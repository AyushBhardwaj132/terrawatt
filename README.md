# TerraWatt
### Multi-Region Energy Demand Forecasting & Reconciliation Platform

TerraWatt is a production-style, mathematically coherent hierarchical electricity demand forecasting platform built for the Indian power grid (POSOCO / GRID-INDIA dataset).

It enforces strict aggregate mathematical sum consistency across a 3-level geographical hierarchy:

$$\text{National Total (India)} = \sum \text{Regions (NR, WR, SR, ER, NER)} = \sum \text{State / Bulk Consumers}$$

using **Minimum Trace (MinT-Shrink)** and **Bottom-Up** variance reconciliation.

---

## 🏗️ System Architecture Flow

```
POSOCO Raw Data -> Data Loader & Cleaning -> 3-Level Hierarchy & Summing Matrix S
                         |
           Feature Engineering (No Data Leakage)
                         |
           Base Forecast Engine (LightGBM Single-Origin Holdout)
                         |
           Hierarchical Reconciliation (MinT-Shrink & Bottom-Up)
                         |
           Objective Metrics & Coherence Verification
                         |
           FastAPI Backend Services + WebSockets
                         |
           Simulated Telemetry & Real-Time Anomaly Engine
                         |
           React + Vite Glassmorphism Dashboard
```

---

## ⚡ Key Features

1. **Deterministic Data Cleaning (`src/data_loader.py`)**:
   - Downloads & caches POSOCO daily energy dataset.
   - Cleans verified reporting anomalies (e.g. Assam on 2014-11-25 and WR scaling on 2015-01-19).
   - Interpolates isolated gaps ($\le 3$ days) while preserving long blackout periods as explicit unreliable flags.

2. **Hierarchical Summing Matrix (`src/hierarchy.py`)**:
   - Single source of truth for all 51 nodes across National, 5 Regional, and State/Bulk Consumer levels.
   - Constructs synthetic `Other_<Region>` residual nodes to guarantee zero coherence error.

3. **Data Leakage Safeguards (`src/feature_engineering.py`)**:
   - Implements calendar, India national holidays, lags ($t-1, t-7, t-30, t-365$), and rolling stats ($7d, 30d$).
   - Uses `.shift(1)` before windowing to guarantee $T$ observation never enters training features for day $T$.

4. **Base Forecasting Model (`src/train_base_models.py`)**:
   - Trains LightGBM time-series regressors per node using chronological single-origin split (`2025-01-01`).

5. **MinT Reconciliation Layer (`src/reconcile.py`)**:
   - Implements MinT-Shrink and Bottom-Up reconciliation to guarantee $\max \| y_{\text{parent}} - \sum y_{\text{children}} \| = 0.000000$.

6. **Real-Time Telemetry & Anomaly Engine (`src/anomaly_detection.py`)**:
   - Evaluates incoming telemetry observations against model forecasts using rolling error z-scores.
   - Flags statuses: `NORMAL`, `WARNING`, and `CRITICAL`.

7. **FastAPI & WebSockets (`api/main.py`)**:
   - REST endpoints for `/health`, `/forecast/hierarchy`, `/forecast/{node_id}`, `/ingest`, `/ingest/history`.
   - Real-time `/ws/telemetry` WebSocket broadcast channel.

8. **Modern React Dashboard (`frontend/`)**:
   - Glassmorphism dark mode UI built with React, Vite, and Chart.js.
   - Interactive hierarchy node selector, horizon selector (7d, 14d, 30d), reconciliation debugger table, and live stream log.

---

## 🚀 Quick Start Guide

### 1. Installation & Environment Setup
```bash
# Clone the repository
git clone https://github.com/Chetan2007max/terrawatt.git
cd terrawatt

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Run the Unified End-to-End Pipeline & Backtest
```bash
# Runs pipeline and 7d, 14d, 30d backtesting
python -m src.pipeline --test-start 2025-01-01
python -m src.backtest
python -m src.generate_figures
```

### 3. Run Automated Unit Tests
```bash
pytest -v
```

### 4. Start the FastAPI Backend Server
```bash
uvicorn api.main:app --reload --port 8000
```
API Documentation will be accessible at: `http://127.0.0.1:8000/docs`.

### 5. Start the Frontend Dashboard
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### 6. Run the Telemetry Streaming Simulator
```bash
# Replays historical daily data into /ingest endpoint at 1 simulated day / second
python src/streaming_simulator.py --speed 1.0 --start 2025-01-01
```

---

## 🐳 Docker Containerization

Run the entire platform via Docker Compose:
```bash
docker-compose up --build
```

---

## 📊 Empirical Evaluation Results (6-Origin Expanding Backtest)

Pooled metrics across **6 historical forecast origins** (`2025-01-01` to `2025-06-01`):

| Horizon | Method | National MAE (MU) | National RMSE (MU) | WMAPE (%) | Coherence Error (MU) | Coherent? |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **7 Days** | Base LightGBM | 77.86 | 90.91 | 1.66% | 104.22 | ❌ |
| **7 Days** | Bottom-Up | 77.82 | 87.98 | 1.66% | 0.00 | ✅ |
| **7 Days** | Top-Down | 77.86 | 90.91 | 1.66% | 0.00 | ✅ |
| **7 Days** | **MinT-Shrink** | **76.72** | **86.12** | **1.63%** | **0.00** | **✅** |
| **14 Days** | Base LightGBM | 91.78 | 113.31 | 1.90% | 173.61 | ❌ |
| **14 Days** | Bottom-Up | 80.67 | 100.63 | 1.68% | 0.00 | ✅ |
| **14 Days** | Top-Down | 91.78 | 113.31 | 1.90% | 0.00 | ✅ |
| **14 Days** | **MinT-Shrink** | **80.36** | **100.29** | **1.67%** | **0.00** | **✅** |
| **30 Days** | Base LightGBM | 79.46 | 102.74 | 1.65% | 173.61 | ❌ |
| **30 Days** | Bottom-Up | 76.60 | 96.81 | 1.59% | 0.00 | ✅ |
| **30 Days** | Top-Down | 79.46 | 102.74 | 1.65% | 0.00 | ✅ |
| **30 Days** | **MinT-Shrink** | **74.53** | **94.97** | **1.55%** | **0.00** | **✅** |

---

## 📄 License
MIT License.
