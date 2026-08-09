package com.ssafy.yorr.game.yacht.simulation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import java.io.IOException;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

public final class YachtTrainingDataCli {

    private static final ObjectMapper JSON = new ObjectMapper()
            .enable(SerializationFeature.INDENT_OUTPUT);

    private YachtTrainingDataCli() {
    }

    public static void main(String[] args) throws IOException {
        System.out.println(render(execute(args)));
    }

    static YachtTrainingDatasetSummary execute(String[] args) throws IOException {
        Options options = Options.parse(args);
        return new YachtTrainingDataGenerator().generate(
                options.split(),
                options.games(),
                options.seedOffset(),
                options.perStratumLimit(),
                options.output()
        );
    }

    static String render(YachtTrainingDatasetSummary summary) throws JsonProcessingException {
        return JSON.writeValueAsString(summary);
    }

    record Options(
            YachtSimulationSplit split,
            int games,
            long seedOffset,
            int perStratumLimit,
            Path output
    ) {

        private static final int DEFAULT_GAMES = 100;
        private static final Path DEFAULT_OUTPUT = Path.of("build", "yacht-ai", "training-data.jsonl");

        static Options parse(String[] args) {
            Map<String, String> values = values(args);
            YachtSimulationSplit split = YachtSimulationSplit.from(values.getOrDefault("split", "train"));
            int games = Integer.parseInt(values.getOrDefault("games", Integer.toString(DEFAULT_GAMES)));
            long seedOffset = Long.parseLong(values.getOrDefault("seed-offset", "0"));
            int perStratumLimit = Integer.parseInt(values.getOrDefault("per-stratum-limit", "0"));
            Path output = Path.of(values.getOrDefault("output", DEFAULT_OUTPUT.toString()));
            return new Options(split, games, seedOffset, perStratumLimit, output);
        }

        private static Map<String, String> values(String[] args) {
            Map<String, String> values = new HashMap<>();
            for (int index = 0; index < args.length; index++) {
                String option = args[index];
                if (!option.startsWith("--") || index + 1 >= args.length) {
                    throw new IllegalArgumentException("arguments must use --key value pairs");
                }
                String key = option.substring(2);
                if (!isSupported(key)) {
                    throw new IllegalArgumentException("unsupported option: --" + key);
                }
                values.put(key, args[++index]);
            }
            return values;
        }

        private static boolean isSupported(String key) {
            return key.equals("split")
                    || key.equals("games")
                    || key.equals("seed-offset")
                    || key.equals("per-stratum-limit")
                    || key.equals("output");
        }
    }
}
