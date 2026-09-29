import React, { useState, useMemo } from "react";
import { Bar } from "react-chartjs-2";
import StatusBadge from "../components/StatusBadge";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";

export default function EvaluationPage({
  evaluationData,
  loadingEvaluation,
  evaluationError,
  onRetry,
}) {
  const [evalHorizonFilter, setEvalHorizonFilter] = useState("all");
  const [evalLevelFilter, setEvalLevelFilter] = useState("national");
  const [selectedMetric, setSelectedMetric] = useState("MAE");

  // Summary metadata values
  const numOrigins = evaluationData?.num_origins || 6;
  const originsList = evaluationData?.origins || [
    "2025-01-01",
    "2025-02-01",
    "2025-03-01",
    "2025-04-01",
    "2025-05-01",
    "2025-06-01",
  ];
  const horizonsList = evaluationData?.horizons || [7, 14, 30];

  // Filtered rows for the benchmark table
  const filteredRows = useMemo(() => {
    if (!evaluationData) return [];
    const sourceRows =
      evaluationData.pooled_results || evaluationData.detailed_results || [];

    return sourceRows.filter((row) => {
      const matchHorizon =
        evalHorizonFilter === "all" || String(row.horizon) === String(evalHorizonFilter);
      const matchLevel =
        evalLevelFilter === "all" ||
        String(row.level).toLowerCase() === String(evalLevelFilter).toLowerCase();
      return matchHorizon && matchLevel;
    });
  }, [evaluationData, evalHorizonFilter, evalLevelFilter]);

  // Find lowest observed value for current filter view (for neutral indicator)
  const lowestStats = useMemo(() => {
    if (!filteredRows || filteredRows.length === 0) return { minMae: null, minWmape: null };
    const minMae = Math.min(...filteredRows.map((r) => r.MAE));
    const minWmape = Math.min(...filteredRows.map((r) => r.WMAPE));
    return { minMae, minWmape };
  }, [filteredRows]);

  // Construct Bar Chart Data
  const chartData = useMemo(() => {
    if (!filteredRows || filteredRows.length === 0) return null;

    // Isolate rows for selected metric comparison
    // If multiple horizons are shown, group by method & horizon
    const displayRows = filteredRows.slice(0, 12);
    const labels = displayRows.map((r) => `${r.method} (${r.horizon}d, ${r.level})`);

    const metricColors = {
      MAE: { bg: "rgba(37, 99, 235, 0.8)", border: "#2563eb" },
      RMSE: { bg: "rgba(14, 165, 233, 0.8)", border: "#0ea5e9" },
      WMAPE: { bg: "rgba(16, 185, 129, 0.8)", border: "#10b981" },
    };

    const color = metricColors[selectedMetric] || metricColors.MAE;

    return {
      labels,
      datasets: [
        {
          label: `${selectedMetric} ${selectedMetric === "WMAPE" ? "(%)" : "(MU)"}`,
          data: displayRows.map((r) => r[selectedMetric]),
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }, [filteredRows, selectedMetric]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        padding: 10,
        callbacks: {
          label: (ctx) => `${selectedMetric}: ${Number(ctx.parsed.y).toFixed(2)} ${selectedMetric === "WMAPE" ? "%" : "MU"}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: "#f1f5f9" },
        ticks: { color: "#475569", font: { size: 11 } },
      },
      y: {
        grid: { color: "#f1f5f9" },
        ticks: {
          color: "#64748b",
          font: { size: 11 },
          callback: (value) => `${value} ${selectedMetric === "WMAPE" ? "%" : "MU"}`,
        },
        title: {
          display: true,
          text: `${selectedMetric} ${selectedMetric === "WMAPE" ? "(Percentage %)" : "(Million Units / MU)"}`,
          color: "#475569",
          font: { size: 12, weight: "500" },
        },
      },
    },
  };

  return (
    <div className="page-content evaluation-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Model Evaluation</h1>
          <p className="page-subtitle">
            Empirical performance from expanding-window rolling-origin backtesting.
          </p>
        </div>
      </div>

      {/* Methodology & Parameter Banner */}
      <div className="content-card evaluation-banner-card">
        <div className="banner-grid">
          <div className="banner-item">
            <span className="banner-label">Evaluation Methodology</span>
            <span className="banner-value">Expanding-Window Rolling-Origin</span>
            <span className="banner-caption">Walk-forward out-of-sample backtest</span>
          </div>

          <div className="banner-item">
            <span className="banner-label">Forecast Origins</span>
            <span className="banner-value">{numOrigins} Forecast Origins</span>
            <span className="banner-caption mono">{originsList.join(", ")}</span>
          </div>

          <div className="banner-item">
            <span className="banner-label">Forecast Horizons</span>
            <span className="banner-value">{horizonsList.map((h) => `${h}d`).join(" / ")} Horizons</span>
            <span className="banner-caption">7, 14, and 30 day forward windows</span>
          </div>

          <div className="banner-item">
            <span className="banner-label">Forecasting Methods</span>
            <span className="banner-value">4 Forecast Methods</span>
            <span className="banner-caption">Base LightGBM, Bottom-Up, Top-Down, MinT-Shrink</span>
          </div>
        </div>
      </div>

      {/* Filter and Metric Controls */}
      <div className="content-card controls-card">
        <div className="controls-grid">
          <div className="control-item">
            <label className="control-label" htmlFor="eval-horizon-select">
              Forecast Horizon
            </label>
            <select
              id="eval-horizon-select"
              className="control-select"
              value={evalHorizonFilter}
              onChange={(e) => setEvalHorizonFilter(e.target.value)}
            >
              <option value="all">All Horizons (7d, 14d, 30d)</option>
              <option value="7">7 Days</option>
              <option value="14">14 Days</option>
              <option value="30">30 Days</option>
            </select>
          </div>

          <div className="control-item">
            <label className="control-label" htmlFor="eval-level-select">
              Hierarchy Level
            </label>
            <select
              id="eval-level-select"
              className="control-select"
              value={evalLevelFilter}
              onChange={(e) => setEvalLevelFilter(e.target.value)}
            >
              <option value="all">All Levels</option>
              <option value="national">National (Level 0)</option>
              <option value="region">Regional Grids (Level 1)</option>
              <option value="state">States & Consumers (Level 2)</option>
              <option value="overall">Overall System Aggregate</option>
            </select>
          </div>

          <div className="control-item">
            <label className="control-label">Metric for Chart</label>
            <div className="segmented-controls">
              {["MAE", "RMSE", "WMAPE"].map((metric) => (
                <button
                  key={metric}
                  className={`segment-btn ${selectedMetric === metric ? "active" : ""}`}
                  onClick={() => setSelectedMetric(metric)}
                >
                  {metric}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Evaluation Chart */}
      <div className="content-card chart-card">
        <div className="chart-header-row">
          <div>
            <h3 className="card-section-title">Comparative Metric Distribution</h3>
            <p className="card-section-subtitle">
              Visual comparison of {selectedMetric} across methods (Horizon: {evalHorizonFilter === "all" ? "All" : `${evalHorizonFilter}d`}, Level: {evalLevelFilter})
            </p>
          </div>
        </div>

        {loadingEvaluation ? (
          <LoadingState message="Loading empirical benchmark metrics..." />
        ) : evaluationError ? (
          <ErrorState
            title="Unable to load evaluation benchmark"
            message={evaluationError}
            onRetry={onRetry}
          />
        ) : chartData ? (
          <div className="chart-wrapper-bar">
            <Bar data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div className="empty-state-text">No evaluation data matching the selected filter.</div>
        )}
      </div>

      {/* Evaluation Table */}
      <div className="content-card table-card">
        <div className="table-header-row">
          <div>
            <h3 className="card-section-title">Benchmark Results Table</h3>
            <p className="card-section-subtitle">
              Detailed empirical evaluation metrics pooled across the 6 historical backtest origins
            </p>
          </div>
          <span className="results-count-badge">
            {filteredRows.length} {filteredRows.length === 1 ? "Result" : "Results"}
          </span>
        </div>

        <div className="table-container">
          <table className="standard-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Level</th>
                <th>Horizon</th>
                <th>MAE (MU)</th>
                <th>RMSE (MU)</th>
                <th>WMAPE (%)</th>
                <th>Coherence Error (MU)</th>
                <th>Coherent</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-cell">
                    No benchmark rows found matching selected filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, idx) => {
                  const isLowestMae =
                    lowestStats.minMae !== null && r.MAE === lowestStats.minMae;
                  const isLowestWmape =
                    lowestStats.minWmape !== null && r.WMAPE === lowestStats.minWmape;

                  return (
                    <tr key={idx}>
                      <td className="font-medium text-primary">{r.method}</td>
                      <td>
                        <span className="level-tag">{r.level}</span>
                      </td>
                      <td className="mono">{r.horizon}d</td>
                      <td className="mono">
                        {r.MAE.toFixed(2)}{" "}
                        {isLowestMae && (
                          <span className="pill-indicator pill-neutral">Lowest observed MAE</span>
                        )}
                      </td>
                      <td className="mono">{r.RMSE.toFixed(2)}</td>
                      <td className="mono">
                        {r.WMAPE.toFixed(2)}%{" "}
                        {isLowestWmape && (
                          <span className="pill-indicator pill-neutral">Lowest observed WMAPE</span>
                        )}
                      </td>
                      <td className="mono">
                        {r.coherence_error !== undefined ? r.coherence_error.toFixed(2) : "0.00"}
                      </td>
                      <td>
                        <StatusBadge
                          status={r.is_coherent ? "COHERENT" : "INCOHERENT"}
                          label={r.is_coherent ? "Yes" : "No"}
                          size="sm"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="card-footer-note">
          <span>* Metrics are computed out-of-sample across {numOrigins} expanding origins without future data leakage.</span>
          <span>* MU = Million Units (1 MU = 1 GWh = $10^6$ kWh).</span>
        </div>
      </div>
    </div>
  );
}
