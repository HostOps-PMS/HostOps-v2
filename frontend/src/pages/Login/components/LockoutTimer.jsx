import React from 'react';

export default function LockoutTimer({ lockoutTimer, initialTimer = 90 }) {
  if (lockoutTimer <= 0) return null;

  const effectiveInitial = Math.max(initialTimer, lockoutTimer);
  const progress = (lockoutTimer / effectiveInitial) * 100;

const housePoints = [
    [100, 10],
    [190, 85],
    [175, 85],
    [175, 190],
    [25, 190],
    [25, 85],
    [10, 85],
    [100, 10],
  ];

  let totalLength = 0;
  const segments = [];
  for (let i = 0; i < housePoints.length - 1; i++) {
    const dx = housePoints[i+1][0] - housePoints[i][0];
    const dy = housePoints[i+1][1] - housePoints[i][1];
    const len = Math.sqrt(dx*dx + dy*dy);
    segments.push(len);
    totalLength += len;
  }

  const filled = (progress / 100) * totalLength;
  let pathD = `M ${housePoints[0][0]} ${housePoints[0][1]}`;
  let accumulated = 0;
  for (let i = 0; i < segments.length; i++) {
    accumulated += segments[i];
    if (accumulated <= filled) {
      pathD += ` L ${housePoints[i+1][0]} ${housePoints[i+1][1]}`;
    } else {
      const prev = accumulated - segments[i];
      const ratio = (filled - prev) / segments[i];
      const px = housePoints[i][0] + ratio * (housePoints[i+1][0] - housePoints[i][0]);
      const py = housePoints[i][1] + ratio * (housePoints[i+1][1] - housePoints[i][1]);
      pathD += ` L ${px} ${py}`;
      break;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px', marginBottom: '10px' }}>
      <div
        style={{
          position: 'relative',
          width: '160px',
          height: '160px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f0f9f7 0%, #ffffff 100%)',
          boxShadow: '0 8px 32px rgba(38, 166, 118, 0.15), inset 0 1px 2px rgba(255, 255, 255, 0.8)'
        }}
      >
        <svg
          viewBox="0 0 200 200"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            filter: 'drop-shadow(0 8px 24px rgba(0, 0, 0, 0.12))',
          }}
        >
          {/* House outline background */}
          <polygon
            points="100,10 190,85 175,85 175,190 25,190 25,85 10,85"
            fill="none"
            stroke="rgba(38, 166, 118, 0.15)"
            strokeWidth="1"
            strokeLinejoin="round"
          />

          {/* Inner house outline */}
          <polygon
            points="100,22 178,88 165,88 165,178 35,178 35,88 22,88"
            fill="none"
            stroke="rgba(38, 166, 118, 0.2)"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />

          {/* House progress path */}
          <path
            d={pathD}
            fill="none"
            stroke="#26A676"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transition: 'all 1s linear',
              filter: 'drop-shadow(0 3px 10px rgba(38, 166, 118, 0.4))',
            }}
          />
        </svg>

        {/* Timer number */}
        <div
          style={{
            zIndex: 10,
            fontSize: '42px',
            fontWeight: '700',
            color: '#1f2937',
            letterSpacing: '-0.5px',
            fontVariantNumeric: 'tabular-nums',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -30%)'
          }}
        >
          {lockoutTimer}
        </div>
      </div>
    </div>
  );
}