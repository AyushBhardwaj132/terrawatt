"""
model_service.py
Service layer for loading forecast data, querying hierarchy nodes,
and processing simulated telemetry stream ingest with anomaly detection.
"""

from typing import Dict, List, Optional
import pandas as pd
import numpy as np

from src.config import RECONCILED_FORECASTS_PATH
from src.hierarchy import get_all_nodes, get_node_metadata, REGIONS, REGION_MEMBERS
from src.anomaly_detection import detect_telemetry_anomaly

_forecast_data = None
_ingested_actuals = []


def load_forecasts() -> pd.DataFrame:
    """Load reconciled forecasts into memory at API startup."""
    global _forecast_data
    if not RECONCILED_FORECASTS_PATH.exists():
        raise FileNotFoundError(
            f"{RECONCILED_FORECASTS_PATH} not found. Please run 'python -m src.pipeline' first."
        )
    df = pd.read_csv(RECONCILED_FORECASTS_PATH)
    rec_col = [c for c in df.columns if "MinTrace" in c or "MinT" in c or "reconciled" in c][0]
    base_col = "y_hat" if "y_hat" in df.columns else ("LGBM" if "LGBM" in df.columns else rec_col)

    df = df.rename(columns={rec_col: "reconciled_forecast", base_col: "base_forecast"})
    _forecast_data = df
    return df


def get_available_nodes() -> List[str]:
    """Return all node IDs available in forecast dataset."""
    if _forecast_data is None:
        load_forecasts()
    return sorted(_forecast_data["unique_id"].unique().tolist())


def get_forecast_for_node(node_id: str) -> List[Dict]:
    """Return full time series forecast for a given node_id."""
    if _forecast_data is None:
        load_forecasts()

    sub = _forecast_data[_forecast_data["unique_id"] == node_id]
    if len(sub) == 0:
        # Fallback search by suffix match (e.g. 'India/NR/Punjab' or 'Punjab')
        sub = _forecast_data[_forecast_data["unique_id"].str.endswith(node_id)]
        if len(sub) == 0:
            raise KeyError(f"Node '{node_id}' not found. See /forecast/hierarchy/nodes for valid IDs.")

    sub = sub.sort_values("ds")
    return [
        {
            "date": str(row["ds"]),
            "base_forecast": round(float(row["base_forecast"]), 2),
            "reconciled_forecast": round(float(row["reconciled_forecast"]), 2),
        }
        for _, row in sub.iterrows()
    ]


def get_full_hierarchy_snapshot(date: str = None) -> Dict:
    """Return full hierarchy forecast snapshot for a given date (latest date if None)."""
    if _forecast_data is None:
        load_forecasts()

    if date is None:
        date = str(_forecast_data["ds"].max())

    snapshot = _forecast_data[_forecast_data["ds"] == date]
    if len(snapshot) == 0:
        raise KeyError(f"No forecast data available for date '{date}'.")

    result = {
        "date": date,
        "national": None,
        "regions": {},
        "bottom_level": {}
    }

    for _, row in snapshot.iterrows():
        uid = row["unique_id"]
        val = round(float(row["reconciled_forecast"]), 2)
        meta = get_node_metadata(uid)

        if meta["level"] == "national":
            result["national"] = val
        elif meta["level"] == "region":
            result["regions"][meta["region"]] = val
        else:
            result["bottom_level"][uid] = val

    return result


def ingest_actual(node_id: str, date: str, actual_value: float) -> Dict:
    """
    Ingest simulated telemetry observation and compare against forecast with anomaly detection.
    """
    global _forecast_data
    if _forecast_data is None:
        load_forecasts()

    record = {"node_id": node_id, "date": date, "actual_value": actual_value}
    _ingested_actuals.append(record)

    candidates = _forecast_data[_forecast_data["unique_id"].str.endswith(node_id)]
    existing = candidates[candidates["ds"] == date]

    result = {
        "status": "ingested",
        "record": record,
        "total_ingested": len(_ingested_actuals)
    }

    if len(existing) > 0:
        forecasted = float(existing.iloc[0]["reconciled_forecast"])
        base_fcst = float(existing.iloc[0]["base_forecast"])

        anomaly = detect_telemetry_anomaly(actual_value=actual_value, forecasted_value=forecasted)

        result["comparison"] = {
            "base_forecast": round(base_fcst, 2),
            "reconciled_forecast": round(forecasted, 2),
            "actual": actual_value,
            "error": anomaly["error"],
            "error_pct": anomaly["error_pct"],
            "z_score": anomaly["z_score"],
            "anomaly_status": anomaly["status"],
            "message": anomaly["message"]
        }
    else:
        result["comparison"] = None
        result["note"] = "No existing forecast found for this date/node to compare against."

    return result


def get_ingested_history() -> List[Dict]:
    """Return all ingested telemetry records for the active session."""
    return _ingested_actuals
