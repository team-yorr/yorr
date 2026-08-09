package com.ssafy.yorr.game.yacht;

import com.ssafy.yorr.game.domain.ScoreBoard;

import java.util.List;
import java.util.Map;

public interface YachtBotPolicy {

    ExpectimaxYachtBotPolicy.BotDecision decide(ScoreBoard board, List<Integer> dice, int rollCount);

    default Map<String, Double> metrics() {
        return Map.of();
    }
}
