
import mongoose from "mongoose";

const predictionSchema = new mongoose.Schema(
  {
    engineId: {
      type: Number,
      required: true,
      min: 1,
      index: true,
    },

    lastCycle: {
      type: Number,
      required: true,
      min: 1,
    },

    observedRecords: {
      type: Number,
      required: true,
      min: 1,
    },

    predictedRulCycles: {
      type: Number,
      required: true,
      min: 0,
    },

    modelVersion: {
      type: String,
      required: true,
    },

    dataset: {
      type: String,
      default: "NASA C-MAPSS FD001",
    },

    sourceType: {
      type: String,
      enum: ["simulated_test_data"],
      default: "simulated_test_data",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Prediction = mongoose.model(
  "Prediction",
  predictionSchema
);

export default Prediction;
