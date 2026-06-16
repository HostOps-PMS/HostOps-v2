import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import FetchingOverlay from "./FetchingOverlay";
import { useDashboard } from "../context/DashboardContext";
import { useDashboardData } from "../hooks/useDashboardData";
import { useAuth } from "../../AuthContext";
import { fetchMessages, sendReply } from "../services/dashboardService";
import { timeAgo, fmtDate } from "../../utils/dateHelpers";
import { useActivityLog } from "../hooks/useActivityLog";

function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

const CHANNEL_META = {
  Airbnb:           { bg: "#fff0f0", color: "#d93025", label: "A" },
  "Booking.com":    { bg: "#e8f0fe", color: "#1a73e8", label: "B" },
  VRBO:             { bg: "#f0eeff", color: "#6741d9", label: "V" },
  Direct:           { bg: "#e8f7f0", color: "#26a676", label: "D" },
  "Direct booking": { bg: "#e8f7f0", color: "#26a676", label: "D" },
  Agoda:            { bg: "#fff4e8", color: "#e07c2a", label: "AG" },
  Website:          { bg: "#f0f4f8", color: "#4a6374", label: "W" },
};

function ChannelBadge({ channel, size = 20 }) {
  const meta = CHANNEL_META[channel] || { bg: "#f0f4f8", color: "#4a6374", label: (channel || "?")[0] };
  return (
    <div style={{
      width: size, height: size, borderRadius: "5px", flexShrink: 0,
      background: meta.bg, color: meta.color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.42, fontWeight: 800,
    }}>
      {meta.label}
    </div>
  );
}

