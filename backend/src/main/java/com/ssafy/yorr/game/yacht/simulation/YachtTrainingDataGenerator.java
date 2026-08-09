package com.ssafy.yorr.game.yacht.simulation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.yorr.game.domain.ScoreBoard;
import com.ssafy.yorr.game.domain.ScoreCategory;
import com.ssafy.yorr.game.domain.YachtScoreCalculator;
import com.ssafy.yorr.game.yacht.ExpectimaxYachtBotPolicy;
import com.ssafy.yorr.game.yacht.ScorecardValueEvaluator;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.SplittableRandom;

public final class YachtTrainingDataGenerator {

    private static final int DICE_COUNT = 5;
    private static final int MAX_ROLL_COUNT = 3;
    private static final int UPPER_BONUS_THRESHOLD = 63;
    private static final ObjectMapper JSON = new ObjectMapper();

    private final ExpectimaxYachtBotPolicy teacher;

    public YachtTrainingDataGenerator() {
        this(new ExpectimaxYachtBotPolicy(new ScorecardValueEvaluator()));
    }

    YachtTrainingDataGenerator(ExpectimaxYachtBotPolicy teacher) {
        this.teacher = teacher;
    }

    public YachtTrainingDatasetSummary generate(
            YachtSimulationSplit split,
            int games,
            long seedOffset,
            int perStratumLimit,
            Path output
    ) throws IOException {
        if (split == null) {
            throw new IllegalArgumentException("split is required");
        }
        if (games <= 0) {
            throw new IllegalArgumentException("games must be positive");
        }
        if (seedOffset < 0) {
            throw new IllegalArgumentException("seed offset must be non-negative");
        }
        if (perStratumLimit < 0) {
            throw new IllegalArgumentException("per-stratum limit must be non-negative");
        }
        if (output == null) {
            throw new IllegalArgumentException("output path is required");
        }

        Path parent = output.toAbsolutePath().getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }

        Map<String, Integer> stratumCounts = new LinkedHashMap<>();
        int written = 0;
        int skipped = 0;
        try (BufferedWriter writer = Files.newBufferedWriter(output)) {
            for (int gameIndex = 0; gameIndex < games; gameIndex++) {
                long seed = split.seedAt(seedOffset + gameIndex);
                GenerationStats stats = simulate(seed, split, perStratumLimit, stratumCounts, writer);
                written += stats.written();
                skipped += stats.skipped();
            }
        }

