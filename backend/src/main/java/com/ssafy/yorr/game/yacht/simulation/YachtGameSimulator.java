package com.ssafy.yorr.game.yacht.simulation;

import com.ssafy.yorr.game.domain.ScoreBoard;
import com.ssafy.yorr.game.domain.ScoreCategory;
import com.ssafy.yorr.game.domain.YachtScoreCalculator;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.SplittableRandom;

public final class YachtGameSimulator {

    private static final int DICE_COUNT = 5;
    private static final int MAX_ROLL_COUNT = 3;

    public YachtSimulationResult simulate(long seed, YachtSimulationPolicy policy) {
        if (policy == null) {
            throw new IllegalArgumentException("policy is required");
        }

        SplittableRandom random = new SplittableRandom(seed);
        EnumMap<ScoreCategory, Integer> scores = new EnumMap<>(ScoreCategory.class);
        List<YachtSimulationResult.TurnResult> turns = new ArrayList<>(ScoreCategory.values().length);
        int decisionCount = 0;
        long decisionNanos = 0;

        for (int turnNumber = 1; turnNumber <= ScoreCategory.values().length; turnNumber++) {
            List<Integer> dice = rollAll(random);
            int rollCount = 1;

            while (true) {
                long startedAt = System.nanoTime();
                YachtSimulationDecision decision = policy.decide(toBoard(scores), dice, rollCount);
                decisionNanos += System.nanoTime() - startedAt;
                decisionCount++;

                if (decision.action() == YachtSimulationDecision.Action.SCORE) {
                    ScoreCategory category = requireOpen(scores, decision.category());
                    int score = YachtScoreCalculator.calculateScore(category, toArray(dice));
                    scores.put(category, score);
                    turns.add(new YachtSimulationResult.TurnResult(
                            turnNumber,
                            rollCount,
                            dice,
                            category,
                            score
                    ));
                    break;
                }

                if (rollCount >= MAX_ROLL_COUNT) {
                    throw new IllegalStateException("policy tried to reroll after the third roll");
                }
                if (decision.held().stream().allMatch(Boolean.TRUE::equals)) {
                    throw new IllegalStateException("policy tried to reroll with every die held");
                }
                dice = reroll(dice, decision.held(), random);
                rollCount++;
            }
        }

        int upperSubtotal = YachtScoreCalculator.calculateUpperSubtotal(scores);
        int upperBonus = YachtScoreCalculator.calculateUpperBonus(scores);
        int totalScore = scores.values().stream().mapToInt(Integer::intValue).sum() + upperBonus;
        return new YachtSimulationResult(
                seed,
                scores,
                turns,
                upperSubtotal,
                upperBonus,
                totalScore,
                decisionCount,
                decisionNanos
        );
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
        if (held.size() != DICE_COUNT) {
            throw new IllegalArgumentException("exactly five held flags are required");
        }
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
            throw new IllegalStateException("policy selected a filled or missing category: " + category);
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

    private static int[] toArray(List<Integer> dice) {
        return dice.stream().mapToInt(Integer::intValue).toArray();
    }
}
