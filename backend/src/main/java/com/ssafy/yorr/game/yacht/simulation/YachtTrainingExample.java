package com.ssafy.yorr.game.yacht.simulation;

import com.ssafy.yorr.game.domain.ScoreCategory;

import java.util.List;
import java.util.Map;

public record YachtTrainingExample(
        YachtSimulationSplit split,
        long seed,
        int turnNumber,
        int rollCount,
        List<Integer> dice,
        Map<String, Integer> scorecard,
        int upperSubtotal,
        int upperBonus,
        int total,
        Phase phase,
        HandPattern handPattern,
        UpperBonusPressure upperBonusPressure,
        List<Candidate> candidates
) {

    public YachtTrainingExample {
        dice = List.copyOf(dice);
        scorecard = Map.copyOf(scorecard);
        candidates = List.copyOf(candidates);
    }

    public String stratumKey() {
        return phase + "|" + handPattern + "|" + upperBonusPressure;
    }

    public enum Phase {
        EARLY,
        MID,
        LATE
    }

    public enum HandPattern {
        YACHT,
        FOUR_OF_A_KIND,
        FULL_HOUSE,
        LARGE_STRAIGHT,
        SMALL_STRAIGHT,
        THREE_OF_A_KIND,
        TWO_PAIR,
        PAIR,
        MIXED
    }

    public enum UpperBonusPressure {
        CLOSED,
        SECURED,
        UNREACHABLE,
        NEAR_THRESHOLD,
        PRESSURED,
        NORMAL
    }

    public record Candidate(
            Action action,
            List<Boolean> held,
            ScoreCategory category,
            double teacherUtility,
            boolean chosen
    ) {

        public Candidate {
            held = List.copyOf(held);
        }
    }

    public enum Action {
        HOLD,
        SCORE
    }
}
