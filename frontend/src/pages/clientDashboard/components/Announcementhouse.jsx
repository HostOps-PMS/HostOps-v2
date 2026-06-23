import { useState, useEffect } from "react";

const DUMMY_ANNOUNCEMENTS = [
  {
    id: 1,
    label: "Maintenance notice",
    message: "Pool area closed June 25 for cleaning.",
    image: "https://images.unsplash.com/photo-1572331165267-854da2b021b1?w=400&h=200&fit=crop",
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

function HouseIllustration({ accent, size = 32 }) {
  const wallFill = "#2dc97f";
  const cutoutFill = "#0a1812";
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 96 86" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
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

function SmokeLabel({ labelColor, smokeColor }) {
  return (
    <div style={{ position: "absolute", left: "70%", top: "-1.4em", pointerEvents: "none" }}>
      <div className="hp-puff" style={{ left: 0, bottom: 0, width: 6, height: 6, background: smokeColor, animationDelay: "0s" }} />
      <div className="hp-puff" style={{ left: 3, bottom: -3, width: 8, height: 8, background: smokeColor, animationDelay: "0.3s" }} />
      <div className="hp-puff" style={{ left: -1, bottom: -6, width: 10, height: 10, background: smokeColor, animationDelay: "0.6s" }} />
      <span style={{
        position: "absolute",
        left: 14,
        bottom: -2,
        fontSize: 13,
        fontWeight: 800,
        color: labelColor,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}>Announcements</span>
      <style>{`
        .hp-puff {
          position: absolute;
          border-radius: 50%;
          opacity: 0;
          animation: hpPuffRise 4s ease-in-out infinite;
        }
        @keyframes hpPuffRise {
          0% { opacity: 0; transform: translateY(0) scale(0.6); }
          15% { opacity: 0.55; transform: translateY(-5px) scale(0.9); }
          45% { opacity: 0.35; transform: translateY(-18px) scale(1.3); }
          70%, 100% { opacity: 0; transform: translateY(-30px) scale(1.6); }
        }
      `}</style>
    </div>
  );
}

const STAGE_CLOSED = 0;
const STAGE_MAILBOX = 1;
const STAGE_ENVELOPE_RISE = 2;
const STAGE_ENVELOPE_OPEN = 3;
const STAGE_CONTENT = 4;

export default function AnnouncementHouse({ dark, announcements = DUMMY_ANNOUNCEMENTS }) {
  const [stage, setStage] = useState(STAGE_CLOSED);

  const accent = dark ? "#56c299" : "#1e8760";
  const labelColor = dark ? "#56c299" : "#1e8760";
  const smokeColor = dark ? "#6aab8a" : "#9fc4b0";
  const panelBg = dark ? "#0f2a1e" : "#fffdf8";
  const cardBg = dark ? "#0d1f17" : "#ffffff";
  const bodyColor = dark ? "#cfe9dd" : "#4a6b5a";
  const mutedColor = dark ? "#6aab8a" : "#8aaa98";
  const separatorColor = dark ? "#1e3a2a" : "#eae8e0";

  const envelopeBg = dark
    ? "linear-gradient(135deg, #1a4d35 0%, #174430 50%, #1a4d35 100%)"
    : "linear-gradient(135deg, #f0dbb8 0%, #e8d0a6 30%, #f5e0be 60%, #ecdaae 100%)";
  const envelopeSolid = dark ? "#1a4d35" : "#ecdaae";
  const envelopeFlap = dark ? "#143d2a" : "#e0c896";
  const envelopeLiner = dark
    ? "repeating-linear-gradient(135deg, #0d2a1c 0px, #0d2a1c 6px, #1a4d35 6px, #1a4d35 12px)"
    : "repeating-linear-gradient(135deg, #c9483e 0px, #c9483e 6px, #d45a50 6px, #d45a50 12px)";
  const sealColor = dark ? "#56c299" : "#c9483e";

  const mailboxGrad = dark
    ? "linear-gradient(180deg, #2a6b4a 0%, #1a4d35 60%, #143d2a 100%)"
    : "linear-gradient(180deg, #3a9d6a 0%, #2a7d55 40%, #1e6b45 100%)";
  const mailboxDark = dark ? "#0d2a1c" : "#1a5c3e";
  const postGrad = dark
    ? "linear-gradient(90deg, #1a3020 0%, #0d2a1c 50%, #1a3020 100%)"
    : "repeating-linear-gradient(90deg, #6a5440 0px, #5a4430 3px, #6a5440 6px)";

  useEffect(() => {
    if (stage === STAGE_MAILBOX) {
      const t = setTimeout(() => setStage(STAGE_ENVELOPE_RISE), 900);
      return () => clearTimeout(t);
    }
    if (stage === STAGE_ENVELOPE_RISE) {
      const t = setTimeout(() => setStage(STAGE_ENVELOPE_OPEN), 800);
      return () => clearTimeout(t);
    }
    if (stage === STAGE_ENVELOPE_OPEN) {
      const t = setTimeout(() => setStage(STAGE_CONTENT), 600);
      return () => clearTimeout(t);
    }
  }, [stage]);

  const showMailbox = stage === STAGE_MAILBOX || stage === STAGE_ENVELOPE_RISE;
  const showEnvelope = stage >= STAGE_ENVELOPE_RISE;
  const open = () => setStage(STAGE_MAILBOX);
  const close = () => setStage(STAGE_CLOSED);
  const isOpen = stage > STAGE_CLOSED;

  return (
    <>
      <style>{`
        @keyframes hpMbIn {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.2) rotate(-8deg); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.06) rotate(3deg); }
          70% { transform: translate(-50%, -50%) scale(0.97) rotate(-2deg); }
          85% { transform: translate(-50%, -50%) scale(1.01) rotate(0.5deg); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
        }
        @keyframes hpMbOut {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
        }
        @keyframes hpFlagUp {
          0% { transform: rotate(0deg); }
          60% { transform: rotate(-100deg); }
          100% { transform: rotate(-90deg); }
        }
        @keyframes hpEnvIn {
          0% { opacity: 0; transform: translate(-50%, -40%) scale(0.5); }
          65% { opacity: 1; transform: translate(-50%, -51%) scale(1.02); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes hpFlapOpen {
          0% { transform: rotateX(0deg); }
          100% { transform: rotateX(180deg); }
        }
        @keyframes hpLetterUp {
          0% { opacity: 0; transform: translateY(24px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Footer house button */}
      <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
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
            display: "flex",
            alignItems: "center",
          }}
        >
          <HouseIllustration accent={accent} size={72} />
          <SmokeLabel labelColor={labelColor} smokeColor={smokeColor} />
        </button>
      </div>

      {/* ── Overlay ── */}
      {isOpen && (
        <div
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(8,18,13,0.5)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 10000,
          }}
        >
          {/* ════════ STAGE 1: MAILBOX ════════ */}
          {showMailbox && (
            <div style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              zIndex: 10001,
              animation: stage === STAGE_ENVELOPE_RISE
                ? "hpMbOut 0.5s ease-in forwards"
                : "hpMbIn 0.7s ease-out forwards",
            }}>
              {/* Mailbox — US rounded style */}
              <div style={{ position: "relative" }}>
                {/* Body */}
                <div style={{
                  width: 120,
                  height: 80,
                  background: mailboxGrad,
                  borderRadius: "50% 50% 8px 8px / 30% 30% 8px 8px",
                  position: "relative",
                  boxShadow: `0 10px 40px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.12)`,
                  border: `2px solid ${mailboxDark}`,
                }}>
                  {/* Shine stripe */}
                  <div style={{
                    position: "absolute",
                    top: 8,
                    left: "15%",
                    right: "55%",
                    height: 3,
                    background: "rgba(255,255,255,0.15)",
                    borderRadius: 2,
                  }} />
                  {/* Mail slot */}
                  <div style={{
                    position: "absolute",
                    top: 24,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 54,
                    height: 6,
                    background: mailboxDark,
                    borderRadius: 3,
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4)",
                  }} />
                  {/* Front emblem */}
                  <div style={{
                    position: "absolute",
                    bottom: 12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    border: `2px solid ${dark ? "#2a6b4a" : "rgba(255,255,255,0.25)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <i className="ti ti-mail" style={{ fontSize: 14, color: dark ? "#56c299" : "rgba(255,255,255,0.6)" }} />
                  </div>
                </div>

                {/* Flag */}
                <div style={{
                  position: "absolute",
                  top: 16,
                  right: -20,
                  transformOrigin: "left center",
                  animation: stage >= STAGE_ENVELOPE_RISE ? "hpFlagUp 0.5s ease-out forwards" : "none",
                }}>
                  <div style={{
                    width: 24,
                    height: 5,
                    background: "#e74c3c",
                    borderRadius: 3,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                  <div style={{
                    position: "absolute",
                    right: -8,
                    top: -6,
                    width: 0,
                    height: 0,
                    borderLeft: "9px solid #e74c3c",
                    borderTop: "8px solid transparent",
                    borderBottom: "8px solid transparent",
                  }} />
                </div>
              </div>

              {/* Post */}
              <div style={{
                width: 16,
                height: 56,
                background: postGrad,
                borderRadius: 3,
                boxShadow: "2px 0 4px rgba(0,0,0,0.15)",
              }} />

              {/* Ground / grass patch */}
              <div style={{
                width: 80,
                height: 12,
                marginTop: -4,
                position: "relative",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
              }}>
                <div style={{
                  width: "100%",
                  height: 8,
                  background: dark ? "#1a3d2d" : "#5a8a6a",
                  borderRadius: "50%",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                }} />
              </div>
            </div>
          )}

          {/* ════════ STAGES 2-4: ENVELOPE ════════ */}
          {showEnvelope && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 10002,
                animation: stage === STAGE_ENVELOPE_RISE ? "hpEnvIn 0.8s ease-out forwards" : "none",
              }}
            >
              {/* Envelope container */}
              <div style={{
                width: "min(360px, calc(100vw - 24px))",
                background: envelopeBg,
                borderRadius: 12,
                position: "relative",
                overflow: "visible",
                boxShadow: "0 16px 56px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.1)",
                border: `1px solid ${dark ? "#2a6b4a" : "#d4c090"}`,
              }}>

                {/* Diagonal liner revealed under flap */}
                <div style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0,
                  height: 90,
                  background: envelopeLiner,
                  borderRadius: "12px 12px 0 0",
                  clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                  opacity: stage >= STAGE_ENVELOPE_OPEN ? 1 : 0,
                  transition: "opacity 0.4s ease",
                }} />

                {/* Flap */}
                <div style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0,
                  height: 90,
                  transformOrigin: "top center",
                  perspective: "800px",
                  animation: stage >= STAGE_ENVELOPE_OPEN ? "hpFlapOpen 0.6s ease-in-out forwards" : "none",
                  zIndex: 6,
                }}>
                  <svg width="100%" height="90" viewBox="0 0 360 90" preserveAspectRatio="none" style={{ display: "block", filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.1))" }}>
                    <polygon points="0,0 360,0 180,90" fill={envelopeFlap} />
                    <polygon points="2,1 358,1 180,88" fill="none" stroke={dark ? "#1e5a3e" : "#cbb888"} strokeWidth="0.5" />
                  </svg>
                  {/* Wax seal on the flap */}
                  <div style={{
                    position: "absolute",
                    bottom: 4,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: `radial-gradient(circle at 40% 35%, ${dark ? "#6dd4a8" : "#d45a50"}, ${sealColor})`,
                    boxShadow: `0 3px 10px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.15)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 7,
                  }}>
                    <i className="ti ti-home-2" style={{ fontSize: 16, color: "#fff", filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.3))" }} />
                  </div>
                </div>

                {/* V-fold lines with shadow */}
                <svg width="100%" height="100%" viewBox="0 0 360 240" preserveAspectRatio="none" style={{
                  position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 1,
                }}>
                  <line x1="0" y1="240" x2="180" y2="75" stroke={dark ? "#0d2a1c" : "#c8b488"} strokeWidth="1" opacity="0.5" />
                  <line x1="360" y1="240" x2="180" y2="75" stroke={dark ? "#0d2a1c" : "#c8b488"} strokeWidth="1" opacity="0.5" />
                  <line x1="1" y1="240" x2="181" y2="76" stroke={dark ? "#2a6b4a" : "#f0e0c0"} strokeWidth="0.5" opacity="0.4" />
                  <line x1="359" y1="240" x2="179" y2="76" stroke={dark ? "#2a6b4a" : "#f0e0c0"} strokeWidth="0.5" opacity="0.4" />
                </svg>

                {/* ── Letter content ── */}
                <div style={{
                  position: "relative",
                  zIndex: 5,
                  padding: "20px 16px 16px",
                  animation: stage >= STAGE_CONTENT ? "hpLetterUp 0.5s ease-out forwards" : "none",
                  opacity: stage >= STAGE_CONTENT ? 1 : 0,
                }}>
                  <div style={{
                    background: panelBg,
                    borderRadius: 10,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06)",
                    overflow: "hidden",
                  }}>
                    {/* Letter header */}
                    <div style={{ padding: "16px 18px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <HouseIllustration accent={accent} size={22} />
                          <div>
                            <span style={{
                              fontSize: 15,
                              fontWeight: 800,
                              color: dark ? "#eaf5f0" : "#1a3a2a",
                              letterSpacing: "-0.01em",
                              display: "block",
                            }}>
                              Announcements
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={close}
                          aria-label="Close"
                          style={{
                            background: dark ? "#1a3d2d" : "#f4f4f2",
                            border: "none",
                            borderRadius: "50%",
                            width: 30,
                            height: 30,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            color: mutedColor,
                            fontSize: 14,
                            transition: "background 0.15s",
                          }}
                        >
                          <i className="ti ti-x" />
                        </button>
                      </div>
                      {/* Decorative underline */}
                      <div style={{
                        marginTop: 10,
                        height: 2,
                        borderRadius: 1,
                        background: dark
                          ? "linear-gradient(90deg, #56c299 0%, transparent 70%)"
                          : "linear-gradient(90deg, #1e8760 0%, transparent 70%)",
                      }} />
                    </div>

                    {/* Announcement cards */}
                    <div style={{
                      padding: "4px 18px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 0,
                      maxHeight: "min(280px, 42vh)",
                      overflowY: "auto",
                    }}>
                      {announcements.length === 0 && (
                        <p style={{ fontSize: 13, color: mutedColor, margin: 0, textAlign: "center", padding: "24px 0" }}>
                          No announcements yet.
                        </p>
                      )}
                      {announcements.map((item, idx) => (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            gap: 12,
                            padding: "12px 0",
                            borderBottom: idx < announcements.length - 1 ? `1px solid ${separatorColor}` : "none",
                            opacity: stage >= STAGE_CONTENT ? 1 : 0,
                            transform: stage >= STAGE_CONTENT ? "translateY(0)" : "translateY(10px)",
                            transition: `opacity 0.35s ease ${0.1 + idx * 0.12}s, transform 0.35s ease ${0.1 + idx * 0.12}s`,
                          }}
                        >
                          {/* Accent bar */}
                          <div style={{
                            width: 4,
                            alignSelf: "stretch",
                            borderRadius: 2,
                            background: accent,
                            flexShrink: 0,
                            opacity: 0.8,
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Optional image */}
                            {item.image && (
                              <div style={{
                                width: "100%",
                                height: 120,
                                borderRadius: 6,
                                overflow: "hidden",
                                marginBottom: 8,
                                background: dark ? "#0a1812" : "#f0f0ee",
                              }}>
                                <img
                                  src={item.image}
                                  alt={item.label}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    display: "block",
                                  }}
                                />
                              </div>
                            )}
                            <p style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: dark ? "#eaf5f0" : "#1a3a2a",
                              margin: "0 0 3px",
                            }}>
                              {item.label}
                            </p>
                            <p style={{
                              fontSize: 13,
                              color: bodyColor,
                              margin: 0,
                              lineHeight: 1.5,
                            }}>
                              {item.message}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Letter footer */}
                    <div style={{
                      padding: "8px 18px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      borderTop: `1px solid ${separatorColor}`,
                    }}>
                      <span style={{ fontSize: 10, color: mutedColor, fontWeight: 500, letterSpacing: "0.05em" }}>
                        From HostOps
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
