
import { useEffect, useState } from "react";
import { Database, History } from "lucide-react";

export default function PredictionHistory({
  refreshKey = 0,
}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadPredictions() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          "/api/predictions",
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(
            `Unable to load prediction history (HTTP ${response.status})`
          );
        }

        const data = await response.json();

        if (!Array.isArray(data.records)) {
          throw new Error("Invalid prediction history response.");
        }

        setRecords(data.records);
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

    loadPredictions();

    return () => controller.abort();
  }, [refreshKey]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-teal-50 p-3">
          <History className="text-teal-600" size={22} />
        </div>

        <div>
          <h3 className="text-xl font-bold text-slate-900">
            Prediction History
          </h3>

          <p className="text-sm text-slate-500">
            Recent predictions saved in MongoDB Atlas
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">
          Loading prediction history...
        </p>
      ) : error ? (
        <p role="alert" className="mt-6 text-sm text-red-600">
          {error}
        </p>
      ) : records.length === 0 ? (
        <div className="mt-6 rounded-xl bg-slate-50 p-8 text-center">
          <Database
            size={30}
            className="mx-auto text-slate-400"
          />

          <p className="mt-3 text-sm text-slate-600">
            No saved predictions yet.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">

            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3">Engine</th>
                <th className="px-4 py-3">Last Cycle</th>
                <th className="px-4 py-3">Predicted RUL</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>

            <tbody>
              {records.map((record) => (
                <tr
                  key={record._id}
                  className="border-t border-slate-100"
                >
                  <td className="px-4 py-3 font-semibold">
                    #{record.engineId}
                  </td>

                  <td className="px-4 py-3">
                    {record.lastCycle}
                  </td>

                  <td className="px-4 py-3 font-semibold text-teal-700">
                    {Number(
                      record.predictedRulCycles
                    ).toFixed(2)} cycles
                  </td>

                  <td className="px-4 py-3">
                    {record.modelVersion}
                  </td>

                  <td className="px-4 py-3 text-slate-500">
                    {record.createdAt
                      ? new Date(
                          record.createdAt
                        ).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Showing up to 20 recent records from NASA FD001
        simulated engine predictions.
      </p>

    </section>
  );
}
