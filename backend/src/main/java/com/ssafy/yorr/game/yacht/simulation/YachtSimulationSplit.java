package com.ssafy.yorr.game.yacht.simulation;

/** 학습·튜닝·최종 평가 사이의 난수 중복을 구조적으로 막는 seed 영역. */
public enum YachtSimulationSplit {
    TRAIN(0L),
    VALIDATION(1L << 40),
    TEST(2L << 40);

    private static final long SEED_RANGE_SIZE = 1L << 40;

    private final long seedBase;

    YachtSimulationSplit(long seedBase) {
        this.seedBase = seedBase;
    }

    public long seedAt(long offset) {
        if (offset < 0 || offset >= SEED_RANGE_SIZE) {
            throw new IllegalArgumentException("seed offset must be between 0 and " + (SEED_RANGE_SIZE - 1));
        }
        return seedBase + offset;
    }

    public static YachtSimulationSplit from(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("split is required");
        }
        return valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
    }
}
