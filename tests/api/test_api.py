
import sys
import unittest
from copy import deepcopy
from pathlib import Path

import pandas as pd
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[2]

sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(
    0, str(PROJECT_ROOT / "ml" / "src")
)

from services.inference_api.main import app
from aeroguard_ml.data_loader import (
    load_data,
    COLUMNS
)
from aeroguard_ml.predict import predict_rul


class TestAeroGuardAPI(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Start the FastAPI lifespan and load the model
        cls.context = TestClient(app)
        cls.client = cls.context.__enter__()

        train_df, _, _ = load_data()

        history = (
            train_df[train_df.engine_id == 1]
            .sort_values("cycle")
            .head(60)
        )

        cls.records = history[COLUMNS].to_dict(
            orient="records"
        )

    @classmethod
    def tearDownClass(cls):
        cls.context.__exit__(None, None, None)

    def test_health_endpoint(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["model_loaded"])

    def test_model_info(self):
        response = self.client.get("/model/info")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["feature_count"], 123
        )

    def test_prediction_success(self):
        response = self.client.post(
            "/predict/rul",
            json={"records": self.records}
        )

        self.assertEqual(response.status_code, 200)

        result = response.json()["prediction"]

        self.assertEqual(result["engine_id"], 1)
        self.assertEqual(result["last_cycle"], 60)
        self.assertGreaterEqual(
            result["predicted_rul_cycles"], 0
        )

    def test_api_matches_direct_model(self):
        response = self.client.post(
            "/predict/rul",
            json={"records": self.records}
        )

        self.assertEqual(response.status_code, 200)

        api_prediction = response.json()[
            "prediction"
        ]["predicted_rul_cycles"]

        direct_result = predict_rul(
            pd.DataFrame(self.records),
            app.state.model_package
        )

        self.assertAlmostEqual(
            api_prediction,
            direct_result["predicted_rul_cycles"],
            places=6
        )

    def test_missing_sensor_rejected(self):
        records = deepcopy(self.records)
        del records[0]["sensor_2"]

        response = self.client.post(
            "/predict/rul",
            json={"records": records}
        )

        self.assertEqual(response.status_code, 422)

    def test_duplicate_cycle_rejected(self):
        records = deepcopy(self.records)
        records[-1]["cycle"] = 59

        response = self.client.post(
            "/predict/rul",
            json={"records": records}
        )

        self.assertEqual(response.status_code, 422)

    def test_multiple_engines_rejected(self):
        records = deepcopy(self.records)
        records[-1]["engine_id"] = 2

        response = self.client.post(
            "/predict/rul",
            json={"records": records}
        )

        self.assertEqual(response.status_code, 422)

    def test_empty_history_rejected(self):
        response = self.client.post(
            "/predict/rul",
            json={"records": []}
        )

        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
