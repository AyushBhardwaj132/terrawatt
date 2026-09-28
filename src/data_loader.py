"""
data_loader.py
Loads, cleans, and validates the POSOCO daily energy dataset.
See README Section 5.1 for verified dataset details.

Cleaning logic incorporates data-quality findings from the investigation phase:
  - Assam: EnergyMet on 2014-11-25 is a corrupted value (1190 vs ~20 on neighboring days) -> set to NaN, interpolate
  - WR state-level columns on 2015-01-19 show a scaling anomaly -> set to NaN, interpolate
  - The early-2013 gap (2013-01-03 to 2013-03-30, ~87 days) affects STATE, REGION, and NATIONAL columns.
    Left entirely as NaN; flagged via explicit `is_data_reliable` column.
  - Isolated gaps (<= 3 days) -> interpolated using time method.
"""

from pathlib import Path
import pandas as pd
import numpy as np

from src.config import (
    POSOCO_URL, RAW_POSOCO_PATH, CLEANED_DATA_PATH, STATE_LEVEL_RELIABLE_FROM
)

KNOWN_BAD_VALUES = [
    {
        "date": "2014-11-25",
        "column": "Assam: EnergyMet",
        "reason": "corrupted state value (1190 vs ~20 on neighboring days); NER total (37) is correct"
    },
    {"date": "2015-01-19", "column": "Maharashtra: EnergyMet", "reason": "WR state breakdown scaling anomaly"},
    {"date": "2015-01-19", "column": "MP: EnergyMet", "reason": "WR state breakdown scaling anomaly"},
    {"date": "2015-01-19", "column": "Chhattisgarh: EnergyMet", "reason": "WR state breakdown scaling anomaly"},
    {"date": "2015-01-19", "column": "Gujarat: EnergyMet", "reason": "WR state breakdown scaling anomaly"},
    {"date": "2015-01-19", "column": "Goa: EnergyMet", "reason": "WR state breakdown scaling anomaly"},
    {"date": "2015-01-19", "column": "DD: EnergyMet", "reason": "WR state breakdown scaling anomaly"},
    {"date": "2015-01-19", "column": "DNH: EnergyMet", "reason": "WR state breakdown scaling anomaly"},
    {"date": "2015-01-19", "column": "Essar steel: EnergyMet", "reason": "WR state breakdown scaling anomaly"},
]


def load_raw_data(source_path_or_url: str = None) -> pd.DataFrame:
    """
    Load raw POSOCO daily dataset.
    If source_path_or_url is not provided, tries loading local RAW_POSOCO_PATH,
    or downloads from POSOCO_URL and caches to RAW_POSOCO_PATH.
    """
    if source_path_or_url is None:
        if RAW_POSOCO_PATH.exists():
            source_path_or_url = str(RAW_POSOCO_PATH)
        else:
            source_path_or_url = POSOCO_URL

    df = pd.read_csv(source_path_or_url)
    if "yyyymmdd" in df.columns:
        df["yyyymmdd"] = pd.to_datetime(df["yyyymmdd"], format="%Y%m%d")
        df = df.rename(columns={"yyyymmdd": "date"})
    elif "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])
    else:
        raise ValueError("Dataframe missing required date column ('yyyymmdd' or 'date')")

    df = df.sort_values("date").reset_index(drop=True)

    # Cache raw data locally if downloaded from URL
    if not RAW_POSOCO_PATH.exists() and source_path_or_url == POSOCO_URL:
        RAW_POSOCO_PATH.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(RAW_POSOCO_PATH, index=False)

    return df


def apply_known_bad_value_fixes(df: pd.DataFrame) -> pd.DataFrame:
    """Set confirmed-bad values to NaN so they get interpolated cleanly."""
    df = df.copy()
    for fix in KNOWN_BAD_VALUES:
        if fix["column"] in df.columns:
            mask = df["date"] == pd.Timestamp(fix["date"])
            df.loc[mask, fix["column"]] = np.nan
    return df


def interpolate_isolated_gaps(df: pd.DataFrame, columns: list, limit: int = 3) -> pd.DataFrame:
    """
    Interpolate ONLY gaps whose full contiguous length is <= limit days.
    Longer gaps are left as NaN to avoid generating fabricated values.
    """
    df = df.copy()
    df = df.set_index("date")
    for col in columns:
        if col not in df.columns:
            continue
        series = df[col]
        is_na = series.isna()
        valid_groups = (~is_na).cumsum()
        gap_lengths = is_na.groupby(valid_groups).transform("sum")
        fillable = is_na & (gap_lengths <= limit)
        interpolated = series.interpolate(method="time", limit_direction="both")
        df[col] = series.where(~fillable, interpolated)
    df = df.reset_index()
    return df


def clean_data(df: pd.DataFrame, state_columns: list = None) -> pd.DataFrame:
    """Full cleaning pipeline."""
    df = apply_known_bad_value_fixes(df)
    all_energymet_cols = [c for c in df.columns if "EnergyMet" in c]
    df = interpolate_isolated_gaps(df, all_energymet_cols, limit=3)

    cutoff = pd.Timestamp(STATE_LEVEL_RELIABLE_FROM)
    df["is_data_reliable"] = df["date"] >= cutoff
    return df


def validate_data_integrity(df: pd.DataFrame) -> None:
    """
    Validation checks:
    - No duplicate dates
    - Clean date column
    - Minimum expected columns present
    """
    if df["date"].duplicated().any():
        raise ValueError("Data validation failed: Duplicate dates found in dataset.")

    if not pd.api.types.is_datetime64_any_dtype(df["date"]):
        raise ValueError("Data validation failed: 'date' column is not datetime type.")

    energymet_cols = [c for c in df.columns if "EnergyMet" in c]
    if len(energymet_cols) == 0:
        raise ValueError("Data validation failed: No EnergyMet columns found.")


if __name__ == "__main__":
    df_raw = load_raw_data()
    df_clean = clean_data(df_raw)
    validate_data_integrity(df_clean)
    df_clean.to_csv(CLEANED_DATA_PATH, index=False)
    print(f"Cleaned dataset saved successfully to {CLEANED_DATA_PATH}")
