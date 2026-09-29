# TerraWatt Methodological Evaluation Report

## 1. Executive Summary
This report presents the verified empirical backtesting results for **TerraWatt**, a production-grade hierarchical electricity demand forecasting platform evaluated on the Indian power grid dataset (POSOCO / GRID-INDIA).

---

## 2. Methodology & Backtest Classification
- **Evaluation Methodology**: **Expanding-Window Rolling-Origin Evaluation** across 6 historical forecast origins:
  - `2025-01-01`
  - `2025-02-01`
  - `2025-03-01`
  - `2025-04-01`
  - `2025-05-01`
  - `2025-06-01`
- **Dataset**: POSOCO / GRID-INDIA Daily Electricity Consumption Data (`2013-01-02` to Present).
- **Training Period**: Expanding window strictly prior to each origin $T$ (data $< T$).
- **Forecast Horizons**: 7-day, 14-day, and 30-day ahead out-of-sample predictions from each origin.
- **Hierarchy Nodes**: 51 total nodes across 3 geographic levels:
  - Level 0: `India` (National Aggregate)
  - Level 1: `India/NR`, `India/WR`, `India/SR`, `India/ER`, `India/NER` (5 Regions)
  - Level 2: 45 State/Bulk Consumer & Synthetic Residual (`Other_<Region>`) Nodes

---

## 3. Data Leakage & Test Isolation Audit
- **Calendar & Holiday Features**: Day of week, month, quarter, day of year, year, weekend, and India national holidays (`holidays`).
- **Lag & Rolling Features**: Lags ($t-1, t-7, t-30, t-365$) and rolling stats ($7d, 30d$).
- **Leakage Audit**: Verified that all lag and rolling features apply `.shift(1)` prior to window calculations. Observation $T$ is **never** present in feature vectors for day $T$. Verified via `tests/test_features.py`.
- **Test Isolation**: Residual covariance matrix $W$ estimation and model fitting strictly use in-sample data prior to each origin $T$.

---

## 4. Empirical Benchmark Results (National Level: `India`)

Pooled metrics across 6 rolling forecast origins (`2025-01-01` to `2025-06-01`):

| Forecast Horizon | Method | National MAE (MU) | National RMSE (MU) | WMAPE (%) | Coherence Error (MU) | Coherent? |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **7 Days** | Base LightGBM | 77.86 | 90.91 | 1.66% | 104.22 | ❌ |
| **7 Days** | Bottom-Up | 77.82 | 87.98 | 1.66% | 0.00 | ✅ |
| **7 Days** | Top-Down | 77.86 | 90.91 | 1.66% | 0.00 | ✅ |
| **7 Days** | **MinT-Shrink** | **76.72** | **86.12** | **1.63%** | **0.00** | **✅ (Best)** |
| **14 Days** | Base LightGBM | 91.78 | 113.31 | 1.90% | 173.61 | ❌ |
| **14 Days** | Bottom-Up | 80.67 | 100.63 | 1.68% | 0.00 | ✅ |
| **14 Days** | Top-Down | 91.78 | 113.31 | 1.90% | 0.00 | ✅ |
| **14 Days** | **MinT-Shrink** | **80.36** | **100.29** | **1.67%** | **0.00** | **✅ (Best)** |
| **30 Days** | Base LightGBM | 79.46 | 102.74 | 1.65% | 173.61 | ❌ |
| **30 Days** | Bottom-Up | 76.60 | 96.81 | 1.59% | 0.00 | ✅ |
| **30 Days** | Top-Down | 79.46 | 102.74 | 1.65% | 0.00 | ✅ |
| **30 Days** | **MinT-Shrink** | **74.53** | **94.97** | **1.55%** | **0.00** | **✅ (Best)** |

---

## 5. Statistical & Methodological Insights
1. **Hierarchy Coherence**: Both Bottom-Up and MinT-Shrink achieve exact mathematical sum consistency ($\text{Coherence Error} < 10^{-11} \approx 0.0000000000$), while Base LightGBM suffers large aggregation discrepancies ($104.22$ to $173.61$ MU).
2. **MinT-Shrink Dominance Across Horizons**: Across the 6-origin expanding backtest, **MinT-Shrink consistently achieves the lowest National MAE and RMSE** across all evaluation horizons (7-day MAE: 76.72 MU; 14-day MAE: 80.36 MU; 30-day MAE: 74.53 MU), outperforming both unreconciled Base LightGBM and Bottom-Up aggregation.
3. **Top-Down Equivalence**: Top-Down (forecast proportions) scales the Base National forecast downward across the hierarchy. Summing these proportions back to the National root produces a total mathematically identical to Base LightGBM, explaining identical National MAE (77.86, 91.78, 79.46 MU).

---

## 6. Reproducibility Commands
```bash
# 1. Run rolling-origin backtest (6 origins x 3 horizons x 4 methods)
python -m src.backtest

# 2. Run automated test suite
pytest -v

# 3. Build frontend bundle
cd frontend && npm run build
```
