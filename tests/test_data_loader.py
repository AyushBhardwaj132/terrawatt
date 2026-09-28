"""
Unit tests for src/data_loader.py
"""

import pytest
import pandas as pd
import numpy as np

from src.data_loader import (
    load_raw_data, clean_data, validate_data_integrity, apply_known_bad_value_fixes
)
from src.config import RAW_POSOCO_PATH


def test_load_raw_data():
    """Verify raw data loading and date parsing."""
    if not RAW_POSOCO_PATH.exists():
        pytest.skip("RAW_POSOCO_PATH not available offline")
    df = load_raw_data(str(RAW_POSOCO_PATH))
    assert "date" in df.columns
    assert isinstance(df["date"].iloc[0], pd.Timestamp)


def test_apply_known_bad_value_fixes():
    """Verify bad values (like Assam on 2014-11-25) are replaced with NaN."""
    mock_df = pd.DataFrame({
        "date": [pd.Timestamp("2014-11-25"), pd.Timestamp("2014-11-26")],
        "Assam: EnergyMet": [1190.0, 20.0]
    })
    fixed_df = apply_known_bad_value_fixes(mock_df)
    assert np.isnan(fixed_df.loc[fixed_df["date"] == "2014-11-25", "Assam: EnergyMet"].values[0])
    assert fixed_df.loc[fixed_df["date"] == "2014-11-26", "Assam: EnergyMet"].values[0] == 20.0


def test_validate_data_integrity():
    """Verify integrity validation passes on clean data and catches duplicate dates."""
    valid_df = pd.DataFrame({
        "date": [pd.Timestamp("2024-01-01"), pd.Timestamp("2024-01-02")],
        "India: EnergyMet": [4000.0, 4100.0]
    })
    validate_data_integrity(valid_df)

    invalid_df = pd.DataFrame({
        "date": [pd.Timestamp("2024-01-01"), pd.Timestamp("2024-01-01")],
        "India: EnergyMet": [4000.0, 4100.0]
    })
    with pytest.raises(ValueError, match="Duplicate dates"):
        validate_data_integrity(invalid_df)
