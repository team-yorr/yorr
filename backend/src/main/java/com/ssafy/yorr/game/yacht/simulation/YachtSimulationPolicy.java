package com.ssafy.yorr.game.yacht.simulation;

import com.ssafy.yorr.game.domain.ScoreBoard;

import java.util.List;
import java.util.Map;

/** 운영 WebSocket과 무관하게 Yacht 한 턴의 행동을 결정하는 시뮬레이션 정책 경계. */
public interface YachtSimulationPolicy {

    String name();

    YachtSimulationDecision decide(ScoreBoard board, List<Integer> dice, int rollCount);

    default Map<String, Double> metrics() {
        return Map.of();
    }
}
