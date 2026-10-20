
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

  const [engines, setEngines] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");

  const [history, setHistory] = useState(null);
  const [selectedSensor, setSelectedSensor] =
    useState("sensor_2");

  const [prediction, setPrediction] = useState(null);

  const [loadingFleet, setLoadingFleet] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [predicting, setPredicting] = useState(false);

  const [fleetError, setFleetError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [predictionError, setPredictionError] = useState("");

  // ======================================
  // Load engine metadata from FastAPI
  // ======================================

  useEffect(() => {
    const controller = new AbortController();

    async function loadFleet() {
      try {
        const response = await fetch(
          "/api/fleet/engines",
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(
            `Fleet API returned HTTP ${response.status}`
          );
        }

        const data = await response.json();

        if (!Array.isArray(data.engines)) {
          throw new Error("Invalid fleet response.");
        }

        setEngines(data.engines);

        if (data.engines.length > 0) {
          setSelectedId(data.engines[0].engine_id);
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
  // Load selected engine sensor history
  // ======================================

  useEffect(() => {

    if (selectedId === null) return;

    const controller = new AbortController();

    async function loadEngineHistory() {
      setLoadingHistory(true);
      setHistoryError("");
      setHistory(null);
      setPrediction(null);
      setPredictionError("");

      try {
        const response = await fetch(
          `/api/fleet/engines/${selectedId}/history`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(
            `Engine history request failed: HTTP ${response.status}`
          );
        }

        const data = await response.json();

        if (!Array.isArray(data.records)) {
          throw new Error("Invalid engine history.");
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
  // Search engines by ID
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
  // Request real model prediction
  // ======================================

  async function predictSelectedEngine() {

    if (!history?.records?.length || predicting) return;

    setPredictionError("");
    setPrediction(null);
    setPredicting(true);

    try {
      const response = await fetch(
        "/api/predict/rul",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            records: history.records,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Prediction request failed."
        );
      }

      if (!data.prediction) {
        throw new Error("Missing prediction response.");
      }

      setPrediction(data.prediction);

    } catch (error) {
      setPredictionError(error.message);

    } finally {
      setPredicting(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* Page Header */}
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
          inspect recorded sensor measurements, and
          request Remaining Useful Life predictions.
        </p>

      </section>

      {/* Fleet Summary */}
      <section className="grid gap-4 sm:grid-cols-3">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Total Engines
          </p>

          <h3 className="mt-3 text-3xl font-bold">
            {engines.length}
          </h3>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Selected Engine
          </p>

          <h3 className="mt-3 text-3xl font-bold">
            {selectedId === null ? "—" : `#${selectedId}`}
          </h3>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">
            Last Observed Cycle
          </p>

          <h3 className="mt-3 text-3xl font-bold">
            {selectedEngine?.last_cycle ?? "—"}
          </h3>
        </div>

      </section>

      <div className="grid gap-6 xl:grid-cols-3">

        {/* Engine Table */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center gap-2">
            <Database size={20} className="text-teal-600" />

            <h3 className="text-lg font-semibold">
              Engine Directory
            </h3>
          </div>

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

          {fleetError && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {fleetError}
            </p>
          )}

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

                      <td colSpan={3} className="p-0">
                        <button
                          type="button"
                          disabled={predicting}
                          onClick={() => {
                            setSelectedId(engine.engine_id);
                          }}
                          className={`grid w-full grid-cols-3 items-center border-b border-slate-100 px-3 py-3 text-left text-sm transition-colors ${
                            engine.engine_id === selectedId
                              ? "bg-teal-50 font-semibold text-teal-800"
                              : "hover:bg-slate-50"
                          } disabled:cursor-wait`}
                        >
                          <span>#{engine.engine_id}</span>
                          <span>{engine.observed_records}</span>
                          <span>{engine.last_cycle}</span>
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

        {/* Engine Details */}
        <section className="space-y-6 xl:col-span-2">

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex flex-wrap items-center justify-between gap-3">

              <h3 className="text-lg font-semibold">
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
                  <option key={sensor} value={sensor}>
                    {sensor}
                  </option>
                ))}
              </select>

            </div>

            {historyError && (
              <p role="alert" className="mt-5 text-sm text-red-600">
                {historyError}
              </p>
            )}

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

                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history.records}>

                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                      />

                      <XAxis
                        dataKey="cycle"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tick={{ fontSize: 11 }}
                      />

                      <YAxis
                        domain={["auto", "auto"]}
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
                  Historical sensor measurements from simulated
                  engine data. These values are not live telemetry.
                </p>
              </>
            ) : (
              <p className="mt-6 text-sm text-slate-500">
                Select an engine to inspect its sensor history.
              </p>
            )}

          </div>

          {/* Prediction Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex items-center gap-2">
              <Activity size={20} className="text-teal-600" />

              <h3 className="text-lg font-semibold">
                Remaining Useful Life
              </h3>
            </div>

            <p className="mt-3 text-sm text-slate-500">
              Generate an RUL estimate using the saved
              Random Forest RF_B model.
            </p>

            <button
              type="button"
              onClick={predictSelectedEngine}
              disabled={
                predicting ||
                loadingHistory ||
                !history?.records?.length
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
                ? "Predicting..."
                : "Predict Engine RUL"}
            </button>

            {predictionError && (
              <p role="alert" className="mt-4 text-sm text-red-600">
                {predictionError}
              </p>
            )}

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

              </div>
            )}

            <div className="mt-5 flex gap-2 rounded-xl bg-amber-50 p-4">
              <AlertTriangle
                size={18}
                className="shrink-0 text-amber-700"
              />

              <p className="text-xs leading-5 text-amber-800">
                Estimates use NASA C-MAPSS simulated data.
                The model can overestimate remaining life
                and must not be used for real aircraft
                maintenance decisions.
              </p>
            </div>

          </div>

        </section>

      </div>

    </div>
  );
}
