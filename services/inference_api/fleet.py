
from pathlib import Path

import pandas as pd

from fastapi import APIRouter, HTTPException
from fastapi import Path as ApiPath


# ======================================
# Fleet API Router
# ======================================

router = APIRouter(
    prefix="/fleet",
    tags=["Engine Fleet"]
)


# ======================================
# Project Paths
# ======================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

TEST_DATA_PATH = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "test_FD001.txt"
)


# ======================================
# Original NASA C-MAPSS Input Columns
# ======================================

RAW_COLUMNS = (
    ["engine_id", "cycle"]
    + [f"setting_{i}" for i in range(1, 4)]
    + [f"sensor_{i}" for i in range(1, 22)]
)


# ======================================
# Endpoint 1: Get All Fleet Engines
# ======================================

@router.get("/engines")
def get_fleet_engines():
    """
    Return metadata for NASA FD001 test engines.

    Includes:
        - Engine ID
        - Number of observed records
        - Last observed operating cycle

    Official RUL labels are not included.
    """

    # Check if the NASA dataset exists
    if not TEST_DATA_PATH.is_file():
        raise HTTPException(
            status_code=503,
            detail=(
                "NASA FD001 test dataset "
                "is unavailable."
            )
        )

    try:
        # ======================================
        # 1. Load Engine ID and Cycle Columns
        # ======================================

        df = pd.read_csv(
            TEST_DATA_PATH,
            sep=r"\s+",
            header=None,
            usecols=[0, 1]
        )

        df.columns = [
            "engine_id",
            "cycle"
        ]

        # Ensure correct integer data types
        df = df.astype({
            "engine_id": "int64",
            "cycle": "int64"
        })

        # ======================================
        # 2. Calculate Engine Metadata
        # ======================================

        fleet = (
            df.groupby(
                "engine_id",
                as_index=False
            )
            .agg(
                observed_records=("cycle", "size"),
                last_cycle=("cycle", "max")
            )
            .sort_values("engine_id")
        )

        # ======================================
        # 3. Convert Columns to Integer Types
        # ======================================

        fleet = fleet.astype({
            "engine_id": "int64",
            "observed_records": "int64",
            "last_cycle": "int64"
        })

        # ======================================
        # 4. Prepare JSON-Compatible Records
        # ======================================

        engines = fleet.to_dict(
            orient="records"
        )

        # ======================================
        # 5. Return Fleet Information
        # ======================================

        return {
            "dataset": "NASA C-MAPSS FD001",
            "source_type": "simulated_test_data",
            "total_engines": len(engines),
            "engines": engines,
            "disclaimer": (
                "Simulated NASA engine records. "
                "Not live aircraft telemetry."
            )
        }

    except (
        OSError,
        ValueError,
        TypeError,
        pd.errors.ParserError
    ) as error:

        raise HTTPException(
            status_code=503,
            detail="Unable to load fleet data."
        ) from error


# ======================================
# Endpoint 2: Get Individual Engine History
# ======================================

@router.get("/engines/{engine_id}/history")
def get_engine_history(
    engine_id: int = ApiPath(ge=1)
):
    """
    Return the complete observed sensor history
    for a specified NASA FD001 test engine.

    Includes:
        - Engine ID
        - Observed record count
        - Last observed cycle
        - Operating settings
        - 21 sensor measurements

    Official RUL labels are never returned.
    """

    # ======================================
    # 1. Verify Dataset Availability
    # ======================================

    if not TEST_DATA_PATH.is_file():
        raise HTTPException(
            status_code=503,
            detail=(
                "NASA test dataset "
                "is unavailable."
            )
        )

    try:
        # ======================================
        # 2. Load Raw NASA Sensor Measurements
        # ======================================

        df = pd.read_csv(
            TEST_DATA_PATH,
            sep=r"\s+",
            header=None,
            names=RAW_COLUMNS,
            usecols=range(26)
        )

        # Explicitly set ID and cycle data types
        df = df.astype({
            "engine_id": "int64",
            "cycle": "int64"
        })

    except (
        OSError,
        ValueError,
        TypeError,
        pd.errors.ParserError
    ) as error:

        raise HTTPException(
            status_code=503,
            detail="Unable to read engine history."
        ) from error

    # ======================================
    # 3. Filter the Requested Engine
    # ======================================

    history = (
        df.loc[
            df["engine_id"] == engine_id,
            RAW_COLUMNS
        ]
        .sort_values("cycle")
        .copy()
    )

    # ======================================
    # 4. Validate Engine History
    # ======================================

    if history.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Engine {engine_id} not found."
        )

    if history.isna().any().any():
        raise HTTPException(
            status_code=503,
            detail=(
                "Engine history contains "
                "missing values."
            )
        )

    # ======================================
    # 5. Calculate Engine Summary
    # ======================================

    observed_records = len(history)

    # NumPy integer array avoids ambiguous
    # Pandas Scalar conversion warnings.
    last_cycle = (
        history["cycle"]
        .to_numpy(dtype="int64")
        .max()
        .item()
    )

    # ======================================
    # 6. Prepare Raw Sensor Records
    # ======================================

    sensor_records = history.to_dict(
        orient="records"
    )

    # ======================================
    # 7. Return Engine History
    # ======================================

    return {
        "engine_id": engine_id,
        "observed_records": observed_records,
        "last_cycle": last_cycle,
        "source_type": "simulated_test_data",
        "records": sensor_records
    }
