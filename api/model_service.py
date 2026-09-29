"""
model_service.py
Service layer for loading forecast data, querying hierarchy nodes,
and processing simulated telemetry stream ingest with anomaly detection.
"""

from typing import Dict, List, Optional
import json
from pathlib import Path
import pandas as pd
import numpy as np

from src.config import RECONCILED_FORECASTS_PATH, CLEANED_DATA_PATH, RESULTS_DIR
from src.hierarchy import get_all_nodes, get_node_metadata, REGIONS, REGION_MEMBERS
from src.anomaly_detection import detect_telemetry_anomaly

_forecast_data: Optional[pd.DataFrame] = None
_actuals_lookup: Dict[str, Dict[str, float]] = {}
_ingested_actuals: List[Dict] = []

METHOD_COL_MAP = {
    "Base LightGBM": "LGBM",
    "Bottom-Up": "LGBM/BottomUp",
    "Top-Down": "LGBM/TopDown_method-forecast_proportions",
    "MinT-Shrink": "LGBM/MinTrace_method-mint_shrink"
}


def _load_actuals_lookup():
    """Build in-memory lookup table for actual energy demand across all 51 hierarchy nodes."""
    global _actuals_lookup
    if not CLEANED_DATA_PATH.exists():
        return

    try:
        df_clean = pd.read_csv(CLEANED_DATA_PATH)
        if "date" not in df_clean.columns:
            return
        df_clean = df_clean.set_index("date")

        actuals = {}
        all_nodes = get_all_nodes()

        for uid in all_nodes:
            node_map = {}
            if uid == "India":
                col = "India: EnergyMet"
                if col in df_clean.columns:
                    s = df_clean[col].dropna()
                    node_map = {str(d): round(float(v), 2) for d, v in s.items()}
            elif len(uid.split("/")) == 2:
                reg = uid.split("/")[1]
                col = f"{reg}: EnergyMet"
                if col in df_clean.columns:
                    s = df_clean[col].dropna()
                    node_map = {str(d): round(float(v), 2) for d, v in s.items()}
            elif "Other" in uid:
                reg = uid.split("/")[1]
                reg_col = f"{reg}: EnergyMet"
                mems = [m for m in REGION_MEMBERS.get(reg, []) if m in df_clean.columns]
                if reg_col in df_clean.columns and mems:
                    other_s = df_clean[reg_col] - df_clean[mems].sum(axis=1)
                    other_s = other_s.dropna()
                    node_map = {str(d): round(float(v), 2) for d, v in other_s.items()}
            else:
                state_name = uid.split("/")[2]
                col = f"{state_name}: EnergyMet"
                if col in df_clean.columns:
                    s = df_clean[col].dropna()
                    node_map = {str(d): round(float(v), 2) for d, v in s.items()}

            actuals[uid] = node_map

        _actuals_lookup = actuals
    except Exception as e:
        print(f"[WARNING] Could not load actuals lookup: {e}")


def load_forecasts() -> pd.DataFrame:
    """Load reconciled forecasts and actuals into memory at API startup."""
    global _forecast_data
    if not RECONCILED_FORECASTS_PATH.exists():
        raise FileNotFoundError(
            f"{RECONCILED_FORECASTS_PATH} not found. Please run 'python -m src.pipeline' first."
        )
    df = pd.read_csv(RECONCILED_FORECASTS_PATH)

    rec_col = [c for c in df.columns if "MinTrace" in c or "MinT" in c or "reconciled" in c][0]
    base_col = "y_hat" if "y_hat" in df.columns else ("LGBM" if "LGBM" in df.columns else rec_col)

    df["base_forecast"] = df[base_col]
    df["reconciled_forecast"] = df[rec_col]

    _forecast_data = df
    _load_actuals_lookup()
    return df


def get_available_nodes() -> List[str]:
    """Return all node IDs available in forecast dataset."""
    if _forecast_data is None:
        load_forecasts()
    return sorted(_forecast_data["unique_id"].unique().tolist())


