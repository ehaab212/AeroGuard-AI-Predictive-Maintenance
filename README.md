# AeroGuard AI

### AI-Powered Predictive Maintenance & Remaining Useful Life Prediction

AeroGuard AI is a **machine learning + full-stack web application** that estimates the **Remaining Useful Life (RUL)** of simulated turbofan engines using the **NASA C-MAPSS FD001** dataset. It combines an experimentally evaluated Random Forest model, a **Python FastAPI inference service**, a **Node.js/Express API**, **MongoDB Atlas** for prediction history, and a **React dashboard** for interactive exploration.

> **Research and educational demonstration only.** NASA C-MAPSS data is simulated. AeroGuard AI is **not certified or validated for real aircraft maintenance decisions**. Predictions can overestimate remaining useful life.

## Features

- **RUL prediction from a file:** Upload FD001-format `.txt` or header-based `.csv` sensor data, select one engine, and obtain a model estimate. This upload workflow currently calls FastAPI directly; its results **are not automatically saved to MongoDB**.
- **Engine fleet explorer:** Browse and search the **100 simulated FD001 test engines**, select an engine, and inspect recorded sensor measurements in an interactive chart.
- **Persistent fleet predictions:** Predict RUL for a selected fleet engine through **React → Express → FastAPI**, with the result saved to **MongoDB Atlas**.
- **Prediction history:** View up to **20 recent saved fleet predictions**, including engine ID, last observed cycle, estimated RUL, model version, and timestamp.
- **Model analytics:** Inspect official-test actual-versus-predicted results, prediction errors, retrospective lifecycle validation, and global SHAP feature importance.
- **REST APIs:** Explore the FastAPI inference endpoints via Swagger and use Express endpoints for persistent prediction records.
- **Validation:** Engine-grouped development validation, official NASA FD001 test evaluation, model inference tests, and FastAPI tests.

## System Architecture

```text
                         React + Vite (port 5173)
                          /                 \
       /api/fleet, /api/analytics,        /api/predictions
       /api/predict/rul, /api/health             |
                    |                          v
                    v                  Express.js (port 5000)
           FastAPI (port 8000)             |            |
                    ^                      |            v
                    |                      |       MongoDB Atlas
                    +----------------------+    (aeroguard_ai)
                       Engine history + RUL
                       inference requests
```

For a **fleet prediction**, React sends the engine ID to Express. Express requests the corresponding observed history from FastAPI, asks FastAPI to run the trained RF_B model, saves the returned estimate in MongoDB, and sends the stored result back to React. The history table reads those records from Express. The separate uploaded-file prediction workflow still talks directly to FastAPI.

### Technology Stack

| Layer | Technologies |
| --- | --- |
| Machine learning / data | Python, NumPy, Pandas, scikit-learn, XGBoost, SHAP |
| Experiments / visualization | Jupyter, Matplotlib, Seaborn |
| ML inference service | FastAPI, Pydantic, Uvicorn |
| Application API | Node.js, Express.js |
| Persistence | MongoDB Atlas, Mongoose |
| Frontend | React, Vite, Tailwind CSS v4, Recharts, Lucide React, Papa Parse |
| Testing / verification | Python `unittest`, FastAPI `TestClient`, HTTPX, Vite production build, manual end-to-end checks |

## Dataset

The project uses **NASA C-MAPSS FD001** (one operating condition and one fault mode):

| File | Purpose |
| --- | --- |
| `train_FD001.txt` | Complete training histories: **100 engines, 20,631 records** |
| `test_FD001.txt` | Partial test histories: **100 engines, 13,096 records** |
| `RUL_FD001.txt` | Official actual RUL labels at each test engine's last observed cycle |

Each raw record has **26 columns**: engine ID, operating cycle, three operating settings, and 21 sensors. The trained model uses **123 engineered features**, including past-only rolling statistics and sensor deltas for 15 varying sensors.

**Source:** [NASA Prognostics Center of Excellence — Data Set Repository](https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/)

The raw datasets are **not committed to Git**. Download the dataset separately and put these files here:

