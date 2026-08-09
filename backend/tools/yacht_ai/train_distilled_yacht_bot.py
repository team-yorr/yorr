import argparse
import json
import math
import os

import numpy as np
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPRegressor


CATEGORIES = [
    ("ACES", "ones"),
    ("DEUCES", "twos"),
    ("THREES", "threes"),
    ("FOURS", "fours"),
    ("FIVES", "fives"),
    ("SIXES", "sixes"),
    ("CHOICE", "choice"),
    ("FOUR_OF_A_KIND", "fourOfAKind"),
    ("FULL_HOUSE", "fullHouse"),
    ("SMALL_STRAIGHT", "smallStraight"),
    ("LARGE_STRAIGHT", "largeStraight"),
    ("YACHT", "yacht"),
]


def feature_vector(example, candidate):
    dice = example["dice"]
    scorecard = example["scorecard"]
    held = candidate.get("held") or []

    features = []
    for face in range(1, 7):
        features.append(dice.count(face) / 5.0)
    features.append((example["rollCount"] - 1) / 2.0)

    filled_count = 0
    open_upper_count = 0
    for index, (_, api_key) in enumerate(CATEGORIES):
        filled = api_key in scorecard
        features.append(1.0 if filled else 0.0)
        if filled:
            filled_count += 1
        if index < 6 and not filled:
            open_upper_count += 1

    for _, api_key in CATEGORIES:
        features.append(scorecard.get(api_key, 0) / 50.0)

    features.append(example["upperSubtotal"] / 63.0)
    features.append(example["upperBonus"] / 35.0)
    features.append(example["total"] / 300.0)
    features.append(filled_count / float(len(CATEGORIES)))
    features.append(open_upper_count / 6.0)

    features.append(1.0 if candidate["action"] == "HOLD" else 0.0)
    features.append(1.0 if candidate["action"] == "SCORE" else 0.0)

    for category_name, _ in CATEGORIES:
        features.append(1.0 if candidate.get("category") == category_name else 0.0)

    held_counts = [0] * 6
    held_count = 0
    for index in range(5):
        is_held = index < len(held) and held[index] is True
        features.append(1.0 if is_held else 0.0)
        if is_held:
            held_counts[dice[index] - 1] += 1
            held_count += 1
    for count in held_counts:
        features.append(count / 5.0)
    features.append(held_count / 5.0)
    return features


def load_rows(path):
    features = []
    targets = []
    chosen_flags = []
    with open(path, "r", encoding="utf-8") as source:
        for line in source:
            if not line.strip():
                continue
            example = json.loads(line)
            for candidate in example["candidates"]:
                features.append(feature_vector(example, candidate))
                targets.append(candidate["teacherUtility"])
                chosen_flags.append(bool(candidate["chosen"]))
    return np.asarray(features, dtype=np.float64), np.asarray(targets, dtype=np.float64), chosen_flags


def normalize(values):
    mean = values.mean(axis=0)
    std = values.std(axis=0)
    std[std == 0] = 1.0
    return (values - mean) / std, mean, std


def export_model(model, feature_mean, feature_std, target_mean, target_std, metrics, output):
    layers = []
    for weights, biases in zip(model.coefs_, model.intercepts_):
        layers.append({
            "weights": weights.tolist(),
            "biases": biases.tolist(),
        })
    payload = {
        "featureVersion": 1,
        "inputSize": int(feature_mean.shape[0]),
        "confidenceMargin": 0.75,
        "featureMean": feature_mean.tolist(),
        "featureStd": feature_std.tolist(),
        "targetMean": float(target_mean),
        "targetStd": float(target_std),
        "layers": layers,
        "training": metrics,
    }
    parent = os.path.dirname(os.path.abspath(output))
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(output, "w", encoding="utf-8") as target:
        json.dump(payload, target, ensure_ascii=False, indent=2)
        target.write("\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--seed", type=int, default=217)
    parser.add_argument("--max-iter", type=int, default=400)
    args = parser.parse_args()

    x, y, chosen_flags = load_rows(args.input)
    if len(x) == 0:
        raise ValueError("training data is empty")

    x_scaled, feature_mean, feature_std = normalize(x)
    target_mean = float(y.mean())
    target_std = float(y.std() if y.std() > 0 else 1.0)
    y_scaled = (y - target_mean) / target_std

    stratify = chosen_flags if len(set(chosen_flags)) == 2 else None
    x_train, x_eval, y_train, y_eval = train_test_split(
        x_scaled,
        y_scaled,
        test_size=0.2,
        random_state=args.seed,
        stratify=stratify,
    )

    model = MLPRegressor(
        hidden_layer_sizes=(32, 16),
        activation="relu",
        solver="adam",
        random_state=args.seed,
        max_iter=args.max_iter,
        early_stopping=True,
        n_iter_no_change=20,
    )
    model.fit(x_train, y_train)

    predicted = model.predict(x_eval) * target_std + target_mean
    expected = y_eval * target_std + target_mean
    metrics = {
        "rows": int(len(x)),
        "features": int(x.shape[1]),
        "iterations": int(model.n_iter_),
        "evalMeanAbsoluteError": float(mean_absolute_error(expected, predicted)),
        "evalRootMeanSquaredError": float(math.sqrt(np.mean((expected - predicted) ** 2))),
    }
    export_model(model, feature_mean, feature_std, target_mean, target_std, metrics, args.output)
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
