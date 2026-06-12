import React, { useState, useEffect, useRef } from "react";

const WAIT_HINTS = [
  "Bribing the server to go faster…",
  "Counting your bookings one by one…",
  "Teaching the dashboard to read…",
  "Waking up the database, it was napping…",
  "Almost there. Probably.",
  "Fetching data at the speed of WiFi…",
  "Your numbers are on their way. No rush.",
  "Asking the server nicely. It said sure.",
  "Hold on, the data is putting on its shoes…",
  "Calculating how rich you are. One sec.",
];

function pickHint() {
  return WAIT_HINTS[Math.floor(Math.random() * WAIT_HINTS.length)];
}

const EXIT_MS  = 220;

const LOADING_ICONS = [
  // 1. House
  () => (
    <svg width="160" height="100" viewBox="0 0 160 100" style={{ overflow: "visible" }}>
      <circle cx="118" cy="22" r="4"   fill="rgba(125,221,181,0.5)" style={{ animation: "_house_smoke 2.2s infinite" }} />
      <circle cx="122" cy="22" r="5"   fill="rgba(125,221,181,0.5)" style={{ animation: "_house_smoke 2.2s 0.7s infinite" }} />
      <circle cx="119" cy="22" r="3.5" fill="rgba(125,221,181,0.5)" style={{ animation: "_house_smoke 2.2s 1.4s infinite" }} />
      <rect x="112" y="25" width="12" height="22" fill="#1e8760" />
      <polygon points="35,48 80,12 125,48" fill="#26a676" />
      <rect x="45" y="48" width="70" height="42" fill="#1a6b44" />
      <rect x="55" y="58" width="18" height="18" rx="2" fill="#7dddb5" style={{ animation: "_house_glow 1.6s infinite" }} />
      <rect x="88" y="65" width="18" height="25" rx="2" fill="#0d3322" />
      <circle cx="101" cy="78" r="1.5" fill="#7dddb5" />
    </svg>
  ),

  // 2. Key
  () => (
    <svg width="160" height="100" viewBox="0 0 160 100" style={{ overflow: "visible" }}>
      <g style={{ transformOrigin: "80px 50px", animation: "_key_swing 1.6s ease-in-out infinite" }}>
        <circle cx="60" cy="50" r="18" fill="none" stroke="#3cb882" strokeWidth="8" />
        <circle cx="60" cy="50" r="6" fill="#0d3322" />
        <rect x="76" y="46" width="40" height="8" fill="#26a676" />
        <rect x="98" y="54" width="6" height="10" fill="#26a676" />
        <rect x="108" y="54" width="6" height="14" fill="#26a676" />
      </g>
    </svg>
  ),

  // 3. Apartment building
  () => (
    <svg width="160" height="100" viewBox="0 0 160 100" style={{ overflow: "visible" }}>
      <rect x="40" y="14" width="80" height="80" fill="#1a6b44" />
      {[0,1,2,3].map(row => (
        [0,1,2].map(col => (
          <rect
            key={`${row}-${col}`}
            x={50 + col*22} y={22 + row*18}
            width="14" height="12" rx="1.5"
            fill="#7dddb5"
            style={{ animation: `_house_glow 1.8s ${(row*3+col)*0.15}s infinite` }}
          />
        ))
      ))}
    </svg>
  ),

  // 4. Bed with Zzz
  () => (
    <svg width="160" height="100" viewBox="0 0 160 100" style={{ overflow: "visible" }}>
      <rect x="35" y="55" width="90" height="28" rx="4" fill="#1a6b44" />
      <rect x="35" y="46" width="34" height="14" rx="3" fill="#7dddb5" />
      <rect x="30" y="83" width="6" height="12" fill="#0d3322" />
      <rect x="124" y="83" width="6" height="12" fill="#0d3322" />
      <text x="100" y="35" fontFamily="'Sora', sans-serif" fontWeight="800" fontSize="14" fill="#56c299" style={{ animation: "_zzz_float 2.4s infinite" }}>Z</text>
      <text x="110" y="28" fontFamily="'Sora', sans-serif" fontWeight="800" fontSize="11" fill="#56c299" style={{ animation: "_zzz_float 2.4s 0.6s infinite" }}>z</text>
      <text x="118" y="22" fontFamily="'Sora', sans-serif" fontWeight="800" fontSize="9"  fill="#56c299" style={{ animation: "_zzz_float 2.4s 1.2s infinite" }}>z</text>
    </svg>
  ),

// 5. Suitcase rolling
  () => (
    <svg width="160" height="100" viewBox="0 0 160 100" style={{ overflow: "visible" }}>
      <g style={{ animation: "_bounce 1s ease-in-out infinite" }}>
        <rect x="50" y="35" width="60" height="42" rx="6" fill="#26a676" />
        <rect x="68" y="22" width="24" height="14" rx="3" fill="none" stroke="#7dddb5" strokeWidth="4" />
        <rect x="50" y="50" width="60" height="6" fill="#1a6b44" />
        <g style={{ transformOrigin: "62px 84px", animation: "_wheel_spin 1s linear infinite" }}>
          <circle cx="62" cy="84" r="5" fill="#0d3322" />
        </g>
        <g style={{ transformOrigin: "98px 84px", animation: "_wheel_spin 1s linear infinite" }}>
          <circle cx="98" cy="84" r="5" fill="#0d3322" />
        </g>
      </g>
    </svg>
  ),

  // 6. Calendar (booking confirmed)
  () => (
    <svg width="160" height="100" viewBox="0 0 160 100" style={{ overflow: "visible" }}>
      <rect x="45" y="25" width="70" height="60" rx="6" fill="#1a6b44" />
      <rect x="45" y="25" width="70" height="18" rx="6" fill="#26a676" />
      <rect x="58" y="16" width="6" height="16" rx="2" fill="#7dddb5" />
      <rect x="96" y="16" width="6" height="16" rx="2" fill="#7dddb5" />
      {[0,1,2].map(row => (
        [0,1,2,3].map(col => (
          <rect
            key={`${row}-${col}`}
            x={53 + col*15} y={50 + row*12}
            width="10" height="9" rx="1.5"
            fill="rgba(125,221,181,0.35)"
          />
        ))
      ))}
      <rect x="53" y="62" width="10" height="9" rx="1.5" fill="#56c299" />
      <g style={{ animation: "_check_pop 1.8s infinite" }}>
        <circle cx="113" cy="78" r="13" fill="#0d3322" stroke="#56c299" strokeWidth="2" />
        <polyline points="107,78 111,82 119,73" fill="none" stroke="#56c299" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  ),

  // 7. Star rating (review)
  () => (
    <svg width="160" height="100" viewBox="0 0 160 100" style={{ overflow: "visible" }}>
      {[0,1,2,3,4].map(i => {
        const cx = 35 + i * 22.5;
        const big = i === 2;
        const r = big ? 16 : 11;
        const color = i <= 3 ? "#56c299" : "rgba(86,194,153,0.25)";
        return (
          <polygon
            key={i}
            points={starPoints(cx, 50, r)}
            fill={color}
            style={{ transformOrigin: `${cx}px 50px`, animation: `_twinkle 1.6s ${i*0.15}s infinite` }}
          />
        );
      })}
    </svg>
  ),

  // 8. Wallet / Payment
  () => (
    <svg width="160" height="100" viewBox="0 0 160 100" style={{ overflow: "visible" }}>
      <rect x="40" y="35" width="80" height="50" rx="8" fill="#1a6b44" />
      <rect x="40" y="35" width="80" height="16" rx="8" fill="#26a676" />
      <rect x="95" y="55" width="28" height="20" rx="4" fill="#0d3322" />
      <circle cx="103" cy="65" r="4" fill="#7dddb5" style={{ animation: "_house_glow 1.6s infinite" }} />
      <g style={{ animation: "_coin_flip 2s infinite" }}>
        <circle cx="65" cy="22" r="10" fill="#56c299" />
        <text x="65" y="26" fontFamily="'Sora', sans-serif" fontWeight="800" fontSize="11" fill="#0d3322" textAnchor="middle">₱</text>
      </g>
    </svg>
  ),

  // 9. Map pin (location)
  () => (
    <svg width="160" height="100" viewBox="0 0 160 100" style={{ overflow: "visible" }}>
      <ellipse cx="80" cy="86" rx="22" ry="5" fill="rgba(86,194,153,0.18)" />
      <g style={{ animation: "_bounce 1.4s ease-in-out infinite" }}>
        <path d="M80 16 C58 16 48 32 48 46 C48 66 80 86 80 86 C80 86 112 66 112 46 C112 32 102 16 80 16 Z" fill="#26a676" />
        <circle cx="80" cy="46" r="14" fill="#0d3322" />
        <circle cx="80" cy="46" r="6" fill="#7dddb5" style={{ animation: "_house_glow 1.6s infinite" }} />
      </g>
    </svg>
  ),

  // 10. Sofa (furnished property)
  () => (
    <svg width="160" height="100" viewBox="0 0 160 100" style={{ overflow: "visible" }}>
      <rect x="40" y="50" width="80" height="32" rx="8" fill="#1a6b44" />
      <rect x="40" y="38" width="22" height="26" rx="6" fill="#26a676" />
      <rect x="98" y="38" width="22" height="26" rx="6" fill="#26a676" />
      <rect x="50" y="40" width="60" height="18" rx="5" fill="#3cb882" />
      <rect x="58" y="44" width="20" height="12" rx="3" fill="#7dddb5" style={{ animation: "_pulse 2s infinite" }} />
      <rect x="82" y="44" width="20" height="12" rx="3" fill="#7dddb5" style={{ animation: "_pulse 2s 0.4s infinite" }} />
      <rect x="36" y="80" width="6" height="10" fill="#0d3322" />
      <rect x="118" y="80" width="6" height="10" fill="#0d3322" />
    </svg>
  ),
];

