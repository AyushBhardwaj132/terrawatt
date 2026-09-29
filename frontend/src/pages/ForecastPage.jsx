import React, { useState, useMemo } from "react";
import { Line } from "react-chartjs-2";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";

const ALL_METHODS = [
  "MinT-Shrink",
  "Bottom-Up",
  "Top-Down",
  "Base LightGBM",
];

export default function ForecastPage({
  nodes,
  selectedNode,
  onChangeNode,
  horizon,
  onChangeHorizon,
  selectedMethod,
  onChangeMethod,
  forecastList,
  loadingForecast,
  forecastError,
  onRetry,
}) {
  const [compareAllMethods, setCompareAllMethods] = useState(true);
  const [showActuals, setShowActuals] = useState(true);

  // Group nodes by level for organized dropdown
  const organizedNodes = useMemo(() => {
    const national = [];
    const regions = [];
    const states = [];

    nodes.forEach((n) => {
      const parts = n.split("/");
      if (parts.length === 1) national.push(n);
      else if (parts.length === 2) regions.push(n);
      else states.push(n);
    });

    return { national, regions, states };
  }, [nodes]);

  // Construct chart data
  const chartData = useMemo(() => {
    if (!forecastList || forecastList.length === 0) return null;

    const labels = forecastList.map((f) => f.date);
    const datasets = [];

    // Ground Truth Actuals
    if (showActuals) {
      const hasActuals = forecastList.some((f) => f.actual !== null && f.actual !== undefined);
      if (hasActuals) {
        datasets.push({
          label: "Ground Truth Actual",
          data: forecastList.map((f) => f.actual),
          borderColor: "#0f172a",
          backgroundColor: "#0f172a",
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.1,
        });
      }
    }

    const methodColorPalette = {
      "MinT-Shrink": { border: "#2563eb", bg: "rgba(37, 99, 235, 0.1)" },
      "Bottom-Up": { border: "#0891b2", bg: "rgba(8, 145, 178, 0.1)" },
      "Top-Down": { border: "#d97706", bg: "rgba(217, 119, 6, 0.1)" },
      "Base LightGBM": { border: "#9333ea", bg: "rgba(147, 51, 234, 0.1)" },
    };

    if (compareAllMethods) {
      ALL_METHODS.forEach((m) => {
        const isSelected = m === selectedMethod;
        const color = methodColorPalette[m] || { border: "#64748b" };

        datasets.push({
          label: `${m}${isSelected ? " (Selected)" : ""}`,
          data: forecastList.map((f) => {
            if (f.methods && f.methods[m] !== undefined) {
              return f.methods[m];
            }
            if (m === "MinT-Shrink") return f.mint_shrink ?? f.reconciled_forecast;
            if (m === "Bottom-Up") return f.bottom_up;
            if (m === "Top-Down") return f.top_down;
            return f.base_forecast;
          }),
          borderColor: color.border,
          borderWidth: isSelected ? 3.0 : 1.5,
          borderDash: m === "Base LightGBM" ? [4, 4] : [],
          pointRadius: isSelected ? 3.5 : 2,
          pointHoverRadius: 5,
          tension: 0.15,
        });
      });
    } else {
      const color = methodColorPalette[selectedMethod] || { border: "#2563eb" };
      datasets.push({
        label: `${selectedMethod} Forecast`,
        data: forecastList.map((f) => {
          if (f.methods && f.methods[selectedMethod] !== undefined) {
            return f.methods[selectedMethod];
          }
          return f.reconciled_forecast;
        }),
        borderColor: color.border,
        borderWidth: 2.5,
        borderDash: selectedMethod === "Base LightGBM" ? [4, 4] : [],
        pointRadius: 3.5,
        pointHoverRadius: 5.5,
        tension: 0.15,
      });
    }

    return { labels, datasets };
  }, [forecastList, selectedMethod, compareAllMethods, showActuals]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        align: "end",
        labels: {
          color: "#334155",
          font: { family: "'Inter', sans-serif", size: 12, weight: "500" },
          usePointStyle: true,
          boxWidth: 8,
        },
      },
      tooltip: {
        backgroundColor: "#0f172a",
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        borderColor: "#334155",
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} MU`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: "#f1f5f9" },
        ticks: { color: "#64748b", font: { size: 11 } },
      },
      y: {
        grid: { color: "#f1f5f9" },
        ticks: {
          color: "#64748b",
          font: { size: 11 },
          callback: (value) => `${value} MU`,
        },
        title: {
          display: true,
          text: "Daily Electricity Consumption (MU)",
          color: "#475569",
          font: { size: 12, weight: "500" },
        },
      },
    },
  };

  // Factual metadata
  const dateRange = useMemo(() => {
    if (!forecastList || forecastList.length === 0) return "—";
    return `${forecastList[0].date} to ${forecastList[forecastList.length - 1].date}`;
  }, [forecastList]);

  return (
    <div className="page-content forecast-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Forecast Explorer</h1>
          <p className="page-subtitle">
            Explore forecasts across the TerraWatt hierarchy.
          </p>
        </div>
      </div>

      {/* Control Panel */}
      <div className="content-card controls-card">
        <div className="controls-grid">
          <div className="control-item">
            <label className="control-label" htmlFor="node-select">
              Hierarchy Node
            </label>
            <select
              id="node-select"
              className="control-select"
              value={selectedNode}
              onChange={(e) => onChangeNode(e.target.value)}
            >
              <optgroup label="National (Root)">
                {organizedNodes.national.map((n) => (
                  <option key={n} value={n}>
                    {n} (National Aggregate)
                  </option>
                ))}
              </optgroup>
              <optgroup label="Regional Grids">
                {organizedNodes.regions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </optgroup>
              <optgroup label="States & Bulk Consumers">
                {organizedNodes.states.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="control-item">
            <label className="control-label" htmlFor="horizon-select">
              Forecast Horizon
            </label>
            <select
              id="horizon-select"
              className="control-select"
              value={horizon}
              onChange={(e) => onChangeHorizon(Number(e.target.value))}
            >
              <option value={7}>7 Days (1 Week)</option>
              <option value={14}>14 Days (2 Weeks)</option>
              <option value={30}>30 Days (1 Month)</option>
            </select>
          </div>

          <div className="control-item">
            <label className="control-label" htmlFor="method-select">
              Primary Method
            </label>
            <select
              id="method-select"
              className="control-select"
              value={selectedMethod}
              onChange={(e) => onChangeMethod(e.target.value)}
            >
              {ALL_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="control-item control-toggles">
            <label className="control-label">Display Options</label>
            <div className="toggles-row">
              <label className="checkbox-toggle">
                <input
                  type="checkbox"
                  checked={compareAllMethods}
                  onChange={(e) => setCompareAllMethods(e.target.checked)}
                />
                <span>Compare All Methods</span>
              </label>
              <label className="checkbox-toggle">
                <input
                  type="checkbox"
                  checked={showActuals}
                  onChange={(e) => setShowActuals(e.target.checked)}
                />
                <span>Show Actuals</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Main Forecast Chart */}
      <div className="content-card chart-card main-chart-card">
        {loadingForecast ? (
          <LoadingState message={`Loading forecast time series for ${selectedNode}...`} />
        ) : forecastError ? (
          <ErrorState
            title={`Unable to load forecast for ${selectedNode}`}
            message={forecastError}
            onRetry={onRetry}
          />
        ) : chartData ? (
          <div className="chart-wrapper">
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div className="empty-state-text">No forecast data available for this node and horizon.</div>
        )}
      </div>

      {/* Forecast Information Area */}
      <div className="info-metadata-grid">
        <div className="info-metadata-box">
          <span className="metadata-label">Forecast Node</span>
          <span className="metadata-value mono">{selectedNode}</span>
        </div>
        <div className="info-metadata-box">
          <span className="metadata-label">Forecast Horizon</span>
          <span className="metadata-value">{horizon} Days</span>
        </div>
        <div className="info-metadata-box">
          <span className="metadata-label">Selected Method</span>
          <span className="metadata-value">{selectedMethod}</span>
        </div>
        <div className="info-metadata-box">
          <span className="metadata-label">Number of Predictions</span>
          <span className="metadata-value mono">{forecastList?.length || 0}</span>
        </div>
        <div className="info-metadata-box">
          <span className="metadata-label">Date Window</span>
          <span className="metadata-value mono">{dateRange}</span>
        </div>
      </div>
    </div>
  );
}
