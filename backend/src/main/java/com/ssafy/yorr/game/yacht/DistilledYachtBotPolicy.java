package com.ssafy.yorr.game.yacht;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.yorr.game.domain.ScoreBoard;
import com.ssafy.yorr.game.domain.ScoreCategory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

@Component
public class DistilledYachtBotPolicy implements YachtBotPolicy {

    private static final Logger log = LoggerFactory.getLogger(DistilledYachtBotPolicy.class);
    private static final String MODEL_PATH = "yacht-ai/distilled-yacht-bot-model.json";
    private static final int FEATURE_VERSION = 1;
    private static final int DICE_COUNT = 5;
    private static final int FACE_COUNT = 6;

    private final ExpectimaxYachtBotPolicy fallback;
    private final Model model;
    private final AtomicLong modelDecisions = new AtomicLong();
    private final AtomicLong fallbackDecisions = new AtomicLong();
    private final AtomicLong missingModelFallbacks = new AtomicLong();
    private final AtomicLong marginFallbacks = new AtomicLong();
    private final AtomicLong emptyCandidateFallbacks = new AtomicLong();
    private final AtomicLong errorFallbacks = new AtomicLong();

    public DistilledYachtBotPolicy(ExpectimaxYachtBotPolicy fallback, ObjectMapper mapper) {
        this(fallback, loadModel(mapper));
    }

    DistilledYachtBotPolicy(ExpectimaxYachtBotPolicy fallback, Model model) {
        this.fallback = fallback;
        this.model = model;
    }

    @Override
    public ExpectimaxYachtBotPolicy.BotDecision decide(ScoreBoard board, List<Integer> dice, int rollCount) {
        if (model == null) {
            return fallbackDecision(board, dice, rollCount, missingModelFallbacks);
        }
        try {
            List<ScoredCandidate> scored = fallback.legalCandidates(board, dice, rollCount)
                    .stream()
                    .map(candidate -> new ScoredCandidate(
                            candidate,
                            predict(candidateFeatures(board, dice, rollCount, candidate))
                    ))
                    .filter(candidate -> Double.isFinite(candidate.predictedUtility()))
                    .sorted(Comparator.comparingDouble(ScoredCandidate::predictedUtility).reversed())
                    .toList();
            if (scored.isEmpty()) {
                return fallbackDecision(board, dice, rollCount, emptyCandidateFallbacks);
            }
            double margin = scored.size() == 1
                    ? Double.POSITIVE_INFINITY
                    : scored.get(0).predictedUtility() - scored.get(1).predictedUtility();
            if (margin < model.confidenceMargin()) {
                return fallbackDecision(board, dice, rollCount, marginFallbacks);
            }
            ScoredCandidate best = scored.get(0);
            modelDecisions.incrementAndGet();
            return switch (best.candidate().action()) {
                case SCORE -> ExpectimaxYachtBotPolicy.BotDecision.score(
                        best.candidate().category(),
                        best.predictedUtility()
                );
                case HOLD -> ExpectimaxYachtBotPolicy.BotDecision.hold(
                        best.candidate().held(),
                        best.predictedUtility()
                );
            };
        } catch (RuntimeException exception) {
            log.warn("Distilled yacht bot inference failed; falling back to Expectimax.", exception);
            return fallbackDecision(board, dice, rollCount, errorFallbacks);
        }
    }

    @Override
    public Map<String, Double> metrics() {
        long model = modelDecisions.get();
        long fallback = fallbackDecisions.get();
        long total = model + fallback;
        LinkedHashMap<String, Double> metrics = new LinkedHashMap<>();
        metrics.put("modelDecisions", (double) model);
        metrics.put("fallbackDecisions", (double) fallback);
        metrics.put("totalDecisions", (double) total);
        metrics.put("modelDecisionRate", rate(model, total));
        metrics.put("fallbackRate", rate(fallback, total));
        metrics.put("missingModelFallbacks", (double) missingModelFallbacks.get());
        metrics.put("marginFallbacks", (double) marginFallbacks.get());
        metrics.put("marginFallbackRate", rate(marginFallbacks.get(), total));
        metrics.put("emptyCandidateFallbacks", (double) emptyCandidateFallbacks.get());
        metrics.put("errorFallbacks", (double) errorFallbacks.get());
        return Map.copyOf(metrics);
    }

    boolean loadedModel() {
        return model != null;
    }

    private ExpectimaxYachtBotPolicy.BotDecision fallbackDecision(
            ScoreBoard board,
            List<Integer> dice,
            int rollCount,
            AtomicLong reason
    ) {
        fallbackDecisions.incrementAndGet();
        reason.incrementAndGet();
        return fallback.decide(board, dice, rollCount);
    }

    private static double rate(long count, long total) {
        return total == 0 ? 0 : count / (double) total;
    }