function Avatar({ name, size = 34 }) {
  const initials = (name || "G").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const hue = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: `hsl(${hue},40%,88%)`, color: `hsl(${hue},40%,30%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

function groupByDate(threads) {
  const groups = {};
  threads.forEach((t) => {
    const ts = t.latestMessage?.createdAt;
    const d = ts ? new Date(ts) : new Date();
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    let label;
    if (diffDays === 0) label = "Today";
    else if (diffDays === 1) label = "Yesterday";
    else if (diffDays < 7) label = d.toLocaleDateString("en-PH", { weekday: "long" });
    else label = d.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
    if (!groups[label]) groups[label] = [];
    groups[label].push(t);
  });
  return groups;
}

function MessageBubble({ msg, dark }) {
  const isIncoming = msg.type === 1 || msg.direction === "incoming" || msg.from === "guest";
  const body = stripHtml(msg.message || msg.messageHtml || msg.body || "");
  const date = msg["created-at"] || msg.createdAt || msg.date || "";
  const lines = body.split("\n");

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: isIncoming ? "flex-start" : "flex-end",
      marginBottom: 16,
    }}>
      <div style={{
        maxWidth: "72%",
        padding: "10px 14px",
        borderRadius: isIncoming ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
        background: isIncoming ? (dark ? "#1a3528" : "#f4f7f5") : "#26a676",
        border: isIncoming ? `1px solid ${dark ? "#1e3a2a" : "#e4ede8"}` : "none",
        fontSize: "13.5px", lineHeight: 1.65,
        color: isIncoming ? (dark ? "#eaf5f0" : "#0c1c14") : "#fff",
      }}>
        {lines.map((line, j) => (
          <React.Fragment key={j}>{line}{j < lines.length - 1 && <br />}</React.Fragment>
        ))}
      </div>
      <div style={{ fontSize: "10.5px", color: dark ? "#4d8a6a" : "#9ab8a9", marginTop: 5, paddingLeft: 4, paddingRight: 4 }}>
        {isIncoming ? "Guest" : "You"}{date ? " · " + fmtDate(date) : ""}
      </div>
    </div>
  );
}

const DOT_COLORS = ["#a8dfc8", "#6cc9a0", "#26a676", "#1a8060", "#0f5e43"];

function LoadingDots() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", paddingTop: 80, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {DOT_COLORS.map((color, i) => (
          <div
            key={i}
            className="loading-dot"
            style={{ background: color, animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function InboxPage() {
  const { dashState, dark } = useDashboard();
  const { loadData } = useDashboardData();
  const auth = useAuth();
  const navigate = useNavigate();

  // Detect if the currently logged-in user is a staff member.
  // We check multiple signals because the login form may store the session
  // differently (data.staff vs data.user, isStaff flag, etc.):
  //   1. hp_user has role:'staff' — set by backend on staff login responses
  //   2. hp_user has isStaff:true — also injected by backend
  //   3. hp_is_staff sessionStorage key — set by some login form implementations
  // For staff: the reply box is always unlocked — they already authenticated
  // via JWT and the backend enforces property-level access in assertReservationOwnership.
  const currentUser = auth.getUser();
  const isStaffUser = !!(
    currentUser?.role === 'staff' ||
    currentUser?.isStaff === true ||
    sessionStorage.getItem('hp_is_staff') === 'true'
  );
  const { logActivity } = useActivityLog();

  useEffect(() => { logActivity('opened_messages_page'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!search.trim()) return;
    const t = setTimeout(() => logActivity('searched_inbox', { query: search.trim() }), 800);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const [filter, setFilter] = useState("all");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [msgError, setMsgError] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  // Staff users start unlocked; regular users must enter the PIN first.
  const [staffUnlocked, setStaffUnlocked] = useState(isStaffUser);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [pinAccessGranted, setPinAccessGranted] = useState(false);
  const msgEndRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showThread, setShowThread] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const STAFF_PIN = "1234";

  function handlePinSubmit() {
    if (!pinInput) return;
    setIsVerifyingPin(true);
    setPinError(false);

    setTimeout(() => {
      setIsVerifyingPin(false);
      if (pinInput === STAFF_PIN) {
        setPinAccessGranted(true);
        setTimeout(() => {
          setPinAccessGranted(false);
          setPinModalOpen(false);
          setPinInput("");
          setStaffUnlocked(true);
          setTimeout(() => setStaffUnlocked(false), 30 * 60 * 1000);
        }, 1000);
      } else {
        setPinError(true);
        setPinInput("");
      }
    }, 800);
  }

  // ── Load data on mount, scoped to the currently selected property ──────────
  // FIX: The old call was loadData() with no args, so apartmentIdOverride was
  // always undefined → null → backend returned ALL properties' inbox (up to
  // limit=5 threads before our smoobu.js fix).
  //
  // Now we derive the Smoobu apartmentId from dashState:
  //   - If rawData already has properties (dashboard loaded before inbox),
  //     find the matching property by name and pass its Smoobu ID.
  //   - Either way, loadData() picks up propertyDbId from safeStorage
  //     (hp_selected_property_id) internally, which injects the per-property
  //     Smoobu API key on the backend. The apartmentId is a second narrowing
  //     filter on top of that.
  useEffect(() => {
    const selectedName = dashState.selectedPropertyName;
    const properties   = dashState.rawData?.properties || [];

    // Resolve the Smoobu numeric apartment ID for the selected property
    let smoobuApartmentId = null;
    if (selectedName && properties.length > 0) {
      const match = properties.find((p) => p.name === selectedName);
      if (match?.id) smoobuApartmentId = match.id;
    }

    // Pass apartmentId as the 3rd argument; from/to as undefined so they
    // fall back to dashState.from / dashState.to inside loadData.
    loadData(undefined, undefined, smoobuApartmentId);
  }, []); // eslint-disable-line

  // When the user switches property from inside InboxPage, show the overlay
  // then redirect to the dashboard so its useEffect fires and loads fresh data.
  useEffect(() => {
    if (!dashState.isSwitching) return;
    const t = setTimeout(() => navigate("/dashboard"), 300);
    return () => clearTimeout(t);
  }, [dashState.isSwitching]); // eslint-disable-line

  const inbox = dashState.rawData?.inbox || [];
  const totalUnread = dashState.rawData?.totalUnread || 0;

  // Auto-select first thread
  useEffect(() => {
    if (inbox.length > 0 && !selected) {
      setSelected(inbox[0]);
      if (!isMobile) setShowThread(true);
    }
  }, [inbox]);

  // Load messages when thread selected
  useEffect(() => {
    if (!selected?.reservationId) return;
    setMessages([]);
    setMsgError("");
    setLoadingMsgs(true);
    fetchMessages(selected.reservationId, auth)
      .then(async (res) => {
        if (!res?.ok) throw new Error("Failed to load");
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : (data.messages || []));
      })
      .catch((e) => setMsgError(e.message))
      .finally(() => setLoadingMsgs(false));
  }, [selected?.reservationId]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const msg = replyText.trim();
    if (!msg || !selected?.reservationId) return;
    setSending(true);
    try {
      const res = await sendReply({ reservationId: selected.reservationId, subject: "Re: Your message", messageBody: msg }, auth);
      if (!res?.ok) throw new Error("Send failed");
      setReplyText("");
      logActivity('sent_message', { guest: selected.guestName, property: selected.property, channel: selected.channel || 'Direct' });
      setTimeout(() => {
        fetchMessages(selected.reservationId, auth)
          .then(async (r) => { if (r?.ok) { const d = await r.json(); setMessages(Array.isArray(d) ? d : (d.messages || [])); } });
      }, 1200);
    } catch (e) {
      alert("Failed to send: " + e.message);
      logActivity('sent_message_failed', { guest: selected.guestName, property: selected.property, reason: e.message });
    } finally {
      setSending(false);
    }
  }

  // Derive unique property names from the inbox for the filter dropdown
  const propertyOptions = Array.from(
    new Set(inbox.map((t) => t.property).filter(Boolean))
  ).sort();

  const filtered = inbox.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (t.guestName || "").toLowerCase().includes(q) ||
      (t.property || "").toLowerCase().includes(q) ||
      (t.channel || "").toLowerCase().includes(q);
    const fromGuest = t.latestMessage?.fromGuest;
    const matchFilter = filter === "all" || (filter === "unread" && fromGuest) || (filter === "replied" && !fromGuest);
    const matchProperty = propertyFilter === "all" || (t.property || "") === propertyFilter;
    return matchSearch && matchFilter && matchProperty;
  });

  const grouped = groupByDate(filtered);

  // Colors
  const bg        = dark ? "#0c1c14" : "#f4f7f5";
  const panelBg   = dark ? "#132a1e" : "#ffffff";
  const border    = dark ? "#1e3a2a" : "#e4ede8";
  const textMain  = dark ? "#eaf5f0" : "#0c1c14";
  const textSub   = dark ? "#4d8a6a" : "#7a9e8c";
  const inputBg   = dark ? "#1a2e20" : "#f7faf8";
  const hoverBg   = dark ? "#1a3528" : "#f0faf5";
  const selBg     = dark ? "#1e3f2a" : "#e8f7f0";

  return (
    <div style={{ height: "100vh", background: bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <FetchingOverlay
        isVisible={dashState.isSwitching}
        message="Switching property…"
        subMessage={dashState.selectedPropertyName || null}
      />
      <FetchingOverlay
        isVisible={isVerifyingPin}
        message="Verifying PIN…"
        subMessage="Please wait a moment"
      />
      <FetchingOverlay
        isVisible={pinAccessGranted}
        success
        message="Access Granted"
        subMessage="Replies are now unlocked"
      />

      <div style={{ position: "sticky", top: 0, zIndex: 100 }}>
        <Navbar />
      </div>

      {/* Main two-panel layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "fixed", top: 58, left: 0, right: 0, bottom: 0 }}>

        {/* ── LEFT PANEL — Thread list ── */}
        <div style={{
          width: isMobile ? "100%" : "340px", flexShrink: 0,
          background: panelBg,
          borderRight: `1px solid ${border}`,
          display: isMobile && showThread ? "none" : "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Left header */}
          <div style={{ padding: "12px 16px 10px", borderBottom: `1px solid ${border}`, background: panelBg }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <button
                onClick={() => navigate("/dashboard")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: "14px", fontWeight: 500, color: "#26a676",
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                }}
              >
                <svg width="8" height="13" viewBox="0 0 9 15" fill="none">
                  <path d="M8 1L1.5 7.5L8 14" stroke="#26a676" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Dashboard
              </button>
              <span style={{ fontSize: "15px", fontWeight: 700, color: textMain, letterSpacing: "-0.3px" }}>
                Messages
              </span>
              <span style={{
                fontSize: "11px", fontWeight: 600, color: textSub,
                background: inputBg, padding: "2px 8px", borderRadius: 20,
              }}>
                {filtered.length}
              </span>
            </div>
            <div style={{ marginBottom: "10px" }}>
              {/* Search */}
              <div style={{ position: "relative", marginBottom: propertyOptions.length > 1 ? 8 : 0 }}>
                <svg style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: textSub, pointerEvents: "none" }}
                  width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: "100%", padding: "7px 10px 7px 28px",
                    borderRadius: "8px", border: `1px solid ${border}`,
                    background: inputBg, color: textMain,
                    fontSize: "12.5px", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
              {/* Property dropdown — only shows when multiple properties */}
              {propertyOptions.length > 1 && (
                <div style={{ position: "relative" }}>
                  <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                    width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke={propertyFilter !== "all" ? "#26a676" : textSub}
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <select
                    value={propertyFilter}
                    onChange={(e) => { setPropertyFilter(e.target.value); logActivity('filtered_inbox_by_property', { property: e.target.value }); }}
                    style={{
                      width: "100%",
                      padding: "7px 28px 7px 28px",
                      borderRadius: "8px",
                      border: `1px solid ${propertyFilter !== "all" ? "#26a676" : border}`,
                      background: propertyFilter !== "all" ? (dark ? "#0f2d1f" : "#eaf7f0") : inputBg,
                      color: propertyFilter !== "all" ? "#26a676" : textMain,
                      fontSize: "12px",
                      fontWeight: propertyFilter !== "all" ? 700 : 500,
                      outline: "none", cursor: "pointer",
                      appearance: "none", WebkitAppearance: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="all">All Properties</option>
                    {propertyOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <svg style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                    width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke={propertyFilter !== "all" ? "#26a676" : textSub}
                    strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              )}
            </div>

            {/* Filter pills + property — single scrollable row */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              overflowX: "auto", paddingBottom: 2,
              scrollbarWidth: "none", msOverflowStyle: "none",
            }}>
              {[
                { key: "all", label: "All" },
                { key: "unread", label: `Unread${totalUnread > 0 ? ` (${totalUnread})` : ""}` },
                { key: "replied", label: "Replied" },
              ].map((f) => (
                <button key={f.key} onClick={() => { setFilter(f.key); logActivity('filtered_inbox', { filter: f.key }); }} style={{
                  padding: "4px 12px", borderRadius: 20, cursor: "pointer",
                  border: "none", flexShrink: 0,
                  background: filter === f.key ? "#26a676" : inputBg,
                  color: filter === f.key ? "#fff" : textSub,
                  fontSize: "11px", fontWeight: filter === f.key ? 600 : 400,
                  transition: "all .15s", whiteSpace: "nowrap",
                }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Thread list */}
          <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}
            className="scrollbar-none">
            {Object.keys(grouped).length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: textSub, fontSize: "13px" }}>
                No conversations found.
              </div>
            ) : (
              Object.entries(grouped).map(([label, threads]) => (
                <div key={label}>
                  {/* Date group label */}
                  <div style={{
                    padding: "8px 16px 4px",
                    fontSize: "10.5px", fontWeight: 700,
                    color: textSub, textTransform: "uppercase", letterSpacing: "0.06em",
                    background: dark ? "#0e2318" : "#f7faf8",
                    borderBottom: `1px solid ${border}`,
                  }}>
                    {label}
                  </div>

                  {threads.map((thread, idx) => {
                    const ch = thread.channel || "Direct";
                    const fromGuest = thread.latestMessage?.fromGuest;
                    const isSelected = selected?.reservationId === thread.reservationId;
                    let preview = stripHtml(thread.latestMessage?.body || "");
                    if (preview.length > 60) preview = preview.slice(0, 60) + "…";

                    // hasThread: false = booking exists but no messages yet
                    const noThread = thread.hasThread === false;
                    const arrivalLabel = thread.arrival
                      ? `Arriving ${thread.arrival}`
                      : null;

                    return (
                      <div
                        key={idx}
                        onClick={() => { setSelected(thread); setShowThread(true); logActivity('opened_message_thread', { guest: thread.guestName, property: thread.property, channel: thread.channel || 'Direct' }); }}
                        style={{
                          display: "flex", alignItems: "center", gap: "11px",
                          padding: "12px 16px",
                          borderBottom: `1px solid ${border}`,
                          cursor: "pointer",
                          background: isSelected ? selBg : "transparent",
                          borderLeft: isSelected ? "3px solid #26a676" : "3px solid transparent",
                          transition: "background 0.12s",
                          opacity: noThread ? 0.82 : 1,
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = hoverBg; }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                      >
                        {/* Avatar + channel badge */}
                        <div style={{ position: "relative", width: 34, height: 34, flexShrink: 0 }}>
                          <Avatar name={thread.guestName} size={34} />
                          <div style={{ position: "absolute", bottom: -3, right: -5 }}>
                            <ChannelBadge channel={ch} size={16} />
                          </div>
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                            <span style={{ fontWeight: fromGuest ? 700 : 500, fontSize: "13px", color: textMain, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {thread.guestName || "Guest"}
                            </span>
                            <span style={{ fontSize: "10px", color: textSub, flexShrink: 0, marginLeft: 6 }}>
                              {noThread
                                ? (arrivalLabel || "No messages")
                                : timeAgo(thread.latestMessage?.createdAt)}
                            </span>
                          </div>
                          <div style={{ fontSize: "11px", color: textSub, marginBottom: 2 }}>
                            {thread.property || ""}{thread.property ? " · " : ""}{ch}
                          </div>
                          <div style={{ fontSize: "11.5px", color: fromGuest ? (dark ? "#e07c2a" : "#b85c00") : (noThread ? (dark ? "#4d8a6a" : "#9ab8a9") : textSub), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {fromGuest && <span style={{ marginRight: 3 }}>⚠</span>}
                            {noThread
                              ? <span style={{ fontStyle: "italic" }}>No messages yet — send the first message</span>
                              : (preview || "No preview")}
                          </div>
                        </div>

                        {/* Unread dot — only for threads with actual unread messages from guest */}
                        {fromGuest && !noThread && (
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#e07c2a", flexShrink: 0 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL — Conversation ── */}
        <div style={{
          flex: 1,
          display: isMobile && !showThread ? "none" : "flex",
          flexDirection: "column", overflow: "hidden", background: bg,
          width: isMobile ? "100%" : undefined,
        }}>
          {!selected ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, color: textSub }}>
              <div style={{ fontSize: "32px" }}>✉</div>
              <div style={{ fontSize: "14px" }}>Select a conversation</div>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div style={{
                padding: isMobile ? "10px 14px" : "14px 24px",
                borderBottom: `1px solid ${border}`,
                background: panelBg,
                display: "flex", alignItems: "center", gap: "14px", flexShrink: 0,
              }}>
                {isMobile && (
                  <button
                    onClick={() => setShowThread(false)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#26a676", display: "flex", alignItems: "center",
                      gap: 4, padding: 0, fontWeight: 700, fontSize: "13px", flexShrink: 0,
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                )}
                <Avatar name={selected.guestName} size={38} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: "15px", color: textMain }}>
                    {selected.guestName || "Guest"}
                  </div>
                  <div style={{ fontSize: "12px", color: textSub, display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <ChannelBadge channel={selected.channel || "Direct"} size={16} />
                    <span>{selected.property || ""}{selected.property ? " · " : ""}{selected.channel || "Direct"}</span>
                  </div>
                </div>
                <div style={{
                  padding: "4px 12px", borderRadius: 100, fontSize: "11px", fontWeight: 700,
                  background: selected.hasThread === false
                    ? (dark ? "#1a2e20" : "#f0faf5")
                    : selected.latestMessage?.fromGuest ? "#fff4e8" : "#e8f7f0",
                  color: selected.hasThread === false
                    ? (dark ? "#4d8a6a" : "#7a9e8c")
                    : selected.latestMessage?.fromGuest ? "#e07c2a" : "#26a676",
                }}>
                  {selected.hasThread === false
                    ? "💬 No messages yet"
                    : selected.latestMessage?.fromGuest ? "⚠ Awaiting reply" : "↳ Replied"}
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "14px 12px" : "24px 28px", scrollbarWidth: "none", msOverflowStyle: "none" }}
                className="scrollbar-none">
                {loadingMsgs && <LoadingDots />}
                {msgError && !loadingMsgs && (
                  <div style={{ textAlign: "center", color: "#e84545", fontSize: "13px", paddingTop: 40 }}>
                    ⚠ {msgError}
                  </div>
                )}
                {!loadingMsgs && !msgError && messages.length === 0 && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", paddingTop: 60, paddingBottom: 40 }}>
                    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="36" cy="36" r="34" fill={dark ? "#1a2e20" : "#edf7f2"} />
                      <path d="M20 26C20 24.3431 21.3431 23 23 23H49C50.6569 23 52 24.3431 52 26V42C52 43.6569 50.6569 45 49 45H39.5L33 51V45H23C21.3431 45 20 43.6569 20 42V26Z" fill={dark ? "#26a676" : "#26a676"} opacity="0.18"/>
                      <path d="M22 26C22 25.4477 22.4477 25 23 25H49C49.5523 25 50 25.4477 50 26V42C50 42.5523 49.5523 43 49 43H38.5L33 48V43H23C22.4477 43 22 42.5523 22 42V26Z" fill={dark ? "#26a676" : "#26a676"} opacity="0.55"/>
                      <circle cx="30" cy="34" r="2.2" fill="white" opacity="0.9"/>
                      <circle cx="36" cy="34" r="2.2" fill="white" opacity="0.9"/>
                      <circle cx="42" cy="34" r="2.2" fill="white" opacity="0.9"/>
                    </svg>
                    <div style={{ fontWeight: 700, color: textMain, marginTop: 18, marginBottom: 6, fontSize: "15px", letterSpacing: "-0.01em" }}>
                      No messages yet
                    </div>
                    <div style={{ fontSize: "12.5px", color: textSub, textAlign: "center", lineHeight: 1.75, maxWidth: 270 }}>
                      {selected.guestName || "This guest"} hasn't sent a message yet.<br />
                      You can send the first message below.
                    </div>
                  </div>
                )}
                {!loadingMsgs && !msgError && messages.map((m, i) => (
                  <MessageBubble key={i} msg={m} dark={dark} />
                ))}
                <div ref={msgEndRef} />
              </div>

              {/* Reply box */}
              <div style={{
                padding: isMobile ? "10px 12px" : "14px 24px",
                paddingBottom: isMobile ? "max(12px, env(safe-area-inset-bottom, 12px))" : "14px",
                borderTop: `1px solid ${border}`,
                background: panelBg,
                flexShrink: 0,
              }}>
                {staffUnlocked ? (
                  <>
                    <textarea
                      rows={3}
                      placeholder="Write a reply…"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend(); }}
                      style={{
                        width: "100%", borderRadius: "10px",
                        border: `1px solid ${border}`,
                        background: inputBg, color: textMain,
                        padding: "10px 14px", fontSize: "13.5px",
                        resize: "none", outline: "none",
                        boxSizing: "border-box", lineHeight: 1.6,
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: "11px", color: textSub }}>Ctrl+Enter to send</span>
                        {/* Lock button only shown for non-staff client users who unlocked via PIN */}
                        {!isStaffUser && (
                          <button onClick={() => setStaffUnlocked(false)} style={{
                            fontSize: "11px", color: "#e84545", background: "none",
                            border: "none", cursor: "pointer", fontWeight: 600,
                          }}>
                            <i className="ti ti-lock" style={{ fontSize: "11px", marginRight: 3 }} />
                            Lock
                          </button>
                        )}
                      </div>
                      <button
                        onClick={handleSend}
                        disabled={sending || !replyText.trim()}
                        style={{
                          padding: "8px 20px", borderRadius: "8px",
                          background: sending || !replyText.trim() ? (dark ? "#1e3a2a" : "#e4ede8") : "#26a676",
                          color: sending || !replyText.trim() ? textSub : "#fff",
                          border: "none", cursor: sending || !replyText.trim() ? "default" : "pointer",
                          fontSize: "13px", fontWeight: 700, transition: "all .15s",
                          display: "flex", alignItems: "center", gap: 7,
                        }}
                      >
                        {sending ? "Sending…" : (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                            Send Reply
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{
                    padding: "12px 16px", borderRadius: "10px",
                    border: `1px solid ${border}`,
                    background: inputBg,
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "8px", flexShrink: 0,
                      background: dark ? "#1e3a2a" : "#e4ede8",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke={textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: textMain }}>
                        Staff access required
                      </div>
                      <div style={{ fontSize: "11px", color: textSub, marginTop: 1 }}>
                        Only staff accounts can reply to guests
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* PIN Modal */}
              {pinModalOpen && (
                <div
                  onClick={(e) => { if (e.target === e.currentTarget) { setPinModalOpen(false); setPinInput(""); setPinError(false); } }}
                  style={{
                    position: "fixed", inset: 0, zIndex: 9999,
                    background: "rgba(8,20,14,0.6)", backdropFilter: "blur(6px)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <div style={{
                    background: panelBg, borderRadius: "16px",
                    padding: "32px 28px", width: "320px",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
                    border: `1px solid ${border}`,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
                  }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: "50%",
                      background: dark ? "#1a3528" : "#eaf8f1",
                      border: `1.5px solid ${dark ? "#1e3a2a" : "#b7e4cf"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <i className="ti ti-lock" style={{ fontSize: "22px", color: "#26a676" }} />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontWeight: 800, fontSize: "15px", color: textMain, marginBottom: 4 }}>
                        Staff Access Required
                      </div>
                      <div style={{ fontSize: "12px", color: textSub }}>
                        Enter your staff PIN to unlock replies
                      </div>
                    </div>

                    <input
                      type="password"
                      placeholder="Enter PIN"
                      value={pinInput}
                      onChange={(e) => { setPinInput(e.target.value); setPinError(false); }}
                      onKeyDown={(e) => { if (e.key === "Enter") handlePinSubmit(); }}
                      autoFocus
                      maxLength={8}
                      style={{
                        width: "100%", padding: "10px 14px",
                        borderRadius: "8px", textAlign: "center",
                        border: `1px solid ${pinError ? "#e84545" : border}`,
                        background: inputBg, color: textMain,
                        fontSize: "20px", letterSpacing: "6px",
                        outline: "none", boxSizing: "border-box",
                      }}
                    />

                    {pinError && (
                      <div style={{ fontSize: "12px", color: "#e84545", fontWeight: 600 }}>
                        Incorrect PIN — try again
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10, width: "100%" }}>
                      <button
                        onClick={() => { setPinModalOpen(false); setPinInput(""); setPinError(false); }}
                        style={{
                          flex: 1, padding: "9px", borderRadius: "8px",
                          border: `1px solid ${border}`, background: "transparent",
                          color: textSub, cursor: "pointer", fontSize: "13px", fontWeight: 600,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePinSubmit}
                        disabled={isVerifyingPin}
                        style={{
                          flex: 1, padding: "9px", borderRadius: "8px",
                          border: "none", background: "#26a676",
                          color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 700,
                        }}
                      >
                        Unlock
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}