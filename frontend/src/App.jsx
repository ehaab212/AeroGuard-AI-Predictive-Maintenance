
import { lazy, Suspense, useEffect, useState } from "react";
import RULPrediction from "./components/RULPrediction";

import {
  LayoutDashboard,
  Activity,
  BarChart3,
  Cpu,
  ShieldCheck,
  Server,
} from "lucide-react";

const EngineFleet = lazy(
  () => import("./components/EngineFleet")
);
const ModelAnalytics = lazy(
  () => import("./components/ModelAnalytics")
);
// ==============================
// Sidebar Navigation
// ==============================

const menuItems = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "RUL Prediction", icon: Activity },
  { name: "Analytics", icon: BarChart3 },
  { name: "Engine Fleet", icon: Cpu },
];

// ==============================
// Model Performance Metrics
// ==============================

const metrics = [
  {
    title: "Test MAE",
    value: "17.77",
    unit: "cycles",
  },
  {
    title: "Test RMSE",
    value: "25.16",
    unit: "cycles",
  },
  {
    title: "Test Engines",
    value: "100",
    unit: "engines",
  },
  {
    title: "Model Features",
    value: "123",
    unit: "features",
  },
];

// ==============================
// Overview Dashboard Component
// ==============================

function OverviewDashboard() {
  return (
    <div className="space-y-7">

      {/* Welcome Banner */}
      <section className="rounded-2xl bg-slate-900 p-8 text-white">

        <p className="text-sm text-teal-300">
          Intelligent Maintenance
        </p>

        <h3 className="mt-3 text-3xl font-bold">
          Predict Engine Remaining Useful Life
        </h3>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          AeroGuard AI uses a trained Random Forest model
          to estimate remaining operating cycles from
          NASA C-MAPSS simulated engine data.
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs text-teal-100">
          <Activity size={15} />
          Random Forest RF_B | Model v1.0.0
        </div>

      </section>

      {/* Performance Metric Cards */}
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">

        {metrics.map((metric) => (
          <div
            key={metric.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >

            <p className="text-sm text-slate-500">
              {metric.title}
            </p>

            <h3 className="mt-4 text-3xl font-bold text-slate-900">
              {metric.value}
            </h3>

            <p className="mt-2 text-xs text-slate-500">
              {metric.unit}
            </p>

          </div>
        ))}

      </section>

      {/* Model Information */}
      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">

        <h3 className="text-xl font-semibold text-slate-900">
          Model Overview
        </h3>

        <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">

          <p className="text-slate-600">
            Algorithm:{" "}
            <strong className="text-slate-900">
              Random Forest RF_B
            </strong>
          </p>

          <p className="text-slate-600">
            Dataset:{" "}
            <strong className="text-slate-900">
              NASA C-MAPSS FD001
            </strong>
          </p>

          <p className="text-slate-600">
            Model Version:{" "}
            <strong className="text-slate-900">
              1.0.0
            </strong>
          </p>

          <p className="text-slate-600">
            Active Sensors:{" "}
            <strong className="text-slate-900">
              15
            </strong>
          </p>

          <p className="text-slate-600">
            Engine Training Records:{" "}
            <strong className="text-slate-900">
              20,631
            </strong>
          </p>

          <p className="text-slate-600">
            Model Input Features:{" "}
            <strong className="text-slate-900">
              123
            </strong>
          </p>

        </div>

        <div className="mt-6 rounded-xl bg-amber-50 p-4">
          <p className="text-xs leading-5 text-amber-800">
            Research demonstration only. This model is trained
            using simulated NASA C-MAPSS data and is not
            validated for real aircraft maintenance decisions.
          </p>
        </div>

      </section>

    </div>
  );
}

// ==============================
// Placeholder for Future Pages
// ==============================

function ComingSoonPage({ title, description }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">

      <h3 className="text-2xl font-semibold text-slate-900">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-slate-500">
        {description}
      </p>

      <span className="mt-6 inline-block rounded-full bg-teal-50 px-4 py-2 text-xs font-medium text-teal-700">
        Under Development
      </span>

    </section>
  );
}

