# TerraWatt
### Multi-Region Real-Time Energy Demand Infrastructure

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

## 📊 Empirical Evaluation Results (Origin: 2025-01-01)

| Horizon | Method | National MAE (MU) | National RMSE (MU) | WMAPE (%) | Coherence Error (MU) | Coherent? |
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

## 📄 License
MIT License.