function starPoints(cx, cy, r) {
  const points = [];
  for (let i = 0; i < 5; i++) {
    const outerAngle = (Math.PI / 2) + (i * 2 * Math.PI / 5);
    points.push(`${cx + r * Math.cos(outerAngle)},${cy - r * Math.sin(outerAngle)}`);
    const innerAngle = outerAngle + Math.PI / 5;
    points.push(`${cx + (r * 0.45) * Math.cos(innerAngle)},${cy - (r * 0.45) * Math.sin(innerAngle)}`);
  }
  return points.join(" ");
}

function pickIcon() {
  return Math.floor(Math.random() * LOADING_ICONS.length);
}

export default function FetchingOverlay({
  isVisible,
  message    = "Loading…",
  subMessage = null,
  success    = false,
}) {
  const [rendered, setRendered] = useState(isVisible);
  const [exiting,  setExiting]  = useState(false);
const [hint,     setHint]     = useState(pickHint);
  const [iconIdx,  setIconIdx]  = useState(pickIcon);
  const exitTimer = useRef(null);

  useEffect(() => {
    if (isVisible) {
      clearTimeout(exitTimer.current);
      setHint(pickHint());
      setIconIdx(pickIcon());
      setRendered(true);
      setExiting(false);
    } else {
      setExiting(true);
      exitTimer.current = setTimeout(() => {
        setRendered(false);
        setExiting(false);
      }, EXIT_MS);
    }
    return () => clearTimeout(exitTimer.current);
  }, [isVisible]);

  if (!rendered) return null;

  return (
    <>
      <style>{`
        @keyframes _fo_fade_in  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes _fo_fade_out { from { opacity: 1; } to { opacity: 0; } }
        @keyframes _fo_up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes _fo_pop {
          0%   { opacity: 0; transform: scale(0.5); }
          65%  { transform: scale(1.18); }
          100% { opacity: 1; transform: scale(1); }
        }
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
        @keyframes _house_smoke {
          0%   { opacity: 0; transform: translateY(0) scale(0.6); }
          30%  { opacity: 0.6; }
          100% { opacity: 0; transform: translateY(-25px) scale(1.2); }
        }
        @keyframes _house_glow {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 1; }
        }
        @keyframes _key_swing {
          0%, 100% { transform: rotate(-8deg); }
          50%      { transform: rotate(8deg); }
        }
        @keyframes _bounce {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes _zzz_float {
          0%   { opacity: 0; transform: translate(0,0) scale(0.7); }
          30%  { opacity: 1; }
          100% { opacity: 0; transform: translate(14px,-22px) scale(1.2); }
        }
        @keyframes _wheel_spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes _pulse {
          0%, 100% { transform: scale(1);   opacity: 1; }
          50%      { transform: scale(1.15); opacity: 0.7; }
        }
        @keyframes _twinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%      { opacity: 1;   transform: scale(1.1); }
        }
        @keyframes _coin_flip {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50%      { transform: translateY(-8px) rotate(180deg); }
        }
        @keyframes _check_pop {
          0%, 60%  { opacity: 0; transform: scale(0.5); }
          80%      { opacity: 1; transform: scale(1.2); }
          100%     { opacity: 1; transform: scale(1); }
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
        animation: exiting
          ? `_fo_fade_out ${EXIT_MS}ms ease forwards`
          : "_fo_fade_in 0.18s ease forwards",
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
          LOADING_ICONS[iconIdx]()
        )}

        {(() => {
          const sub = subMessage ?? (!success ? hint : null);
          return (
            <div style={{ textAlign: "center", animation: "_fo_up 0.25s ease forwards" }}>
              <p style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 800,
                fontSize: 17,
                color: "#eaf5f0",
                margin: sub ? "0 0 6px" : 0,
                letterSpacing: "-0.3px",
              }}>
                {message}
              </p>
              {sub && (
                <p style={{ fontSize: 13, color: "#56c299", margin: 0 }}>
                  {sub}
                </p>
              )}
            </div>
          );
        })()}
      </div>
    </>
  );
}
