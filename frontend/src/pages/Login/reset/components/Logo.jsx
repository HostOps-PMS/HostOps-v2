import React from 'react';

/**
 * Logo.jsx — HostPilot logomark
 * Reuse or import from a shared /components/Logo if your project has one.
 */
export default function Logo() {
  return (
    <div className="rst-logo">
      {/* Replace src with your actual logo asset */}
      <img
        src="/assets/hostpilot-logo.svg"
        alt="HostPilot"
        style={{ height: 36 }}
      />
    </div>
  );
}
