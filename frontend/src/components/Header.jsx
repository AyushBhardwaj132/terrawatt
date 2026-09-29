import React, { useState } from "react";
import StatusBadge from "./StatusBadge";

export default function Header({ activeTab, onSelectTab, apiConnected }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: "home", label: "Home" },
    { id: "forecast", label: "Forecast" },
    { id: "evaluation", label: "Evaluation" },
    { id: "telemetry", label: "Telemetry" },
    { id: "about", label: "About" },
  ];

  const handleTabClick = (tabId) => {
    onSelectTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="site-header">
      <div className="header-container">
        <div className="header-left">
          <button
            className="brand-button"
            onClick={() => handleTabClick("home")}
          >
            <span className="brand-title">TerraWatt</span>
            <span className="brand-subtitle">Energy Demand Forecasting & Reconciliation</span>
          </button>
        </div>

        <nav className={`header-nav ${mobileMenuOpen ? "open" : ""}`}>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-link ${activeTab === item.id ? "active" : ""}`}
              onClick={() => handleTabClick(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="header-right">
          <div className="api-status-wrapper" title={apiConnected ? "FastAPI backend is responsive" : "FastAPI backend is unreachable"}>
            <span className="status-label">API:</span>
            <StatusBadge
              status={apiConnected ? "CONNECTED" : "OFFLINE"}
              size="sm"
            />
          </div>

          <button
            className="mobile-menu-toggle"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="menu-icon-bar" />
            <span className="menu-icon-bar" />
            <span className="menu-icon-bar" />
          </button>
        </div>
      </div>
    </header>
  );
}
