
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import predictionRoutes from "./routes/predictionRoutes.js";
// ======================================
// 1. Load Environment Variables
// ======================================

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT) || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// ======================================
// 2. Middleware
// ======================================

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json({ limit: "1mb" }));


// Prediction history API
app.use("/api/predictions", predictionRoutes);
// ======================================
// 3. Home Endpoint
// ======================================

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Welcome to AeroGuard AI Express Backend",
    service: "AeroGuard AI API",
    health_endpoint: "/api/health",
  });
});

// ======================================
// 4. Health Check Endpoint
// ======================================

app.get("/api/health", (req, res) => {

  const isConnected =
    mongoose.connection.readyState === 1;

  res.status(isConnected ? 200 : 503).json({
    status: isConnected ? "healthy" : "degraded",
    service: "AeroGuard AI Express Backend",
    database: isConnected
      ? "connected"
      : "disconnected",
  });
});

// ======================================
// 5. Connect MongoDB and Start Express
// ======================================

async function startServer() {

  if (!MONGODB_URI) {
    console.error(
      "ERROR: MONGODB_URI is missing from backend/.env"
    );

    process.exit(1);
  }

  try {

    console.log("Connecting to MongoDB Atlas...");

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("MongoDB connected successfully!");

    const server = app.listen(
      PORT,
      "127.0.0.1",
      () => {
        console.log(
          `AeroGuard AI backend running on http://127.0.0.1:${PORT}`
        );
      }
    );

    server.on("error", (error) => {
      console.error(
        "Express server failed:",
        error.message
      );
      process.exit(1);
    });

  } catch (error) {

    console.error(
      "MongoDB connection failed:",
      error.message
    );

    process.exit(1);
  }
}

// ======================================
// 6. Run Backend
// ======================================

startServer();
