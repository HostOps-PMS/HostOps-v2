import { useState } from "react";

// TODO: palitan ng tawag sa backend route mo pag handa na (e.g. GET /api/announcements)
// Static/dummy data muna gaya ng request mo
const DUMMY_ANNOUNCEMENTS = [
  {
    id: 1,
    label: "Maintenance notice",
    message: "Pool area closed June 25 for cleaning.",
  },
  {
    id: 2,
    label: "New policy",
    message: "Check-in time updated to 2:00 PM starting July.",
  },
  {
    id: 3,
    label: "Reminder",
    message: "Please review house rules before your stay.",
  },
];

// Illustrated na bahay: bubong, chimney, dalawang bintana (may cross-pane), pinto,
// doorknob. Walls/windows/door ay hardcoded na kulay (hindi `accentDark`) para
// laging may contrast kahit kalapit ang theme background sa accent color.
// `width`/`height` ay naka-clamp() para sumukat depende sa screen — laki sa
// desktop, konting paliit sa mobile, hindi pixel-fixed.
function HouseIllustration({ accent }) {
  const wallFill = "#2dc97f";
  const cutoutFill = "#0a1812";
  return (
    <svg
      className="hp-house-svg"
      viewBox="0 0 96 86"
      aria-hidden="true"
      style={{ display: "block", width: "clamp(56px, 9vw, 128px)", height: "clamp(50px, 8vw, 115px)" }}
    >
      <polygon points="48,2 91,38 5,38" fill={accent} />
      <rect x="66" y="8" width="12" height="22" fill={accent} />
      <rect x="16" y="35" width="64" height="46" rx="2" fill={wallFill} />
      <rect x="37" y="54" width="22" height="27" rx="1" fill={cutoutFill} />
      <rect x="21" y="46" width="15" height="15" rx="1" fill={cutoutFill} />
      <rect x="60" y="46" width="15" height="15" rx="1" fill={cutoutFill} />
      <line x1="28.5" y1="46" x2="28.5" y2="61" stroke={wallFill} strokeWidth="2" />
      <line x1="21" y1="53.5" x2="36" y2="53.5" stroke={wallFill} strokeWidth="2" />
      <line x1="67.5" y1="46" x2="67.5" y2="61" stroke={wallFill} strokeWidth="2" />
      <line x1="60" y1="53.5" x2="75" y2="53.5" stroke={wallFill} strokeWidth="2" />
      <circle cx="51" cy="66" r="2" fill={wallFill} />
    </svg>
  );
}

// Looping smoke puffs mula sa chimney (kanang-itaas ng bahay, kung saan
// nakaposisyon ang chimney sa SVG sa itaas) + "Announcements" text na
// nagdi-dissolve papasok at palabas (blur + letter-spacing). Umuulit every
// 4 seconds. Naka-absolute relative sa parent button (kailangan `position:
// relative` ang parent) para tama ang placement malapit sa chimney sa lahat
// ng screen size.
function SmokeLabel({ labelColor, smokeColor }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "62%",
        top: "-1.6em",
        pointerEvents: "none",
      }}
    >
      <div className="hp-puff" style={{ left: 0, bottom: 0, width: 9, height: 9, background: smokeColor, animationDelay: "0s" }} />
      <div className="hp-puff" style={{ left: 5, bottom: -4, width: 12, height: 12, background: smokeColor, animationDelay: "0.3s" }} />
      <div className="hp-puff" style={{ left: -2, bottom: -9, width: 15, height: 15, background: smokeColor, animationDelay: "0.6s" }} />
      <span className="hp-text" style={{ color: labelColor }}>Announcements</span>
      <style>{`
        .hp-puff {
          position: absolute;
          border-radius: 50%;
          opacity: 0;
          animation: hpPuffRise 4s ease-in-out infinite;
        }
        .hp-text {
          position: absolute;
          left: 16px;
          bottom: 0;
          font-size: clamp(9px, 1.4vw, 12px);
          font-weight: 700;
          letter-spacing: 0.04em;
          white-space: nowrap;
          opacity: 0;
          filter: blur(4px);
          animation: hpTextForm 4s ease-in-out infinite;
        }
        @media (max-width: 768px) {
          .hp-text {
            left: 12px;
            font-size: 9px;
          }
        }
        @keyframes hpPuffRise {
          0% { opacity: 0; transform: translateY(0) scale(0.6); }
          15% { opacity: 0.55; transform: translateY(-6px) scale(0.9); }
          45% { opacity: 0.35; transform: translateY(-22px) scale(1.3); }
          70%, 100% { opacity: 0; transform: translateY(-38px) scale(1.6); }
        }
        @keyframes hpTextForm {
          0%, 10% { opacity: 0; filter: blur(6px); letter-spacing: 0.3em; }
          45% { opacity: 1; filter: blur(0px); letter-spacing: 0.04em; }
          75% { opacity: 1; filter: blur(0px); letter-spacing: 0.04em; }
          95%, 100% { opacity: 0; filter: blur(4px); letter-spacing: 0.1em; }
        }
      `}</style>
    </div>
  );
}

