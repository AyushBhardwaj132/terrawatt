import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import Header from "./components/Header";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import ForecastPage from "./pages/ForecastPage";
import EvaluationPage from "./pages/EvaluationPage";
import TelemetryPage from "./pages/TelemetryPage";
import AboutPage from "./pages/AboutPage";
import {
  checkHealth,
  getHierarchyNodes,
  getHierarchySnapshot,
  getNodeForecast,
  getEvaluationSummary,
  ingestActual,
  getWebSocketUrl,
} from "./api";
import "./App.css";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function App() {
  // Navigation: "home" | "forecast" | "evaluation" | "telemetry" | "about"
  const [activeTab, setActiveTab] = useState("home");

  // Connectivity
  const [apiConnected, setApiConnected] = useState(false);
  const [telemetryConnected, setTelemetryConnected] = useState(false);

  // Global selections
  const [nodes, setNodes] = useState(["India"]);
  const [selectedNode, setSelectedNode] = useState("India");
  const [horizon, setHorizon] = useState(7);
  const [selectedMethod, setSelectedMethod] = useState("MinT-Shrink");

  // Data states
  const [snapshot, setSnapshot] = useState(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [snapshotError, setSnapshotError] = useState(null);

  const [forecastList, setForecastList] = useState([]);
  const [loadingForecast, setLoadingForecast] = useState(true);
  const [forecastError, setForecastError] = useState(null);

  const [nationalForecastList, setNationalForecastList] = useState([]);
  const [loadingNationalForecast, setLoadingNationalForecast] = useState(true);
  const [nationalForecastError, setNationalForecastError] = useState(null);

  const [evaluationData, setEvaluationData] = useState(null);
  const [loadingEvaluation, setLoadingEvaluation] = useState(true);
  const [evaluationError, setEvaluationError] = useState(null);

  // Telemetry state
  const [telemetryLogs, setTelemetryLogs] = useState([]);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestResult, setIngestResult] = useState(null);
  const [ingestError, setIngestError] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const connectWsRef = useRef(null);

  // 1. Health check & connectivity monitor
  const pollHealth = useCallback(async () => {
    try {
      const res = await checkHealth();
      setApiConnected(res.status === "ok");
    } catch {
      setApiConnected(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    checkHealth()
      .then((res) => {
        if (isMounted) setApiConnected(res.status === "ok");
      })
      .catch(() => {
        if (isMounted) setApiConnected(false);
      });

    const interval = setInterval(pollHealth, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pollHealth]);



  // Retry handlers
  const handleRetrySnapshot = () => {
    setLoadingSnapshot(true);
    getHierarchySnapshot()
      .then((res) => {
        setSnapshot(res);
        setSnapshotError(null);
      })
      .catch((err) => setSnapshotError(err.message || "Failed to load snapshot"))
      .finally(() => setLoadingSnapshot(false));
  };

  const handleRetryNationalForecast = () => {
    setLoadingNationalForecast(true);
    getNodeForecast("India", 30)
      .then((res) => {
        setNationalForecastList(res.forecast || []);
        setNationalForecastError(null);
      })
      .catch((err) => setNationalForecastError(err.message || "Failed to load national forecast"))
      .finally(() => setLoadingNationalForecast(false));
  };

  const handleRetryNodeForecast = () => {
    setLoadingForecast(true);
    getNodeForecast(selectedNode, horizon)
      .then((res) => {
        setForecastList(res.forecast || []);
        setForecastError(null);
      })
      .catch((err) => setForecastError(err.message || `Failed to load forecast for ${selectedNode}`))
      .finally(() => setLoadingForecast(false));
  };

  const handleRetryEvaluation = () => {
    setLoadingEvaluation(true);
    getEvaluationSummary()
      .then((res) => {
        setEvaluationData(res);
        setEvaluationError(null);
      })
      .catch((err) => setEvaluationError(err.message || "Failed to load evaluation summary"))
      .finally(() => setLoadingEvaluation(false));
  };

  // Initial load
  useEffect(() => {
    let isMounted = true;

    getHierarchyNodes()
      .then((res) => {
        if (isMounted && res?.nodes?.length) setNodes(res.nodes);
      })
      .catch((err) => console.warn("Could not load nodes:", err));

    getHierarchySnapshot()
      .then((res) => {
        if (isMounted) {
          setSnapshot(res);
          setSnapshotError(null);
          setLoadingSnapshot(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setSnapshotError(err.message || "Failed to load snapshot");
          setLoadingSnapshot(false);
        }
      });

    getNodeForecast("India", 30)
      .then((res) => {
        if (isMounted) {
          setNationalForecastList(res.forecast || []);
          setNationalForecastError(null);
          setLoadingNationalForecast(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setNationalForecastError(err.message || "Failed to load national forecast");
          setLoadingNationalForecast(false);
        }
      });

    getEvaluationSummary()
      .then((res) => {
        if (isMounted) {
          setEvaluationData(res);
          setEvaluationError(null);
          setLoadingEvaluation(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setEvaluationError(err.message || "Failed to load evaluation summary");
          setLoadingEvaluation(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Refetch node forecast when selected node or horizon changes
  useEffect(() => {
    let isMounted = true;

    getNodeForecast(selectedNode, horizon)
      .then((res) => {
        if (isMounted) {
          setForecastList(res.forecast || []);
          setForecastError(null);
          setLoadingForecast(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setForecastError(err.message || `Failed to load forecast for ${selectedNode}`);
          setLoadingForecast(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedNode, horizon]);

  // 7. WebSocket connection for telemetry
  const connectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setTelemetryConnected(true);
      };

      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          const comp = payload.comparison || {};
          const rec = payload.record || {};

          const logEntry = {
            node_id: rec.node_id || "Unknown",
            date: rec.date || new Date().toLocaleTimeString(),
            actual: comp.actual ?? rec.actual_value,
            reconciled_forecast: comp.reconciled_forecast,
            error: comp.error,
            error_pct: comp.error_pct,
            z_score: comp.z_score,
            anomaly_status: comp.anomaly_status || "NORMAL",
          };

          setTelemetryLogs((prev) => [logEntry, ...prev.slice(0, 49)]);
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      ws.onerror = () => {
        setTelemetryConnected(false);
      };

      ws.onclose = () => {
        setTelemetryConnected(false);
        reconnectTimerRef.current = setTimeout(() => {
          if (connectWsRef.current) connectWsRef.current();
        }, 5000);
      };

      wsRef.current = ws;
    } catch (err) {
      console.warn("Could not initiate WebSocket connection:", err);
      reconnectTimerRef.current = setTimeout(() => {
        if (connectWsRef.current) connectWsRef.current();
      }, 5000);
    }
  }, []);

  useEffect(() => {
    connectWsRef.current = connectWebSocket;
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connectWebSocket]);

  // 8. Manual Ingest Handler
  const handleIngestSubmit = async (nodeId, date, actualValue) => {
    setIngestLoading(true);
    setIngestError(null);
    setIngestResult(null);

    try {
      const res = await ingestActual(nodeId, date, actualValue);
      setIngestResult(res);

      if (res && res.comparison) {
        const entry = {
          node_id: res.record.node_id,
          date: res.record.date,
          actual: res.comparison.actual,
          reconciled_forecast: res.comparison.reconciled_forecast,
          error: res.comparison.error,
          error_pct: res.comparison.error_pct,
          z_score: res.comparison.z_score,
          anomaly_status: res.comparison.anomaly_status,
        };
        setTelemetryLogs((prev) => [entry, ...prev.slice(0, 49)]);
      }
    } catch (err) {
      setIngestError(err.message || "Failed to submit observation");
    } finally {
      setIngestLoading(false);
    }
  };

  return (
    <div className="site-wrapper">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        apiConnected={apiConnected}
      />

      <main className="main-content">
        {activeTab === "home" && (
          <HomePage
            onSelectTab={setActiveTab}
            nodes={nodes}
            snapshot={snapshot}
            loadingSnapshot={loadingSnapshot}
            snapshotError={snapshotError}
            nationalForecastList={nationalForecastList}
            loadingNationalForecast={loadingNationalForecast}
            nationalForecastError={nationalForecastError}
            onRetryForecast={handleRetryNationalForecast}
            onRetrySnapshot={handleRetrySnapshot}
            evaluationData={evaluationData}
          />
        )}

        {activeTab === "forecast" && (
          <ForecastPage
            nodes={nodes}
            selectedNode={selectedNode}
            onChangeNode={setSelectedNode}
            horizon={horizon}
            onChangeHorizon={setHorizon}
            selectedMethod={selectedMethod}
            onChangeMethod={setSelectedMethod}
            forecastList={forecastList}
            loadingForecast={loadingForecast}
            forecastError={forecastError}
            onRetry={handleRetryNodeForecast}
          />
        )}

        {activeTab === "evaluation" && (
          <EvaluationPage
            evaluationData={evaluationData}
            loadingEvaluation={loadingEvaluation}
            evaluationError={evaluationError}
            onRetry={handleRetryEvaluation}
          />
        )}

        {activeTab === "telemetry" && (
          <TelemetryPage
            nodes={nodes}
            telemetryConnected={telemetryConnected}
            telemetryLogs={telemetryLogs}
            onIngestSubmit={handleIngestSubmit}
            ingestLoading={ingestLoading}
            ingestResult={ingestResult}
            ingestError={ingestError}
          />
        )}

        {activeTab === "about" && <AboutPage />}
      </main>

      <Footer onSelectTab={setActiveTab} />
    </div>
  );
}
