"""
Unit tests for src/train_base_models.py
"""

import pandas as pd
import numpy as np

from src.train_base_models import train_lightgbm_for_node


def test_train_lightgbm_for_node():
    """Verify LightGBM training and prediction format on synthetic series."""
    dates = pd.date_range("2023-01-01", "2025-03-01", freq="D")
    np.random.seed(42)
    values = 100.0 + np.sin(np.arange(len(dates))) * 10.0 + np.random.normal(0, 2, len(dates))

    df = pd.DataFrame({"date": dates, "India: EnergyMet": values})

    res = train_lightgbm_for_node(df, target_col="India: EnergyMet", test_start="2025-01-01")

    assert res["target_col"] == "India: EnergyMet"
    assert len(res["preds"]) > 0
    assert len(res["preds_insample"]) > 0
    assert res["mae"] >= 0.0
    assert res["rmse"] >= 0.0
