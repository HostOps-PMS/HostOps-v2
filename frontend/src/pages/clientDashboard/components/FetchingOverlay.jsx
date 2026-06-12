import React from "react";

/*
 * Newton's cradle geometry (all in SVG user units, 1:1 with CSS px).
 *
 * Rotation physics note:
 *   CSS rotate(+θ) on a pendulum hanging below its pivot → ball swings LEFT.
 *   CSS rotate(-θ) → ball swings RIGHT.
 *   (Positive CSS rotation is clockwise; a ball below the pivot moves left.)
 *
 * So:
 *   Left  ball pulled back = rotate(+40deg)  →  ball is to the LEFT  (outward)
 *   Right ball swings out  = rotate(-40deg)  →  ball is to the RIGHT (outward)
 */
const PIVOT_Y  = 10;
const STRING_L = 65;
const BALL_R   = 10;
const BALL_CY  = PIVOT_Y + STRING_L;              // 75  (ball center at rest)
const CX       = [65, 85, 105, 125, 145];         // 5 touching balls, Ø 20
const COLORS   = ["#1a6b44","#1e8760","#26a676","#3cb882","#7dddb5"];
const STR_CLR  = "rgba(86,194,153,0.28)";

export default function FetchingOverlay({
  isVisible,
  message    = "Loading…",
  subMessage = null,
  success    = false,
}) {
  if (!isVisible) return null;

  return (
    <>
      <style>{`
        @keyframes _fo_fade {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes _fo_up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes _fo_pop {
          0%   { opacity: 0; transform: scale(0.5); }
          65%  { transform: scale(1.18); }
          100% { opacity: 1; transform: scale(1); }
        }

        /*
         * Period 2.8 s  ·  half-swing 0.7 s
         *
         * LEFT ball:
         *   0 %–25 %   rotate(+40°)→rotate(0°)   swings IN from left   (ease-in: slow→fast)
         *  25 %–75 %   stays at 0°               right ball is swinging
         *  75 %–100%   rotate(0°)→rotate(+40°)   swings OUT to left    (ease-out: fast→slow)
         *
         * RIGHT ball (first-iteration delay = 0.7 s = T/4):
         *   0 %–25 %   rotate(0°)→rotate(-40°)   swings OUT to right   (ease-out: fast→slow)
         *  25 %–50 %   rotate(-40°)→rotate(0°)   swings IN from right  (ease-in: slow→fast)
         *  50 %–100%   stays at 0°               left ball is swinging
         *
         * The delay is T/4 so every subsequent cycle stays phase-locked
         * (no animation-delay on repeat iterations; period math keeps sync).
         */
        @keyframes _nc_left {
          0%   { transform: rotate(40deg);  animation-timing-function: ease-in;  }
          25%  { transform: rotate(0deg);   animation-timing-function: linear;   }
          75%  { transform: rotate(0deg);   animation-timing-function: ease-out; }
          100% { transform: rotate(40deg);  }
        }
        @keyframes _nc_right {
          0%   { transform: rotate(0deg);   animation-timing-function: ease-out; }
          25%  { transform: rotate(-40deg); animation-timing-function: ease-in;  }
          50%  { transform: rotate(0deg);   animation-timing-function: linear;   }
          100% { transform: rotate(0deg);   }
        }
      `}</style>

      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(6, 18, 12, 0.88)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        animation: "_fo_fade 0.18s ease forwards",
      }}>

        {success ? (
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "rgba(86, 194, 153, 0.12)",
            border: "1.5px solid rgba(86, 194, 153, 0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "_fo_pop 0.38s cubic-bezier(0.34,1.56,0.64,1) forwards",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
              stroke="#56c299" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        ) : (
          /*
           * Fixed-size SVG so 1 CSS px = 1 SVG user unit.
           * transformOrigin is given in px and resolves correctly against
           * the SVG viewport coordinate system (no transform-box needed).
           *
           * Left  ball: transformOrigin = pivot (65, 10)  → rotate(+40°) swings LEFT
           * Right ball: transformOrigin = pivot (145, 10) → rotate(-40°) swings RIGHT
           *
           * Rendering order: left ball first (behind static cluster when at 0°),
           * static balls next, right ball last (on top when swung out).
           */
          <svg
            width="210" height="100"
            viewBox="0 0 210 100"
            style={{ overflow: "visible" }}
          >
            {/* Support bar */}
            <line
              x1={CX[0]} y1={PIVOT_Y}
              x2={CX[4]} y2={PIVOT_Y}
              stroke="rgba(86,194,153,0.35)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Left ball — behind cluster when at center */}
            <g style={{
              transformOrigin: `${CX[0]}px ${PIVOT_Y}px`,
              animation: "_nc_left 1.4s infinite",
            }}>
              <line
                x1={CX[0]} y1={PIVOT_Y}
                x2={CX[0]} y2={BALL_CY}
                stroke={STR_CLR} strokeWidth="1.5"
              />
              <circle cx={CX[0]} cy={BALL_CY} r={BALL_R} fill={COLORS[0]} />
            </g>

            {/* Static middle balls (1, 2, 3) */}
            {[1, 2, 3].map(i => (
              <g key={i}>
                <line
                  x1={CX[i]} y1={PIVOT_Y}
                  x2={CX[i]} y2={BALL_CY}
                  stroke={STR_CLR} strokeWidth="1.5"
                />
                <circle cx={CX[i]} cy={BALL_CY} r={BALL_R} fill={COLORS[i]} />
              </g>
            ))}

            {/* Right ball — on top in SVG z-order when swung out */}
            <g style={{
              transformOrigin: `${CX[4]}px ${PIVOT_Y}px`,
              animation: "_nc_right 1.4s 0.35s infinite",
            }}>
              <line
                x1={CX[4]} y1={PIVOT_Y}
                x2={CX[4]} y2={BALL_CY}
                stroke={STR_CLR} strokeWidth="1.5"
              />
              <circle cx={CX[4]} cy={BALL_CY} r={BALL_R} fill={COLORS[4]} />
            </g>
          </svg>
        )}

        <div style={{ textAlign: "center", animation: "_fo_up 0.25s ease forwards" }}>
          <p style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 800,
            fontSize: 17,
            color: "#eaf5f0",
            margin: subMessage ? "0 0 6px" : 0,
            letterSpacing: "-0.3px",
          }}>
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
