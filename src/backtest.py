"""
backtest.py
True Rolling-Origin / Expanding-Window Backtesting Engine for TerraWatt.

Evaluates Base LightGBM, Bottom-Up, Top-Down, and MinT-Shrink reconciliation
across multiple historical forecast origins and multiple forecast horizons (7, 14, 30 days).

Zero Future Data Leakage:
  At origin T:
    - Training data strictly uses dates < T
    - In-sample residual covariance W estimation strictly uses dates < T
    - Model predictions evaluate out-of-sample window [T, T + H)
"""

from typing import Dict, List, Tuple
import pandas as pd
import numpy as np
import json
import time
from pathlib import Path

from src.config import (
    CLEANED_DATA_PATH, RECONCILED_FORECASTS_PATH, RESULTS_DIR
)
from src.data_loader import load_raw_data, clean_data
from src.hierarchy import REGIONS, REGION_MEMBERS, build_summing_matrix, get_parent_child_map, get_node_metadata
from src.train_base_models import train_all_base_models
from src.reconcile import reconcile_with_hierarchicalforecast, verify_coherence
from src.evaluate import calculate_mae, calculate_rmse, calculate_mape, calculate_wmape


DEFAULT_ORIGINS = ["2025-01-01", "2025-02-01", "2025-03-01", "2025-04-01", "2025-05-01", "2025-06-01"]
HORIZONS = [7, 14, 30]


