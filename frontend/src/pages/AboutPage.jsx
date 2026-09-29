import React, { useState } from "react";

export default function AboutPage() {
  const [showMathDetails, setShowMathDetails] = useState(false);

  return (
    <div className="page-content about-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">About TerraWatt</h1>
          <p className="page-subtitle">
            System architecture, hierarchical reconciliation mathematics, and verified engineering implementation.
          </p>
        </div>
      </div>

      {/* 1. What is TerraWatt? */}
      <div className="content-card article-card">
        <h2 className="article-heading">What is TerraWatt?</h2>
        <p className="article-paragraph">
          <strong>TerraWatt</strong> is an end-to-end power grid forecasting and reconciliation platform evaluated on India’s national transmission grid dataset (POSOCO / GRID-INDIA, covering 2013 to the present).
        </p>
        <p className="article-paragraph">
          In large interconnected power systems, electricity demand must be forecast accurately at multiple geographical resolutions simultaneously—from individual state load dispatch centers (SLDCs) to regional transmission corridors (NR, WR, SR, ER, NER) up to the National Load Despatch Centre (NLDC).
        </p>
        <p className="article-paragraph">
          When independent machine learning models forecast each node separately, the sum of lower-level state forecasts almost never equals the regional or national total due to variance, non-linearities, and differing local signal-to-noise ratios. This discrepancy is known as <em>hierarchical incoherence</em>. TerraWatt solves this challenge by reconciling independent LightGBM base predictions using optimal linear projection matrices.
        </p>
      </div>

      {/* 2. End-to-End System Architecture */}
      <div className="content-card article-card">
        <h2 className="article-heading">System Architecture</h2>
        <p className="article-paragraph">
          The platform follows a modular, feed-forward architecture from raw grid telemetry to browser-based interactive exploration:
        </p>

        <div className="architecture-flow-wrapper">
          <div className="arch-step">
            <div className="step-num">1</div>
            <div className="step-content">
              <strong>Data Ingestion & Cleaning</strong>
              <span>Cleans POSOCO daily energy metrics, fills isolated gaps (&le;3 days), and verifies timestamp integrity.</span>
            </div>
          </div>
          <div className="arch-arrow">&darr;</div>

          <div className="arch-step">
            <div className="step-num">2</div>
            <div className="step-content">
              <strong>Hierarchy Construction</strong>
              <span>Generates the 51-node 3-level tree and compiles the linear summing matrix S (51 rows &times; 45 bottom series).</span>
            </div>
          </div>
          <div className="arch-arrow">&darr;</div>

          <div className="arch-step">
            <div className="step-num">3</div>
            <div className="step-content">
              <strong>Feature Engineering</strong>
              <span>Extracts calendar signals, Indian holidays, and multi-period lags (t-1, t-7, t-30, t-365) with strict leakage protection.</span>
            </div>
          </div>
          <div className="arch-arrow">&darr;</div>

          <div className="arch-step">
            <div className="step-num">4</div>
            <div className="step-content">
              <strong>LightGBM Base Forecasting</strong>
              <span>Trains walk-forward gradient boosted regressors per node with time-split walk-forward validation.</span>
            </div>
          </div>
          <div className="arch-arrow">&darr;</div>

          <div className="arch-step">
            <div className="step-num">5</div>
            <div className="step-content">
              <strong>Hierarchical Reconciliation</strong>
              <span>Applies MinT-Shrink, Bottom-Up, and Top-Down algorithms to restore exact mathematical sum consistency.</span>
            </div>
          </div>
          <div className="arch-arrow">&darr;</div>

          <div className="arch-step">
            <div className="step-num">6</div>
            <div className="step-content">
              <strong>Evaluation & Serving Layer</strong>
              <span>Runs 6-origin expanding backtest, exposes FastAPI REST endpoints, and pushes telemetry over WebSockets to React.</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Hierarchical Structure & Reconciliation */}
      <div className="content-card article-card">
        <h2 className="article-heading">Hierarchical Reconciliation</h2>
        <p className="article-paragraph">
          The TerraWatt hierarchy partitions the Indian power grid into three strictly nested geographic tiers totaling <strong>51 distinct series</strong>:
        </p>

        <div className="hierarchy-breakdown-grid">
          <div className="tier-card">
            <div className="tier-tag">Level 0 &bull; 1 Node</div>
            <h3 className="tier-title">National Aggregate</h3>
            <p className="tier-desc">Root series: <code>India</code> representing total synchronous national demand.</p>
          </div>

          <div className="tier-card">
            <div className="tier-tag">Level 1 &bull; 5 Nodes</div>
            <h3 className="tier-title">Regional Grids</h3>
            <p className="tier-desc">Five regional dispatch corridors: <code>NR</code> (North), <code>WR</code> (West), <code>SR</code> (South), <code>ER</code> (East), and <code>NER</code> (North East).</p>
          </div>

          <div className="tier-card">
            <div className="tier-tag">Level 2 &bull; 45 Nodes</div>
            <h3 className="tier-title">States & Bulk Consumers</h3>
            <p className="tier-desc">Individual states, Union Territories, industrial direct consumers (e.g. Railways, AMNSIL), and synthetic residual nodes.</p>
          </div>
        </div>

        {/* Collapsible Technical & Mathematical Details */}
        <div className="math-accordion">
          <button
            className="math-toggle-btn"
            onClick={() => setShowMathDetails(!showMathDetails)}
          >
            <span>{showMathDetails ? "▲ Hide Technical Details & Mathematics" : "▼ Show Technical Details & Mathematics"}</span>
          </button>

          {showMathDetails && (
            <div className="math-body">
              <h4 className="math-subheading">Linear Summing Matrix (S)</h4>
              <p className="math-text">
                Let y_t be the vector of all 51 time series at day t, and b_t be the 45 bottom-level state series. The structural aggregation is expressed as:
              </p>
              <pre className="code-formula">{"y_t = S · b_t"}</pre>
              <p className="math-text">
                {"where S is the 51 × 45 binary summing matrix mapping state series to regional and national totals."}
              </p>

              <h4 className="math-subheading">Minimum Trace (MinT) Reconciliation</h4>
              <p className="math-text">
                Given unreconciled base forecasts ŷ_t from LightGBM, MinT computes the optimal linear unbiased revised forecasts ỹ_t that minimize total forecast variance:
              </p>
              <pre className="code-formula">{"ỹ_t = S · (Sᵀ · W⁻¹ · S)⁻¹ · Sᵀ · W⁻¹ · ŷ_t"}</pre>
              <p className="math-text">
                where $W$ is the in-sample forecast error covariance matrix. In <strong>MinT-Shrink</strong>, $W$ is regularized via Ledoit-Wolf shrinkage toward a diagonal target to ensure positive-definiteness and invertibility.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 4. Verified Technology Stack */}
      <div className="content-card article-card">
        <h2 className="article-heading">Technology Stack</h2>
        <p className="article-paragraph">
          TerraWatt uses a lightweight, modern technology stack strictly verified in the repository:
        </p>

        <div className="tech-stack-grid">
          <div className="tech-item">
            <span className="tech-category">Machine Learning</span>
            <span className="tech-name">LightGBM &bull; HierarchicalForecast &bull; Scikit-learn</span>
          </div>
          <div className="tech-item">
            <span className="tech-category">Data Processing</span>
            <span className="tech-name">Pandas &bull; NumPy &bull; Holidays</span>
          </div>
          <div className="tech-item">
            <span className="tech-category">Backend Service</span>
            <span className="tech-name">FastAPI &bull; Uvicorn &bull; WebSockets</span>
          </div>
          <div className="tech-item">
            <span className="tech-category">Frontend & Visualization</span>
            <span className="tech-name">React 19 &bull; Vite &bull; Chart.js</span>
          </div>
          <div className="tech-item">
            <span className="tech-category">Testing & Verification</span>
            <span className="tech-name">Pytest (25 Tests) &bull; Oxlint</span>
          </div>
          <div className="tech-item">
            <span className="tech-category">Containerization</span>
            <span className="tech-name">Docker &bull; Docker Compose</span>
          </div>
        </div>
      </div>
    </div>
  );
}
