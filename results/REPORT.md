# TerraWatt Methodological Evaluation Report

## 1. Executive Summary
This report presents the verified empirical backtesting results for **TerraWatt**, a production-style hierarchical electricity demand forecasting system evaluated on the Indian power grid dataset (POSOCO / GRID-INDIA).

---

## 2. Methodology & Backtest Classification
- **Evaluation Methodology**: **Single-Origin Holdout Evaluation** (Forecast Origin: `2025-01-01`).
- **Dataset**: POSOCO / GRID-INDIA Daily Electricity Consumption Data (`2013-03-31` to Present).
- **Training Period**: Data strictly prior to `2025-01-01`.
- **Forecast Horizons**: 7-day, 14-day, and 30-day ahead out-of-sample predictions from the `2025-01-01` origin.
- **Hierarchy Nodes**: 51 total nodes across 3 geographic levels:
  - Level 0: `India` (National Aggregate)
  - Level 1: `India/NR`, `India/WR`, `India/SR`, `India/ER`, `India/NER` (5 Regions)
  - Level 2: 45 State/Bulk Consumer & Synthetic Residual (`Other_<Region>`) Nodes

---

## 3. Data Leakage & Test Isolation Audit
- **Calendar & Holiday Features**: Day of week, month, quarter, day of year, year, weekend, and India national holidays (`holidays`).
- **Lag & Rolling Features**: Lags ($t-1, t-7, t-30, t-365$) and rolling stats ($7d, 30d$).
- **Leakage Audit**: Verified that all lag and rolling features apply `.shift(1)` prior to window calculations. Observation $T$ is **never** present in feature vectors for day $T$. Verified via `tests/test_features.py`.
- **Test Isolation**: Residual covariance matrix $W$ estimation and model fitting strictly use in-sample data prior to `2025-01-01`.

---

## 4. Empirical Benchmark Results (National Level: `India`)

Evaluated on single-origin holdout test split (Origin: `2025-01-01`).

| Forecast Horizon | Method | National MAE (MU) | National RMSE (MU) | WMAPE (%) | Coherence Error (MU) | Coherent? |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **7 Days** | Base LightGBM | 65.38 | 76.48 | 1.51% | 52.166483 | ❌ |
| **7 Days** | **Bottom-Up** | **49.09** | **55.82** | **1.13%** | **0.000000** | **✅** |
| **7 Days** | Top-Down | 65.38 | 76.48 | 1.51% | 0.000000 | ✅ |
| **7 Days** | MinT-Shrink | 52.16 | 58.71 | 1.21% | 0.000000 | ✅ |
| **14 Days** | Base LightGBM | 68.78 | 83.84 | 1.58% | 60.203903 | ❌ |
| **14 Days** | **Bottom-Up** | **57.37** | **74.70** | **1.31%** | **0.000000** | **✅** |
| **14 Days** | Top-Down | 68.78 | 83.84 | 1.58% | 0.000000 | ✅ |
| **14 Days** | MinT-Shrink | 58.45 | 75.09 | 1.34% | 0.000000 | ✅ |
| **30 Days** | Base LightGBM | 56.63 | 68.88 | 1.28% | 60.203903 | ❌ |
| **30 Days** | **Bottom-Up** | **45.30** | **59.15** | **1.02%** | **0.000000** | **✅** |
| **30 Days** | Top-Down | 56.63 | 68.88 | 1.28% | 0.000000 | ✅ |
| **30 Days** | MinT-Shrink | 45.98 | 59.59 | 1.04% | 0.000000 | ✅ |

---

## 5. Statistical & Methodological Insights
1. **Coherence**: Both Bottom-Up and MinT-Shrink achieve exact mathematical sum consistency ($\text{Coherence Error} = 0.0000000000$).
2. **Bottom-Up vs MinT-Shrink Accuracy**: On this dataset and holdout origin (`2025-01-01`), **Bottom-Up achieved lower National MAE** than MinT-Shrink (49.09 vs 52.16 MU on 7-day horizon; 57.37 vs 58.45 MU on 14-day horizon; 45.30 vs 45.98 MU on 30-day horizon).
3. **Top-Down Equivalence**: Top-Down (forecast proportions method) takes the Base National forecast and allocates it downward before summing back up. At the National root level, Top-Down's forecast is mathematically identical to Base LightGBM, resulting in identical MAE (65.38, 68.78, 56.63 MU).

---

## 6. Reproducibility Commands
```bash
# 1. Run pipeline and generate benchmarks
python -m src.pipeline --test-start 2025-01-01
python -m src.backtest
python -m src.generate_figures

# 2. Run automated test suite (21/21 tests pass)
pytest -v

# 3. Build frontend bundle
cd frontend && npm run build
```
