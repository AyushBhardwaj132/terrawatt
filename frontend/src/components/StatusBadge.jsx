import React from "react";

export default function StatusBadge({ status, label, size = "md" }) {
  const norm = String(status || "").toUpperCase();
  
  let type = "neutral";
  let text = label || status;
  
  if (norm === "NORMAL" || norm === "COHERENT" || norm === "CONNECTED" || norm === "OK" || norm === "YES") {
    type = "success";
    if (!label) text = norm === "YES" ? "Coherent" : norm === "CONNECTED" ? "Connected" : norm;
  } else if (norm === "WARNING" || norm === "CONNECTING") {
    type = "warning";
    if (!label) text = norm;
  } else if (norm === "CRITICAL" || norm === "INCOHERENT" || norm === "DISCONNECTED" || norm === "OFFLINE" || norm === "NO") {
    type = "critical";
    if (!label) text = norm === "NO" ? "Incoherent" : norm === "DISCONNECTED" ? "Offline" : norm;
  }

  const className = `badge badge-${type} badge-${size}`;

  return (
    <span className={className}>
      <span className="badge-dot" />
      {text}
    </span>
  );
}
