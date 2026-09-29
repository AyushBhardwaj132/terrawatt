"""
main.py
FastAPI entrypoint for TerraWatt platform.
Serves energy demand forecast endpoints, telemetry ingestion API, and real-time WebSockets.
"""

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List, Optional

from api.model_service import (
    load_forecasts, get_available_nodes, get_forecast_for_node,
    get_full_hierarchy_snapshot, ingest_actual, get_ingested_history,
    get_evaluation_summary
)
from api.schemas import IngestPayload


class ConnectionManager:
    """Manages active WebSocket connections for live telemetry streaming."""
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


ws_manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    try:
        load_forecasts()
        print("[OK] Reconciled forecast data and actuals loaded into memory.")
    except Exception as e:
        print(f"[WARNING] Could not load forecasts on startup: {e}")
    yield
    # Shutdown logic


app = FastAPI(
    title="TerraWatt",
    description="Multi-Region Energy Demand Forecasting & Hierarchical Reconciliation Infrastructure",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "TerraWatt Forecasting Platform"}


@app.get("/forecast/hierarchy/nodes")
def list_nodes():
    """List every valid node_id available in the hierarchy."""
    return {"nodes": get_available_nodes()}


@app.get("/forecast/hierarchy")
def forecast_hierarchy(date: str = None):
    """Return full hierarchy forecast snapshot for a given date."""
    try:
        return get_full_hierarchy_snapshot(date)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/forecast/{node_id:path}")
def forecast_node(node_id: str, horizon: Optional[int] = Query(None, description="Forecast horizon in days")):
    """Return forecast time series for a single hierarchy node, optionally sliced by horizon."""
    try:
        return {"node_id": node_id, "forecast": get_forecast_for_node(node_id, horizon=horizon)}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/evaluation/summary")
def evaluation_summary():
    """Return rolling backtest and objective evaluation summary."""
    summary = get_evaluation_summary()
    if not summary:
        raise HTTPException(status_code=404, detail="No evaluation results found. Run backtest first.")
    return summary


@app.post("/ingest")
async def ingest(payload: IngestPayload):
    """
    Ingest simulated telemetry observation, compare against forecast, and broadcast live via WebSocket.
    """
    result = ingest_actual(payload.node_id, payload.date, payload.actual_value)
    await ws_manager.broadcast(result)
    return result


@app.get("/ingest/history")
def ingest_history():
    """Return all ingested telemetry records from current session."""
    return {"history": get_ingested_history()}


@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    """Real-time WebSocket connection for streaming telemetry updates."""
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
