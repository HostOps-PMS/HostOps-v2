import React from 'react';

export default function Logo() {
  return (
    <div className="lp-logo">
      <img
        src="/HostOpsLOGO.png"
        alt="HostOps"
        style={{
          height: '38px',
          width: 'auto',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </div>
  );
}