```text
data/raw/train_FD001.txt
data/raw/test_FD001.txt
data/raw/RUL_FD001.txt
```

Official test RUL labels are used for **evaluation**, not supplied as inputs to the prediction model. The fleet API exposes observed histories, not the official labels. The Analytics API uses evaluation results that contain actual labels for comparison charts.

## Model and Evaluation

The experiments compared a mean baseline, Ridge Regression, Random Forest, and XGBoost. Development used engine-grouped train/validation data, retrospective partial-history snapshots, and 3-fold GroupKFold optimization. The selected **RF_B** model is a Random Forest regressor with:

```python
RandomForestRegressor(
    n_estimators=160,
    max_depth=18,
    min_samples_leaf=5,
    max_features=0.8,
    random_state=42,
    n_jobs=-1,
)
```

### Official NASA FD001 Test Results

One prediction was evaluated per engine, using the engine's final observed test cycle (**100 official test engines**):

| Metric | Result |
| --- | ---: |
| Mean Absolute Error (MAE) | **17.7685 cycles** |
| Root Mean Squared Error (RMSE) | **25.1574 cycles** |
| Mean signed error (predicted − actual) | **+9.5634 cycles** |
| Overestimated RUL | **69 / 100 engines** |
| Underestimated RUL | **31 / 100 engines** |

**Interpretation:** The model tends to **overestimate** remaining life. An early-history example is FD001 test Engine 1: its predicted RUL is approximately **192.38 cycles**, versus an official actual RUL of **112 cycles**. These results do not establish operational reliability.

### Development Validation

Across 60 retrospective snapshots (20 validation engines at 50%, 70%, and 90% of known full lifetimes), optimized RF_B achieved **MAE 14.2934** and **RMSE 21.7156** cycles. These retrospective lifecycle positions use known lifetime information and **are not an online lifecycle detector**. Do not confuse these scores with the official independent test results.

### Explainability and Plots

![Official FD001 error analysis](ml/reports/figures/official_test_error_analysis.png)

![Global SHAP feature importance](ml/reports/figures/shap_global_importance.png)

Global SHAP importance was calculated from **40 sampled training records**. It describes model behavior, not causal engine physics. Operating cycle was the strongest feature in that sample. See [`ml/reports/`](ml/reports/) and [`notebooks/`](notebooks/) for evaluation artifacts and experiments.

## Repository Structure

```text
.
├── backend/
│   ├── src/
│   │   ├── models/Prediction.js       # Mongoose prediction-history schema
│   │   ├── routes/predictionRoutes.js  # Express prediction/history routes
│   │   └── server.js                   # Express, MongoDB connection, health check
│   ├── package.json
│   └── package-lock.json
├── data/                                # Dataset placeholders; raw data ignored
├── docs/                                # Validation and environment records
├── frontend/
│   ├── src/components/                  # RULPrediction, ModelAnalytics,
│   │                                    # EngineFleet, PredictionHistory
│   ├── vite.config.js                   # FastAPI + Express development proxies
│   └── package.json
├── ml/
│   ├── artifacts/                       # Local trained model; ignored by Git
│   ├── reports/                         # Benchmark JSON/CSV files and figures
│   └── src/aeroguard_ml/                # Data, features, prediction helpers
├── notebooks/                           # Experiments, optimization, evaluation
├── scripts/                             # Local API smoke checks
├── services/inference_api/             # FastAPI inference/analytics/fleet routers
├── tests/api/                           # FastAPI tests
├── tests/ml/                            # ML inference tests
├── requirements.txt
└── README.md
```

## Getting Started (Windows / PowerShell)

### Prerequisites

- Python 3.13 (or a compatible Python version with the required dependencies)
- Node.js 24 and npm (or a compatible supported Node.js version)
- MongoDB Atlas cluster, database user, and allowed client IP
- NASA FD001 data files (see **Dataset**)
- A locally generated model package (see below)

### 1. Clone the Repository

