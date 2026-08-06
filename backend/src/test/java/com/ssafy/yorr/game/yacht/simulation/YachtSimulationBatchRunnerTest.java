package com.ssafy.yorr.game.yacht.simulation;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class YachtSimulationBatchRunnerTest {

    private final YachtSimulationBatchRunner runner = new YachtSimulationBatchRunner();

    @Test
    void aggregatesReproducibleScoreStatisticsForASeedRange() {
        YachtSimulationReport first = runner.run(
                YachtSimulationPolicies.heuristic(), 25, YachtSimulationSplit.TEST, 100
        );
        YachtSimulationReport second = runner.run(
                YachtSimulationPolicies.heuristic(), 25, YachtSimulationSplit.TEST, 100
        );

        assertThat(second.completedGames()).isEqualTo(25);
        assertThat(second.failedGames()).isZero();
        assertThat(second.averageTotalScore()).isEqualTo(first.averageTotalScore());
        assertThat(second.medianTotalScore()).isEqualTo(first.medianTotalScore());
        assertThat(second.totalScoreStandardDeviation()).isEqualTo(first.totalScoreStandardDeviation());
        assertThat(second.upperBonusRate()).isEqualTo(first.upperBonusRate());
        assertThat(second.categories()).isEqualTo(first.categories());
        assertThat(second.categories()).hasSize(12);
    }

    @Test
    void keepsDatasetSplitSeedRangesDisjoint() {
        assertThat(YachtSimulationSplit.TRAIN.seedAt(217))
                .isNotEqualTo(YachtSimulationSplit.VALIDATION.seedAt(217));
        assertThat(YachtSimulationSplit.VALIDATION.seedAt(217))
                .isNotEqualTo(YachtSimulationSplit.TEST.seedAt(217));
    }

    @Test
    void rejectsInvalidBatchSizesAndSeedOffsets() {
        assertThatThrownBy(() -> runner.run(
                YachtSimulationPolicies.heuristic(), 0, YachtSimulationSplit.TEST, 0
        )).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> runner.run(
                YachtSimulationPolicies.heuristic(), 2, YachtSimulationSplit.TEST, Long.MAX_VALUE
        )).isInstanceOf(ArithmeticException.class);
    }
}
