import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../AuthContext";
import { authFetch } from "../../apiService";
import safeStorage from "../../safeStorage";

const canAccessProperty = (property) => property?.hasAccess !== false;
const PROP_ID_KEY = "hp_selected_property_id";
const PROP_NAME_KEY = "hp_selected_property_name";

// ─────────────────────────────────────────────────────────────────
// SwitchAccountModal
//
// Fetches the current user's properties from GET /auth/my-properties
// (never reads user.properties from sessionStorage — the backend is
// the source of truth). Lets the user switch their active property,
// which is stored in sessionStorage as 'hp_active_property'.
//
// Props:
//   isOpen    {boolean}  — whether the modal is visible
//   onClose   {fn}       — called when the user dismisses the modal
//   onSwitch  {fn}       — called with the selected property object
//                          { _id, propertyName } or null (All Properties)
// ─────────────────────────────────────────────────────────────────
export default function SwitchAccountModal({ isOpen, onClose, onSwitch }) {
  const auth = useAuth();

  // FIX 1: Read user fresh on every render — avoids stale null on first mount
  // when the auth context hasn't fully hydrated yet.
  let user = auth.getUser?.() ?? auth.user ?? null;
  // Guard against the { user: { …fields } } wrapper that verifySession
  // previously persisted — unwrap so every field is at the top level.
  if (user && user.user && !user.email && typeof user.user === 'object') {
    user = user.user;
  }

  // Properties fetched from the backend
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [fetchedBusinessName, setFetchedBusinessName] = useState("");

  // Read the currently active property _id from sessionStorage so we
  // can pre-select and badge it in the list on open.
  // Uses the same keys as DashboardContext (hp_selected_property_id / hp_selected_property_name)
  // so the "Active" badge always reflects what the dashboard is actually showing.
  const getActiveId = () => {
    try {
      return safeStorage.getItem(PROP_ID_KEY) || null;
    } catch {
      return null;
    }
  };

  // FIX 2: Derive activeId live on every render instead of freezing it in
  // useState at mount time. On first login sessionStorage isn't populated yet
  // when the component mounts, so useState(() => getActiveId()) would capture
  // null and never update — causing the "Active" badge to never appear.
  const activeId = getActiveId();

  const [selectedId, setSelectedId] = useState(getActiveId);

  const overlayRef = useRef(null);

  // ── Fetch properties from backend whenever modal opens ────────────
  useEffect(() => {
    if (!isOpen) return;

    // Re-read the stored active property every time the modal opens
    const currentActive = getActiveId();
    setSelectedId(currentActive);

    setLoading(true);
    setFetchError(null);

    authFetch("/auth/my-properties", {}, auth)
      .then(async (res) => {
        if (!res) throw new Error("Session expired. Please log in again.");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Error ${res.status}`);
        }
        const data = await res.json();
        const fetched = data.properties || [];
        setProperties(fetched);
        if (data.businessName) setFetchedBusinessName(data.businessName);

        const currentActive = getActiveId();
        const currentActiveProp = fetched.find((p) => String(p._id) === String(currentActive));
        const firstAccessible = fetched.find(canAccessProperty);

        // If no active property is stored yet (first login), auto-select and
        // persist only an accessible property so disabled properties cannot
        // become active by default.
        if (fetched.length > 0 && !currentActive && firstAccessible) {
          const first = firstAccessible;
          safeStorage.setItem(PROP_ID_KEY, String(first._id));
          safeStorage.setItem(PROP_NAME_KEY, first.propertyName || "");
          setSelectedId(String(first._id));
        } else if (currentActive && currentActiveProp?.hasAccess === false) {
          setSelectedId(firstAccessible ? String(firstAccessible._id) : null);
        }
      })
      .catch((err) => {
        setFetchError(err.message);
      })
      .finally(() => setLoading(false));
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close on Escape ───────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleSelect(id) {
    setSelectedId(id);
  }

  function handleConfirm() {
    if (!selectedId) return;

    const chosen = properties.find((p) => String(p._id) === String(selectedId));
    if (!chosen) return;
    if (!canAccessProperty(chosen)) return;

    // Capture the current ("from") property BEFORE overwriting storage —
    // this is what gets passed to logActivity in Navbar so the switch log
    // correctly records where the user switched FROM, not the new value.
    const fromPropertyId   = safeStorage.getItem(PROP_ID_KEY)   || null;
    const fromPropertyName = safeStorage.getItem(PROP_NAME_KEY) || null;

    // Write the same keys that DashboardContext reads so the "Active" badge
    // stays in sync with what the dashboard is actually displaying.
    safeStorage.setItem(PROP_ID_KEY, String(chosen._id));
    safeStorage.setItem(PROP_NAME_KEY, chosen.propertyName || "");

    // Pass { id, name, fromPropertyId, fromPropertyName } so Navbar can:
    //   1. call selectProperty() on DashboardContext (id, name)
    //   2. log the switch with correct from/to values (fromPropertyId/Name)
    if (onSwitch) onSwitch({
      id:               String(chosen._id),
      name:             chosen.propertyName || "",
      fromPropertyId,
      fromPropertyName,
    });
    onClose();
  }

  if (!isOpen) return null;

  // ── Derived display values ────────────────────────────────────────
  const initials =
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .map((n) => n.charAt(0).toUpperCase())
      .join("") ||
    user?.businessName?.charAt(0).toUpperCase() ||
    "U";

  // displayName: always prefer businessName first, then full name, then email.
  // We also try user.business_name (snake_case) in case the API returns that shape.
  const displayName =
    user?.businessName ||
    fetchedBusinessName ||
    "Your Account";

  // Helper: is this item currently the live active property?
  const isCurrentlyActive = (id) => !!activeId && String(id) === String(activeId);
  // Helper: is this item selected in this open session?
  const isSelected = (id) => String(id) === String(selectedId);
  const selectedProperty = properties.find((p) => String(p._id) === String(selectedId));
  const canConfirm = !!selectedProperty && canAccessProperty(selectedProperty);

  return (
    <>
      <style>{`
        @keyframes switchModalIn {
          from { opacity: 0; transform: scale(0.94) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes propItemIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes swSpin {
          to { transform: rotate(360deg); }
        }
        .sw-prop-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1.5px solid #eaf3ee;
          background: #fff;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
          margin-bottom: 8px;
          animation: propItemIn 0.18s ease both;
          text-align: left;
          width: 100%;
          font-family: inherit;
        }
        .sw-prop-item:hover:not(.sw-prop-selected):not(:disabled) {
          border-color: #9ab8a9;
          background: #f7faf8;
        }
        .sw-prop-selected {
          border-color: #1e8760 !important;
          background: #eaf8f1 !important;
          box-shadow: 0 0 0 3px rgba(30,135,96,0.10) !important;
        }
        .sw-confirm-btn:hover:not(:disabled) {
          background: #1a3325 !important;
        }
        .sw-cancel-btn:hover {
          background: #f0f8f4 !important;
        }
        .sw-close-btn:hover {
          background: #f0f8f4 !important;
          color: #0c1c14 !important;
        }
        .sw-modal-scroll::-webkit-scrollbar { display: none; }
        .sw-modal-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Overlay */}
      <div
        ref={overlayRef}
        onClick={handleOverlayClick}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(12, 28, 20, 0.55)",
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
          zIndex: 10500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div
          className="sw-modal-scroll"
          role="dialog"
          aria-modal="true"
          aria-label="Switch Property"
          style={{
            background: "#fff",
            borderRadius: 20,
            width: "100%",
            maxWidth: 420,
            maxHeight: "85vh",
            overflowY: "auto",
            boxShadow: "0 24px 64px rgba(12,28,20,0.22), 0 4px 16px rgba(12,28,20,0.08)",
            animation: "switchModalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              padding: "22px 24px 18px",
              borderBottom: "1px solid #eaf3ee",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              {/* Avatar */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "#0c1c14",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#eaf5f0",
                  flexShrink: 0,
                  letterSpacing: "-0.5px",
                }}
              >
                {initials}
              </div>

              <div>
                <h2
                  style={{
                    fontFamily: "'Sora', sans-serif",
                    fontSize: "1rem",
                    fontWeight: 800,
                    color: "#0c1c14",
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  Switch Property
                </h2>
                <p style={{ fontSize: 12, color: "#9ab8a9", margin: "3px 0 0" }}>
                  Choose a different property
                </p>
              </div>
            </div>

            {/* Close button */}
            <button
              className="sw-close-btn"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "1px solid #e0ede6",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#6a8b7c",
                fontSize: 14,
                flexShrink: 0,
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>

          {/* ── Body ── */}
          <div style={{ padding: "20px 24px" }}>

            {/* Section label */}
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "#9ab8a9",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Your Properties
            </p>

            {/* ── Loading state ── */}
            {loading && (
              <div style={{ textAlign: "center", padding: "32px 20px", color: "#9ab8a9" }}>
                <svg
                  width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke="#1e8760" strokeWidth="2.5" strokeLinecap="round"
                  style={{ animation: "swSpin 0.8s linear infinite", display: "inline-block", marginBottom: 10 }}
                >
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                <p style={{ fontSize: 13, margin: 0 }}>Loading properties…</p>
              </div>
            )}

            {/* ── Fetch error state ── */}
            {!loading && fetchError && (
              <div
                style={{
                  textAlign: "center",
                  padding: "28px 20px",
                  color: "#c13515",
                }}
              >
                <i
                  className="ti ti-alert-circle"
                  style={{ fontSize: 28, display: "block", marginBottom: 8 }}
                  aria-hidden="true"
                />
                <p style={{ fontSize: 13, margin: 0 }}>{fetchError}</p>
              </div>
            )}

            {/* ── No properties state ── */}
            {!loading && !fetchError && properties.length === 0 && (
              <div style={{ textAlign: "center", padding: "32px 20px", color: "#9ab8a9" }}>
                <i
                  className="ti ti-building"
                  style={{ fontSize: 32, display: "block", marginBottom: 10 }}
                  aria-hidden="true"
                />
                <p style={{ fontSize: 13, margin: 0 }}>
                  No properties linked to your account yet.
                </p>
                <p style={{ fontSize: 12, margin: "4px 0 0", color: "#b8d4c4" }}>
                  Contact your administrator to add properties.
                </p>
              </div>
            )}

            {/* ── Individual property items ── */}
            {!loading && !fetchError && properties.map((property, index) => {
              const propId    = String(property._id);
              const active    = isCurrentlyActive(propId);
              const selected  = !active && isSelected(propId);
              const disabled  = active || !canAccessProperty(property);

              return (
                <button
                  key={property._id}
                  className={`sw-prop-item${selected ? " sw-prop-selected" : ""}`}
                  onClick={() => !disabled && handleSelect(propId)}
                  disabled={disabled}
                  style={{
                    animationDelay: `${(index + 1) * 40}ms`,
                    opacity: active ? 1 : disabled ? 0.5 : 1,
                    cursor: active ? "default" : disabled ? "not-allowed" : "pointer",
                  }}
                  title={active ? "You are currently on this property" : disabled ? "You do not have access to this property" : ""}
                >
                  {/* Property icon / photo */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: selected ? "#1e8760" : active ? "#eaf3ee" : disabled ? "#f0f4f2" : "#eaf3ee",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      overflow: "hidden",
                      transition: "background 0.15s",
                    }}
                  >
                    {property.propertyPicture ? (
                      <img
                        src={property.propertyPicture}
                        alt={property.propertyName}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: 10,
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextSibling.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <i
                      className="ti ti-home"
                      style={{
                        fontSize: 16,
                        color: selected ? "#fff" : (active || disabled) ? "#9ab8a9" : "#6a8b7c",
                        display: property.propertyPicture ? "none" : "flex",
                      }}
                      aria-hidden="true"
                    />
                  </div>

                  {/* Property info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: (active || disabled) ? "#9ab8a9" : "#0c1c14",
                          margin: 0,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {property.propertyName}
                      </p>
                      {active && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#1e8760",
                            background: "#d1f0e3",
                            borderRadius: 20,
                            padding: "1px 7px",
                            letterSpacing: "0.04em",
                            flexShrink: 0,
                          }}
                        >
                          Active
                        </span>
                      )}
                      {!active && disabled && (
                         <span
                         style={{
                           fontSize: 10,
                           fontWeight: 700,
                           color: "#c13515",
                           background: "#ffeae5",
                           borderRadius: 20,
                           padding: "1px 7px",
                           letterSpacing: "0.04em",
                           flexShrink: 0,
                         }}
                       >
                         No Access
                       </span>
                      )}
                    </div>
                    {/* Subtitle: show the business name as a secondary descriptor */}
                    <p
                      style={{
                        fontSize: 11,
                        color: (active || disabled) ? "#b8d4c4" : "#9ab8a9",
                        margin: "2px 0 0",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {property.businessName || property.business_name || displayName}
                    </p>
                  </div>

                  {selected && (
                    <i
                      className="ti ti-circle-check-filled"
                      style={{ fontSize: 18, color: "#1e8760", flexShrink: 0 }}
                      aria-hidden="true"
                    />
                  )}
                  {!active && disabled && (
                    <i
                      className="ti ti-lock"
                      style={{ fontSize: 18, color: "#9ab8a9", flexShrink: 0 }}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Footer ── */}
          {!loading && !fetchError && properties.length > 0 && (
            <div
              style={{
                padding: "14px 24px 22px",
                borderTop: "1px solid #eaf3ee",
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                className="sw-cancel-btn"
                onClick={onClose}
                style={{
                  padding: "9px 18px",
                  borderRadius: 10,
                  border: "1.5px solid #d4e8dd",
                  background: "transparent",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#4a6b5a",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                className="sw-confirm-btn"
                onClick={handleConfirm}
                disabled={!canConfirm}
                style={{
                  padding: "9px 22px",
                  borderRadius: 10,
                  border: "none",
                  background: canConfirm ? "#0c1c14" : "#b8d4c4",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#eaf5f0",
                  cursor: canConfirm ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  transition: "background 0.15s",
                  fontFamily: "inherit",
                }}
              >
                <i className="ti ti-arrows-exchange" style={{ fontSize: 14 }} aria-hidden="true" />
                Switch
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}