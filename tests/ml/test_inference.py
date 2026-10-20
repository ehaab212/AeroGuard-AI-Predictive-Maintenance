
import sys
import unittest
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[2]

sys.path.insert(
    0,
    str(PROJECT_ROOT / "ml" / "src")
)

from aeroguard_ml.data_loader import load_data
from aeroguard_ml.feature_engineering import engineer_features
from aeroguard_ml.predict import (
    load_model_package,
    predict_rul
)


class TestModelInference(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.package = load_model_package()

        train_df, _, _ = load_data()

        cls.engine = train_df[
            train_df["engine_id"] == 1
        ].sort_values("cycle")

        cls.history = cls.engine.head(60).copy()

    def test_prediction_works(self):
        result = predict_rul(
            self.history, self.package
        )

        self.assertEqual(result["engine_id"], 1)
        self.assertEqual(result["last_cycle"], 60)

        self.assertTrue(np.isfinite(
            result["predicted_rul_cycles"]
        ))

        self.assertGreaterEqual(
            result["predicted_rul_cycles"], 0
        )

    def test_future_data_independence(self):
        # Prediction using first 60 observed cycles
        result = predict_rul(
            self.history, self.package
        )

        # Recompute cycle-60 features from a longer history.
        extended = self.engine.head(90)

        engineered = engineer_features(
            extended,
            self.package["sensor_columns"],
            tuple(self.package["rolling_windows"])
        )

        reference_features = engineered.loc[
            engineered["cycle"] == 60,
            self.package["feature_columns"]
        ]

        reference_prediction = max(
            0.0,
            float(self.package["model"].predict(
                reference_features
            )[0])
        )

        self.assertAlmostEqual(
            result["predicted_rul_cycles"],
            reference_prediction,
            places=6
        )

    def test_missing_sensor_rejected(self):
        invalid = self.history.drop(
            columns=["sensor_2"]
        )

        with self.assertRaises(ValueError):
            predict_rul(invalid, self.package)

    def test_duplicate_cycle_rejected(self):
        invalid = self.history.copy()
        invalid.loc[
            invalid.index[-1], "cycle"
        ] = 59

        with self.assertRaises(ValueError):
            predict_rul(invalid, self.package)

    def test_non_consecutive_cycles_rejected(self):
        invalid = self.history[
            self.history["cycle"] != 30
        ].copy()

        with self.assertRaises(ValueError):
            predict_rul(invalid, self.package)


if __name__ == "__main__":
    unittest.main()
