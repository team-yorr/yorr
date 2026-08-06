package com.ssafy.yorr.game.yacht.simulation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public final class YachtSimulationCli {

    private static final ObjectMapper JSON = new ObjectMapper()
            .enable(SerializationFeature.INDENT_OUTPUT);

    private YachtSimulationCli() {
    }

    public static void main(String[] args) throws JsonProcessingException {
        System.out.println(render(execute(args)));
    }

    static YachtSimulationReport execute(String[] args) {
        Options options = Options.parse(args);
        YachtSimulationPolicy policy = switch (options.policy()) {
            case "heuristic" -> YachtSimulationPolicies.heuristic();
            case "expectimax" -> YachtSimulationPolicies.expectimax();
            default -> throw new IllegalArgumentException("unsupported policy: " + options.policy());
        };
        return new YachtSimulationBatchRunner().run(
                policy,
                options.games(),
                options.split(),
                options.seedOffset()
        );
    }

    static String render(YachtSimulationReport report) throws JsonProcessingException {
        return JSON.writeValueAsString(report);
    }

    record Options(String policy, int games, YachtSimulationSplit split, long seedOffset) {

        private static final int DEFAULT_GAMES = 100;

        static Options parse(String[] args) {
            Map<String, String> values = values(args);
            String policy = values.getOrDefault("policy", "heuristic")
                    .toLowerCase(Locale.ROOT);
            int games = Integer.parseInt(values.getOrDefault("games", Integer.toString(DEFAULT_GAMES)));
            YachtSimulationSplit split = YachtSimulationSplit.from(values.getOrDefault("split", "test"));
            long seedOffset = Long.parseLong(values.getOrDefault("seed-offset", "0"));
            return new Options(policy, games, split, seedOffset);
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
            return key.equals("policy")
                    || key.equals("games")
                    || key.equals("split")
                    || key.equals("seed-offset");
        }
    }
}
