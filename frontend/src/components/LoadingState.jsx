import React from "react";

export default function LoadingState({ message = "Loading data..." }) {
  return (
    <div className="state-container loading-state">
      <div className="spinner" />
      <span className="state-message">{message}</span>
    </div>
  );
}
