import React from "react";

export default function ErrorState({
  title = "Unable to load data",
  message = "An error occurred while connecting to the TerraWatt service.",
  onRetry,
}) {
  return (
    <div className="state-container error-state">
      <div className="error-icon">!</div>
      <div className="error-content">
        <h4 className="error-title">{title}</h4>
        <p className="error-message">{message}</p>
        {onRetry && (
          <button className="btn btn-secondary btn-sm" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
