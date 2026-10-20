
import json
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException


# ======================================
# Analytics API Router
# ======================================

router = APIRouter(
    prefix="/analytics",
    tags=["Model Analytics"]
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]

REPORTS_DIR = PROJECT_ROOT / "ml" / "reports"


# ======================================
# Model Analytics Endpoint
# ======================================

@router.get("/summary")
def get_analytics_summary():
    """
    Return previously saved NASA FD001
    evaluation results and SHAP explanations.
    """

    try:
        # ======================================
        # 1. Load Official Evaluation Metrics
        # ======================================

        metrics = json.loads(
            (
                REPORTS_DIR
                / "official_fd001_metrics.json"
            ).read_text(encoding="utf-8")
        )

        # ======================================
        # 2. Load Official Test Predictions
        # ======================================

        predictions = pd.read_csv(
            REPORTS_DIR
            / "official_fd001_predictions.csv"
        )

        # ======================================
        # 3. Load SHAP Feature Importance
        # ======================================

        shap_df = pd.read_csv(
            REPORTS_DIR
            / "shap_feature_importance.csv"
        )

        # ======================================
        # 4. Load Lifecycle Validation Results
        # ======================================

        lifecycle_df = pd.read_csv(
            REPORTS_DIR
            / "optimized_lifecycle_results.csv"
        )

        # ======================================
        # 5. Calculate Signed Prediction Errors
        # ======================================

        predictions["signed_error"] = (
            predictions["predicted_rul"]
            - predictions["actual_rul"]
        )

        overestimated = (
            predictions["signed_error"] > 0
        ).sum()

        underestimated = (
            predictions["signed_error"] < 0
        ).sum()

        # ======================================
        # 6. Prepare Top 10 SHAP Features
        # ======================================

        top_features = (
            shap_df[
                ["Feature", "Mean_Absolute_SHAP"]
            ]
            .sort_values(
                "Mean_Absolute_SHAP",
                ascending=False
            )
            .head(10)
            .rename(
                columns={
                    "Feature": "feature",
                    "Mean_Absolute_SHAP": "importance"
                }
            )
            .copy()
        )

        # Explicitly define column types
        top_features["feature"] = (
            top_features["feature"].astype(str)
        )

        top_features["importance"] = (
            pd.to_numeric(
                top_features["importance"],
                errors="raise"
            )
            .astype("float64")
            .round(4)
        )

        # ======================================
        # 7. Prepare RF_B Lifecycle Metrics
        # ======================================

        rf_lifecycle = (
            lifecycle_df
            .loc[
                lifecycle_df["Model"] == "RF_B",
                ["Stage", "MAE", "RMSE"]
            ]
            .rename(
                columns={
                    "Stage": "stage",
                    "MAE": "mae",
                    "RMSE": "rmse"
                }
            )
            .sort_values("stage")
            .copy()
        )

        rf_lifecycle["stage"] = (
            rf_lifecycle["stage"].astype(str)
        )

        rf_lifecycle[["mae", "rmse"]] = (
            rf_lifecycle[["mae", "rmse"]]
            .astype("float64")
            .round(4)
        )

        # ======================================
        # 8. Prepare Prediction Records
        # ======================================

        prediction_records = (
            predictions[
                [
                    "engine_id",
                    "last_cycle",
                    "actual_rul",
                    "predicted_rul",
                    "signed_error"
                ]
            ]
            .round(4)
            .to_dict(orient="records")
        )

        # ======================================
        # 9. Return Analytics JSON
        # ======================================

        return {
            "metrics": {
                "mae": float(metrics["mae"]),
                "rmse": float(metrics["rmse"]),
                "bias": float(metrics["bias"]),
                "test_engines": int(
                    metrics["test_engines"]
                ),
                "overestimated": int(overestimated),
                "underestimated": int(underestimated)
            },

            "predictions": prediction_records,

            "feature_importance": (
                top_features.to_dict(
                    orient="records"
                )
            ),

            "lifecycle": (
                rf_lifecycle.to_dict(
                    orient="records"
                )
            )
        }

    except (
        OSError,
        KeyError,
        ValueError,
        TypeError,
        pd.errors.ParserError
    ) as error:

        raise HTTPException(
            status_code=503,
            detail=(
                "Analytics reports are missing "
                "or contain invalid data."
            )
        ) from error
