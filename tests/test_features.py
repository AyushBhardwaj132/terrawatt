"""
Unit tests for src/feature_engineering.py, focusing on data leakage prevention.
"""

import pandas as pd
import numpy as np

from src.feature_engineering import build_features


def test_feature_engineering_leakage_prevention():
    """
    Crucial check: Verify rolling and lag features on day T use ONLY observations
    from day T-1 and earlier, never incorporating day T's own value.
    """
    dates = pd.date_range("2024-01-01", periods=10, freq="D")
    values = [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0]
    df = pd.DataFrame({"date": dates, "target": values})

    df_feat = build_features(df, target_col="target")

    # Day 0 (2024-01-01): target_lag_1 must be NaN
    assert np.isnan(df_feat.loc[0, "target_lag_1"])

    # Day 1 (2024-01-02): target_lag_1 must equal 10.0 (Day 0's value)
    assert df_feat.loc[1, "target_lag_1"] == 10.0

    # Day 2 (2024-01-03): target_rolling_mean_7 shifted window should mean(10.0, 20.0) = 15.0
    # Day 2's target is 30.0, so rolling mean MUST NOT include 30.0
    assert df_feat.loc[2, "target_rolling_mean_7"] == 15.0
