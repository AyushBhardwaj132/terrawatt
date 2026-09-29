import React, { useState } from "react";
import StatusBadge from "../components/StatusBadge";
import ErrorState from "../components/ErrorState";

export default function TelemetryPage({
  nodes,
  telemetryConnected,
  telemetryLogs,
  onIngestSubmit,
  ingestLoading,
  ingestResult,
  ingestError,
}) {
  const [formData, setFormData] = useState({
    node_id: "India",
    date: "2025-01-05",
    actual_value: "4200.0",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.node_id || !formData.date || !formData.actual_value) return;
    onIngestSubmit(formData.node_id, formData.date, formData.actual_value);
  };

  return (
    <div className="page-content telemetry-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Telemetry</h1>
          <p className="page-subtitle">
            Historical telemetry replay and anomaly monitoring.
          </p>
        </div>

        <div className="telemetry-connection-status">
          <span className="status-label">WebSocket Stream:</span>
          <StatusBadge
            status={telemetryConnected ? "CONNECTED" : "DISCONNECTED"}
            label={telemetryConnected ? "Connected" : "Disconnected"}
            size="md"
          />
        </div>
      </div>

      {/* Replay Notice */}
      <div className="telemetry-notice-box">
        <span className="notice-icon">&bull;</span>
        <div className="notice-text">
          <strong>Historical Telemetry Replay:</strong> This stream ingests historical observations from the POSOCO / GRID-INDIA dataset to demonstrate real-time telemetry processing, error calculation, and statistical anomaly detection. This is not a live direct feed from grid substations.
        </div>
      </div>

      <div className="telemetry-grid">
        {/* Manual Telemetry Ingest Form */}
        <div className="content-card form-card">
          <h3 className="card-section-title">Manual Telemetry Ingest</h3>
          <p className="card-section-subtitle">
            Submit an observation to evaluate immediate forecast deviation and anomaly score
          </p>

          <form onSubmit={handleSubmit} className="ingest-form">
            <div className="form-group">
              <label className="form-label" htmlFor="ingest-node">
                Hierarchy Node
              </label>
              <select
                id="ingest-node"
                className="control-select"
                value={formData.node_id}
                onChange={(e) => setFormData({ ...formData, node_id: e.target.value })}
              >
                {nodes?.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label" htmlFor="ingest-date">
                  Observation Date
                </label>
                <input
                  id="ingest-date"
                  type="date"
                  className="control-input"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="ingest-value">
                  Actual Demand (MU)
                </label>
                <input
                  id="ingest-value"
                  type="number"
                  step="0.01"
                  className="control-input"
                  placeholder="e.g. 4200.0"
                  value={formData.actual_value}
                  onChange={(e) => setFormData({ ...formData, actual_value: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={ingestLoading}
              >
                {ingestLoading ? "Submitting Reading..." : "Submit Reading"}
              </button>
            </div>
          </form>

          {/* Form Result / Feedback */}
          {ingestError && (
            <div style={{ marginTop: "16px" }}>
              <ErrorState title="Submission Failed" message={ingestError} />
            </div>
          )}

          {ingestResult && ingestResult.comparison && (
            <div className="ingest-result-card">
              <div className="result-header">
                <span className="result-title">Ingest Result for {ingestResult.record.node_id}</span>
                <StatusBadge
                  status={ingestResult.comparison.anomaly_status}
                  size="sm"
                />
              </div>

              <div className="result-metrics-grid">
                <div className="result-metric">
                  <span className="res-label">Actual Demand</span>
                  <span className="res-val mono">{ingestResult.comparison.actual} MU</span>
                </div>
                <div className="result-metric">
                  <span className="res-label">Reconciled Forecast</span>
                  <span className="res-val mono">{ingestResult.comparison.reconciled_forecast} MU</span>
                </div>
                <div className="result-metric">
                  <span className="res-label">Deviation Error</span>
                  <span className="res-val mono">
                    {ingestResult.comparison.error > 0 ? `+${ingestResult.comparison.error}` : ingestResult.comparison.error} MU ({ingestResult.comparison.error_pct}%)
                  </span>
                </div>
                <div className="result-metric">
                  <span className="res-label">z-score</span>
                  <span className="res-val mono">{ingestResult.comparison.z_score?.toFixed(2) || "0.00"}</span>
                </div>
              </div>
              <p className="result-message">{ingestResult.comparison.message}</p>
            </div>
          )}
        </div>

        {/* Telemetry Guide / Info Card */}
        <div className="content-card info-card">
          <h3 className="card-section-title">Anomaly Detection Protocol</h3>
          <p className="card-section-subtitle">
            Threshold specifications evaluated against in-sample residual covariance
          </p>

          <div className="anomaly-rules-list">
            <div className="anomaly-rule-item">
              <StatusBadge status="NORMAL" label="NORMAL" size="sm" />
              <div className="rule-details">
                <span className="rule-title">Standard Variance Range</span>
                <span className="rule-desc">z-score &lt; 2.0 (i.e. deviation &lt; 2&sigma; from forecast). Expected grid load condition.</span>
              </div>
            </div>

            <div className="anomaly-rule-item">
              <StatusBadge status="WARNING" label="WARNING" size="sm" />
              <div className="rule-details">
                <span className="rule-title">Elevated Load Deviation</span>
                <span className="rule-desc">2.0 &le; z-score &lt; 3.0. Indicates abnormal weather or unforecasted event demand.</span>
              </div>
            </div>

            <div className="anomaly-rule-item">
              <StatusBadge status="CRITICAL" label="CRITICAL" size="sm" />
              <div className="rule-details">
                <span className="rule-title">Severe Grid Anomaly</span>
                <span className="rule-desc">z-score &ge; 3.0. Potential outage, curtailment, or sensor telemetry fault.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Incoming Telemetry Stream Table */}
      <div className="content-card table-card" style={{ marginTop: "24px" }}>
        <div className="table-header-row">
          <div>
            <h3 className="card-section-title">Real-Time Telemetry Stream</h3>
            <p className="card-section-subtitle">
              Events broadcasted live over WebSocket connection ({telemetryLogs.length} events logged this session)
            </p>
          </div>
        </div>

        <div className="table-container">
          <table className="standard-table">
            <thead>
              <tr>
                <th>Timestamp / Date</th>
                <th>Node</th>
                <th>Actual Demand</th>
                <th>Reconciled Forecast</th>
                <th>Error</th>
                <th>z-score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {telemetryLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-cell">
                    No telemetry events received yet. Submit a reading above to test live ingestion and WebSocket broadcast.
                  </td>
                </tr>
              ) : (
                telemetryLogs.map((evt, idx) => (
                  <tr key={idx}>
                    <td className="mono text-muted">{evt.date || evt.time || "—"}</td>
                    <td className="font-medium">{evt.node_id}</td>
                    <td className="mono">{evt.actual} MU</td>
                    <td className="mono">{evt.reconciled_forecast} MU</td>
                    <td className="mono">
                      {evt.error > 0 ? `+${evt.error}` : evt.error} MU ({evt.error_pct}%)
                    </td>
                    <td className="mono">{evt.z_score !== undefined ? Number(evt.z_score).toFixed(2) : "—"}</td>
                    <td>
                      <StatusBadge status={evt.anomaly_status || "NORMAL"} size="sm" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
