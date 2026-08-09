package com.ssafy.yorr.game.yacht.simulation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class YachtTrainingDataGeneratorTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final YachtTrainingDataGenerator generator = new YachtTrainingDataGenerator();

    @TempDir
    Path tempDir;

    @Test
    void writesSoftLabelCandidateExamplesAsJsonLines() throws Exception {
        Path output = tempDir.resolve("training.jsonl");

        YachtTrainingDatasetSummary summary = generator.generate(
                YachtSimulationSplit.TRAIN,
                1,
                0,
                0,
                output
        );

        List<String> lines = Files.readAllLines(output);
        assertThat(summary.writtenExamples()).isEqualTo(lines.size());
        assertThat(lines).isNotEmpty();

        JsonNode first = JSON.readTree(lines.getFirst());
        assertThat(first.path("split").asText()).isEqualTo("TRAIN");
        assertThat(first.path("dice")).hasSize(5);
        assertThat(first.path("phase").asText()).isEqualTo("EARLY");
        assertThat(first.path("handPattern").asText()).isNotBlank();
        assertThat(first.path("upperBonusPressure").asText()).isNotBlank();
        assertThat(first.path("candidates")).isNotEmpty();
        assertThat(first.path("candidates"))
                .anySatisfy(candidate -> assertThat(candidate.path("chosen").asBoolean()).isTrue());
        assertThat(first.path("candidates"))
                .allSatisfy(candidate -> assertThat(candidate.path("teacherUtility").isNumber()).isTrue());
    }

    @Test
    void limitsExamplesPerStratumWhenRequested() throws Exception {
        Path output = tempDir.resolve("sampled.jsonl");

        YachtTrainingDatasetSummary summary = generator.generate(
                YachtSimulationSplit.TRAIN,
                3,
                0,
                1,
                output
        );

        assertThat(summary.skippedByStratumLimit()).isPositive();
        assertThat(summary.stratumCounts().values()).allSatisfy(count -> assertThat(count).isLessThanOrEqualTo(1));
    }

    @Test
    void rejectsInvalidGenerationOptions() {
        assertThatThrownBy(() -> generator.generate(YachtSimulationSplit.TRAIN, 0, 0, 0, tempDir.resolve("x.jsonl")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("games");
    }
}
