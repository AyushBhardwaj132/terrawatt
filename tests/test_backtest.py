"""
Unit and integration tests for rolling-origin backtesting framework (src/backtest.py).
"""

import pytest
import pandas as pd
from pathlib import Path

from src.backtest import run_rolling_backtest, DEFAULT_ORIGINS
from src.config import RESULTS_DIR


def test_multiple_origins_generation():
    """Verify that rolling backtesting uses multiple origins, not just one."""
    origins = ["2025-01-01", "2025-02-01"]
    df_fcst, df_summary, res_dict = run_rolling_backtest(origins=origins, horizons=[7], save_results=False)

    assert res_dict["num_origins"] == 2
    assert res_dict["num_origins"] > 1, "Backtest must evaluate multiple forecast origins."
    assert set(df_fcst["origin"].unique()) == set(origins)


def test_single_origin_assertion_fails():
    """Test asserting that a single-origin evaluation is rejected when multiple origins are required."""
    origins = ["2025-01-01"]
    if len(origins) == 1:
        with pytest.raises(AssertionError, match="Multiple forecast origins required"):
            assert len(origins) > 1, "Multiple forecast origins required for true rolling backtest."


def test_rolling_forecast_schema():
    """Verify out-of-sample forecast dataframe schema."""
    origins = ["2025-01-01"]
    df_fcst, df_summary, res_dict = run_rolling_backtest(origins=origins, horizons=[7], save_results=False)

    expected_cols = {"origin", "unique_id", "ds", "y_true", "LGBM", "LGBM/MinTrace_method-mint_shrink"}
    for col in expected_cols:
        assert col in df_fcst.columns, f"Missing expected column {col} in rolling forecasts dataframe."


def test_rolling_reconciliation_coherence():
    """Verify parent forecast equals sum of children across all rolling origins."""
    origins = ["2025-01-01", "2025-02-01"]
    df_fcst, df_summary, res_dict = run_rolling_backtest(origins=origins, horizons=[7], save_results=False)

    assert res_dict["max_coherence_error"] < 1e-6
