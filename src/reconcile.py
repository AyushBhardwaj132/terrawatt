"""
reconcile.py
Hierarchical time series reconciliation layer.

Implements mathematical reconciliation methods (Bottom-Up, Top-Down, MinT-Shrink, MinT-Cov)
to guarantee hierarchy coherence: parent forecast == sum(children forecasts).

Mathematics of MinT (Minimum Trace):
  Reconciled forecasts Y_tilde are given by:
    Y_tilde = S * (S^T * W^-1 * S)^-1 * S^T * W^-1 * Y_hat
  where:
    S = Summing matrix (n_total x n_bottom)
    Y_hat = Unreconciled base forecasts vector (n_total x 1)
    W = In-sample residual covariance matrix (n_total x n_total)
    In MinT-Shrink, W is estimated using Ledoit-Wolf shrinkage to ensure positive-definiteness.
"""

from typing import Dict, List, Optional, Tuple
import pandas as pd
import numpy as np

from hierarchicalforecast.core import HierarchicalReconciliation
from hierarchicalforecast.methods import BottomUp, TopDown, MinTrace


def reconcile_with_hierarchicalforecast(
    Y_hat_df: pd.DataFrame,
    S_df: pd.DataFrame,
    tags: dict,
    Y_df_train: Optional[pd.DataFrame] = None,
    methods: Optional[List] = None
) -> pd.DataFrame:
    """
    Reconciles base forecasts using hierarchicalforecast package implementations.

    Parameters:
      Y_hat_df: DataFrame containing ['unique_id', 'ds', 'y_hat']
      S_df: Summing matrix DataFrame produced by aggregate()
      tags: Hierarchy level tags dictionary
      Y_df_train: Training DataFrame containing in-sample actuals (needed for MinT covariance estimation)
      methods: List of reconciliation method instances. Defaults to BottomUp, TopDown, MinTrace(mint_shrink).

    Returns:
      reconciled_df: DataFrame with base and reconciled forecast columns.
    """
    if methods is None:
        methods = [
            BottomUp(),
            TopDown(method="forecast_proportions"),
            MinTrace(method="mint_shrink"),
        ]

    reconciler = HierarchicalReconciliation(reconcilers=methods)

    df_forecast = Y_hat_df.copy()
    if "y_hat" in df_forecast.columns and "LGBM" not in df_forecast.columns:
        df_forecast = df_forecast.rename(columns={"y_hat": "LGBM"})

    reconciled_df = reconciler.reconcile(
        Y_hat_df=df_forecast,
        tags=tags,
        S_df=S_df,
        Y_df=Y_df_train
    )

    return reconciled_df


def reconcile_matrix_bottom_up(
    y_hat_dict: Dict[str, np.ndarray],
    S_df: pd.DataFrame
) -> Dict[str, np.ndarray]:
    """
    Direct matrix implementation of Bottom-Up reconciliation:
    Y_tilde = S * Y_bottom
    """
    bottom_uids = S_df.columns.tolist()
    all_uids = S_df.index.tolist()

    horizon = len(next(iter(y_hat_dict.values())))
    Y_bottom = np.vstack([y_hat_dict[uid] for uid in bottom_uids])

    S_matrix = S_df.values
    Y_reconciled = S_matrix @ Y_bottom

    reconciled_dict = {}
    for idx, uid in enumerate(all_uids):
        reconciled_dict[uid] = Y_reconciled[idx, :]

    return reconciled_dict


def verify_coherence(
    reconciled_df: pd.DataFrame,
    parent_uid: str,
    child_uids: List[str],
    forecast_col: str,
    tolerance: float = 1e-6
) -> Tuple[bool, float]:
    """
    Verifies parent forecast equals sum of child forecasts across all timestamps.

    Returns:
      (is_coherent, max_absolute_error)
    """
    parent = reconciled_df[reconciled_df["unique_id"] == parent_uid].set_index("ds")[forecast_col]
    children = reconciled_df[reconciled_df["unique_id"].isin(child_uids)]
    children_sum = children.groupby("ds")[forecast_col].sum()

    diff = (parent - children_sum).abs()
    max_error = float(diff.max())
    is_coherent = max_error < tolerance

    return is_coherent, max_error
