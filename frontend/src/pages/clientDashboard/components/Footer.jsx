import React from "react";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{
      width: "100%",
      boxSizing: "border-box",
      background: "linear-gradient(135deg, #f0faf6 0%, #e8f5f0 100%)",
      borderTop: "1px solid #c8e6d8",
    }}>
      <style>{`
        .footer-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: nowrap;
          gap: 12px;
          padding: 20px clamp(16px, 5vw, 80px);
        }
        .footer-links a:hover {
          background: #f0faf6 !important;
          border-color: #c8e6d8 !important;
          color: #1e6b4a !important;
        }
        @media (max-width: 768px) {
          .footer-inner {
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            padding: 20px 16px !important;
            gap: 14px !important;
          }
          .footer-links {
            width: 100% !important;
            justify-content: center !important;
          }
        }
      `}</style>

      <div className="footer-inner">

        {/* Logo + Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #26a676, #1e8760)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(38,166,118,0.25)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e6b4a" }}>HostOps</div>
            <div style={{ fontSize: "11px", color: "#8ab8a0", marginTop: 1 }}>{year} — All rights reserved</div>
          </div>
        </div>

        {/* Status Badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          background: "#fff", border: "1px solid #c8e6d8",
          borderRadius: 20, padding: "6px 14px", flexShrink: 0,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#26a676" }} />
          <span style={{ fontSize: "11px", color: "#5a9e7e", fontWeight: 600 }}>All systems operational</span>
        </div>

        {/* Nav Links */}
        <div className="footer-links" style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          {["Privacy Policy", "Terms of Use"].map((label) => (
            <a key={label} href="#" style={{
              fontSize: "12px", color: "#7aaa90", textDecoration: "none",
              fontWeight: 500, padding: "6px 12px", borderRadius: 8,
              border: "1px solid transparent", transition: "all .15s",
            }}>{label}</a>
          ))}
          <a href="#" style={{
            fontSize: "12px", color: "#fff", textDecoration: "none",
            fontWeight: 600, padding: "6px 14px", borderRadius: 8,
            background: "linear-gradient(135deg, #26a676, #1e8760)",
            boxShadow: "0 2px 8px rgba(38,166,118,0.3)",
          }}>Support</a>
        </div>

      </div>
    </footer>
  );
}