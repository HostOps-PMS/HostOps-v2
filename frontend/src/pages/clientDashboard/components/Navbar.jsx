import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../AuthContext";
import { useDashboard } from "../context/DashboardContext";
import { exportDashboardPDF } from "../services/pdfExportService";
import AccountSettingsModal from "./AccountSettingsModal";

export default function Navbar() {
  const { getUser, clear } = useAuth();
  const { dashState } = useDashboard();
  const user = getUser();
  const [dark, setDark] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setMenuOpen(false);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    clear();
    window.location.href = "/";
  };

  function openAccountSettings() {
    setDropOpen(false);
    setMenuOpen(false);
    setAccountSettingsOpen(true);
  }

  async function handleExportPDF() {
    if (isExporting) return;
    if (!dashState.rawData) {
      alert("No dashboard data loaded yet. Please wait for data to load first.");
      return;
    }
    setIsExporting(true);
    try {
      // Small tick so the spinner renders before the heavy PDF work blocks the thread
      await new Promise((r) => setTimeout(r, 50));
      await exportDashboardPDF(dashState);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  const t = {
    navbar: {
      background: dark ? "#0c1c14" : "#eaf5f0",
      borderBottom: `0.5px solid ${dark ? "#1e3a2a" : "#b7dece"}`,
      transition: "background 0.2s, border-color 0.2s",
      position: "sticky",
      top: 0,
      zIndex: 100,
    },
    inner: {
      maxWidth: "1400px",
      margin: "0 auto",
      padding: isMobile ? "0 16px" : "0 32px",
      height: isMobile ? "52px" : "58px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    logoWrap: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      textDecoration: "none",
    },
    logoBox: {
      width: "28px",
      height: "28px",
      background: dark ? "#eaf5f0" : "#0c1c14",
      borderRadius: "6px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    logoIcon: {
      fontSize: "14px",
      color: dark ? "#0c1c14" : "#eaf5f0",
    },
    logoText: {
      fontSize: "17px",
      fontWeight: 700,
      color: dark ? "#eaf5f0" : "#0c1c14",
      letterSpacing: "-0.3px",
    },
    rightGroup: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    iconBtn: {
      width: "34px",
      height: "34px",
      borderRadius: "8px",
      background: "transparent",
      border: `0.5px solid ${dark ? "#1e3a2a" : "#b7dece"}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      color: dark ? "#56c299" : "#1e8760",
    },
    exportBtn: {
      width: "34px",
      height: "34px",
      borderRadius: "8px",
      background: isExporting
        ? (dark ? "#1a2e20" : "#eaf8f1")
        : "transparent",
      border: `0.5px solid ${isExporting ? "#26a676" : (dark ? "#1e3a2a" : "#b7dece")}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: isExporting ? "default" : "pointer",
      color: isExporting ? "#26a676" : (dark ? "#56c299" : "#1e8760"),
      transition: "all .15s",
      position: "relative",
    },
    iconBtnIcon: { fontSize: "16px" },
    divider: {
      width: "0.5px",
      height: "20px",
      background: dark ? "#1e3a2a" : "#b7dece",
      margin: "0 4px",
    },
    userPill: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "5px 10px",
      borderRadius: "8px",
      border: `0.5px solid ${dark ? "#1e3a2a" : "#b7dece"}`,
      cursor: "pointer",
      background: dark ? "#1a2e20" : "#fff",
    },
    avatar: {
      width: "26px",
      height: "26px",
      borderRadius: "50%",
      background: dark ? "#56c299" : "#0c1c14",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "11px",
      fontWeight: 500,
      color: dark ? "#0c1c14" : "#eaf5f0",
      flexShrink: 0,
    },
    userName: {
      fontSize: "13px",
      fontWeight: 500,
      color: dark ? "#eaf5f0" : "#0c1c14",
    },
    chevron: {
      fontSize: "13px",
      color: dark ? "#56c299" : "#1e8760",
      transition: "transform 0.2s",
      transform: dropOpen ? "rotate(180deg)" : "rotate(0deg)",
    },
    dropdown: {
      display: dropOpen ? "block" : "none",
      position: "absolute",
      top: "calc(100% + 8px)",
      right: 0,
      width: "200px",
      background: dark ? "#1a2e20" : "#fff",
      border: `0.5px solid ${dark ? "#1e3a2a" : "#b7dece"}`,
      borderRadius: "10px",
      overflow: "hidden",
      boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
      zIndex: 999,
    },
    dropHeader: {
      padding: "12px 14px",
      borderBottom: `0.5px solid ${dark ? "#1e3a2a" : "#e8f3ee"}`,
    },
    dropName: {
      fontSize: "13px",
      fontWeight: 500,
      color: dark ? "#eaf5f0" : "#0c1c14",
      margin: 0,
    },
    dropEmail: {
      fontSize: "11px",
      color: dark ? "#56c299" : "#6a8b7c",
      margin: "3px 0 0",
    },
    dropBody: { padding: "6px" },
    dropBtn: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "9px 10px",
      borderRadius: "6px",
      border: "none",
      background: "transparent",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: 500,
      textAlign: "left",
    },
    mobileMenu: {
      display: menuOpen ? "flex" : "none",
      flexDirection: "column",
      position: "absolute",
      top: "52px",
      left: 0,
      right: 0,
      background: dark ? "#0c1c14" : "#eaf5f0",
      borderBottom: `0.5px solid ${dark ? "#1e3a2a" : "#b7dece"}`,
      padding: "12px 16px",
      gap: "8px",
      zIndex: 99,
    },
    mobileMenuItem: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 12px",
      borderRadius: "8px",
      border: "none",
      background: "transparent",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: 500,
      width: "100%",
      textAlign: "left",
    },
    mobileDivider: {
      height: "0.5px",
      background: dark ? "#1e3a2a" : "#b7dece",
      margin: "4px 0",
    },
  };

  /* ── Export button (shared between mobile & desktop) ── */
  const ExportButton = (
    <button
      style={t.exportBtn}
      onClick={handleExportPDF}
      aria-label={isExporting ? "Exporting PDF…" : "Export analytics as PDF"}
      title={
        isExporting
          ? "Generating PDF…"
          : `Export analytics PDF${dashState.from ? ` · ${dashState.from} – ${dashState.to}` : ""}`
      }
    >
      {isExporting ? (
        /* Spinning ring */
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ animation: "spin 0.8s linear infinite" }}
        >
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      ) : (
        /* Download arrow icon */
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
    </button>
  );

  // Mobile layout
  if (isMobile) {
    return (
      <>
        <nav style={{ ...t.navbar, position: "sticky" }}>
          <div style={t.inner}>
            <a href="/" style={t.logoWrap}>
              <div style={t.logoBox}>
                <i className="ti ti-home" style={t.logoIcon} aria-hidden="true" />
              </div>
              <span style={t.logoText}>HostOps</span>
            </a>

            <div style={t.rightGroup}>
              {/* Export PDF */}
              {ExportButton}

              <button
                style={t.iconBtn}
                onClick={() => setDark((prev) => !prev)}
                aria-label="Toggle dark mode"
              >
                <i
                  className={dark ? "ti ti-sun" : "ti ti-moon"}
                  style={t.iconBtnIcon}
                  aria-hidden="true"
                />
              </button>

              <div style={{ position: "relative" }} ref={dropdownRef}>
                <div
                  style={t.avatar}
                  onClick={() => setDropOpen((prev) => !prev)}
                >
                  {user?.firstName?.charAt(0).toUpperCase() || "U"}
                </div>
                <div style={t.dropdown}>
                  <div style={t.dropHeader}>
                    <p style={t.dropName}>
                      {user?.firstName} {user?.lastName || ""}
                    </p>
                    <p style={t.dropEmail}>{user?.email || ""}</p>
                  </div>
                  <div style={t.dropBody}>
                    <button
                      style={{
                        ...t.dropBtn,
                        color: dark ? "#eaf5f0" : "#0c1c14",
                      }}
                    >
                      <i
                        className="ti ti-bell"
                        style={{ fontSize: "15px", color: "#1e8760" }}
                        aria-hidden="true"
                      />
                      Notifications
                    </button>
                    <button
                      style={{
                        ...t.dropBtn,
                        color: dark ? "#eaf5f0" : "#0c1c14",
                      }}
                    >
                      <i
                        className="ti ti-settings"
                        style={{ fontSize: "15px", color: "#1e8760" }}
                        aria-hidden="true"
                      />
                      Settings
                    </button>
                    <button
                      style={{
                        ...t.dropBtn,
                        color: dark ? "#eaf5f0" : "#0c1c14",
                      }}
                      onClick={openAccountSettings}
                    >
                      <i
                        className="ti ti-user"
                        style={{ fontSize: "15px", color: "#1e8760" }}
                        aria-hidden="true"
                      />
                      Account settings
                    </button>
                    <div style={t.mobileDivider} />
                    <button
                      style={{ ...t.dropBtn, color: "#c13515" }}
                      onClick={handleLogout}
                    >
                      <i
                        className="ti ti-logout"
                        style={{ fontSize: "15px", color: "#c13515" }}
                        aria-hidden="true"
                      />
                      Log out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <AccountSettingsModal
          isOpen={accountSettingsOpen}
          onClose={() => setAccountSettingsOpen(false)}
        />
      </>
    );
  }

  // Desktop layout
  return (
    <>
      <nav style={t.navbar}>
        <div style={t.inner}>
          <a href="/" style={t.logoWrap}>
            <div style={t.logoBox}>
              <i className="ti ti-home" style={t.logoIcon} aria-hidden="true" />
            </div>
            <span style={t.logoText}>HostPilot</span>
          </a>

          <div style={t.rightGroup}>
            <button style={t.iconBtn} aria-label="Notifications">
              <i
                className="ti ti-bell"
                style={t.iconBtnIcon}
                aria-hidden="true"
              />
            </button>

            {/* Export PDF — sits right after the bell */}
            {ExportButton}

            <button
              style={t.iconBtn}
              onClick={() => setDark((prev) => !prev)}
              aria-label="Toggle dark mode"
            >
              <i
                className={dark ? "ti ti-sun" : "ti ti-moon"}
                style={t.iconBtnIcon}
                aria-hidden="true"
              />
            </button>

            <div style={t.divider} />

            <div style={{ position: "relative" }} ref={dropdownRef}>
              <div
                style={t.userPill}
                onClick={() => setDropOpen((prev) => !prev)}
              >
                <div style={t.avatar}>
                  {user?.firstName?.charAt(0).toUpperCase() || "U"}
                </div>
                <span style={t.userName}>{user?.firstName || "User"}</span>
                <i
                  className="ti ti-chevron-down"
                  style={t.chevron}
                  aria-hidden="true"
                />
              </div>

              <div style={t.dropdown}>
                <div style={t.dropHeader}>
                  <p style={t.dropName}>
                    {user?.firstName} {user?.lastName || ""}
                  </p>
                  <p style={t.dropEmail}>{user?.email || ""}</p>
                </div>
                <div style={t.dropBody}>
                  <button
                    style={{ ...t.dropBtn, color: dark ? "#eaf5f0" : "#0c1c14" }}
                    onClick={openAccountSettings}
                  >
                    <i
                      className="ti ti-user"
                      style={{ fontSize: "15px", color: "#1e8760" }}
                      aria-hidden="true"
                    />
                    Account settings
                  </button>
                  <button
                    style={{ ...t.dropBtn, color: "#c13515" }}
                    onClick={handleLogout}
                  >
                    <i
                      className="ti ti-logout"
                      style={{ fontSize: "15px", color: "#c13515" }}
                      aria-hidden="true"
                    />
                    Log out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <AccountSettingsModal
        isOpen={accountSettingsOpen}
        onClose={() => setAccountSettingsOpen(false)}
      />
    </>
  );
}