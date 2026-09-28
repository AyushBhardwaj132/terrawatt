"""
anomaly_detection.py
Real-time grid stress and forecast anomaly detection engine.

Calculates rolling forecast error, error standard deviation, and z-scores
to flag abnormal demand spikes/drops (e.g. grid trip events, unpredicted heatwaves).
"""

from typing import Dict, Optional
import numpy as np


def detect_telemetry_anomaly(
    actual_value: float,
    forecasted_value: float,
    rolling_std: float = 50.0,
    warning_z: float = 2.0,
    critical_z: float = 3.0
) -> Dict:
    """
    Evaluates an incoming telemetry observation against the model forecast.

    Returns:
      {
        "error": float,
        "error_pct": float,
        "z_score": float,
        "status": "NORMAL" | "WARNING" | "CRITICAL",
        "message": str
      }
    """
    error = actual_value - forecasted_value
    error_pct = (error / actual_value * 100.0) if actual_value != 0 else 0.0

    z_score = abs(error) / rolling_std if rolling_std > 0 else 0.0

    if z_score >= critical_z:
        status = "CRITICAL"
        message = f"CRITICAL: Telemetry deviates by {z_score:.2f} std ({error:+.1f} MU from forecast)."
    elif z_score >= warning_z:
        status = "WARNING"
        message = f"WARNING: Telemetry deviates by {z_score:.2f} std ({error:+.1f} MU from forecast)."
    else:
        status = "NORMAL"
        message = "Demand within expected forecast confidence bounds."

    return {
        "error": round(error, 2),
        "error_pct": round(error_pct, 2),
        "z_score": round(z_score, 2),
        "status": status,
        "message": message
    }