def run_rolling_backtest(
    origins: List[str] = DEFAULT_ORIGINS,
    horizons: List[int] = HORIZONS,
    save_results: bool = True
) -> Tuple[pd.DataFrame, pd.DataFrame, dict]:
    """
    Executes expanding-window rolling-origin evaluation across multiple historical origins.
    """
    start_time = time.time()
    print("=" * 65)
    print("      TERRAWATT ROLLING-ORIGIN BACKTESTING ENGINE           ")
    print(f"      Origins ({len(origins)}): {origins[0]} -> {origins[-1]}")
    print(f"      Horizons: {horizons}")
    print("=" * 65)

    df_raw = load_raw_data()
    all_state_cols = [c for cols in REGION_MEMBERS.values() for c in cols]
    df_clean = clean_data(df_raw, state_columns=all_state_cols)

    Y_df, S_df, tags = build_summing_matrix(df_clean)
    target_cols = [f"{r}: EnergyMet" for r in REGIONS] + ["India: EnergyMet"] + all_state_cols

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    all_forecast_records = []
    summary_rows = []

    method_mapping = {
        "LGBM": "Base LightGBM",
        "LGBM/BottomUp": "Bottom-Up",
        "LGBM/TopDown_method-forecast_proportions": "Top-Down",
        "LGBM/MinTrace_method-mint_shrink": "MinT-Shrink"
    }

    max_coherence_error_reconciled = 0.0

    for origin in origins:
        origin_start = time.time()
        print(f"\n[Rolling Origin: {origin}] Training expanding models on data < {origin}...")

        base_results = train_all_base_models(df_clean, target_cols=target_cols, test_start=origin)

        for horizon in horizons:
            forecast_rows = []
            insample_rows = []
            actual_rows = []

            for target_col, res in base_results.items():
                node_name = target_col.replace(": EnergyMet", "")
                if node_name == "India":
                    uid = "India"
                elif node_name in REGIONS:
                    uid = f"India/{node_name}"
                else:
                    reg = [r for r, members in REGION_MEMBERS.items() if target_col in members][0]
                    uid = f"India/{reg}/{node_name}"

                h_test_dates = res["test_dates"][:horizon]
                h_preds = res["preds"][:horizon]
                h_actuals = res["y_test"][:horizon]

                for d, p, a in zip(h_test_dates, h_preds, h_actuals):
                    forecast_rows.append({"unique_id": uid, "ds": d, "y_hat": p})
                    actual_rows.append({"unique_id": uid, "ds": d, "y_true": a})

                for d, p, y in zip(res["train_dates"], res["preds_insample"], res["y_train"]):
                    insample_rows.append({"unique_id": uid, "ds": d, "LGBM": p, "y": y})

            Y_hat_df = pd.DataFrame(forecast_rows)
            Y_true_df = pd.DataFrame(actual_rows)
            Y_df_train = pd.DataFrame(insample_rows)

            existing_uids = set(Y_hat_df["unique_id"].unique())
            all_uids = set(S_df["unique_id"].unique()) if "unique_id" in S_df.columns else set(S_df.index)
            missing_uids = all_uids - existing_uids

            if missing_uids:
                for m_uid in missing_uids:
                    parts = str(m_uid).split("/")
                    if len(parts) >= 2:
                        reg = parts[1]
                        parent_uid = f"India/{reg}"

                        parent_df = Y_hat_df[Y_hat_df["unique_id"] == parent_uid].sort_values("ds")
                        children_df = Y_hat_df[Y_hat_df["unique_id"].str.startswith(f"India/{reg}/")].groupby("ds")["y_hat"].sum().reset_index()

                        other_df = parent_df.merge(children_df, on="ds", suffixes=("_p", "_c"))
                        other_df["y_hat"] = other_df["y_hat_p"] - other_df["y_hat_c"]
                        other_df["unique_id"] = m_uid

                        sub_other = other_df[["unique_id", "ds", "y_hat"]]
                        Y_hat_df = pd.concat([Y_hat_df, sub_other], ignore_index=True)

                        parent_in = Y_df_train[Y_df_train["unique_id"] == parent_uid].sort_values("ds")
                        children_in = Y_df_train[Y_df_train["unique_id"].str.startswith(f"India/{reg}/")].groupby("ds")[["LGBM", "y"]].sum().reset_index()

                        other_in = parent_in.merge(children_in, on="ds", suffixes=("_p", "_c"))
                        other_in["LGBM"] = other_in["LGBM_p"] - other_in["LGBM_c"]
                        other_in["y"] = other_in["y_p"] - other_in["y_c"]
                        other_in["unique_id"] = m_uid

                        sub_other_in = other_in[["unique_id", "ds", "LGBM", "y"]]
                        Y_df_train = pd.concat([Y_df_train, sub_other_in], ignore_index=True)

                        parent_act = Y_true_df[Y_true_df["unique_id"] == parent_uid].sort_values("ds")
                        children_act = Y_true_df[Y_true_df["unique_id"].str.startswith(f"India/{reg}/")].groupby("ds")["y_true"].sum().reset_index()
                        other_act = parent_act.merge(children_act, on="ds", suffixes=("_p", "_c"))
                        other_act["y_true"] = other_act["y_true_p"] - other_act["y_true_c"]
                        other_act["unique_id"] = m_uid
                        Y_true_df = pd.concat([Y_true_df, other_act[["unique_id", "ds", "y_true"]]], ignore_index=True)

            reconciled_df = reconcile_with_hierarchicalforecast(
                Y_hat_df=Y_hat_df,
                S_df=S_df,
                tags=tags,
                Y_df_train=Y_df_train
            )

            merged = reconciled_df.merge(Y_true_df, on=["unique_id", "ds"], how="inner")
            merged["origin"] = origin
            merged["horizon"] = int(horizon)

            all_forecast_records.append(merged)

            for m_col, readable_name in method_mapping.items():
                if m_col not in merged.columns:
                    continue

                for level in ["national", "region", "state", "overall"]:
                    if level == "overall":
                        sub = merged.copy()
                    elif level == "national":
                        sub = merged[merged["unique_id"] == "India"]
                    elif level == "region":
                        sub = merged[merged["unique_id"].isin([f"India/{r}" for r in REGIONS])]
                    else:
                        sub = merged[merged["unique_id"].str.count("/") == 2]

                    if len(sub) == 0:
                        continue

                    y_true = sub["y_true"].values
                    y_pred = sub[m_col].values

                    mae = calculate_mae(y_true, y_pred)
                    rmse = calculate_rmse(y_true, y_pred)
                    mape = calculate_mape(y_true, y_pred)
                    wmape = calculate_wmape(y_true, y_pred)

                    is_coh, coh_err = verify_coherence(
                        reconciled_df, parent_uid="India", child_uids=[f"India/{r}" for r in REGIONS], forecast_col=m_col
                    )
                    if readable_name in ["Bottom-Up", "MinT-Shrink"]:
                        max_coherence_error_reconciled = max(max_coherence_error_reconciled, coh_err)

                    summary_rows.append({
                        "origin": str(origin),
                        "horizon": int(horizon),
                        "method": str(readable_name),
                        "level": str(level),
                        "MAE": round(float(mae), 2),
                        "RMSE": round(float(rmse), 2),
                        "MAPE": round(float(mape), 2) if not np.isnan(mape) else None,
                        "WMAPE": round(float(wmape), 2),
                        "coherence_error": round(float(coh_err), 8),
                        "is_coherent": bool(is_coh)
                    })

        print(f"  [OK] Origin {origin} completed in {time.time() - origin_start:.2f}s")

    df_all_forecasts = pd.concat(all_forecast_records, ignore_index=True)
    df_summary = pd.DataFrame(summary_rows)

    pooled_rows = []
    for (horizon, method_name, level), group in df_summary.groupby(["horizon", "method", "level"]):
        mean_mae = float(group["MAE"].mean())
        mean_rmse = float(group["RMSE"].mean())
        mean_wmape = float(group["WMAPE"].mean())
        max_coh = float(group["coherence_error"].max())

        pooled_rows.append({
            "num_origins": len(origins),
            "horizon": int(horizon),
            "method": str(method_name),
            "level": str(level),
            "MAE": round(mean_mae, 2),
            "RMSE": round(mean_rmse, 2),
            "WMAPE": round(mean_wmape, 2),
            "coherence_error": round(max_coh, 8),
            "is_coherent": bool(max_coh < 1e-6)
        })

    df_pooled_summary = pd.DataFrame(pooled_rows)

    elapsed = float(time.time() - start_time)
    print("\n" + "=" * 65)
    print(f"      ROLLING-ORIGIN BACKTEST COMPLETE in {elapsed:.2f}s")
    print(f"      Evaluated {len(origins)} Origins x {len(horizons)} Horizons")
    if save_results:
        print(f"      Saved: results/rolling_backtest.csv & results/rolling_backtest_summary.csv")
    print("=" * 65)

    res_dict = {
        "num_origins": len(origins),
        "first_origin": str(origins[0]),
        "last_origin": str(origins[-1]),
        "origins": [str(o) for o in origins],
        "horizons": [int(h) for h in horizons],
        "elapsed_seconds": round(elapsed, 2),
        "max_coherence_error": float(max_coherence_error_reconciled),
        "pooled_results": pooled_rows
    }

    if save_results:
        df_all_forecasts.to_csv(RESULTS_DIR / "rolling_forecasts.csv", index=False)
        df_summary.to_csv(RESULTS_DIR / "rolling_backtest.csv", index=False)
        df_pooled_summary.to_csv(RESULTS_DIR / "rolling_backtest_summary.csv", index=False)
        with open(RESULTS_DIR / "rolling_backtest_summary.json", "w") as f:
            json.dump(res_dict, f, indent=2)

    return df_all_forecasts, df_pooled_summary, res_dict


if __name__ == "__main__":
    run_rolling_backtest()
