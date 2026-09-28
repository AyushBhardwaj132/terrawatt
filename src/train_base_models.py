"""
train_base_models.py
Trains per-node LightGBM base forecasting models using walk-forward validation.
"""

from typing import Dict, List, Tuple
import pandas as pd
import numpy as np
import lightgbm as lgb
from sklearn.metrics import mean_absolute_error, mean_squared_error, mean_absolute_percentage_error

from src.feature_engineering import build_features
from src.config import DEFAULT_TEST_START, RANDOM_SEED


def get_feature_columns(df: pd.DataFrame, target_col: str) -> List[str]:
    """Extract calendar/holiday features + target column's lag/rolling features."""
    calendar_cols = [
        "day_of_week", "day_of_month", "month", "quarter", "year",
        "day_of_year", "is_weekend", "is_holiday"
    ]
    node_specific_cols = [
        c for c in df.columns
        if c.startswith(f"{target_col}_lag_") or c.startswith(f"{target_col}_rolling_")
    ]
    return calendar_cols + node_specific_cols


def train_test_split_by_date(df: pd.DataFrame, test_start: str, date_col: str = "date") -> Tuple[pd.DataFrame, pd.DataFrame]:
    """Walk-forward time split: everything before test_start is train, from test_start onward is test."""
    cutoff = pd.Timestamp(test_start)
    train = df[df[date_col] < cutoff].copy()
    test = df[df[date_col] >= cutoff].copy()
    return train, test


def train_lightgbm_for_node(
    df_clean: pd.DataFrame,
    target_col: str,
    test_start: str = DEFAULT_TEST_START,
    fallback_test_days: int = 180
) -> Dict:
    """
    Trains a LightGBM regressor for a single target column (hierarchy node).
    Returns predictions (in-sample and out-of-sample) + evaluation metrics.
    """
    df_features = build_features(df_clean, target_col=target_col)
    feature_cols = get_feature_columns(df_features, target_col)
    df_model = df_features.dropna(subset=[target_col] + feature_cols)

    train, test = train_test_split_by_date(df_model, test_start)
    used_fallback = False

    if len(test) == 0:
        used_fallback = True
        df_model = df_model.sort_values("date")
        test = df_model.tail(fallback_test_days)
        train = df_model.iloc[:-fallback_test_days]

    if len(test) == 0 or len(train) == 0:
        raise ValueError(f"Insufficient training or test data for target column '{target_col}'.")

    X_train, y_train = train[feature_cols].copy(), train[target_col]
    X_test, y_test = test[feature_cols].copy(), test[target_col]

    # Sanitize feature names for LightGBM
    safe_names = {c: c.replace(":", "").replace(" ", "_") for c in feature_cols}
    X_train = X_train.rename(columns=safe_names)
    X_test = X_test.rename(columns=safe_names)

    model = lgb.LGBMRegressor(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=6,
        random_state=RANDOM_SEED,
        verbosity=-1,
        n_jobs=1
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    preds_insample = model.predict(X_train)

    mean_actual = y_test.mean()
    is_low_magnitude = mean_actual < 5.0

    mape = mean_absolute_percentage_error(y_test, preds) if not is_low_magnitude else float("nan")
    rmse = np.sqrt(mean_squared_error(y_test, preds))
    mae = mean_absolute_error(y_test, preds)

    return {
        "target_col": target_col,
        "used_fallback_split": used_fallback,
        "is_low_magnitude": is_low_magnitude,
        "mean_actual": mean_actual,
        "model": model,
        "train_size": len(train),
        "test_size": len(test),
        "train_dates": train["date"].values,
        "test_dates": test["date"].values,
        "y_train": y_train.values,
        "y_test": y_test.values,
        "preds_insample": preds_insample,
        "preds": preds,
        "mape": mape,
        "rmse": rmse,
        "mae": mae,
        "feature_cols": feature_cols,
    }


def train_all_base_models(
    df_clean: pd.DataFrame,
    target_cols: List[str],
    test_start: str = DEFAULT_TEST_START
) -> Dict[str, Dict]:
    """Train base LightGBM models across all target columns in the hierarchy."""
    results = {}
    for col in target_cols:
        if col in df_clean.columns:
            results[col] = train_lightgbm_for_node(df_clean, target_col=col, test_start=test_start)
    return results