```powershell
git clone https://github.com/ehaab212/AeroGuard-AI-Predictive-Maintenance.git
cd AeroGuard-AI-Predictive-Maintenance
```

### 2. Install Python Dependencies

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Keep `requirements.txt` aligned with the project's direct dependencies, including joblib, XGBoost, SHAP, FastAPI, Uvicorn, and HTTPX. An environment snapshot is available in `docs/environment-packages.txt`.

### 3. Prepare the Dataset and Trained Model

Copy the three FD001 files into `data/raw/`. The trained model is intentionally excluded from Git:

```text
ml/artifacts/aeroguard_rf_b_v1.joblib
```

To reproduce it, follow the preprocessing/training workflow in `notebooks/` and run `notebooks/05_final_model_evaluation.ipynb`. This saves the local model package used by FastAPI. **Only load trusted `.joblib` files:** deserializing an untrusted Python model can execute code.

### 4. Configure MongoDB Atlas

1. Resume your Atlas cluster if it is paused.
2. Create a dedicated database user with **`readWrite` on `aeroguard_ai` only**; do not use an Atlas administrator account in the application.
3. Allow your current public IP in Atlas Network Access.
4. Create `backend/.env` with the following **template**:

```dotenv
PORT=5000
MONGODB_URI=mongodb+srv://USERNAME:URL_ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/aeroguard_ai?retryWrites=true&w=majority
INFERENCE_API_URL=http://127.0.0.1:8000
```

Replace the placeholders privately. URL-encode reserved characters in the database password. **Never commit `backend/.env` or share a credential-bearing connection string.** MongoDB normally creates the `aeroguard_ai` database and `predictions` collection on the first successful insert.

### 5. Start FastAPI — Terminal 1 (Repository Root)

```powershell
python -m uvicorn services.inference_api.main:app --reload --reload-dir services --host 127.0.0.1 --port 8000
```

Swagger documentation: **http://127.0.0.1:8000/docs**

### 6. Start Express + MongoDB — Terminal 2

From the repository root:

```powershell
npm --prefix backend install
npm --prefix backend run dev
```

Express starts at **http://127.0.0.1:5000** after connecting to MongoDB. Verify its database health endpoint at **http://127.0.0.1:5000/api/health**. The development command uses Node's built-in `--watch` mode; Nodemon is not required.

### 7. Start React — Terminal 3

From the repository root:

```powershell
npm --prefix frontend install
npm --prefix frontend run dev
```

Open **http://localhost:5173/**.

During local development, the Vite proxy routes `/api/predictions` to **Express (5000)** and other `/api/*` requests to **FastAPI (8000)**, removing the `/api` prefix for FastAPI. **All three services must be running** for saved fleet predictions. This Vite proxy is development-only; production hosting requires equivalent routing/configuration.

### 8. Build the Frontend

```powershell
npm --prefix frontend run build
```

The static build is written to `frontend/dist/` (excluded from Git). Building React does **not** deploy the APIs, dataset, or model.

## API Reference

### FastAPI — `http://127.0.0.1:8000`

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Inference service information |
| `GET` | `/health` | ML service/model readiness |
| `GET` | `/model/info` | Model version, features, metadata |
| `POST` | `/predict/rul` | Predict RUL from one engine's observed sensor history |
| `GET` | `/analytics/summary` | Official test metrics, predictions, SHAP and lifecycle data |
| `GET` | `/fleet/engines` | List simulated FD001 test engines |
| `GET` | `/fleet/engines/{engine_id}/history` | Raw observed sensor history for an engine |

`POST /predict/rul` expects `{"records": [...]}` with `engine_id`, `cycle`, `setting_1`–`setting_3`, and `sensor_1`–`sensor_21` for each record. Current validation enforces one engine, contiguous and nonduplicate cycles, finite numeric data, and no more than 500 records per request.

### Express — `http://127.0.0.1:5000`

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Application API welcome message |
| `GET` | `/api/health` | Express and MongoDB connection status |
| `POST` | `/api/predictions` | Look up an FD001 test engine, run FastAPI inference, save result to MongoDB |
| `GET` | `/api/predictions` | Return up to 20 most recent saved predictions |

