
import { Router } from "express";
import Prediction from "../models/Prediction.js";

const router = Router();

const INFERENCE_API_URL =
  process.env.INFERENCE_API_URL ||
  "http://127.0.0.1:8000";

// ======================================
// POST: Generate and save an ML prediction
// ======================================

router.post("/", async (req, res) => {
  const engineId = req.body?.engine_id;

  if (!Number.isInteger(engineId) || engineId < 1) {
    return res.status(400).json({
      error: "A valid numeric engine_id is required.",
    });
  }

  try {
    // 1. Retrieve observed NASA engine history
    const historyResponse = await fetch(
      `${INFERENCE_API_URL}/fleet/engines/${engineId}/history`,
      {
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!historyResponse.ok) {
      return res.status(
        historyResponse.status === 404 ? 404 : 502
      ).json({
        error: "Unable to retrieve engine history.",
      });
    }

    const history = await historyResponse.json();

    if (
      !Array.isArray(history.records) ||
      history.records.length === 0
    ) {
      return res.status(502).json({
        error: "Invalid engine history received.",
      });
    }

    // 2. Ask FastAPI to run the trained ML model
    const inferenceResponse = await fetch(
      `${INFERENCE_API_URL}/predict/rul`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records: history.records,
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!inferenceResponse.ok) {
      return res.status(502).json({
        error: "Machine Learning prediction failed.",
      });
    }

    const result = await inferenceResponse.json();
    const prediction = result.prediction;

    if (
      !prediction ||
      !Number.isFinite(prediction.predicted_rul_cycles) ||
      prediction.predicted_rul_cycles < 0 ||
      prediction.engine_id !== engineId
    ) {
      return res.status(502).json({
        error: "Invalid prediction received from FastAPI.",
      });
    }

    // 3. Save the actual model output to MongoDB
    const savedPrediction = await Prediction.create({
      engineId: prediction.engine_id,
      lastCycle: prediction.last_cycle,
      observedRecords: prediction.observed_records,
      predictedRulCycles:
        prediction.predicted_rul_cycles,
      modelVersion:
        prediction.model_version || "unspecified",
      dataset: "NASA C-MAPSS FD001",
      sourceType: "simulated_test_data",
    });

    return res.status(201).json({
      status: "saved",
      message: "ML prediction saved successfully.",
      record: savedPrediction,
    });

  } catch (error) {
    console.error(
      "Prediction processing failed:",
      error.message
    );

    return res.status(503).json({
      error:
        "Prediction service or database is unavailable.",
    });
  }
});

// ======================================
// GET: Retrieve saved prediction history
// ======================================

router.get("/", async (req, res) => {
  try {
    const predictions = await Prediction.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.json({
      total_returned: predictions.length,
      records: predictions,
    });

  } catch (error) {
    console.error(
      "Prediction history failed:",
      error.message
    );

    return res.status(503).json({
      error: "Unable to retrieve prediction history.",
    });
  }
});

export default router;
