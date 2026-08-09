package com.ssafy.yorr.game.yacht.simulation;

import com.ssafy.yorr.game.domain.ScoreCategory;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class YachtSimulationBatchRunner {

    private final YachtGameSimulator simulator;

    public YachtSimulationBatchRunner() {
        this(new YachtGameSimulator());
    }

    YachtSimulationBatchRunner(YachtGameSimulator simulator) {
        this.simulator = simulator;
    }

    public YachtSimulationReport run(
            YachtSimulationPolicy policy,
            int games,
            YachtSimulationSplit split,
            long seedOffset
    ) {
        if (policy == null || split == null) {
            throw new IllegalArgumentException("policy and split are required");
        }
        if (games <= 0) {
            throw new IllegalArgumentException("games must be positive");
        }
        split.seedAt(Math.addExact(seedOffset, games - 1L));

        long startedAt = System.nanoTime();
        List<YachtSimulationResult> completed = new ArrayList<>(games);
        int failures = 0;
        for (int index = 0; index < games; index++) {
            try {
                completed.add(simulator.simulate(split.seedAt(seedOffset + index), policy));
            } catch (RuntimeException failure) {
                failures++;
            }
        }
        long elapsedMillis = (System.nanoTime() - startedAt) / 1_000_000;
        return report(policy, split, seedOffset, games, completed, failures, elapsedMillis);
    }

    private static YachtSimulationReport report(
            YachtSimulationPolicy policy,
            YachtSimulationSplit split,
            long seedOffset,
            int requestedGames,
            List<YachtSimulationResult> completed,
            int failures,
            long elapsedMillis
    ) {
        if (completed.isEmpty()) {
            return new YachtSimulationReport(
                    policy.name(), split, seedOffset, requestedGames, 0, failures,
                    0, 0, 0, 0, 0, 0, elapsedMillis, emptyCategoryStatistics(), policy.metrics()
            );
        }

        double averageTotal = completed.stream()
                .mapToInt(YachtSimulationResult::totalScore)
                .average()
                .orElseThrow();
        double variance = completed.stream()
                .mapToDouble(result -> Math.pow(result.totalScore() - averageTotal, 2))
                .average()
                .orElseThrow();
        long decisions = completed.stream().mapToLong(YachtSimulationResult::decisionCount).sum();
        long decisionNanos = completed.stream().mapToLong(YachtSimulationResult::decisionNanos).sum();

        return new YachtSimulationReport(
                policy.name(),
                split,
                seedOffset,
                requestedGames,
                completed.size(),
                failures,
                averageTotal,
                median(completed),
                Math.sqrt(variance),
                completed.stream().filter(result -> result.upperBonus() > 0).count()
                        / (double) completed.size(),
                completed.stream().mapToInt(YachtSimulationResult::zeroScoreCount).average().orElseThrow(),
                decisions == 0 ? 0 : decisionNanos / (double) decisions / 1_000,
                elapsedMillis,
                categoryStatistics(completed),
                policy.metrics()
        );
    }

    private static double median(List<YachtSimulationResult> results) {
        List<Integer> totals = results.stream()
                .map(YachtSimulationResult::totalScore)
                .sorted(Comparator.naturalOrder())
                .toList();
        int middle = totals.size() / 2;
        if (totals.size() % 2 == 1) {
            return totals.get(middle);
        }
        return (totals.get(middle - 1) + totals.get(middle)) / 2.0;
    }

    private static Map<String, YachtSimulationReport.CategoryStatistics> categoryStatistics(
            List<YachtSimulationResult> results
    ) {
        LinkedHashMap<String, YachtSimulationReport.CategoryStatistics> statistics = new LinkedHashMap<>();
        for (ScoreCategory category : ScoreCategory.values()) {
            double average = results.stream()
                    .mapToInt(result -> result.categoryScores().get(category))
                    .average()
                    .orElseThrow();
            double zeroRate = results.stream()
                    .filter(result -> result.categoryScores().get(category) == 0)
                    .count() / (double) results.size();
            statistics.put(category.apiKey(), new YachtSimulationReport.CategoryStatistics(average, zeroRate));
        }
        return statistics;
    }

    private static Map<String, YachtSimulationReport.CategoryStatistics> emptyCategoryStatistics() {
        LinkedHashMap<String, YachtSimulationReport.CategoryStatistics> statistics = new LinkedHashMap<>();
        for (ScoreCategory category : ScoreCategory.values()) {
            statistics.put(category.apiKey(), new YachtSimulationReport.CategoryStatistics(0, 0));
        }
        return statistics;
    }
}
