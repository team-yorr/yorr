package com.ssafy.yorr.game.yacht.simulation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class YachtSimulationCliTest {

    private final ObjectMapper json = new ObjectMapper();

    @Test
    void acceptsPolicyBatchSizeAndDisjointSeedSplitOptions() {
        YachtSimulationCli.Options options = YachtSimulationCli.Options.parse(new String[]{
                "--policy", "expectimax",
                "--games", "17",
                "--split", "validation",
                "--seed-offset", "217"
        });

        assertThat(options.policy()).isEqualTo("expectimax");
        assertThat(options.games()).isEqualTo(17);
        assertThat(options.split()).isEqualTo(YachtSimulationSplit.VALIDATION);
        assertThat(options.seedOffset()).isEqualTo(217);
    }

    @Test
    void executesAndRendersAJsonReport() throws Exception {
        YachtSimulationReport report = YachtSimulationCli.execute(new String[]{
                "--policy", "heuristic",
                "--games", "3",
                "--split", "test",
                "--seed-offset", "10"
        });

        JsonNode rendered = json.readTree(YachtSimulationCli.render(report));
        assertThat(rendered.path("policy").asText()).isEqualTo("heuristic");
        assertThat(rendered.path("completedGames").asInt()).isEqualTo(3);
        assertThat(rendered.path("categories").size()).isEqualTo(12);
    }

    @Test
    void rejectsUnknownOptionsAndPolicies() {
        assertThatThrownBy(() -> YachtSimulationCli.Options.parse(new String[]{"--unknown", "value"}))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unsupported option");
        assertThatThrownBy(() -> YachtSimulationCli.execute(new String[]{"--policy", "random"}))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unsupported policy");
    }
}
