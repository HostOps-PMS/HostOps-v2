import React, { useState, useEffect } from "react";

export default function Banner({ type, message }) {
  const [dismissed, setDismissed] = useState(false);

  const AUTO_DISMISS_MS = 4000; // 4 seconds, palitan mo kung gusto mo

  useEffect(() => {
    if (!message || dismissed) return;
    const timer = setTimeout(() => setDismissed(true), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, dismissed]);

  useEffect(() => {
    setDismissed(false);
  }, [type]);

  if (!message || dismissed) return null;

  const config = {
    live: {
      bg: "#f0faf5",
      borderColor: "#a8d5be",
      wrapper: {
        position: "fixed",
        top: "70px",
        right: "24px",
        zIndex: 9999,
      },
      icon: { background: "#d4f0e4", color: "#1e8760", iconClass: "ti-check" },
      title: "Live data connected",
      sub: "Dashboard is showing real-time data",
    },
    loading: {
      bg: "#fffbec",
      borderColor: "#f5d87e",
      wrapper: {
        position: "fixed",
        top: "70px",
        right: "24px",
        zIndex: 9999,
      },
      icon: { background: "#fef3c7", color: "#a16207", iconClass: "ti-loader" },
      title: "Loading dashboard...",
      sub: "Fetching your real-time data",
    },
    error: {
      bg: "#fff0ee",
      borderColor: "#ffb5aa",
      wrapper: {
        position: "fixed",
        top: "70px",
        right: "24px",
        zIndex: 9999,
      },
      icon: {
        background: "#fee2e2",
        color: "#c13515",
        iconClass: "ti-alert-triangle",
      },
      title: "Failed to load data",
      sub: message || "Please refresh and try again",
    },
  };

  const c = config[type] || config.live;

  return (
    <div style={c.wrapper}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 16px",
          background: c.bg,
          border: `1px solid ${c.borderColor}`,
          borderRadius: "10px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: c.icon.background,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <i
            className={`ti ${c.icon.iconClass}`}
            style={{ fontSize: "16px", color: c.icon.color }}
            aria-hidden="true"
          />
        </div>
        <div>
          <p
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#0c1c14",
              margin: 0,
            }}
          >
            {c.title}
          </p>
          <p style={{ fontSize: "11px", color: "#6a8b7c", margin: 0 }}>
            {c.sub}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#9ab8a9",
            fontSize: "14px",
            padding: "0 0 0 8px",
            lineHeight: 1,
          }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
