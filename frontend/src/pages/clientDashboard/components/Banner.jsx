import React, { useState, useEffect } from "react";
import { useDashboard } from "../context/DashboardContext";

export default function Banner({ type, message }) {
  const { dark } = useDashboard();
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
      bg: dark ? "#0d2619" : "#f0faf5",
      borderColor: dark ? "#1e3a2a" : "#a8d5be",
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
      bg: dark ? "#1c1800" : "#fffbec",
      borderColor: dark ? "#3a2e00" : "#f5d87e",
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
      bg: dark ? "#280f0a" : "#fff0ee",
      borderColor: dark ? "#5c2020" : "#ffb5aa",
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
  config.demo = { ...config.live, icon: { ...config.live.icon, iconClass: "ti-eye" }, title: "Demo mode", sub: "Showing sample data, not a real account" };

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
              color: dark ? "#eaf5f0" : "#0c1c14",
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