export default function AnnouncementHouse({ dark, announcements = DUMMY_ANNOUNCEMENTS }) {
  const [isOpen, setIsOpen] = useState(false);

  const accent = dark ? "#56c299" : "#1e8760";
  const panelBg = dark ? "#102b20" : "#ffffff";
  const cardBg = dark ? "#0d1f17" : "#f0faf6";
  const cardBorder = dark ? "#1e3a2a" : "#c8e6d8";
  const labelColor = dark ? "#56c299" : "#1e8760";
  const bodyColor = dark ? "#cfe9dd" : "#3a5f4d";
  const mutedColor = dark ? "#6aab8a" : "#7aaa90";
  const smokeColor = dark ? "#6aab8a" : "#9fc4b0";

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return (
    <>
      <style>{`
        @media (max-width: 1024px) {
          .hp-panel {
            left: 50% !important;
            transform: translateX(-50%);
            border-radius: 12px !important;
          }
          .hp-panel-inner {
            width: min(320px, calc(100vw - 24px)) !important;
          }
        }
        @media (max-width: 480px) {
          .hp-house-svg {
            width: 48px !important;
            height: 44px !important;
          }
          .hp-panel,
          .hp-panel-inner {
            width: calc(100vw - 16px) !important;
          }
        }
      `}</style>

      {/* Scrim - lalabas lang habang bukas yung panel */}
      <div
        onClick={close}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(8,18,13,0.5)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.3s ease",
          zIndex: 998,
        }}
      />

      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-start", maxWidth: "100%" }}>
        {/* House icon + animated smoke-to-text label — ito ang "tab" na laging visible sa footer */}
        <button
          type="button"
          onClick={open}
          aria-label="Open announcements"
          style={{
            position: "relative",
            background: "none",
            border: "none",
            padding: 0,
            margin: 0,
            cursor: "pointer",
            display: "block",
            transform: isOpen ? "scale(0)" : "scale(1)",
            transformOrigin: "bottom left",
            transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <HouseIllustration accent={accent} />
          <SmokeLabel labelColor={labelColor} smokeColor={smokeColor} />
        </button>

        {/* Pop-out panel */}
        <div
          role="dialog"
          aria-label="Announcements"
          className="hp-panel"
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: isOpen ? "min(320px, calc(100vw - 32px))" : 0,
            maxHeight: isOpen ? "min(420px, 70vh)" : 0,
            opacity: isOpen ? 1 : 0,
            overflow: "hidden",
            transformOrigin: "bottom left",
            transition: "width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), max-height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease",
            zIndex: 999,
            boxShadow: isOpen ? "0 12px 32px rgba(0,0,0,0.25)" : "none",
            borderRadius: "0 12px 12px 12px",
          }}
        >
          <div className="hp-panel-inner" style={{ width: "min(320px, calc(100vw - 32px))", background: panelBg }}>
            {/* Roof accent sa itaas ng panel, kasing-tema ng bahay */}
            <svg width="100%" height="56" viewBox="0 0 320 56" preserveAspectRatio="none" style={{ display: "block" }}>
              <polygon points="160,2 312,52 8,52" fill={panelBg} />
              <polygon points="160,12 280,48 40,48" fill={accent} opacity="0.12" />
              <rect x="220" y="14" width="16" height="28" fill={panelBg} />
            </svg>

            <div style={{ padding: "0 18px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: labelColor, letterSpacing: "0.04em" }}>
                  Announcements
                </span>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close announcements"
                  style={{ background: "none", border: "none", cursor: "pointer", color: mutedColor, fontSize: 16, lineHeight: 1, padding: 4 }}
                >
                  <i className="ti ti-x" />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "min(300px, 50vh)", overflowY: "auto" }}>
                {announcements.length === 0 && (
                  <p style={{ fontSize: 13, color: mutedColor, margin: 0 }}>No announcements yet.</p>
                )}
                {announcements.map((item) => (
                  <div
                    key={item.id}
                    style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 10, padding: 10 }}
                  >
                    <p style={{ fontSize: 12, fontWeight: 700, color: accent, margin: "0 0 3px" }}>
                      {item.label}
                    </p>
                    <p style={{ fontSize: 12, color: bodyColor, margin: 0, lineHeight: 1.5 }}>
                      {item.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}