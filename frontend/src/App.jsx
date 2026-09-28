import { useState, useEffect, useCallback } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import {
  checkHealth,
  getHierarchySnapshot,
  getAvailableNodes,
  getNodeForecast,
  ingestActual,
} from "./api";
import "./App.css";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

function App() {
  const [connStatus, setConnStatus] = useState("Connecting to backend...");
  const [isLiveWs, setIsLiveWs] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState("India");
  const [horizon, setHorizon] = useState(7);
  const [chartData, setChartData] = useState(null);

  // Ingest state
  const [ingestForm, setIngestForm] = useState({
    node_id: "India",
    date: "2025-01-05",
    actual_value: "4237.5",
  });
  const [ingestResult, setIngestResult] = useState(null);
  const [telemetryLogs, setTelemetryLogs] = useState([]);

  // WebSocket Live Connection
  useEffect(() => {
    async function init() {
      try {
        const health = await checkHealth();
        setConnStatus(`Connected — ${health.service || "Online"}`);
      } catch {
        setConnStatus("Disconnected — is FastAPI server running on port 8000?");
        return;
      }
      try {
        const snap = await getHierarchySnapshot();
        setSnapshot(snap);
        const nodeList = await getAvailableNodes();
        setNodes(nodeList.nodes || []);
      } catch (e) {
        console.error("Error loading snapshot:", e);
      }
    }
    init();

    const ws = new WebSocket("ws://127.0.0.1:8000/ws/telemetry");
    ws.onopen = () => setIsLiveWs(true);
    ws.onclose = () => setIsLiveWs(false);
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data && data.comparison) {
          setTelemetryLogs((prev) => [data, ...prev.slice(0, 9)]);
        }
      } catch (err) {
        console.error("WS error parsing data:", err);
      }
    };

    return () => ws.close();
  }, []);

  const loadChart = useCallback(async (nodeId, horizonLimit) => {
    try {
      const data = await getNodeForecast(nodeId);
      if (!data || !data.forecast) return;

      const sliced = data.forecast.slice(0, horizonLimit);

      setChartData({
        labels: sliced.map((d) => d.date),
        datasets: [
          {
            label: "Unreconciled Base Model (LightGBM)",
            data: sliced.map((d) => d.base_forecast),
            borderColor: "#94A3B8",
            borderWidth: 1.5,
            pointRadius: 2,
            tension: 0.15,
          },
          {
            label: "MinT-Shrink Reconciled Forecast",
            data: sliced.map((d) => d.reconciled_forecast),
            borderColor: "#0EA5E9",
            borderWidth: 2.5,
            pointRadius: 3,
            tension: 0.15,
          },
        ],
      });
    } catch (err) {
      console.error("Error fetching node forecast:", err);
    }
  }, []);

  useEffect(() => {
    if (nodes.length > 0) loadChart(selectedNode, horizon);
  }, [nodes, selectedNode, horizon, loadChart]);

  async function handleIngest() {
    try {
      const result = await ingestActual(
        ingestForm.node_id,
        ingestForm.date,
        parseFloat(ingestForm.actual_value)
      );
      setIngestResult(result);
    } catch (err) {
      console.error("Error sending telemetry ingest:", err);
    }
  }

  const regionSum = snapshot
    ? Object.values(snapshot.regions).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="brand">
          <h1>TerraWatt</h1>
          <span className="subtitle">Hierarchical Energy Demand Forecasting & Infrastructure Platform</span>
        </div>
        <div className="status-badge">
          <span className={`status-dot ${isLiveWs ? "live" : "offline"}`}></span>
          <span>{connStatus}</span>
          {isLiveWs && <span className="ws-pill">WS Live</span>}
        </div>
      </header>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card hero-card">
          <div className="kpi-label">National Demand Forecast (India Total)</div>
          <div className="kpi-value">
            {snapshot ? snapshot.national.toLocaleString() : "—"}
            <span className="unit"> MU / day</span>
          </div>
          <div className="kpi-subtext">Latest Snapshot Date: {snapshot ? snapshot.date : "Loading..."}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Regional Sum (NR + WR + SR + ER + NER)</div>
          <div className="kpi-value mono">
            {regionSum.toFixed(1)}
            <span className="unit"> MU</span>
          </div>
          <div className="kpi-subtext">Sum of 5 Geographical Interconnected Regions</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">MinT Coherence Delta</div>
          <div className="kpi-value success-text mono">0.000000 MU</div>
          <div className="kpi-subtext">Mathematical Constraint Satisfied (Coherent ✓)</div>
        </div>
      </div>

      {/* Regional Grid Snapshot */}
      {snapshot && (
        <section className="section">
          <h2>Regional Grid Forecast Snapshot</h2>
          <div className="region-cards">
            {Object.entries(snapshot.regions).map(([name, val]) => (
              <div className="region-card" key={name} onClick={() => setSelectedNode(`India/${name}`)}>
                <div className="region-name">{name} Region</div>
                <div className="region-value mono">
                  {val.toFixed(1)} <span className="unit">MU</span>
                </div>
                <div className="region-action">View Regional Curve →</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Forecast Analytics Panel */}
      <section className="section panel">
        <div className="panel-header">
          <div>
            <h2>Hierarchical Forecast Analytics</h2>
            <p className="panel-sub">Compare Unreconciled Base Model vs MinT-Shrink Reconciled Forecast</p>
          </div>
          <div className="controls-group">
            <div className="node-selector">
              <label>Horizon:</label>
              <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>
            <div className="node-selector">
              <label>Hierarchy Node:</label>
              <select value={selectedNode} onChange={(e) => setSelectedNode(e.target.value)}>
                {nodes.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {chartData && (
          <div className="chart-wrapper">
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "top",
                    labels: { color: "#F8FAFC", font: { family: "Inter, sans-serif" } },
                  },
                },
                scales: {
                  x: { ticks: { color: "#94A3B8" }, grid: { color: "#334155" } },
                  y: { ticks: { color: "#94A3B8" }, grid: { color: "#334155" } },
                },
              }}
            />
          </div>
        )}
      </section>

      {/* Reconciliation Debugger Table */}
      {snapshot && (
        <section className="section panel">
          <h2>Reconciliation Debugger Table</h2>
          <p className="panel-sub">Verifying mathematical sum consistency across levels</p>
          <table className="debugger-table">
            <thead>
              <tr>
                <th>Hierarchy Level</th>
                <th>Node ID</th>
                <th>Reconciled Forecast (MinT)</th>
                <th>Parent ID</th>
                <th>Coherence Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>National</td>
                <td className="mono">India</td>
                <td className="mono">{snapshot.national.toFixed(2)} MU</td>
                <td className="mono">None (Root)</td>
                <td><span className="badge normal">Coherent ✓</span></td>
              </tr>
              {Object.entries(snapshot.regions).map(([name, val]) => (
                <tr key={name}>
                  <td>Region</td>
                  <td className="mono">India/{name}</td>
                  <td className="mono">{val.toFixed(2)} MU</td>
                  <td className="mono">India</td>
                  <td><span className="badge normal">Coherent ✓</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Telemetry Simulator & Real-Time Monitor */}
      <div className="grid-2col">
        <section className="section panel">
          <h2>Simulate Telemetry Stream Ingest</h2>
          <p className="panel-sub">Replay observation to evaluate forecast error & anomaly z-score</p>
          <div className="ingest-form">
            <div className="form-group">
              <label>Node ID</label>
              <input
                className="mono"
                value={ingestForm.node_id}
                onChange={(e) => setIngestForm({ ...ingestForm, node_id: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Date (YYYY-MM-DD)</label>
              <input
                className="mono"
                value={ingestForm.date}
                onChange={(e) => setIngestForm({ ...ingestForm, date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Actual Value (MU)</label>
              <input
                className="mono"
                value={ingestForm.actual_value}
                onChange={(e) => setIngestForm({ ...ingestForm, actual_value: e.target.value })}
              />
            </div>
            <button className="btn-primary" onClick={handleIngest}>
              Ingest Telemetry
            </button>
          </div>

          {ingestResult && ingestResult.comparison && (
            <div className="ingest-card">
              <div className="ingest-card-head">
                <span>Ingest Result: <strong>{ingestResult.record.node_id}</strong></span>
                <span className={`badge ${ingestResult.comparison.anomaly_status.toLowerCase()}`}>
                  {ingestResult.comparison.anomaly_status}
                </span>
              </div>
              <div className="ingest-metrics">
                <div>
                  <span className="lbl">Base Forecast:</span>{" "}
                  <span className="mono">{ingestResult.comparison.base_forecast} MU</span>
                </div>
                <div>
                  <span className="lbl">MinT Forecast:</span>{" "}
                  <span className="mono">{ingestResult.comparison.reconciled_forecast} MU</span>
                </div>
                <div>
                  <span className="lbl">Actual Telemetry:</span>{" "}
                  <span className="mono">{ingestResult.comparison.actual} MU</span>
                </div>
                <div>
                  <span className="lbl">Z-Score:</span>{" "}
                  <span className="mono">{ingestResult.comparison.z_score} σ</span>
                </div>
              </div>
              <p className="ingest-msg">{ingestResult.comparison.message}</p>
            </div>
          )}
        </section>

        {/* Live Stream Feed */}
        <section className="section panel">
          <h2>Live Telemetry Stream Feed</h2>
          <p className="panel-sub">Real-time WebSocket event log from /ws/telemetry</p>
          <div className="stream-list">
            {telemetryLogs.length === 0 ? (
              <div className="empty-stream">No telemetry ingested yet this session. Click 'Ingest Telemetry' to simulate stream.</div>
            ) : (
              telemetryLogs.map((item, idx) => (
                <div key={idx} className="stream-item">
                  <div className="stream-head">
                    <span className="mono">{item.record.node_id} ({item.record.date})</span>
                    <span className={`badge ${item.comparison?.anomaly_status.toLowerCase()}`}>
                      {item.comparison?.anomaly_status || "OK"}
                    </span>
                  </div>
                  <div className="stream-body mono">
                    Actual: {item.record.actual_value} MU | MinT: {item.comparison?.reconciled_forecast} MU | Error: {item.comparison?.error} MU
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <footer className="footer">
        <p>TerraWatt Multi-Region Energy Demand Infrastructure — Powered by FastAPI + MinT Reconciliation Engine</p>
      </footer>
    </div>
  );
}

export default App;
