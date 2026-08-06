package com.ssafy.yorr.game.yacht.simulation;

import com.ssafy.yorr.game.domain.ScoreCategory;

import java.util.List;

public record YachtSimulationDecision(
        Action action,
        List<Boolean> held,
        ScoreCategory category
) {

    public YachtSimulationDecision {
        if (action == null) {
            throw new IllegalArgumentException("action is required");
        }
        held = held == null ? List.of() : List.copyOf(held);
        if (action == Action.HOLD && (held.size() != 5 || category != null)) {
            throw new IllegalArgumentException("hold decision requires five held flags only");
        }
        if (action == Action.SCORE && (category == null || !held.isEmpty())) {
            throw new IllegalArgumentException("score decision requires a category only");
        }
    }

    public static YachtSimulationDecision hold(List<Boolean> held) {
        return new YachtSimulationDecision(Action.HOLD, held, null);
    }

    public static YachtSimulationDecision score(ScoreCategory category) {
        return new YachtSimulationDecision(Action.SCORE, List.of(), category);
    }

    public enum Action {
        HOLD,
        SCORE
    }
}
