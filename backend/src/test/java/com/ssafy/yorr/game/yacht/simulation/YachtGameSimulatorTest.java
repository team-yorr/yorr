package com.ssafy.yorr.game.yacht.simulation;

import com.ssafy.yorr.game.domain.ScoreBoard;
import com.ssafy.yorr.game.domain.ScoreCategory;
import com.ssafy.yorr.game.domain.YachtScoreCalculator;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class YachtGameSimulatorTest {

    private final YachtGameSimulator simulator = new YachtGameSimulator();

    @Test
    void repeatsTheSameGameForTheSameSeedAndPolicy() {
        YachtSimulationResult first = simulator.simulate(20260806L, firstOpenAfterThirdRoll());
        YachtSimulationResult second = simulator.simulate(20260806L, firstOpenAfterThirdRoll());

        assertThat(second.categoryScores()).isEqualTo(first.categoryScores());
        assertThat(second.turns()).isEqualTo(first.turns());
        assertThat(second.totalScore()).isEqualTo(first.totalScore());
    }

    @Test
    void completesEveryCategoryAndUsesTheProductionScoreCalculator() {
        YachtSimulationResult result = simulator.simulate(217L, firstOpenAfterThirdRoll());

        assertThat(result.turns()).hasSize(ScoreCategory.values().length);
        assertThat(result.categoryScores()).containsOnlyKeys(ScoreCategory.values());
        assertThat(result.turns()).allSatisfy(turn ->
                assertThat(turn.score()).isEqualTo(YachtScoreCalculator.calculateScore(
                        turn.category(),
                        turn.dice().stream().mapToInt(Integer::intValue).toArray()
                ))
        );
        assertThat(result.upperSubtotal())
                .isEqualTo(YachtScoreCalculator.calculateUpperSubtotal(result.categoryScores()));
        assertThat(result.upperBonus())
                .isEqualTo(YachtScoreCalculator.calculateUpperBonus(result.categoryScores()));
        assertThat(result.totalScore()).isEqualTo(
                result.categoryScores().values().stream().mapToInt(Integer::intValue).sum()
                        + result.upperBonus()
        );
    }

    @Test
    void rejectsAClosedCategorySelectedAgain() {
        YachtSimulationPolicy invalid = new YachtSimulationPolicy() {
            @Override
            public String name() {
                return "invalid";
            }

            @Override
            public YachtSimulationDecision decide(ScoreBoard board, List<Integer> dice, int rollCount) {
                return YachtSimulationDecision.score(ScoreCategory.ACES);
            }
        };

        assertThatThrownBy(() -> simulator.simulate(1L, invalid))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("filled");
    }

    private static YachtSimulationPolicy firstOpenAfterThirdRoll() {
        return new YachtSimulationPolicy() {
            @Override
            public String name() {
                return "test-first-open";
            }

            @Override
            public YachtSimulationDecision decide(ScoreBoard board, List<Integer> dice, int rollCount) {
                if (rollCount < 3) {
                    return YachtSimulationDecision.hold(List.of(false, false, false, false, false));
                }
                ScoreCategory category = Arrays.stream(ScoreCategory.values())
                        .filter(candidate -> board.categories().get(candidate.apiKey()) == null)
                        .findFirst()
                        .orElseThrow();
                return YachtSimulationDecision.score(category);
            }
        };
    }
}
