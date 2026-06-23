import React, { useState } from "react";
import hostopsLogo from "../../../assets/HostOpsLOGO.png";
import { useDashboard } from "../context/DashboardContext";
import BugReportModal from "./BugReportModal";
import AnnouncementHouse from "./AnnouncementHouse";

export default function Footer() {
  const year = new Date().getFullYear();
  const { dark } = useDashboard();
  const [showBugReport, setShowBugReport] = useState(false);

  return (
    <footer style={{
      width: "100%",
      boxSizing: "border-box",
      background: dark
        ? "linear-gradient(135deg, #0a1f15 0%, #0c2318 100%)"
        : "linear-gradient(135deg, #f0faf6 0%, #e8f5f0 100%)",
      borderTop: dark ? "1px solid #1e3a2a" : "1px solid #c8e6d8",
      transition: "background 0.2s, border-color 0.2s",
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
        .footer-links a:hover,
        .footer-links button:hover {
          background: ${dark ? "#132a1e" : "#f0faf6"} !important;
          border-color: ${dark ? "#2a5c3c" : "#c8e6d8"} !important;
          color: ${dark ? "#56c299" : "#1e6b4a"} !important;
        }
        @media (max-width: 1024px) {
          .footer-brand-row {
            flex-direction: column !important;
            align-items: center !important;
          }
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

        {/* Announcements house + Logo + Brand — same row, same flex item,
            kaya zero extra vertical space ang naidadagdag */}
        <div className="footer-brand-row" style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
          <AnnouncementHouse dark={dark} />

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
              <img src={hostopsLogo} alt="HostOps" style={{ width: 32, height: 32, objectFit: "contain" }} />
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: dark ? "#56c299" : "#1e6b4a" }}>HostOps</div>
              <div style={{ fontSize: "11px", color: "#8ab8a0", marginTop: 1 }}>{year} — All rights reserved</div>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          background: dark ? "#132a1e" : "#fff",
          border: dark ? "1px solid #1e3a2a" : "1px solid #c8e6d8",
          borderRadius: 20, padding: "6px 14px", flexShrink: 0,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#26a676" }} />
          <span style={{ fontSize: "11px", color: "#5a9e7e", fontWeight: 600 }}>All systems operational</span>
        </div>

        {/* Nav Links */}
        <div className="footer-links" style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
          {["Privacy Policy", "Terms of Use"].map((label) => (
            <a key={label} href="#" style={{
              fontSize: "12px", color: dark ? "#6aab8a" : "#7aaa90", textDecoration: "none",
              fontWeight: 500, padding: "6px 12px", borderRadius: 8,
              border: "1px solid transparent", transition: "all .15s",
            }}>{label}</a>
          ))}
          {/* Bug Report button — temporarily disabled */}
          {/*
          <button
            onClick={() => setShowBugReport(true)}
            style={{
              fontSize: "12px", color: "#fff", textDecoration: "none",
              fontWeight: 600, padding: "6px 14px", borderRadius: 8,
              background: "linear-gradient(135deg, #26a676, #1e8760)",
              boxShadow: "0 2px 8px rgba(38,166,118,0.3)",
              border: "none", cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", gap: "5px",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
            </svg>
            Bug Report
          </button>
          */}
        </div>

      </div>

      <BugReportModal show={showBugReport} onClose={() => setShowBugReport(false)} />
    </footer>
  );
}