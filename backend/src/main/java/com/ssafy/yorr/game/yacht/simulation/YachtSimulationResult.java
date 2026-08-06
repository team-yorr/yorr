package com.ssafy.yorr.game.yacht.simulation;

import com.ssafy.yorr.game.domain.ScoreCategory;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

public record YachtSimulationResult(
        long seed,
        Map<ScoreCategory, Integer> categoryScores,
        List<TurnResult> turns,
        int upperSubtotal,
        int upperBonus,
        int totalScore,
        int decisionCount,
        long decisionNanos
) {

    public YachtSimulationResult {
        categoryScores = Map.copyOf(new EnumMap<>(categoryScores));
        turns = List.copyOf(turns);
    }

    public int zeroScoreCount() {
        return (int) categoryScores.values().stream().filter(score -> score == 0).count();
    }

    public record TurnResult(
            int turnNumber,
            int rollCount,
            List<Integer> dice,
            ScoreCategory category,
            int score
    ) {

        public TurnResult {
            dice = List.copyOf(dice);
        }
    }
}
