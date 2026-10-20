
import { useMemo, useState } from "react";
import Papa from "papaparse";
import {
  Upload,
  Activity,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  LoaderCircle,
} from "lucide-react";

const REQUIRED_COLUMNS = [
  "engine_id",
  "cycle",
  ...Array.from({ length: 3 }, (_, i) => `setting_${i + 1}`),
  ...Array.from({ length: 21 }, (_, i) => `sensor_${i + 1}`),
];

function validateRecord(row, rowNumber) {
  const record = {};

  for (const column of REQUIRED_COLUMNS) {
    const rawValue = row[column];

    if (
      rawValue === undefined ||
      rawValue === null ||
      String(rawValue).trim() === ""
    ) {
      throw new Error(
        `Row ${rowNumber}: missing value for ${column}`
      );
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value)) {
      throw new Error(
        `Row ${rowNumber}: invalid number in ${column}`
      );
    }

    record[column] = value;
  }

  for (const column of ["engine_id", "cycle"]) {
    if (
      !Number.isSafeInteger(record[column]) ||
      record[column] < 1
    ) {
      throw new Error(
        `Row ${rowNumber}: ${column} must be a positive integer`
      );
    }
  }

  return record;
}

function parseNASAFile(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    const values = line.split(/\s+/);

    if (values.length !== REQUIRED_COLUMNS.length) {
      throw new Error(
        `Line ${index + 1}: expected 26 values, found ${values.length}`
      );
    }

    const row = Object.fromEntries(
      REQUIRED_COLUMNS.map((column, i) => [
        column,
        values[i],
      ])
    );

    return validateRecord(row, index + 1);
  });
}

function parseCSVFile(text) {
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) =>
      header.replace(/^\uFEFF/, "").trim(),
  });

  if (parsed.errors.length) {
    throw new Error(
      parsed.errors[0].message || "Invalid CSV format"
    );
  }

  return parsed.data.map((row, index) =>
    validateRecord(row, index + 2)
  );
}