    private double predict(double[] features) {
        if (features.length != model.inputSize()
                || model.featureMean().length != features.length
                || model.featureStd().length != features.length) {
            throw new IllegalStateException("distilled yacht model feature shape mismatch");
        }
        double[] values = new double[features.length];
        for (int index = 0; index < features.length; index++) {
            double std = model.featureStd()[index] == 0 ? 1 : model.featureStd()[index];
            values[index] = (features[index] - model.featureMean()[index]) / std;
        }
        for (int layerIndex = 0; layerIndex < model.layers().length; layerIndex++) {
            Layer layer = model.layers()[layerIndex];
            double[] next = new double[layer.biases().length];
            for (int output = 0; output < next.length; output++) {
                double sum = layer.biases()[output];
                for (int input = 0; input < values.length; input++) {
                    sum += values[input] * layer.weights()[input][output];
                }
                next[output] = layerIndex == model.layers().length - 1
                        ? sum
                        : Math.max(0, sum);
            }
            values = next;
        }
        return values[0] * model.targetStd() + model.targetMean();
    }

    private static double[] candidateFeatures(
            ScoreBoard board,
            List<Integer> dice,
            int rollCount,
            ExpectimaxYachtBotPolicy.CandidateEvaluation candidate
    ) {
        double[] features = new double[62];
        int cursor = 0;

        int[] diceCounts = counts(dice);
        for (int count : diceCounts) {
            features[cursor++] = count / (double) DICE_COUNT;
        }
        features[cursor++] = (rollCount - 1) / 2.0;

        int filledCount = 0;
        int openUpperCount = 0;
        for (ScoreCategory category : ScoreCategory.values()) {
            Integer score = board.categories().get(category.apiKey());
            features[cursor++] = score == null ? 0 : 1;
            if (score != null) {
                filledCount++;
            }
            if (category.isUpperCategory() && score == null) {
                openUpperCount++;
            }
        }
        for (ScoreCategory category : ScoreCategory.values()) {
            Integer score = board.categories().get(category.apiKey());
            features[cursor++] = score == null ? 0 : score / 50.0;
        }
        features[cursor++] = board.upperSubtotal() / 63.0;
        features[cursor++] = board.upperBonus() / 35.0;
        features[cursor++] = board.total() / 300.0;
        features[cursor++] = filledCount / (double) ScoreCategory.values().length;
        features[cursor++] = openUpperCount / 6.0;

        features[cursor++] = candidate.action() == ExpectimaxYachtBotPolicy.Action.HOLD ? 1 : 0;
        features[cursor++] = candidate.action() == ExpectimaxYachtBotPolicy.Action.SCORE ? 1 : 0;

        for (ScoreCategory category : ScoreCategory.values()) {
            features[cursor++] = candidate.category() == category ? 1 : 0;
        }

        List<Boolean> held = candidate.held();
        int[] heldCounts = new int[FACE_COUNT];
        int heldCount = 0;
        for (int index = 0; index < DICE_COUNT; index++) {
            boolean isHeld = index < held.size() && Boolean.TRUE.equals(held.get(index));
            features[cursor++] = isHeld ? 1 : 0;
            if (isHeld) {
                heldCounts[dice.get(index) - 1]++;
                heldCount++;
            }
        }
        for (int count : heldCounts) {
            features[cursor++] = count / (double) DICE_COUNT;
        }
        features[cursor] = heldCount / (double) DICE_COUNT;
        return features;
    }

    private static int[] counts(List<Integer> dice) {
        int[] counts = new int[FACE_COUNT];
        dice.forEach(die -> counts[die - 1]++);
        return counts;
    }

    private static Model loadModel(ObjectMapper mapper) {
        ClassPathResource resource = new ClassPathResource(MODEL_PATH);
        if (!resource.exists()) {
            log.info("Distilled yacht bot model was not found; Expectimax fallback will be used.");
            return null;
        }
        try (InputStream input = resource.getInputStream()) {
            Model model = mapper.readValue(input, Model.class);
            if (model.featureVersion() != FEATURE_VERSION) {
                throw new IllegalStateException("unsupported distilled yacht model feature version");
            }
            return model;
        } catch (IOException exception) {
            throw new IllegalStateException("failed to load distilled yacht bot model", exception);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Model(
            int featureVersion,
            int inputSize,
            double confidenceMargin,
            double[] featureMean,
            double[] featureStd,
            double targetMean,
            double targetStd,
            Layer[] layers
    ) {
        Model {
            featureMean = Arrays.copyOf(featureMean, featureMean.length);
            featureStd = Arrays.copyOf(featureStd, featureStd.length);
            layers = Arrays.copyOf(layers, layers.length);
        }
    }

    record Layer(double[][] weights, double[] biases) {
        Layer {
            weights = Arrays.stream(weights)
                    .map(row -> Arrays.copyOf(row, row.length))
                    .toArray(double[][]::new);
            biases = Arrays.copyOf(biases, biases.length);
        }
    }

    private record ScoredCandidate(
            ExpectimaxYachtBotPolicy.CandidateEvaluation candidate,
            double predictedUtility
    ) {
    }
}
