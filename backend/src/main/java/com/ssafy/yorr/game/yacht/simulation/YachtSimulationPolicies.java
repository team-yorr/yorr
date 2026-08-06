package com.ssafy.yorr.game.yacht.simulation;

import com.ssafy.yorr.game.domain.ScoreBoard;
import com.ssafy.yorr.game.domain.ScoreCategory;
import com.ssafy.yorr.game.yacht.ExpectimaxYachtBotPolicy;
import com.ssafy.yorr.game.yacht.LocalYachtBotStrategy;
import com.ssafy.yorr.game.yacht.ScorecardValueEvaluator;

import java.util.Arrays;
import java.util.List;

public final class YachtSimulationPolicies {

    private YachtSimulationPolicies() {
    }

    public static YachtSimulationPolicy expectimax() {
        return expectimax(new ExpectimaxYachtBotPolicy(new ScorecardValueEvaluator()));
    }

    static YachtSimulationPolicy expectimax(ExpectimaxYachtBotPolicy policy) {
        return new YachtSimulationPolicy() {
            @Override
            public String name() {
                return "expectimax";
            }

            @Override
            public YachtSimulationDecision decide(ScoreBoard board, List<Integer> dice, int rollCount) {
                ExpectimaxYachtBotPolicy.BotDecision decision = policy.decide(board, dice, rollCount);
                return switch (decision.action()) {
                    case HOLD -> YachtSimulationDecision.hold(decision.held());
                    case SCORE -> YachtSimulationDecision.score(decision.category());
                };
            }
        };
    }

    public static YachtSimulationPolicy heuristic() {
        return heuristic(new LocalYachtBotStrategy());
    }

    static YachtSimulationPolicy heuristic(LocalYachtBotStrategy strategy) {
        return new YachtSimulationPolicy() {
            @Override
            public String name() {
                return "heuristic";
            }

            @Override
            public YachtSimulationDecision decide(ScoreBoard board, List<Integer> dice, int rollCount) {
                List<ScoreCategory> open = openCategories(board);
                if (rollCount >= 3) {
                    return YachtSimulationDecision.score(strategy.chooseCategory(dice, open));
                }
                List<Boolean> held = strategy.chooseHeld(dice);
                if (held.stream().allMatch(Boolean.TRUE::equals)) {
                    return YachtSimulationDecision.score(strategy.chooseCategory(dice, open));
                }
                return YachtSimulationDecision.hold(held);
            }
        };
    }

    private static List<ScoreCategory> openCategories(ScoreBoard board) {
        return Arrays.stream(ScoreCategory.values())
                .filter(category -> board.categories().get(category.apiKey()) == null)
                .toList();
    }
}
