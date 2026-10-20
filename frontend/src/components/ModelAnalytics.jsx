
import { useEffect, useState } from "react";

import {
  BarChart3,
  AlertTriangle,
  Activity,
  TrendingUp,
} from "lucide-react";

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

// ===================================
// Reusable Metric Card
// ===================================

function MetricCard({ title, value, unit }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">
        {title}
      </p>

      <div className="mt-4 flex flex-wrap items-baseline gap-2">
        <h3 className="text-3xl font-bold text-slate-900">
          {value}
        </h3>

        <span className="text-xs text-slate-500">
          {unit}
        </span>
      </div>
    </div>
  );
}

// ===================================
// Reusable Chart Card
// ===================================

function ChartCard({ title, description, children }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">
        {title}
      </h3>

      <p className="mt-2 mb-6 text-xs leading-5 text-slate-500">
        {description}
      </p>

      {children}
    </div>
  );
}

// ===================================
// Model Analytics Component
// ===================================

export default function ModelAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load real ML results from FastAPI
  useEffect(() => {
    const controller = new AbortController();

    async function fetchAnalytics() {
      try {
        const response = await fetch(
          "/api/analytics/summary",
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to load analytics (HTTP ${response.status})`
          );
        }

        const data = await response.json();

        setAnalytics(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchAnalytics();

    return () => controller.abort();
  }, []);

  // Loading screen
  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <Activity
          className="mx-auto animate-pulse text-teal-600"
          size={35}
        />

        <p className="mt-4 text-slate-500">
          Loading AeroGuard AI Analytics...
        </p>
      </div>
    );
  }

  // Error screen
  if (error || !analytics) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-6"
      >
        <div className="flex items-center gap-3 text-red-700">
          <AlertTriangle size={22} />

          <h3 className="font-semibold">
            Analytics Loading Failed
          </h3>
        </div>

        <p className="mt-3 text-sm text-red-600">
          {error || "No analytics data returned."}
        </p>

        <p className="mt-2 text-xs text-red-500">
          Please verify that FastAPI is running
          and /analytics/summary is available.
        </p>
      </div>
    );
  }

  const {
    metrics,
    predictions,
    feature_importance,
    lifecycle,
  } = analytics;

  const maxRul = Math.ceil(
    Math.max(
      1,
      ...predictions.map((item) =>
        Math.max(item.actual_rul, item.predicted_rul)
      )
    ) / 25
  ) * 25;

  return (
    <div className="space-y-7">

      {/* Analytics Header */}
      <section className="rounded-2xl bg-slate-900 p-8 text-white">
        <div className="flex items-center gap-2 text-teal-300">
          <BarChart3 size={20} />

          <span className="text-sm font-medium">
            Model Intelligence
          </span>
        </div>

        <h2 className="mt-4 text-3xl font-bold">
          Model Analytics & Explainability
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Explore actual NASA C-MAPSS FD001 evaluation
          results, prediction errors, model performance,
          and SHAP feature importance.
        </p>
      </section>

      {/* Performance Metrics */}
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Test Mean Absolute Error"
          value={metrics.mae.toFixed(2)}
          unit="cycles"
        />

        <MetricCard
          title="Test RMSE"
          value={metrics.rmse.toFixed(2)}
          unit="cycles"
        />

        <MetricCard
          title="Prediction Bias"
          value={`${
            metrics.bias >= 0 ? "+" : ""
          }${metrics.bias.toFixed(2)}`}
          unit="cycles"
        />

        <MetricCard
          title="Overestimated Predictions"
          value={metrics.overestimated}
          unit={`of ${metrics.test_engines} engines`}
        />
      </section>

      {/* Analytics Charts */}
      <section className="grid gap-6 xl:grid-cols-2">

        {/* Chart 1: Actual vs Predicted */}
        <ChartCard
          title="Actual vs Predicted RUL"
          description="Official NASA test results across 100 engines. The dashed diagonal represents a perfect prediction."
        >
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{
                top: 15,
                right: 20,
                bottom: 25,
                left: 5,
              }}>
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  type="number"
                  dataKey="actual_rul"
                  name="Actual RUL"
                  domain={[0, maxRul]}
                  label={{
                    value: "Actual RUL (cycles)",
                    position: "insideBottom",
                    offset: -12,
                  }}
                />

                <YAxis
                  type="number"
                  dataKey="predicted_rul"
                  name="Predicted RUL"
                  domain={[0, maxRul]}
                  width={48}
                />

                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                />

                <ReferenceLine
                  segment={[
                    { x: 0, y: 0 },
                    { x: maxRul, y: maxRul },
                  ]}
                  stroke="#64748b"
                  strokeDasharray="5 5"
                />

                <Scatter
                  name="NASA Test Engines"
                  data={predictions}
                  fill="#0d9488"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Chart 2: SHAP Feature Importance */}
        <ChartCard
          title="SHAP Feature Importance"
          description="Top ten features ranked by mean absolute SHAP value on 40 sampled training records."
        >
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={feature_importance}
                layout="vertical"
                margin={{
                  top: 10,
                  right: 20,
                  bottom: 10,
                  left: 0,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                />

                <XAxis type="number" />

                <YAxis
                  type="category"
                  dataKey="feature"
                  width={145}
                  tick={{ fontSize: 11 }}
                />

                <Tooltip
                  formatter={(value) => [
                    Number(value).toFixed(2),
                    "Mean |SHAP|",
                  ]}
                />

                <Bar
                  dataKey="importance"
                  fill="#0d9488"
                  radius={[0, 5, 5, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Chart 3: Lifecycle Performance */}
        <ChartCard
          title="Lifecycle Prediction Performance"
          description="RF_B development-validation errors at retrospective 50%, 70%, and 90% lifecycle checkpoints."
        >
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lifecycle}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis dataKey="stage" />
                <YAxis />

                <Tooltip
                  formatter={(value) =>
                    `${Number(value).toFixed(2)} cycles`
                  }
                />

                <Legend />

                <Bar
                  dataKey="mae"
                  name="MAE"
                  fill="#0d9488"
                  radius={[5, 5, 0, 0]}
                />

                <Bar
                  dataKey="rmse"
                  name="RMSE"
                  fill="#334155"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Chart 4: Prediction Error */}
        <ChartCard
          title="Prediction Error Analysis"
          description="Signed error against the last observed cycle. Positive values indicate overestimated remaining life."
        >
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{
                top: 15,
                right: 20,
                bottom: 25,
                left: 5,
              }}>
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  type="number"
                  dataKey="last_cycle"
                  name="Observed Cycle"
                  label={{
                    value: "Last Observed Cycle",
                    position: "insideBottom",
                    offset: -12,
                  }}
                />

                <YAxis
                  type="number"
                  dataKey="signed_error"
                  name="Prediction Error"
                  width={48}
                />

                <ReferenceLine
                  y={0}
                  stroke="#64748b"
                  strokeDasharray="5 5"
                />

                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                />

                <Scatter
                  name="Prediction Error"
                  data={predictions}
                  fill="#0d9488"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

      </section>

      {/* Model Limitation */}
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-0.5 shrink-0 text-amber-700"
            size={22}
          />

          <div>
            <h3 className="font-semibold text-amber-900">
              Model Reliability Notice
            </h3>

            <p className="mt-2 text-sm leading-6 text-amber-800">
              AeroGuard AI is trained using simulated NASA
              engine data. The model has a tendency to
              overestimate remaining useful life and is
              intended for research and educational use,
              not real aircraft maintenance decisions.
            </p>
          </div>
        </div>
      </section>

      {/* Data Source Information */}
      <section className="flex flex-wrap items-center gap-3 rounded-xl bg-teal-50 p-4 text-xs text-teal-800">
        <TrendingUp size={18} />

        <p>
          Analytics loaded from the AeroGuard AI FastAPI
          backend using saved ML evaluation reports.
        </p>
      </section>

    </div>
  );
}
