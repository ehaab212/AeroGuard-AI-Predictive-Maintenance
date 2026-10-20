
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from aeroguard_ml.feature_engineering import engineer_features


PROJECT_ROOT = Path(__file__).resolve().parents[3]

MODEL_PATH = (
    PROJECT_ROOT
    / "ml"
    / "artifacts"
    / "aeroguard_rf_b_v1.joblib"
)

RAW_COLUMNS = (
    ["engine_id", "cycle"]
    + [f"setting_{i}" for i in range(1, 4)]
    + [f"sensor_{i}" for i in range(1, 22)]
)


def load_model_package(model_path=MODEL_PATH):
    """Load the trusted, locally trained model package."""

    model_path = Path(model_path)

    if not model_path.is_file():
        raise FileNotFoundError(
            f"Model not found: {model_path}"
        )

    package = joblib.load(model_path)

    required_keys = [
        "model",
        "feature_columns",
        "sensor_columns",
        "rolling_windows",
        "model_version",
    ]

    missing = [
        key for key in required_keys
        if key not in package
    ]

    if missing:
        raise ValueError(
            f"Invalid model package. Missing: {missing}"
        )

    return package


def predict_rul(history: pd.DataFrame, package: dict):
    """
    Predict RUL from one engine's historical measurements.

    Requires chronological, contiguous operating cycles.
    Uses only information available through the latest cycle.
    """

    if history.empty:
        raise ValueError("Engine history cannot be empty.")

    missing = [
        col for col in RAW_COLUMNS
        if col not in history.columns
    ]

    if missing:
        raise ValueError(
            f"Missing required columns: {missing}"
        )

    # Accept only expected raw sensor inputs.
    data = history[RAW_COLUMNS].copy()

    for col in RAW_COLUMNS:
        data[col] = pd.to_numeric(
            data[col], errors="raise"
        )

    if not np.isfinite(
        data.to_numpy(dtype=float)
    ).all():
        raise ValueError(
            "Input contains missing or non-finite values."
        )

    if data["engine_id"].nunique() != 1:
        raise ValueError(
            "Provide history for exactly one engine."
        )

    if (data["engine_id"] < 1).any() or (
        data["engine_id"] % 1 != 0
    ).any():
        raise ValueError("Invalid engine ID.")

    if (data["cycle"] < 1).any() or (
        data["cycle"] % 1 != 0
    ).any():
        raise ValueError("Invalid operating cycle.")

    data = data.sort_values("cycle")

    if data["cycle"].duplicated().any():
        raise ValueError("Duplicate operating cycles.")

    if not np.all(
        np.diff(data["cycle"].to_numpy()) == 1
    ):
        raise ValueError(
            "Operating cycles must be consecutive."
        )

    # Recreate the same feature engineering pipeline.
    engineered = engineer_features(
        data,
        package["sensor_columns"],
        windows=tuple(package["rolling_windows"])
    )

    # Use features in exactly the trained order.
    latest_features = engineered[
        package["feature_columns"]
    ].tail(1)

    prediction = package["model"].predict(
        latest_features
    )[0]

    prediction = max(0.0, float(prediction))

    return {
        "engine_id": int(data["engine_id"].iloc[0]),
        "last_cycle": int(data["cycle"].iloc[-1]),
        "observed_records": len(data),
        "predicted_rul_cycles": prediction,
        "model_version": package["model_version"],
        "data_source": "NASA C-MAPSS simulation"
    }
