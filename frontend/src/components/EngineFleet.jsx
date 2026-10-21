
import { useEffect, useMemo, useState } from "react";

import {
  Cpu,
  Search,
  Activity,
  AlertTriangle,
  Database,
  LoaderCircle,
} from "lucide-react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import PredictionHistory from "./PredictionHistory";

// ======================================
// Sensor Options
// ======================================

const SENSOR_OPTIONS = [
  "sensor_2",
  "sensor_3",
  "sensor_4",
  "sensor_7",
  "sensor_11",
  "sensor_15",
  "sensor_21",
];

export default function EngineFleet() {
  // ======================================
  // 1. Fleet States
  // ======================================

  const [engines, setEngines] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");

  // ======================================
  // 2. Sensor History States
  // ======================================

  const [history, setHistory] = useState(null);

  const [selectedSensor, setSelectedSensor] =
    useState("sensor_2");

  // ======================================
  // 3. Prediction States
  // ======================================

  const [prediction, setPrediction] = useState(null);

  const [historyRefreshKey, setHistoryRefreshKey] =
    useState(0);

  // ======================================
  // 4. Loading States
  // ======================================

  const [loadingFleet, setLoadingFleet] = useState(true);

  const [loadingHistory, setLoadingHistory] =
    useState(false);

  const [predicting, setPredicting] = useState(false);

  // ======================================
  // 5. Error States
  // ======================================

  const [fleetError, setFleetError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [predictionError, setPredictionError] =
    useState("");

  // ======================================
  // 6. Load Engine Fleet From FastAPI
  // ======================================

  useEffect(() => {
    const controller = new AbortController();

    async function loadFleet() {
      try {
        const response = await fetch(
          "/api/fleet/engines",
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Fleet API returned HTTP ${response.status}`
          );
        }

        const data = await response.json();

        if (!Array.isArray(data.engines)) {
          throw new Error(
            "Invalid fleet response received."
          );
        }

        setEngines(data.engines);

        if (data.engines.length > 0) {
          setSelectedId(
            data.engines[0].engine_id
          );
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          setFleetError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingFleet(false);
        }
      }
    }

    loadFleet();

    return () => controller.abort();
  }, []);

  // ======================================
  // 7. Load Selected Engine History
  // ======================================

  useEffect(() => {
    if (selectedId === null) {
      return;
    }

    const controller = new AbortController();

    async function loadEngineHistory() {
      setLoadingHistory(true);

      setHistoryError("");
      setPredictionError("");

      setHistory(null);
      setPrediction(null);

      try {
        const response = await fetch(
          `/api/fleet/engines/${selectedId}/history`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Engine history request failed: HTTP ${response.status}`
          );
        }

        const data = await response.json();

        if (!Array.isArray(data.records)) {
          throw new Error(
            "Invalid engine history received."
          );
        }

        setHistory(data);
      } catch (error) {
        if (error.name !== "AbortError") {
          setHistoryError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingHistory(false);
        }
      }
    }

    loadEngineHistory();

    return () => controller.abort();
  }, [selectedId]);

  // ======================================
  // 8. Search Engines
  // ======================================

  const filteredEngines = useMemo(() => {
    const query = search.trim();

    return engines.filter((engine) =>
      String(engine.engine_id).includes(query)
    );
  }, [engines, search]);

  const selectedEngine = engines.find(
    (engine) => engine.engine_id === selectedId
  );

  // ======================================
  // 9. Predict RUL Using Express + FastAPI
  //    and Save Result to MongoDB Atlas
  // ======================================

  async function predictSelectedEngine() {
    if (
      selectedId === null ||
      predicting ||
      loadingHistory ||
      !history?.records?.length ||
      history.engine_id !== selectedId
    ) {
      return;
    }

    setPredictionError("");
    setPrediction(null);
    setPredicting(true);

    try {
      // Express calls FastAPI for real ML inference
      // and saves the prediction in MongoDB.
      const response = await fetch(
        "/api/predictions",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            engine_id: selectedId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to generate and save prediction."
        );
      }

      const saved = data.record;

      if (
        !saved ||
        !Number.isFinite(saved.predictedRulCycles) ||
        saved.engineId !== selectedId
      ) {
        throw new Error(
          "Invalid saved prediction received."
        );
      }

      // Convert MongoDB record into the format
      // already used by this React component.
      setPrediction({
        engine_id: saved.engineId,

        last_cycle: saved.lastCycle,

        observed_records: saved.observedRecords,

        predicted_rul_cycles:
          saved.predictedRulCycles,

        model_version: saved.modelVersion,
      });

      // Refresh saved prediction history
      setHistoryRefreshKey(
        (previousValue) => previousValue + 1
      );
    } catch (error) {
      setPredictionError(error.message);
    } finally {
      setPredicting(false);
    }
  }

  // ======================================
  // 10. Frontend UI
  // ======================================

  return (
    <div className="space-y-6">

      {/* ======================================
          Page Header
      ====================================== */}

      <section className="rounded-2xl bg-slate-900 p-8 text-white">
        <div className="flex items-center gap-2 text-teal-300">
          <Cpu size={20} />

          <span className="text-sm font-medium">
            AeroGuard Fleet Intelligence
          </span>
        </div>

        <h2 className="mt-4 text-3xl font-bold">
          Engine Fleet Monitoring
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Explore NASA C-MAPSS FD001 simulated engines,
          inspect recorded sensor measurements,
          generate Remaining Useful Life predictions,
          and view saved prediction history.
        </p>
      </section>

      {/* ======================================
          Fleet Summary Cards
      ====================================== */}

      <section className="grid gap-4 sm:grid-cols-3">

        {/* Total Engines */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Total Engines
          </p>

          <h3 className="mt-3 text-3xl font-bold text-slate-900">
            {loadingFleet ? "..." : engines.length}
          </h3>
        </div>

        {/* Selected Engine */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Selected Engine
          </p>

          <h3 className="mt-3 text-3xl font-bold text-slate-900">
            {selectedId === null
              ? "—"
              : `#${selectedId}`}
          </h3>
        </div>

        {/* Last Observed Cycle */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Last Observed Cycle
          </p>

          <h3 className="mt-3 text-3xl font-bold text-slate-900">
            {selectedEngine?.last_cycle ?? "—"}
          </h3>
        </div>

      </section>

      {/* ======================================
          Fleet Directory and Engine Details
      ====================================== */}

      <div className="grid gap-6 xl:grid-cols-3">

        {/* ======================================
            Engine Directory
        ====================================== */}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center gap-2">
            <Database
              size={20}
              className="text-teal-600"
            />

            <h3 className="text-lg font-semibold text-slate-900">
              Engine Directory
            </h3>
          </div>

          {/* Search */}
          <div className="relative mt-5">
            <Search
              size={18}
              className="absolute left-3 top-3 text-slate-400"
            />

            <input
              type="search"
              placeholder="Search engine ID..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-teal-500"
            />
          </div>

          {/* Fleet API Error */}
          {fleetError && (
            <p
              role="alert"
              className="mt-4 text-sm text-red-600"
            >
              {fleetError}
            </p>
          )}

          {/* Loading or Engine Table */}
          {loadingFleet ? (
            <p className="mt-6 text-sm text-slate-500">
              Loading engines...
            </p>
          ) : (
            <div className="mt-5 max-h-[450px] overflow-y-auto">

              <table className="w-full text-left text-sm">

                <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-3">
                      Engine
                    </th>

                    <th className="px-3 py-3">
                      Records
                    </th>

                    <th className="px-3 py-3">
                      Cycle
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEngines.map((engine) => (
                    <tr key={engine.engine_id}>

                      <td
                        colSpan={3}
                        className="p-0"
                      >
                        <button
                          type="button"
                          disabled={predicting}
                          onClick={() =>
                            setSelectedId(
                              engine.engine_id
                            )
                          }
                          className={`grid w-full grid-cols-3 items-center border-b border-slate-100 px-3 py-3 text-left text-sm transition-colors ${
                            engine.engine_id === selectedId
                              ? "bg-teal-50 font-semibold text-teal-800"
                              : "hover:bg-slate-50"
                          } disabled:cursor-wait`}
                        >
                          <span>
                            #{engine.engine_id}
                          </span>

                          <span>
                            {engine.observed_records}
                          </span>

                          <span>
                            {engine.last_cycle}
                          </span>
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>

              </table>

              {filteredEngines.length === 0 && (
                <p className="p-5 text-center text-sm text-slate-500">
                  No matching engines found.
                </p>
              )}

            </div>
          )}

        </section>

        {/* ======================================
            Engine Details
        ====================================== */}

        <section className="space-y-6 xl:col-span-2">

          {/* ======================================
              Sensor History Card
          ====================================== */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex flex-wrap items-center justify-between gap-3">

              <h3 className="text-lg font-semibold text-slate-900">
                Engine {selectedId ?? "—"} — Sensor History
              </h3>

              <select
                value={selectedSensor}
                onChange={(event) =>
                  setSelectedSensor(event.target.value)
                }
                aria-label="Choose sensor"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
              >
                {SENSOR_OPTIONS.map((sensor) => (
                  <option
                    key={sensor}
                    value={sensor}
                  >
                    {sensor}
                  </option>
                ))}
              </select>

            </div>

            {/* Sensor API Error */}
            {historyError && (
              <p
                role="alert"
                className="mt-5 text-sm text-red-600"
              >
                {historyError}
              </p>
            )}

            {/* Sensor Chart */}
            {loadingHistory ? (
              <p className="mt-8 text-sm text-slate-500">
                Loading sensor measurements...
              </p>
            ) : history?.records?.length ? (
              <>
                <p className="mt-3 text-xs text-slate-500">
                  {history.observed_records} measurements
                  through cycle {history.last_cycle}.
                </p>

                <div className="mt-6 h-72 w-full">

                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <LineChart
                      data={history.records}
                    >

                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                      />

                      <XAxis
                        dataKey="cycle"
                        type="number"
                        domain={[
                          "dataMin",
                          "dataMax",
                        ]}
                        tick={{ fontSize: 11 }}
                      />

                      <YAxis
                        domain={[
                          "auto",
                          "auto",
                        ]}
                        width={60}
                        tick={{ fontSize: 11 }}
                      />

                      <Tooltip
                        formatter={(value) => [
                          Number(value).toFixed(4),
                          selectedSensor,
                        ]}
                      />

                      <Line
                        type="monotone"
                        dataKey={selectedSensor}
                        stroke="#0d9488"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />

                    </LineChart>
                  </ResponsiveContainer>

                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Historical sensor measurements from
                  simulated NASA engine data.
                  These are not live aircraft readings.
                </p>
              </>
            ) : (
              <p className="mt-6 text-sm text-slate-500">
                Select an engine to inspect
                its sensor history.
              </p>
            )}

          </div>

          {/* ======================================
              RUL Prediction Card
          ====================================== */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex items-center gap-2">
              <Activity
                size={20}
                className="text-teal-600"
              />

              <h3 className="text-lg font-semibold text-slate-900">
                Remaining Useful Life
              </h3>
            </div>

            <p className="mt-3 text-sm text-slate-500">
              Generate an RUL estimate using the saved
              Random Forest RF_B model. The result
              will also be stored in MongoDB Atlas.
            </p>

            {/* Predict Button */}
            <button
              type="button"
              onClick={predictSelectedEngine}
              disabled={
                predicting ||
                loadingHistory ||
                !history?.records?.length ||
                history?.engine_id !== selectedId
              }
              className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >

              {predicting && (
                <LoaderCircle
                  size={18}
                  className="animate-spin"
                />
              )}

              {predicting
                ? "Predicting and Saving..."
                : "Predict Engine RUL"}
            </button>

            {/* Prediction Error */}
            {predictionError && (
              <p
                role="alert"
                className="mt-4 text-sm text-red-600"
              >
                {predictionError}
              </p>
            )}

            {/* Prediction Result */}
            {prediction && (
              <div className="mt-6 rounded-2xl bg-teal-50 p-6">

                <p className="text-sm font-medium text-teal-800">
                  Estimated Remaining Useful Life
                </p>

                <p className="mt-3 text-4xl font-bold text-teal-700">
                  {Number(
                    prediction.predicted_rul_cycles
                  ).toFixed(2)}
                </p>

                <p className="mt-1 text-sm text-teal-800">
                  Operating cycles
                </p>

                <p className="mt-3 text-xs text-teal-700">
                  Model {prediction.model_version} ·
                  Engine #{prediction.engine_id}
                </p>

                <p className="mt-4 text-xs font-medium text-teal-700">
                  Prediction saved to MongoDB Atlas
                </p>

              </div>
            )}

            {/* Disclaimer */}
            <div className="mt-5 flex gap-2 rounded-xl bg-amber-50 p-4">

              <AlertTriangle
                size={18}
                className="shrink-0 text-amber-700"
              />

              <p className="text-xs leading-5 text-amber-800">
                Estimates use NASA C-MAPSS simulated
                data. The model can overestimate
                remaining life and must not be used
                for real aircraft maintenance decisions.
              </p>

            </div>

          </div>

        </section>

      </div>

      {/* ======================================
          11. MongoDB Prediction History
          This was missing in your old JSX.
      ====================================== */}

      <PredictionHistory
        refreshKey={historyRefreshKey}
      />

    </div>
  );
}