def get_forecast_for_node(node_id: str, horizon: Optional[int] = None) -> List[Dict]:
    """Return forecast time series for a given node_id, optionally sliced by horizon."""
    if _forecast_data is None:
        load_forecasts()

    sub = _forecast_data[_forecast_data["unique_id"] == node_id]
    matched_uid = node_id
    if len(sub) == 0:
        matches = _forecast_data[_forecast_data["unique_id"].str.endswith(node_id)]
        if len(matches) == 0:
            raise KeyError(f"Node '{node_id}' not found. See /forecast/hierarchy/nodes for valid IDs.")
        sub = matches
        matched_uid = matches["unique_id"].iloc[0]

    sub = sub.sort_values("ds")
    if horizon is not None and horizon > 0:
        sub = sub.head(horizon)

    node_actuals = _actuals_lookup.get(matched_uid, {})

    results = []
    for _, row in sub.iterrows():
        d_str = str(row["ds"])
        actual_val = node_actuals.get(d_str)

        base_val = round(float(row.get("LGBM", row.get("base_forecast", 0.0))), 2)
        bu_val = round(float(row.get("LGBM/BottomUp", base_val)), 2)
        td_val = round(float(row.get("LGBM/TopDown_method-forecast_proportions", base_val)), 2)
        mint_val = round(float(row.get("LGBM/MinTrace_method-mint_shrink", row.get("reconciled_forecast", base_val))), 2)

        results.append({
            "date": d_str,
            "actual": actual_val,
            "base_forecast": base_val,
            "reconciled_forecast": mint_val,
            "bottom_up": bu_val,
            "top_down": td_val,
            "mint_shrink": mint_val,
            "methods": {
                "Base LightGBM": base_val,
                "Bottom-Up": bu_val,
                "Top-Down": td_val,
                "MinT-Shrink": mint_val
            }
        })
    return results


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
        "bottom_level": {},
        "actual_national": None,
        "actual_regions": {},
        "methods": {
            "Base LightGBM": {"national": None, "regions": {}},
            "Bottom-Up": {"national": None, "regions": {}},
            "Top-Down": {"national": None, "regions": {}},
            "MinT-Shrink": {"national": None, "regions": {}}
        },
        "coherence": {}
    }

    # Populate actuals for that date
    if "India" in _actuals_lookup and date in _actuals_lookup["India"]:
        result["actual_national"] = _actuals_lookup["India"][date]

    for reg in REGIONS:
        reg_uid = f"India/{reg}"
        if reg_uid in _actuals_lookup and date in _actuals_lookup[reg_uid]:
            result["actual_regions"][reg] = _actuals_lookup[reg_uid][date]

    for _, row in snapshot.iterrows():
        uid = row["unique_id"]
        meta = get_node_metadata(uid)

        base_val = round(float(row.get("LGBM", row.get("base_forecast", 0.0))), 2)
        bu_val = round(float(row.get("LGBM/BottomUp", base_val)), 2)
        td_val = round(float(row.get("LGBM/TopDown_method-forecast_proportions", base_val)), 2)
        mint_val = round(float(row.get("LGBM/MinTrace_method-mint_shrink", row.get("reconciled_forecast", base_val))), 2)

        vals = {
            "Base LightGBM": base_val,
            "Bottom-Up": bu_val,
            "Top-Down": td_val,
            "MinT-Shrink": mint_val
        }

        if meta["level"] == "national":
            result["national"] = mint_val
            for m_name, val in vals.items():
                result["methods"][m_name]["national"] = val
        elif meta["level"] == "region":
            result["regions"][meta["region"]] = mint_val
            for m_name, val in vals.items():
                result["methods"][m_name]["regions"][meta["region"]] = val
        else:
            result["bottom_level"][uid] = mint_val

    # Calculate empirical coherence for each method
    for m_name in ["Base LightGBM", "Bottom-Up", "Top-Down", "MinT-Shrink"]:
        parent = result["methods"][m_name]["national"]
        regions_vals = result["methods"][m_name]["regions"]
        children_sum = round(sum(regions_vals.values()), 2) if regions_vals else None
        if parent is not None and children_sum is not None:
            diff = round(abs(parent - children_sum), 2)
            result["coherence"][m_name] = {
                "parent_forecast": parent,
                "children_sum": children_sum,
                "difference": diff,
                "is_coherent": bool(diff < 0.05)
            }

    return result


def get_evaluation_summary() -> Dict:
    """Return evaluation metrics from results/ directory."""
    summary_path = RESULTS_DIR / "rolling_backtest_summary.json"
    eval_path = RESULTS_DIR / "evaluation.json"
    csv_path = RESULTS_DIR / "rolling_backtest.csv"

    data = {}
    if summary_path.exists():
        try:
            with open(summary_path, "r") as f:
                data = json.load(f)
        except Exception as e:
            print(f"[WARNING] Could not read {summary_path}: {e}")

    if not data and eval_path.exists():
        try:
            with open(eval_path, "r") as f:
                data = json.load(f)
        except Exception as e:
            print(f"[WARNING] Could not read {eval_path}: {e}")

    if csv_path.exists():
        try:
            df_csv = pd.read_csv(csv_path)
            data["detailed_results"] = df_csv.to_dict(orient="records")
        except Exception as e:
            print(f"[WARNING] Could not read {csv_path}: {e}")

    return data


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
