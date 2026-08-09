package com.ssafy.yorr.game.yacht.simulation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.yorr.game.domain.ScoreBoard;
import com.ssafy.yorr.game.domain.ScoreCategory;
import com.ssafy.yorr.game.yacht.DistilledYachtBotPolicy;
import com.ssafy.yorr.game.yacht.ExpectimaxYachtBotPolicy;
import com.ssafy.yorr.game.yacht.LocalYachtBotStrategy;
import com.ssafy.yorr.game.yacht.ScorecardValueEvaluator;
import com.ssafy.yorr.game.yacht.YachtBotPolicy;

import java.util.Arrays;
import java.util.List;

public final class YachtSimulationPolicies {

    private YachtSimulationPolicies() {
    }

    public static YachtSimulationPolicy expectimax() {
        return expectimax(new ExpectimaxYachtBotPolicy(new ScorecardValueEvaluator()));
    }

    static YachtSimulationPolicy expectimax(YachtBotPolicy policy) {
        return adapter("expectimax", policy);
    }

    public static YachtSimulationPolicy distilled() {
        return adapter(
                "distilled",
                new DistilledYachtBotPolicy(
                        new ExpectimaxYachtBotPolicy(new ScorecardValueEvaluator()),
                        new ObjectMapper()
                )
        );
    }

    private static YachtSimulationPolicy adapter(String name, YachtBotPolicy policy) {
        return new YachtSimulationPolicy() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public YachtSimulationDecision decide(ScoreBoard board, List<Integer> dice, int rollCount) {
                ExpectimaxYachtBotPolicy.BotDecision decision = policy.decide(board, dice, rollCount);
                return switch (decision.action()) {
                    case HOLD -> YachtSimulationDecision.hold(decision.held());
                    case SCORE -> YachtSimulationDecision.score(decision.category());
                };
            }

            @Override
            public java.util.Map<String, Double> metrics() {
                return policy.metrics();
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