// ==============================
// Main AeroGuard AI Application
// ==============================

export default function App() {

  const [apiStatus, setApiStatus] = useState("Checking...");
  const [activePage, setActivePage] = useState("Overview");

  // ==============================
  // FastAPI Connection Health Check
  // ==============================

  useEffect(() => {

    const controller = new AbortController();

    async function checkAPI() {
      try {

        const response = await fetch("/api/health", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("FastAPI unavailable");
        }

        const data = await response.json();

        setApiStatus(
          data.status === "healthy" && data.model_loaded
            ? "Connected"
            : "Offline"
        );

      } catch (error) {

        if (error.name !== "AbortError") {
          setApiStatus("Offline");
        }

      }
    }

    checkAPI();

    return () => controller.abort();

  }, []);

  // ==============================
  // Page Rendering
  // ==============================

  
function renderPage() {
  switch (activePage) {
    case "Overview":
      return <OverviewDashboard />;

    case "RUL Prediction":
      return <RULPrediction />;

    case "Analytics":
      return <ModelAnalytics />;

    case "Engine Fleet":
      return <EngineFleet />;

    default:
      return <OverviewDashboard />;
  }
}


  return (
    <div className="min-h-screen bg-slate-100 lg:flex">

      {/* ==============================
          Sidebar Navigation
      ============================== */}

      <aside className="bg-slate-900 p-6 text-white lg:min-h-screen lg:w-64 lg:shrink-0">

        {/* Application Branding */}
        <div className="flex items-center gap-3">

          <div className="rounded-xl bg-teal-600 p-3">
            <ShieldCheck size={25} />
          </div>

          <div>
            <h1 className="text-xl font-bold">
              AeroGuard AI
            </h1>

            <p className="text-xs text-slate-400">
              Predictive Intelligence
            </p>
          </div>

        </div>

        {/* Navigation Label */}
        <p className="mt-12 mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Navigation
        </p>

        {/* Navigation Links */}
        <nav className="flex flex-wrap gap-2 lg:flex-col">

          {menuItems.map((item) => {

            const Icon = item.icon;

            return (
              <button
                key={item.name}
                type="button"
                onClick={() => setActivePage(item.name)}
                aria-current={
                  activePage === item.name
                    ? "page"
                    : undefined
                }
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-colors ${
                  activePage === item.name
                    ? "bg-teal-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >

                <Icon size={19} />

                <span>{item.name}</span>

              </button>
            );

          })}

        </nav>

        {/* Sidebar Footer */}
        <div className="mt-12 hidden rounded-xl border border-slate-700 p-4 lg:block">

          <p className="text-sm font-semibold text-white">
            AeroGuard AI v1.0
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Machine Learning powered predictive
            maintenance research platform.
          </p>

        </div>

      </aside>

      {/* ==============================
          Main Application Content
      ============================== */}

      <main className="min-w-0 flex-1">

        {/* Dashboard Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-6 md:px-8">

          <div>

            <p className="text-sm font-medium text-teal-700">
              AeroGuard AI Workspace
            </p>

            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              {activePage}
            </h2>

          </div>

          {/* API Status Indicator */}
          <div className="flex items-center gap-3 rounded-full border border-slate-200 px-4 py-2 text-sm">

            <span
              className={`h-2.5 w-2.5 rounded-full ${
                apiStatus === "Connected"
                  ? "bg-emerald-500"
                  : apiStatus === "Checking..."
                  ? "bg-amber-400"
                  : "bg-red-500"
              }`}
            />

            <Server size={16} className="text-teal-600" />

            <span className="font-medium text-slate-700">
              FastAPI: {apiStatus}
            </span>

          </div>

        </header>

        {/* Active Page Content */}
        <div className="mx-auto max-w-7xl p-6 md:p-8">

         <Suspense
  fallback={
    <div className="rounded-2xl bg-white p-8 text-slate-500">
      Loading page...
    </div>
  }
>
  {renderPage()}
</Suspense>

        </div>

      </main>

    </div>
  );
}
