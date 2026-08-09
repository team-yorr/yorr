package com.ssafy.yorr.game.yacht.simulation;

import com.ssafy.yorr.game.domain.ScoreCategory;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class YachtSimulationPoliciesTest {

    private final YachtGameSimulator simulator = new YachtGameSimulator();

    @Test
    void completesAGameWithTheProductionHeuristicPolicy() {
        YachtSimulationResult result = simulator.simulate(11L, YachtSimulationPolicies.heuristic());

        assertThat(result.categoryScores()).hasSize(ScoreCategory.values().length);
    }

    @Test
    void completesAGameWithTheProductionExpectimaxPolicy() {
        YachtSimulationResult result = simulator.simulate(12L, YachtSimulationPolicies.expectimax());

        assertThat(result.categoryScores()).hasSize(ScoreCategory.values().length);
    }

    @Test
    void completesAGameWithTheDistilledPolicyAndExpectimaxFallback() {
        YachtSimulationResult result = simulator.simulate(13L, YachtSimulationPolicies.distilled());

        assertThat(result.categoryScores()).hasSize(ScoreCategory.values().length);
    }
}
