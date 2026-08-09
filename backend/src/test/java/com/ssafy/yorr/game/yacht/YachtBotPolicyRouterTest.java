package com.ssafy.yorr.game.yacht;

import com.ssafy.yorr.game.domain.ScoreBoard;
import com.ssafy.yorr.game.domain.ScoreCategory;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class YachtBotPolicyRouterTest {

    private final ExpectimaxYachtBotPolicy expectimax = mock(ExpectimaxYachtBotPolicy.class);
    private final DistilledYachtBotPolicy distilled = mock(DistilledYachtBotPolicy.class);

    @Test
    void usesExpectimaxByDefaultToPreserveProductionBotQuality() {
        ScoreBoard board = emptyBoard();
        List<Integer> dice = List.of(1, 2, 3, 4, 5);
        var expected = ExpectimaxYachtBotPolicy.BotDecision.score(ScoreCategory.LARGE_STRAIGHT, 30);
        when(expectimax.decide(board, dice, 3)).thenReturn(expected);

        var router = new YachtBotPolicyRouter("expectimax", expectimax, distilled);

        assertThat(router.decide(board, dice, 3)).isEqualTo(expected);
    }

    @Test
    void canRouteToTheDistilledPolicyWhenConfigured() {
        ScoreBoard board = emptyBoard();
        List<Integer> dice = List.of(6, 6, 6, 1, 2);
        var expected = ExpectimaxYachtBotPolicy.BotDecision.hold(
                List.of(true, true, true, false, false),
                42
        );
        when(distilled.decide(board, dice, 1)).thenReturn(expected);

        var router = new YachtBotPolicyRouter("distilled", expectimax, distilled);

        assertThat(router.decide(board, dice, 1)).isEqualTo(expected);
    }

    private static ScoreBoard emptyBoard() {
        return new ScoreBoard(Map.of(), 0, 0, 0);
    }
}
