"""
pipeline.py
End-to-end execution pipeline for TerraWatt.

Orchestrates:
  1. Data Loading & Cleaning
  2. Hierarchy Construction & Summing Matrix Generation
  3. Feature Engineering
  4. Base Forecasting (LightGBM Walk-Forward)
  5. Hierarchical Reconciliation (MinT-Shrink & Bottom-Up)
  6. Objective Evaluation & Coherence Verification
  7. Artifact & Results Serialization

Usage:
  python -m src.pipeline --test-start 2025-01-01
"""

import argparse
from pathlib import Path
import pandas as pd
import numpy as np
import joblib
import json
from datetime import datetime

from src.config import (
    RAW_POSOCO_PATH, CLEANED_DATA_PATH, RECONCILED_FORECASTS_PATH,
    ARTIFACTS_DIR, RESULTS_DIR, DEFAULT_TEST_START
)
from src.data_loader import load_raw_data, clean_data, validate_data_integrity
from src.hierarchy import REGION_MEMBERS, REGIONS, build_summing_matrix, get_parent_child_map
from src.train_base_models import train_all_base_models
from src.reconcile import reconcile_with_hierarchicalforecast, verify_coherence
from src.evaluate import evaluate_forecasts


def run_pipeline(test_start: str = DEFAULT_TEST_START) -> dict:
    """Executes the complete end-to-end TerraWatt pipeline."""
    print("=" * 60)
    print("      TERRAWATT HIERARCHICAL ENERGY FORECASTING PIPELINE      ")
    print("=" * 60)

    # 1. Load & Clean Data
    print("\n[Step 1/6] Loading and cleaning POSOCO daily energy dataset...")
    df_raw = load_raw_data()
    all_state_cols = [c for cols in REGION_MEMBERS.values() for c in cols]
    df_clean = clean_data(df_raw, state_columns=all_state_cols)
    validate_data_integrity(df_clean)
    df_clean.to_csv(CLEANED_DATA_PATH, index=False)
    print(f"  [OK] Cleaned dataset saved to: {CLEANED_DATA_PATH}")

    # 2. Build Hierarchy & Summing Matrix
    print("\n[Step 2/6] Building 3-level summing matrix and aggregate tags...")
    Y_df, S_df, tags = build_summing_matrix(df_clean)
    print(f"  [OK] Aggregated total hierarchy series: {len(Y_df['unique_id'].unique())} unique nodes.")

    # 3. Train Base LightGBM Models
    print(f"\n[Step 3/6] Training base LightGBM models (Walk-forward split cutoff: {test_start})...")
    target_cols = [f"{r}: EnergyMet" for r in REGIONS] + ["India: EnergyMet"] + all_state_cols
    base_results = train_all_base_models(df_clean, target_cols=target_cols, test_start=test_start)
    print(f"  [OK] Trained {len(base_results)} per-node LightGBM models successfully.")

    # 4. Save Model Artifacts & Metadata
    print("\n[Step 4/6] Persisting model artifacts to models/artifacts/...")
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    for target_col, res in base_results.items():
        node_id = target_col.replace(": EnergyMet", "")
        safe_filename = node_id.replace("/", "_").replace(" ", "_") + ".joblib"
        model_path = ARTIFACTS_DIR / safe_filename
        artifact = {
            "node_id": node_id,
            "target_col": target_col,
            "model": res["model"],
            "feature_cols": res["feature_cols"],
            "mae": res["mae"],
            "rmse": res["rmse"],
            "mape": res["mape"],
            "trained_at": datetime.now().isoformat()
        }
        joblib.dump(artifact, model_path)
    print(f"  [OK] Saved {len(base_results)} model artifacts.")

    # 5. Format Base Forecasts & In-sample Residuals for MinT
    print("\n[Step 5/6] Performing MinT-Shrink & Bottom-Up Hierarchical Reconciliation...")
    forecast_rows = []
    insample_rows = []

    for target_col, res in base_results.items():
        node_name = target_col.replace(": EnergyMet", "")
        if node_name == "India":
            uid = "India"
        elif node_name in REGIONS:
            uid = f"India/{node_name}"
        else:
            reg = [r for r, members in REGION_MEMBERS.items() if target_col in members][0]
            uid = f"India/{reg}/{node_name}"

        for d, p in zip(res["test_dates"], res["preds"]):
            forecast_rows.append({"unique_id": uid, "ds": d, "y_hat": p})

        for d, p, y in zip(res["train_dates"], res["preds_insample"], res["y_train"]):
            insample_rows.append({"unique_id": uid, "ds": d, "LGBM": p, "y": y})

    Y_hat_df = pd.DataFrame(forecast_rows)
    Y_df_train = pd.DataFrame(insample_rows)

    # Handle synthetic residual 'Other_<Region>' base forecasts & insample actuals
    existing_uids = set(Y_hat_df["unique_id"].unique())
    all_uids = set(S_df["unique_id"].unique()) if "unique_id" in S_df.columns else set(S_df.index)
    missing_uids = all_uids - existing_uids

    if missing_uids:
        for m_uid in missing_uids:
            parts = str(m_uid).split("/")
            if len(parts) >= 2:
                reg = parts[1]
                parent_uid = f"India/{reg}"

                # Out-of-sample forecast for Other_<Region>
                parent_df = Y_hat_df[Y_hat_df["unique_id"] == parent_uid].sort_values("ds")
                children_df = Y_hat_df[Y_hat_df["unique_id"].str.startswith(f"India/{reg}/")].groupby("ds")["y_hat"].sum().reset_index()

                other_df = parent_df.merge(children_df, on="ds", suffixes=("_p", "_c"))
                other_df["y_hat"] = other_df["y_hat_p"] - other_df["y_hat_c"]
                other_df["unique_id"] = m_uid

                sub_other = other_df[["unique_id", "ds", "y_hat"]]
                Y_hat_df = pd.concat([Y_hat_df, sub_other], ignore_index=True)

                # In-sample predictions & actuals for Other_<Region>
                parent_in = Y_df_train[Y_df_train["unique_id"] == parent_uid].sort_values("ds")
                children_in = Y_df_train[Y_df_train["unique_id"].str.startswith(f"India/{reg}/")].groupby("ds")[["LGBM", "y"]].sum().reset_index()

                other_in = parent_in.merge(children_in, on="ds", suffixes=("_p", "_c"))
                other_in["LGBM"] = other_in["LGBM_p"] - other_in["LGBM_c"]
                other_in["y"] = other_in["y_p"] - other_in["y_c"]
                other_in["unique_id"] = m_uid

                sub_other_in = other_in[["unique_id", "ds", "LGBM", "y"]]
                Y_df_train = pd.concat([Y_df_train, sub_other_in], ignore_index=True)

    reconciled_df = reconcile_with_hierarchicalforecast(
        Y_hat_df=Y_hat_df,
        S_df=S_df,
        tags=tags,
        Y_df_train=Y_df_train
    )

    reconciled_df.to_csv(RECONCILED_FORECASTS_PATH, index=False)
    print(f"  [OK] Reconciled forecast dataset saved to: {RECONCILED_FORECASTS_PATH}")

    # 6. Evaluation & Coherence Check
    print("\n[Step 6/6] Calculating objective evaluation metrics...")
    pc_map = get_parent_child_map()
    rec_col = [c for c in reconciled_df.columns if "MinTrace" in c or "MinT" in c][0]

    is_coherent, max_err = verify_coherence(
        reconciled_df, parent_uid="India", child_uids=[f"India/{r}" for r in REGIONS], forecast_col=rec_col
    )

    eval_summary = {
        "is_coherent": is_coherent,
        "max_hierarchy_coherence_error": max_err,
        "reconciled_column": rec_col,
        "pipeline_timestamp": datetime.now().isoformat()
    }

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_DIR / "evaluation.json", "w") as f:
        json.dump(eval_summary, f, indent=2)

    print(f"  [OK] Coherence status: {is_coherent} (Max error: {max_err:.10f})")
    print("=" * 60)
    print("               PIPELINE EXECUTION COMPLETE                   ")
    print("=" * 60)

    return eval_summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TerraWatt Hierarchical Pipeline Runner")
    parser.add_argument("--test-start", default=DEFAULT_TEST_START, help="Cutoff date for test set")
    args = parser.parse_args()

    run_pipeline(test_start=args.test_start)
