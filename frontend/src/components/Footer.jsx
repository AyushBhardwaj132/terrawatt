import React from "react";

export default function Footer({ onSelectTab }) {
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-brand-column">
          <div className="footer-logo">TerraWatt</div>
          <p className="footer-tagline">
            Multi-Region Energy Demand Forecasting & Reconciliation
          </p>
          <p className="footer-description">
            Hierarchical electricity demand forecasting platform evaluated on India's power grid dataset (POSOCO / GRID-INDIA) using walk-forward LightGBM models and mathematical reconciliation (MinT-Shrink, Bottom-Up, Top-Down).
          </p>
        </div>

        <div className="footer-links-column">
          <h4 className="footer-heading">Navigation</h4>
          <ul className="footer-links-list">
            <li>
              <button onClick={() => onSelectTab("home")}>Home</button>
            </li>
            <li>
              <button onClick={() => onSelectTab("forecast")}>Forecast Explorer</button>
            </li>
            <li>
              <button onClick={() => onSelectTab("evaluation")}>Model Evaluation</button>
            </li>
            <li>
              <button onClick={() => onSelectTab("telemetry")}>Telemetry & Simulator</button>
            </li>
            <li>
              <button onClick={() => onSelectTab("about")}>About Architecture</button>
            </li>
          </ul>
        </div>

        <div className="footer-meta-column">
          <h4 className="footer-heading">Methodology & Dataset</h4>
          <ul className="footer-meta-list">
            <li>
              <span className="meta-label">Dataset:</span>
              <span className="meta-value">POSOCO / GRID-INDIA (2013–Present)</span>
            </li>
            <li>
              <span className="meta-label">Evaluation:</span>
              <span className="meta-value">6-Origin Expanding Backtest</span>
            </li>
            <li>
              <span className="meta-label">Hierarchy:</span>
              <span className="meta-value">51 Nodes (National, 5 Regions, 45 States)</span>
            </li>
            <li>
              <span className="meta-label">Primary Method:</span>
              <span className="meta-value">MinT-Shrink (Minimum Trace)</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-container">
          <span>&copy; {new Date().getFullYear()} TerraWatt Research & Engineering Platform. Open academic & portfolio demonstration.</span>
          <span>LightGBM &bull; HierarchicalForecast &bull; FastAPI &bull; React</span>
        </div>
      </div>
    </footer>
  );
}
