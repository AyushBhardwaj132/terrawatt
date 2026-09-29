import React, { useState, useMemo } from "react";
import { Line } from "react-chartjs-2";
import StatusBadge from "../components/StatusBadge";
import LoadingState from "../components/LoadingState";
import ErrorState from "../components/ErrorState";

const REGION_METADATA = {
  NR: { name: "Northern Region", states: 9 },
  WR: { name: "Western Region", states: 9 },
  SR: { name: "Southern Region", states: 6 },
  ER: { name: "Eastern Region", states: 7 },
  NER: { name: "North Eastern Region", states: 7 },
};

export default function HomePage({
  onSelectTab,
  nodes,
  snapshot,
  loadingSnapshot,
  snapshotError,
  nationalForecastList,
  loadingNationalForecast,
  nationalForecastError,
  onRetryForecast,
  onRetrySnapshot,
  evaluationData,
}) {
  // Method selected for Home national chart & coherence comparison
  const [activeMethod, setActiveMethod] = useState("MinT-Shrink");
  const [showActuals, setShowActuals] = useState(true);

  // Dynamic project stats
  const totalNodesCount = nodes?.length || 51;
  const originsCount = evaluationData?.num_origins || 6;
  const horizonsCount = evaluationData?.horizons?.length || 3;
  const methodsCount = 4;

  // Chart configuration for National Demand Time Series
  const nationalChartData = useMemo(() => {
    if (!nationalForecastList || nationalForecastList.length === 0) return null;

    const labels = nationalForecastList.map((item) => item.date);
    const datasets = [];

    // Ground truth actuals
    if (showActuals) {
      datasets.push({
        label: "Ground Truth Actual",
        data: nationalForecastList.map((item) => item.actual),
        borderColor: "#0f172a",
        backgroundColor: "#0f172a",
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.1,
      });
    }

    // Active method forecast line
    const methodColors = {
      "MinT-Shrink": { border: "#2563eb", bg: "rgba(37, 99, 235, 0.1)" },
      "Bottom-Up": { border: "#0891b2", bg: "rgba(8, 145, 178, 0.1)" },
      "Top-Down": { border: "#d97706", bg: "rgba(217, 119, 6, 0.1)" },
      "Base LightGBM": { border: "#9333ea", bg: "rgba(147, 51, 234, 0.1)" },
    };

    const color = methodColors[activeMethod] || { border: "#2563eb", bg: "rgba(37, 99, 235, 0.1)" };

    datasets.push({
      label: `${activeMethod} Forecast`,
      data: nationalForecastList.map((item) => {
        if (item.methods && item.methods[activeMethod] !== undefined) {
          return item.methods[activeMethod];
        }
        return item.reconciled_forecast;
      }),
      borderColor: color.border,
      backgroundColor: color.bg,
      borderWidth: 2.5,
      borderDash: activeMethod === "Base LightGBM" ? [4, 4] : [],
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: 0.15,
      fill: false,
    });

    return { labels, datasets };
  }, [nationalForecastList, activeMethod, showActuals]);

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
          text: "Daily Electricity Consumption (Million Units / MU)",
          color: "#475569",
          font: { size: 12, weight: "500" },
        },
      },
    },
  };

  // Coherence audit info for selected method
  const coherenceInfo = useMemo(() => {
    if (!snapshot || !snapshot.coherence || !snapshot.coherence[activeMethod]) {
      return null;
    }
    return snapshot.coherence[activeMethod];
  }, [snapshot, activeMethod]);

  // Regional breakdown info
  const regionalData = useMemo(() => {
    if (!snapshot || !snapshot.methods || !snapshot.methods[activeMethod]) {
      return [];
    }
    const regionsMap = snapshot.methods[activeMethod].regions || {};
    const nationalVal = snapshot.methods[activeMethod].national || 0;

    return Object.entries(REGION_METADATA).map(([code, meta]) => {
      const forecastVal = regionsMap[code] || 0;
      const actualVal = snapshot.actual_regions ? snapshot.actual_regions[code] : null;
      const share = nationalVal > 0 ? (forecastVal / nationalVal) * 100 : 0;

      return {
        code,
        name: meta.name,
        forecastVal,
        actualVal,
        share,
      };
    });
  }, [snapshot, activeMethod]);

  return (
    <div className="page-content home-page">
      {/* 1. Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">Research & Engineering Project</div>
          <h1 className="hero-title">
            TerraWatt
            <span className="hero-subtitle-block">
              Multi-Region Energy Demand Forecasting & Reconciliation
            </span>
          </h1>
          <p className="hero-description">
            An end-to-end platform for forecasting electricity demand across India’s hierarchical power grid using machine learning and hierarchical forecast reconciliation.
          </p>
          <div className="hero-actions">
            <button
              className="btn btn-primary"
              onClick={() => onSelectTab("forecast")}
            >
              Explore Forecasts
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onSelectTab("evaluation")}
            >
              View Evaluation
            </button>
          </div>
        </div>

        {/* 2. Compact Project Overview */}
        <div className="project-overview-grid">
          <div className="overview-stat">
            <div className="stat-number">{totalNodesCount}</div>
            <div className="stat-label">Hierarchy Nodes</div>
            <div className="stat-detail">National &bull; 5 Regions &bull; 45 States &amp; Consumers</div>
          </div>
          <div className="overview-stat">
            <div className="stat-number">{originsCount}</div>
            <div className="stat-label">Forecast Origins</div>
            <div className="stat-detail">Expanding monthly origins (2025)</div>
          </div>
          <div className="overview-stat">
            <div className="stat-number">{horizonsCount}</div>
            <div className="stat-label">Forecast Horizons</div>
            <div className="stat-detail">7, 14, and 30 days ahead</div>
          </div>
          <div className="overview-stat">
            <div className="stat-number">{methodsCount}</div>
            <div className="stat-label">Forecast Methods</div>
            <div className="stat-detail">Base, Bottom-Up, Top-Down, MinT</div>
          </div>
        </div>
      </section>

      {/* 3. National Electricity Demand Section */}
      <section className="section-container">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">National Electricity Demand</h2>
            <p className="section-subtitle">
              Out-of-sample multi-horizon forecasts compared with ground-truth POSOCO observations
            </p>
          </div>

          <div className="chart-controls-group">
            <div className="method-pill-selector">
              {["MinT-Shrink", "Bottom-Up", "Top-Down", "Base LightGBM"].map((m) => (
                <button
                  key={m}
                  className={`pill-btn ${activeMethod === m ? "active" : ""}`}
                  onClick={() => setActiveMethod(m)}
                >
                  {m}
                </button>
              ))}
            </div>

            <label className="checkbox-toggle">
              <input
                type="checkbox"
                checked={showActuals}
                onChange={(e) => setShowActuals(e.target.checked)}
              />
              <span>Show Actual</span>
            </label>
          </div>
        </div>

        <div className="content-card chart-card">
          {loadingNationalForecast ? (
            <LoadingState message="Loading national forecast data..." />
          ) : nationalForecastError ? (
            <ErrorState
              title="Unable to load national forecast"
              message={nationalForecastError}
              onRetry={onRetryForecast}
            />
          ) : nationalChartData ? (
            <div className="chart-wrapper">
              <Line data={nationalChartData} options={chartOptions} />
            </div>
          ) : (
            <div className="empty-state-text">No national forecast observations available.</div>
          )}

          <div className="card-footer-note">
            <span>Method in view: <strong>{activeMethod}</strong></span>
            <span>Dataset: POSOCO / GRID-INDIA National Aggregate</span>
          </div>
        </div>
      </section>

      {/* 4. Regional Demand Section */}
      <section className="section-container">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">Regional Demand</h2>
            <p className="section-subtitle">
              Demand breakdown across India’s five synchronous electrical grid regions (Snapshot date: {snapshot?.date || "Latest"})
            </p>
          </div>
        </div>

        {loadingSnapshot ? (
          <LoadingState message="Loading regional grid breakdown..." />
        ) : snapshotError ? (
          <ErrorState
            title="Unable to load regional snapshot"
            message={snapshotError}
            onRetry={onRetrySnapshot}
          />
        ) : (
          <div className="regional-grid">
            {regionalData.map((reg) => (
              <div key={reg.code} className="region-box">
                <div className="region-header">
                  <span className="region-code">{reg.code}</span>
                  <span className="region-share">{reg.share.toFixed(1)}% of National</span>
                </div>
                <div className="region-name">{reg.name}</div>
                <div className="region-values">
                  <div className="region-val-row">
                    <span className="val-label">Forecast ({activeMethod}):</span>
                    <span className="val-number mono">{reg.forecastVal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MU</span>
                  </div>
                  {reg.actualVal !== null && reg.actualVal !== undefined && (
                    <div className="region-val-row">
                      <span className="val-label">Actual Demand:</span>
                      <span className="val-number mono text-secondary">{reg.actualVal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MU</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Hierarchical Coherence Section */}
      <section className="section-container">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">Hierarchical Coherence</h2>
            <p className="section-subtitle">
              Reconciled forecasts ensure that national demand equals the sum of regional demand.
            </p>
          </div>

          <div className="method-pill-selector">
            {["MinT-Shrink", "Bottom-Up", "Top-Down", "Base LightGBM"].map((m) => (
              <button
                key={m}
                className={`pill-btn ${activeMethod === m ? "active" : ""}`}
                onClick={() => setActiveMethod(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="content-card coherence-card">
          {coherenceInfo ? (
            <div className="coherence-audit-grid">
              <div className="coherence-metric-box">
                <span className="metric-label">National Total</span>
                <span className="metric-value mono">
                  {coherenceInfo.parent_forecast !== null ? `${coherenceInfo.parent_forecast.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MU` : "—"}
                </span>
                <span className="metric-caption">Root node (Level 0)</span>
              </div>

              <div className="coherence-operator">=</div>

              <div className="coherence-metric-box">
                <span className="metric-label">Regional Sum</span>
                <span className="metric-value mono">
                  {coherenceInfo.children_sum !== null ? `${coherenceInfo.children_sum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MU` : "—"}
                </span>
                <span className="metric-caption">Sum of NR + WR + SR + ER + NER</span>
              </div>

              <div className="coherence-divider" />

              <div className="coherence-metric-box">
                <span className="metric-label">Difference (Discrepancy)</span>
                <span className="metric-value mono">
                  {coherenceInfo.difference.toFixed(2)} MU
                </span>
                <span className="metric-caption">|National &minus; Sum(Regions)|</span>
              </div>

              <div className="coherence-status-box">
                <span className="metric-label">Mathematical Status</span>
                <div style={{ marginTop: "4px" }}>
                  <StatusBadge
                    status={coherenceInfo.is_coherent ? "COHERENT" : "INCOHERENT"}
                    label={coherenceInfo.is_coherent ? "Coherent" : "Incoherent"}
                    size="lg"
                  />
                </div>
                <span className="metric-caption">
                  {coherenceInfo.is_coherent
                    ? "Sum-consistency holds exactly"
                    : "Aggregation discrepancy present in unreconciled base models"}
                </span>
              </div>
            </div>
          ) : (
            <div className="empty-state-text">Coherence audit data is currently unavailable.</div>
          )}
        </div>
      </section>
    </div>
  );
}
