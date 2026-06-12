import React from "react";

/**
 * Full-screen loading overlay — same visual language as the property-switching
 * overlay. Render it wherever you need to block the UI during a fetch.
 *
 * Props:
 *   isVisible  {boolean}         — controls visibility (returns null when false)
 *   message    {string}          — primary bold text   (default: "Loading…")
 *   subMessage {string|null}     — smaller line below  (optional)
 */
export default function FetchingOverlay({
  isVisible,
  message    = "Loading…",
  subMessage = null,
}) {
  if (!isVisible) return null;

  return (
    <>
      <style>{`
        @keyframes _fo_spin { to { transform: rotate(360deg); } }
        @keyframes _fo_fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes _fo_up   {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          background: "rgba(12, 28, 20, 0.82)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          animation: "_fo_fade 0.2s ease forwards",
        }}
      >
        {/* Spinner */}
        <svg
          width="44"
          height="44"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#56c299"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ animation: "_fo_spin 0.8s linear infinite" }}
        >
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>

        {/* Text */}
        <div
          style={{
            textAlign: "center",
            animation: "_fo_up 0.25s ease forwards",
          }}
        >
          <p
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 800,
              fontSize: 17,
              color: "#eaf5f0",
              margin: subMessage ? "0 0 6px" : 0,
              letterSpacing: "-0.3px",
            }}
          >
            {message}
          </p>

          {subMessage && (
            <p style={{ fontSize: 13, color: "#56c299", margin: 0 }}>
              {subMessage}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
