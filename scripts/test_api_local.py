
from pathlib import Path
import sys
import httpx

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "ml" / "src"))

from aeroguard_ml.data_loader import (
    load_data,
    COLUMNS
)

train_df, _, _ = load_data()

# First 60 observed cycles of Engine 1
history = (
    train_df[train_df["engine_id"] == 1]
    .sort_values("cycle")
    .head(60)
)

payload = {
    "records": history[COLUMNS].to_dict(
        orient="records"
    )
}

with httpx.Client(
    base_url="http://127.0.0.1:8000",
    timeout=60.0
) as client:

    health = client.get("/health")
    health.raise_for_status()

    print("===== API HEALTH =====")
    print(health.json())

    info = client.get("/model/info")
    info.raise_for_status()

    print("\n===== MODEL INFORMATION =====")
    print(info.json())

    response = client.post(
        "/predict/rul",
        json=payload
    )

    print("\n===== RUL PREDICTION =====")
    print("HTTP Status:", response.status_code)
    print(response.json())

    response.raise_for_status()
