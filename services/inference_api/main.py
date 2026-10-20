
from contextlib import asynccontextmanager
from pathlib import Path
import sys

import pandas as pd
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field


from services.inference_api.fleet import (
    router as fleet_router
)

from services.inference_api.analytics import (
    router as analytics_router
)
# Locate the project and ML package
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / "ml" / "src"))

from aeroguard_ml.predict import (
    load_model_package,
    predict_rul
)


# One complete NASA C-MAPSS sensor record
class SensorRecord(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        allow_inf_nan=False
    )

    engine_id: int = Field(ge=1)
    cycle: int = Field(ge=1)

    setting_1: float
    setting_2: float
    setting_3: float

    sensor_1: float
    sensor_2: float
    sensor_3: float
    sensor_4: float
    sensor_5: float
    sensor_6: float
    sensor_7: float
    sensor_8: float
    sensor_9: float
    sensor_10: float
    sensor_11: float
    sensor_12: float
    sensor_13: float
    sensor_14: float
    sensor_15: float
    sensor_16: float
    sensor_17: float
    sensor_18: float
    sensor_19: float
    sensor_20: float
    sensor_21: float


class PredictionRequest(BaseModel):
    records: list[SensorRecord] = Field(
        min_length=1,
        max_length=500
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the trained model once at startup
    app.state.model_package = load_model_package()
    yield


app = FastAPI(
    title="AeroGuard AI",
    description=(
        "Predictive Maintenance API using "
        "NASA C-MAPSS simulated engine data."
    ),
    version="1.0.0",
    lifespan=lifespan
)
app.include_router(analytics_router)
app.include_router(fleet_router)
@app.get("/")
def home():
    return {
        "application": "AeroGuard AI",
        "message": "Predictive Maintenance API",
        "docs": "/docs"
    }


@app.get("/health")
def health(request: Request):
    package = request.app.state.model_package

    return {
        "status": "healthy",
        "model_loaded": True,
        "model_version": package["model_version"]
    }


@app.get("/model/info")
def model_info(request: Request):
    package = request.app.state.model_package

    return {
        "model_type": type(package["model"]).__name__,
        "model_version": package["model_version"],
        "dataset": package["dataset"],
        "feature_count": len(package["feature_columns"]),
        "sensor_count": len(package["sensor_columns"]),
        "rolling_windows": package["rolling_windows"],
        "disclaimer": (
            "Research and demonstration only. "
            "Not validated for real aircraft maintenance."
        )
    }


@app.post("/predict/rul")
def predict(
    payload: PredictionRequest,
    request: Request
):
    package = request.app.state.model_package

    try:
        history = pd.DataFrame([
            record.model_dump()
            for record in payload.records
        ])

        result = predict_rul(
            history,
            package
        )

        return {
            "status": "success",
            "prediction": result
        }

    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error)
        ) from error
