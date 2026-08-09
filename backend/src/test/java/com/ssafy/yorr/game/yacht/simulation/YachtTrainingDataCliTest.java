package com.ssafy.yorr.game.yacht.simulation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class YachtTrainingDataCliTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @TempDir
    Path tempDir;

    @Test
    void parsesOptionsAndGeneratesJsonlDataset() throws Exception {
        Path output = tempDir.resolve("training.jsonl");

        YachtTrainingDatasetSummary summary = YachtTrainingDataCli.execute(new String[]{
                "--split", "validation",
                "--games", "1",
                "--seed-offset", "7",
                "--per-stratum-limit", "2",
                "--output", output.toString()
        });

        assertThat(summary.split()).isEqualTo(YachtSimulationSplit.VALIDATION);
        assertThat(summary.games()).isEqualTo(1);
        assertThat(summary.seedOffset()).isEqualTo(7);
        assertThat(Files.readAllLines(output)).hasSize(summary.writtenExamples());

        JsonNode rendered = JSON.readTree(YachtTrainingDataCli.render(summary));
        assertThat(rendered.path("writtenExamples").asInt()).isEqualTo(summary.writtenExamples());
    }

    @Test
    void rejectsUnknownOptions() {
        assertThatThrownBy(() -> YachtTrainingDataCli.execute(new String[]{"--unknown", "value"}))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unsupported option");
    }
}
