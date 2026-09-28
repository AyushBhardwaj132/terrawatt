"""
Unit tests for src/reconcile.py
"""

import pandas as pd
import numpy as np

from src.reconcile import reconcile_matrix_bottom_up, verify_coherence


def test_bottom_up_matrix_reconciliation():
    """Verify matrix bottom-up reconciliation satisfies sum(bottom) == parent."""
    # Hierarchy: Parent 'P' = Child 'C1' + Child 'C2'
    S_df = pd.DataFrame(
        [[1.0, 1.0], [1.0, 0.0], [0.0, 1.0]],
        index=["P", "C1", "C2"],
        columns=["C1", "C2"]
    )

    y_hat_dict = {
        "C1": np.array([10.0, 20.0]),
        "C2": np.array([15.0, 25.0])
    }

    reconciled = reconcile_matrix_bottom_up(y_hat_dict, S_df)

    # Parent 'P' reconciled forecast should equal C1 + C2
    np.testing.assert_array_equal(reconciled["P"], np.array([25.0, 45.0]))


def test_verify_coherence():
    """Verify coherence checker returns True for coherent series."""
    df = pd.DataFrame({
        "ds": ["2025-01-01", "2025-01-01", "2025-01-01"],
        "unique_id": ["India", "India/NR", "India/WR"],
        "reconciled": [100.0, 60.0, 40.0]
    })

    is_coherent, max_err = verify_coherence(
        df, parent_uid="India", child_uids=["India/NR", "India/WR"], forecast_col="reconciled"
    )

    assert is_coherent
    assert max_err == 0.0
