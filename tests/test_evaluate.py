"""
Unit tests for src/evaluate.py
"""

import numpy as np
import pandas as pd

from src.evaluate import (
    calculate_mae, calculate_rmse, calculate_mape, calculate_wmape, evaluate_forecasts
)


def test_evaluation_metrics():
    """Verify evaluation metric calculations."""
    y_true = np.array([100.0, 200.0, 300.0])
    y_pred = np.array([110.0, 190.0, 310.0])

    mae = calculate_mae(y_true, y_pred)
    assert mae == 10.0

    rmse = calculate_rmse(y_true, y_pred)
    assert np.isclose(rmse, 10.0)

    wmape = calculate_wmape(y_true, y_pred)
    # sum(|err|) = 30, sum(|true|) = 600 -> 30/600 * 100 = 5%
    assert np.isclose(wmape, 5.0)


def test_mape_near_zero_handling():
    """Verify MAPE returns NaN when actual values are zero/near-zero."""
    y_true = np.array([0.1, 0.2, 0.0])
    y_pred = np.array([1.0, 2.0, 3.0])

    mape = calculate_mape(y_true, y_pred, min_threshold=1.0)
    assert np.isnan(mape)
