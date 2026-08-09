package com.ssafy.yorr.game.yacht.simulation;

import java.nio.file.Path;
import java.util.Map;

public record YachtTrainingDatasetSummary(
        YachtSimulationSplit split,
        int games,
        long seedOffset,
        Path output,
        int writtenExamples,
        int skippedByStratumLimit,
        Map<String, Integer> stratumCounts
) {
}
