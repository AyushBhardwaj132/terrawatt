"""
config.py
Centralized configuration management for TerraWatt.
Uses pathlib.Path to avoid hardcoded absolute paths across OS environments.
"""

from pathlib import Path
import os

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"

RAW_POSOCO_PATH = RAW_DATA_DIR / "POSOCO_data.csv"
CLEANED_DATA_PATH = PROCESSED_DATA_DIR / "cleaned_daily.csv"
RECONCILED_FORECASTS_PATH = PROCESSED_DATA_DIR / "reconciled_forecasts_mint_shrink.csv"

ARTIFACTS_DIR = BASE_DIR / "models" / "artifacts"
RESULTS_DIR = BASE_DIR / "results"

# Data Source URL
POSOCO_URL = "https://robbieandrew.github.io/india/data/POSOCO_data.csv"

# Time Series Settings
STATE_LEVEL_RELIABLE_FROM = "2013-03-31"
DEFAULT_TEST_START = "2025-01-01"
DEFAULT_FORECAST_HORIZON = 7

# Random Seed & Tolerances
RANDOM_SEED = 42
COHERENCE_TOLERANCE = 1e-6

# Ensure required directories exist
for directory in [RAW_DATA_DIR, PROCESSED_DATA_DIR, ARTIFACTS_DIR, RESULTS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)