export default function RULPrediction() {
  const [fileName, setFileName] = useState("");
  const [records, setRecords] = useState([]);
  const [selectedEngine, setSelectedEngine] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const engineIds = useMemo(
    () =>
      [...new Set(records.map((row) => row.engine_id))].sort(
        (a, b) => a - b
      ),
    [records]
  );

  const history = useMemo(
    () =>
      records
        .filter(
          (row) => row.engine_id === Number(selectedEngine)
        )
        .sort((a, b) => a.cycle - b.cycle),
    [records, selectedEngine]
  );

  async function handleUpload(event) {
    const file = event.target.files?.[0];

    setError("");
    setPrediction(null);
    setRecords([]);
    setSelectedEngine("");
    setFileName("");

    if (!file) return;

    try {
      if (file.size > 15 * 1024 * 1024) {
        throw new Error("Please upload a file smaller than 15 MB.");
      }

      const extension = file.name.split(".").pop().toLowerCase();

      if (!["txt", "csv"].includes(extension)) {
        throw new Error("Only .txt and .csv files are supported.");
      }

      const text = await file.text();

      const parsed =
        extension === "txt"
          ? parseNASAFile(text)
          : parseCSVFile(text);

      if (!parsed.length) {
        throw new Error("The uploaded file is empty.");
      }

      const ids = [
        ...new Set(parsed.map((row) => row.engine_id)),
      ].sort((a, b) => a - b);

      setRecords(parsed);
      setSelectedEngine(String(ids[0]));
      setFileName(file.name);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePrediction() {
    setError("");
    setPrediction(null);

    if (!history.length) {
      setError("Please upload a file and select an engine.");
      return;
    }

    if (history.length > 500) {
      setError(
        "This engine has more than 500 records. The current API supports at most 500 records per request."
      );
      return;
    }

    for (let i = 1; i < history.length; i++) {
      if (history[i].cycle !== history[i - 1].cycle + 1) {
        setError(
          "Engine history must contain consecutive, non-duplicate cycles."
        );
        return;
      }
    }

    setLoading(true);

    try {
      const response = await fetch("/api/predict/rul", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: history }),
      });

      const data = await response.json();

      if (!response.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : "Prediction request failed.";

        throw new Error(detail);
      }

      if (!data.prediction) {
        throw new Error("No prediction returned by the API.");
      }

      setPrediction(data.prediction);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot reach FastAPI. Check that the backend is running."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-slate-900 p-7 text-white">
        <div className="flex items-center gap-2 text-teal-300">
          <Activity size={20} />
          <span className="text-sm font-medium">
            AeroGuard Prediction Engine
          </span>
        </div>

        <h2 className="mt-4 text-2xl font-bold md:text-3xl">
          Remaining Useful Life Prediction
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Upload NASA C-MAPSS engine sensor history and
          estimate remaining operating cycles using our
          trained Random Forest model.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Upload Engine Data
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Supported: NASA FD001 raw .txt or CSV with
              named raw sensor columns.
            </p>
          </div>

          <label
            htmlFor="engine-file"
            className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/50 p-8 text-center hover:bg-teal-50"
          >
            <Upload size={32} className="text-teal-600" />

            <span className="mt-4 font-medium text-slate-900">
              Choose an engine data file
            </span>

            <span className="mt-2 text-xs text-slate-500">
              .txt or .csv — maximum 15 MB
            </span>

            <input
              id="engine-file"
              type="file"
              accept=".txt,.csv"
              onChange={handleUpload}
              className="sr-only"
            />
          </label>

          {fileName && (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 size={18} />
                File loaded: {fileName}
              </div>

              <p className="mt-2 text-xs">
                {records.length} sensor records across{" "}
                {engineIds.length} engines.
              </p>
            </div>
          )}

          {engineIds.length > 0 && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="engine-select"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Select Engine
                </label>

                <select
                  id="engine-select"
                  value={selectedEngine}
                  onChange={(event) => {
                    setSelectedEngine(event.target.value);
                    setPrediction(null);
                    setError("");
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500"
                >
                  {engineIds.map((id) => (
                    <option key={id} value={id}>
                      Engine {id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">
                    Selected Engine
                  </p>
                  <p className="mt-2 text-xl font-bold">
                    #{selectedEngine}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">
                    Observed Records
                  </p>
                  <p className="mt-2 text-xl font-bold">
                    {history.length}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">
                    Latest Cycle
                  </p>
                  <p className="mt-2 text-xl font-bold">
                    {history.at(-1)?.cycle ?? "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700"
            >
              <AlertTriangle size={19} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handlePrediction}
            disabled={loading || history.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <LoaderCircle size={20} className="animate-spin" />
            ) : (
              <Activity size={20} />
            )}

            {loading ? "Predicting..." : "Predict Remaining Life"}
          </button>
        </section>

        <section
          aria-live="polite"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Cpu size={22} className="text-teal-600" />
            <h3 className="text-lg font-semibold">
              Prediction Results
            </h3>
          </div>

          {prediction ? (
            <div className="mt-8 space-y-6">
              <div className="rounded-2xl bg-teal-50 p-6 text-center">
                <p className="text-sm text-teal-800">
                  Estimated Remaining Useful Life
                </p>

                <p className="mt-4 text-5xl font-bold tracking-tight text-teal-700">
                  {Number(
                    prediction.predicted_rul_cycles
                  ).toFixed(2)}
                </p>

                <p className="mt-2 text-sm text-teal-800">
                  Operating cycles
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Engine</span>
                  <strong>#{prediction.engine_id}</strong>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">
                    Last Observed Cycle
                  </span>
                  <strong>{prediction.last_cycle}</strong>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Model Version</span>
                  <strong>{prediction.model_version}</strong>
                </div>
              </div>

              <p className="rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-800">
                This estimate is generated from simulated
                NASA engine data. The model can overestimate
                remaining life and must not be used for
                real maintenance decisions.
              </p>
            </div>
          ) : (
            <div className="mt-12 text-center text-sm leading-6 text-slate-500">
              <Activity
                size={40}
                className="mx-auto mb-4 text-slate-300"
              />
              Upload engine data and click Predict to display
              the RUL estimate.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
