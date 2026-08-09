package com.ssafy.yorr.game.yacht.simulation;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public record YachtSimulationReport(
        String policy,
        YachtSimulationSplit split,
        long seedOffset,
        int requestedGames,
        int completedGames,
        int failedGames,
        double averageTotalScore,
        double medianTotalScore,
        double totalScoreStandardDeviation,
        double upperBonusRate,
        double averageZeroScoreCount,
        double averageDecisionMicros,
        long elapsedMillis,
        Map<String, CategoryStatistics> categories,
        Map<String, Double> policyMetrics
) {

    public YachtSimulationReport {
        categories = Collections.unmodifiableMap(new LinkedHashMap<>(categories));
        policyMetrics = Collections.unmodifiableMap(new LinkedHashMap<>(policyMetrics));
    }

    public record CategoryStatistics(double averageScore, double zeroScoreRate) {
    }
}
