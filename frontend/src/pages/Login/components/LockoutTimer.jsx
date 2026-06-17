import React from 'react';

export default function LockoutTimer({ lockoutTimer, initialTimer = 90 }) {
  if (lockoutTimer <= 0) return null;

  // If lockoutTimer somehow exceeds initialTimer, cap the progress at 100
  const effectiveInitial = Math.max(initialTimer, lockoutTimer);
  const progress = (lockoutTimer / effectiveInitial) * 100;
  
  // Circumference of circle with r=85 is 2 * pi * 85 ≈ 534.07
  const circumference = 534.07;
  const dashoffset = circumference - (progress / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px', marginBottom: '10px' }}>
      
      <div 
        style={{
          position: 'relative',
          width: '120px',
          height: '120px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: 'linear-gradient(145deg, #e5e2e2, #ffffff)',
          boxShadow: '10px 10px 20px #d8d5d5, -10px -10px 20px #ffffff'
        }}
      >
        <svg 
          viewBox="0 0 200 200"
          style={{ 
            position: 'absolute',
            width: '100%',
            height: '100%',
            transform: 'rotate(-90deg)',
            filter: 'drop-shadow(0 4px 16px rgba(0, 0, 0, 0.06))',
          }}
        >
          {/* Background circle */}
          <circle
            cx="100" cy="100" r="85"
            fill="none" stroke="rgba(38, 166, 118, 0.3)" strokeWidth="1" opacity="0.4"
          />
          
          {/* Main progress indicator */}
          <circle
            cx="100" cy="100" r="85"
            fill="none" stroke="#26A676" strokeWidth="6"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashoffset}
            strokeLinecap="round"
            style={{ 
              transition: 'stroke-dashoffset 1s linear',
              filter: 'drop-shadow(0 2px 6px rgba(38, 166, 118, 0.3))' 
            }}
          />
        </svg>

        {/* Timer number */}
        <div 
          style={{ 
            zIndex: 10, 
            fontSize: '36px', 
            fontWeight: 300, 
            color: '#374151', 
            letterSpacing: '-1px' 
          }}
        >
          {lockoutTimer}
        </div>
      </div>
    </div>
  );
}