        return new YachtTrainingDatasetSummary(
                split,
                games,
                seedOffset,
                output,
                written,
                skipped,
                Map.copyOf(stratumCounts)
        );
    }

    private GenerationStats simulate(
            long seed,
            YachtSimulationSplit split,
            int perStratumLimit,
            Map<String, Integer> stratumCounts,
            BufferedWriter writer
    ) throws IOException {
        SplittableRandom random = new SplittableRandom(seed);
        EnumMap<ScoreCategory, Integer> scores = new EnumMap<>(ScoreCategory.class);
        int written = 0;
        int skipped = 0;

        for (int turnNumber = 1; turnNumber <= ScoreCategory.values().length; turnNumber++) {
            List<Integer> dice = rollAll(random);
            int rollCount = 1;

            while (true) {
                ScoreBoard board = toBoard(scores);
                ExpectimaxYachtBotPolicy.BotDecision decision = teacher.decide(board, dice, rollCount);
                YachtTrainingExample example = example(split, seed, turnNumber, rollCount, dice, board, decision);
                String stratumKey = example.stratumKey();
                int count = stratumCounts.getOrDefault(stratumKey, 0);
                if (perStratumLimit == 0 || count < perStratumLimit) {
                    stratumCounts.put(stratumKey, count + 1);
                    writer.write(JSON.writeValueAsString(example));
                    writer.newLine();
                    written++;
                } else {
                    skipped++;
                }

                if (decision.action() == ExpectimaxYachtBotPolicy.Action.SCORE) {
                    ScoreCategory category = requireOpen(scores, decision.category());
                    int score = YachtScoreCalculator.calculateScore(category, toArray(dice));
                    scores.put(category, score);
                    break;
                }
                if (rollCount >= MAX_ROLL_COUNT) {
                    throw new IllegalStateException("teacher tried to reroll after the third roll");
                }
                dice = reroll(dice, decision.held(), random);
                rollCount++;
            }
        }
        return new GenerationStats(written, skipped);
    }

    private YachtTrainingExample example(
            YachtSimulationSplit split,
            long seed,
            int turnNumber,
            int rollCount,
            List<Integer> dice,
            ScoreBoard board,
            ExpectimaxYachtBotPolicy.BotDecision decision
    ) {
        List<YachtTrainingExample.Candidate> candidates = teacher.evaluateCandidates(board, dice, rollCount)
                .stream()
                .map(candidate -> new YachtTrainingExample.Candidate(
                        action(candidate.action()),
                        candidate.held(),
                        candidate.category(),
                        candidate.teacherUtility(),
                        isChosen(candidate, decision)
                ))
                .toList();
        return new YachtTrainingExample(
                split,
                seed,
                turnNumber,
                rollCount,
                dice,
                filledScores(board),
                board.upperSubtotal(),
                board.upperBonus(),
                board.total(),
                phase(turnNumber),
                handPattern(dice),
                upperBonusPressure(board),
                candidates
        );
    }

    private static boolean isChosen(
            ExpectimaxYachtBotPolicy.CandidateEvaluation candidate,
            ExpectimaxYachtBotPolicy.BotDecision decision
    ) {
        if (candidate.action() != decision.action()) {
            return false;
        }
        return switch (candidate.action()) {
            case SCORE -> candidate.category() == decision.category();
            case HOLD -> candidate.held().equals(decision.held());
        };
    }

    private static YachtTrainingExample.Action action(ExpectimaxYachtBotPolicy.Action action) {
        return switch (action) {
            case HOLD -> YachtTrainingExample.Action.HOLD;
            case SCORE -> YachtTrainingExample.Action.SCORE;
        };
    }

    private static YachtTrainingExample.Phase phase(int turnNumber) {
        if (turnNumber <= 4) {
            return YachtTrainingExample.Phase.EARLY;
        }
        if (turnNumber <= 8) {
            return YachtTrainingExample.Phase.MID;
        }
        return YachtTrainingExample.Phase.LATE;
    }

    private static YachtTrainingExample.HandPattern handPattern(List<Integer> dice) {
        int[] counts = counts(dice);
        int max = 0;
        int pairs = 0;
        boolean hasThree = false;
        for (int count : counts) {
            max = Math.max(max, count);
            if (count == 2) {
                pairs++;
            }
            if (count == 3) {
                hasThree = true;
            }
        }
        int[] diceArray = toArray(dice);
        if (max == 5) {
            return YachtTrainingExample.HandPattern.YACHT;
        }
        if (max == 4) {
            return YachtTrainingExample.HandPattern.FOUR_OF_A_KIND;
        }
        if (hasThree && pairs == 1) {
            return YachtTrainingExample.HandPattern.FULL_HOUSE;
        }
        if (ScoreCategory.LARGE_STRAIGHT.isSatisfiedBy(diceArray)) {
            return YachtTrainingExample.HandPattern.LARGE_STRAIGHT;
        }
        if (ScoreCategory.SMALL_STRAIGHT.isSatisfiedBy(diceArray)) {
            return YachtTrainingExample.HandPattern.SMALL_STRAIGHT;
        }
        if (max == 3) {
            return YachtTrainingExample.HandPattern.THREE_OF_A_KIND;
        }
        if (pairs >= 2) {
            return YachtTrainingExample.HandPattern.TWO_PAIR;
        }
        if (pairs == 1) {
            return YachtTrainingExample.HandPattern.PAIR;
        }
        return YachtTrainingExample.HandPattern.MIXED;
    }

    private static YachtTrainingExample.UpperBonusPressure upperBonusPressure(ScoreBoard board) {
        List<ScoreCategory> openUpper = openUpperCategories(board);
        if (openUpper.isEmpty()) {
            return YachtTrainingExample.UpperBonusPressure.CLOSED;
        }
        int needed = UPPER_BONUS_THRESHOLD - board.upperSubtotal();
        if (needed <= 0) {
            return YachtTrainingExample.UpperBonusPressure.SECURED;
        }
        int maxPossible = openUpper.stream()
                .mapToInt(category -> (category.ordinal() + 1) * DICE_COUNT)
                .sum();
        if (needed > maxPossible) {
            return YachtTrainingExample.UpperBonusPressure.UNREACHABLE;
        }
        int remainingSlots = openUpper.size();
        if (needed <= remainingSlots * 3) {
            return YachtTrainingExample.UpperBonusPressure.NEAR_THRESHOLD;
        }
        if (needed >= remainingSlots * 4) {
            return YachtTrainingExample.UpperBonusPressure.PRESSURED;
        }
        return YachtTrainingExample.UpperBonusPressure.NORMAL;
    }

    private static List<ScoreCategory> openUpperCategories(ScoreBoard board) {
        List<ScoreCategory> open = new ArrayList<>();
        for (ScoreCategory category : ScoreCategory.values()) {
            if (category.isUpperCategory() && board.categories().get(category.apiKey()) == null) {
                open.add(category);
            }
        }
        return List.copyOf(open);
    }

    private static Map<String, Integer> filledScores(ScoreBoard board) {
        LinkedHashMap<String, Integer> filled = new LinkedHashMap<>();
        board.categories().forEach((category, score) -> {
            if (score != null) {
                filled.put(category, score);
            }
        });
        return filled;
    }

    private static List<Integer> rollAll(SplittableRandom random) {
        List<Integer> dice = new ArrayList<>(DICE_COUNT);
        for (int index = 0; index < DICE_COUNT; index++) {
            dice.add(random.nextInt(1, 7));
        }
        return List.copyOf(dice);
    }

    private static List<Integer> reroll(
            List<Integer> dice,
            List<Boolean> held,
            SplittableRandom random
    ) {
        List<Integer> next = new ArrayList<>(DICE_COUNT);
        for (int index = 0; index < DICE_COUNT; index++) {
            next.add(Boolean.TRUE.equals(held.get(index))
                    ? dice.get(index)
                    : random.nextInt(1, 7));
        }
        return List.copyOf(next);
    }

    private static ScoreCategory requireOpen(
            Map<ScoreCategory, Integer> scores,
            ScoreCategory category
    ) {
        if (category == null || scores.containsKey(category)) {
            throw new IllegalStateException("teacher selected a filled or missing category: " + category);
        }
        return category;
    }

    private static ScoreBoard toBoard(Map<ScoreCategory, Integer> scores) {
        LinkedHashMap<String, Integer> categories = new LinkedHashMap<>();
        scores.forEach((category, score) -> categories.put(category.apiKey(), score));
        int upperSubtotal = YachtScoreCalculator.calculateUpperSubtotal(scores);
        int upperBonus = YachtScoreCalculator.calculateUpperBonus(scores);
        int total = scores.values().stream().mapToInt(Integer::intValue).sum() + upperBonus;
        return new ScoreBoard(categories, upperSubtotal, upperBonus, total);
    }

    private static int[] counts(List<Integer> dice) {
        int[] counts = new int[6];
        dice.forEach(die -> counts[die - 1]++);
        return counts;
    }

    private static int[] toArray(List<Integer> dice) {
        return dice.stream().mapToInt(Integer::intValue).toArray();
    }

    private record GenerationStats(int written, int skipped) {
    }
}