**Example: save and retrieve a prediction from PowerShell:**

```powershell
$body = @{ engine_id = 1 } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/predictions' `
  -Method POST -ContentType 'application/json' -Body $body

Invoke-RestMethod 'http://127.0.0.1:5000/api/predictions'
```

An example stored record includes `engineId`, `lastCycle`, `observedRecords`, `predictedRulCycles`, `modelVersion`, and automatically managed `createdAt`/`updatedAt` timestamps. The endpoint currently **only predicts engines present in the local FD001 test dataset**. It does not accept arbitrary sensor histories or save uploaded-file predictions.

## Testing and Verification

From the repository root, with Python dependencies installed:

```powershell
python -m unittest discover -s tests/ml -p 'test_inference.py' -v
python -m unittest discover -s tests/api -p 'test_api.py' -v
```

During local development, **5 ML inference tests and 8 FastAPI tests passed**. The API suite covers inference/model metadata and input validation, but does **not yet** fully cover Fleet, Analytics, or Express/MongoDB routes. Compatibility warnings from Starlette/scikit-learn may appear without failing these tests.

For a live FastAPI smoke test:

```powershell
python scripts/test_api_local.py
```

For backend syntax/security checks and a frontend production build:

```powershell
node --check backend/src/server.js
node --check backend/src/routes/predictionRoutes.js
node --check backend/src/models/Prediction.js
npm --prefix backend audit
npm --prefix frontend run build
```

**Manually verified end-to-end:** React Fleet selection → Express POST → FastAPI inference → MongoDB save → React Prediction History display. FD001 test Engine 1 produces approximately **192.38 predicted cycles**. This is a functional integration check, **not** a claim that the prediction is accurate or safe for maintenance.

## Security and Limitations

- **Research-only simulation:** No live aircraft telemetry, certified prognostics, maintenance authorization, or real-world safety validation.
- **Dataset scope:** Trained/evaluated on FD001 only. The current upload parser may accept similarly shaped files from other subsets (such as FD003), but such predictions **are not validated** and should not be presented as FD001 benchmark results.
- **Error/bias:** Official FD001 mean signed error is positive; individual predictions may substantially overestimate RUL.
- **No automatic upload persistence:** Uploaded-file predictions go straight to FastAPI; **only fleet predictions sent through Express are stored**.
- **Access control is not implemented:** The Express prediction endpoints do not currently require authentication or provide per-user record isolation. **Do not expose these endpoints publicly without adding authentication, rate limits, stricter CORS, and other production safeguards.**
- **Local data/model dependencies:** The raw dataset and trained `.joblib` artifact are excluded from Git; fresh clones need explicit dataset/model provisioning. The current fleet source is a local NASA test file, **not** a persisted operational fleet.
- **Deployment not completed:** The three-service system and MongoDB integration have been tested locally; there is not yet a published hosted demo.

## Current Status and Roadmap

- [x] NASA FD001 data validation, feature engineering, grouped model validation
- [x] Random Forest / XGBoost comparisons and RF_B optimization
- [x] Official NASA FD001 benchmark and SHAP explanations
- [x] Local model package and FastAPI inference, analytics, and fleet routes
- [x] React dashboard with file upload, model charts, and fleet sensor history
- [x] Express.js + MongoDB Atlas connection and persistent fleet prediction records
- [x] React Prediction History with saved records and refresh after new fleet predictions
- [x] Basic inference/API tests and end-to-end local integration check
- [ ] Search/filter/pagination enhancements for saved prediction history
- [ ] Validated uploaded-file persistence and stricter dataset compatibility checks
- [ ] Dedicated Express/Fleet/Analytics integration tests, authentication, and rate limiting
- [ ] Production configuration, deployment, monitoring, and portfolio demo

## Author

**Ehaab Ullah** · [GitHub](https://github.com/ehaab212)

## Acknowledgements

NASA Prognostics Center of Excellence for publishing the C-MAPSS simulated turbofan engine degradation datasets.
