import { toYMD, dayDiff, fmtMoney } from "../../utils/dateHelpers";
import React, { useEffect, useRef, useState } from "react";
import {
  getChannelPillClass,
  getChannelColor,
  getChannelInitial,
} from "../utils/channelHelpers";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildDateRange(baseDate, monthsCount) {
  const dates = [];
  const start = new Date(baseDate);
  const end = new Date(baseDate);
  end.setMonth(end.getMonth() + monthsCount);
  const cur = new Date(start);
  while (cur < end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function ChannelBadge({ channel }) {
  const color = getChannelColor(channel);
  const initial = getChannelInitial(channel);
  return (
    <span className="cal-pill-ic" style={{ background: color }}>
      {initial}
    </span>
  );
}

function PropertyRow({ prop, allBookings, dateRange, ymdRange, todayISO }) {
  const rangeStartYMD = ymdRange[0];
  const rangeEndYMD = ymdRange[ymdRange.length - 1];
  const propBookings = allBookings.filter((b) => {
    if (!b.apartment || b.apartment.id !== prop.id) return false;
    if (!b["guest-name"] && b["is-blocked-booking"]) return false;
    const arrYMD = toYMD(b.arrival);
    const depYMD = toYMD(b.departure);
    return arrYMD <= rangeEndYMD && depYMD > rangeStartYMD;
  });

  propBookings.sort((a, b) => {
    const aArr =
      toYMD(a.arrival) < rangeStartYMD ? rangeStartYMD : toYMD(a.arrival);
    const bArr =
      toYMD(b.arrival) < rangeStartYMD ? rangeStartYMD : toYMD(b.arrival);
    return aArr < bArr ? -1 : aArr > bArr ? 1 : 0;
  });

  const ymdToIdx = {};
  ymdRange.forEach((ymd, i) => {
    ymdToIdx[ymd] = i;
  });

  const cellMap = {};
  propBookings.forEach((booking) => {
    const arrYMD = toYMD(booking.arrival);
    const depYMD = toYMD(booking.departure);
    const startIdx =
      arrYMD < rangeStartYMD
        ? 0
        : ymdToIdx[arrYMD] !== undefined
          ? ymdToIdx[arrYMD]
          : -1;
    if (startIdx < 0) return;
    const daysFromStart = dayDiff(ymdRange[startIdx], depYMD);
    const renderSpan = Math.max(
      1,
      Math.min(daysFromStart, ymdRange.length - startIdx),
    );
    cellMap[startIdx] = { booking, renderSpan };
  });

  let skipUntil = -1;
  const cells = ymdRange.map((dayStr, idx) => {
    const day = dateRange[idx];
    const isToday = dayStr === todayISO;
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const isMonthStart = day.getDate() === 1;
    const tdClass = [
      isToday ? "today-col" : "",
      isWeekend ? "weekend-col" : "",
      isMonthStart ? "month-start" : "",
    ]
      .filter(Boolean)
      .join(" ");

    if (idx <= skipUntil) {
      return <td key={dayStr} className={tdClass || undefined} />;
    }

    const entry = cellMap[idx];
    if (entry) {
      const { booking, renderSpan } = entry;
      skipUntil = idx + renderSpan - 1;
      const channel = (booking.channel && booking.channel.name) || "Direct";
      const guests = (booking.adults || 0) + (booking.children || 0);
      const pillClass = getChannelPillClass(channel);

      return (
        <td key={dayStr} className={tdClass || undefined}>
          <div
            className={`cal-pill ${pillClass}`}
            style={{ width: `calc(${renderSpan * 100}% - 6px)`, left: 3 }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              if (el._ttPinned) return;
              if (!el._ttEl) {
                const tt = document.createElement("div");
                tt.className = "cal-tt";
                const g = (booking.adults || 0) + (booking.children || 0) || 1;
                const nights = Math.round(
                  (new Date(booking.departure) - new Date(booking.arrival)) /
                    86400000,
                );

                const fmt = (d) =>
                  new Date(d).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });

                tt.innerHTML = `
                  <div class="cal-tt-top">
                    <span class="cal-tt-name">${booking["guest-name"] || "Guest"}</span>
                    <span class="cal-tt-chip">${channel}</span>
                  </div>
                  <div class="cal-tt-dates">
                    <div><div class="cal-tt-dl">Check-in</div><div class="cal-tt-dv">${fmt(booking.arrival)}</div></div>
                    <div><div class="cal-tt-dl">Check-out</div><div class="cal-tt-dv">${fmt(booking.departure)}</div></div>
                  </div>
                  <div class="cal-tt-row"><span class="cal-tt-rl">Guests</span><span class="cal-tt-rv">${g} - ${nights} nights</span></div>
                  <div class="cal-tt-row cal-tt-last"><span class="cal-tt-rl">Total</span><span class="cal-tt-rv cal-tt-price">${fmtMoney(booking.price)}</span></div>
                `;
                document.body.appendChild(tt);
                el._ttEl = tt;
              }
              const rect = el.getBoundingClientRect();
              el._ttEl.style.top = `${rect.bottom + window.scrollY + 6}px`;
              el._ttEl.style.left = `${rect.left + window.scrollX}px`;
              el._ttEl.style.display = "block";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              if (el._ttPinned) return;
              if (el._ttEl) el._ttEl.style.display = "none";
            }}
            onClick={(e) => {
              const el = e.currentTarget;

              document.querySelectorAll(".cal-tt").forEach((tt) => {
                if (tt !== el._ttEl) {
                  tt.style.display = "none";
                  tt._pinned = false;
                }
              });

              document.querySelectorAll("[data-tt-pinned]").forEach((pill) => {
                if (pill !== el) pill.removeAttribute("data-tt-pinned");
              });

              const wasOpen = el.hasAttribute("data-tt-pinned");
              if (wasOpen) {
                el.removeAttribute("data-tt-pinned");
                if (el._ttEl) el._ttEl.style.display = "none";
              } else {
                el.setAttribute("data-tt-pinned", "1");
                el._ttPinned = true;
                if (el._ttEl) {
                  const rect = el.getBoundingClientRect();
                  el._ttEl.style.top = `${rect.bottom + window.scrollY + 6}px`;
                  el._ttEl.style.left = `${rect.left + window.scrollX}px`;
                  el._ttEl.style.display = "block";
                }
              }
            }}
          >
            <ChannelBadge channel={channel} />
            <span className="pill-text">
              {booking["guest-name"] || "Guest"}
            </span>
            <span className="pill-meta">
              {guests || 1} - {fmtMoney(booking.price)}
            </span>
          </div>
        </td>
      );
    }

    return <td key={dayStr} className={tdClass || undefined} />;
  });

  return (
    <tr>
      {cells}
    </tr>
  );
}

export default function CalendarGrid({
  properties = [],
  bookings = [],
  calBaseDate,
  calMonthsCount,
  view = "multi",
  channels = [],
  shouldScrollToToday,
  onScrollToTodayConsumed,
  onLoadMore,
}) {
  const scrollRef = useRef(null);
  const filterPopRef = useRef(null);
  const todayISO = toYMD(new Date());

  const [selectedProps, setSelectedProps] = useState([]);
  const [showPropFilter, setShowPropFilter] = useState(false);

  useEffect(() => {
    function handler(e) {
      if (filterPopRef.current && !filterPopRef.current.contains(e.target)) {
        setShowPropFilter(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggleProp(propId) {
    setSelectedProps((prev) =>
      prev.includes(propId)
        ? prev.filter((id) => id !== propId)
        : [...prev, propId],
    );
  }

  function clearProps() {
    setSelectedProps([]);
    setShowPropFilter(false);
  }

  const dateRange = buildDateRange(calBaseDate, calMonthsCount);
  const ymdRange = dateRange.map(toYMD);

  const filteredBookings =
    channels.length > 0
      ? bookings.filter((b) => {
          const ch = (b.channel && b.channel.name) || "Direct";
          return channels.includes(ch);
        })
      : bookings;

  let displayedProps = view === "single" ? properties.slice(0, 1) : properties;
  if (selectedProps.length > 0) {
    displayedProps = displayedProps.filter((p) => selectedProps.includes(p.id));
  }

  const monthGroups = [];
  let currentMonth = null;
  let monthStart = 0;

  dateRange.forEach((d, i) => {
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (key !== currentMonth) {
      if (currentMonth !== null) {
        monthGroups[monthGroups.length - 1].span = i - monthStart;
      }
      currentMonth = key;
      monthStart = i;
      monthGroups.push({
        label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        span: 0,
        startIdx: i,
      });
    }
  });

  if (monthGroups.length) {
    monthGroups[monthGroups.length - 1].span =
      dateRange.length - monthGroups[monthGroups.length - 1].startIdx;
  }

  useEffect(() => {
    if (!shouldScrollToToday || !scrollRef.current) return;

    const todayCell = scrollRef.current.querySelector("th.today");
    if (!todayCell) {
      scrollRef.current.scrollLeft = 0;
    } else {
      const stickyWidth = 200;
      const visibleWidth = scrollRef.current.clientWidth - stickyWidth;
      scrollRef.current.scrollLeft = Math.max(
        0,
        todayCell.offsetLeft - stickyWidth - visibleWidth / 2 + 32,
      );
    }

    onScrollToTodayConsumed?.();
  }, [shouldScrollToToday, onScrollToTodayConsumed]);

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "cal-tt-styles";
    if (!document.getElementById("cal-tt-styles")) {
      style.textContent = `
        .cal-tt {
          display: none;
          position: fixed;
          z-index: 9999;
          background: #fff;
          border: 0.5px solid #e5e7eb;
          border-radius: 10px;
          min-width: 220px;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.10);
        }
        .cal-tt-top { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 0.5px solid #e5e7eb; }
        .cal-tt-name { font-size: 14px; font-weight: 600; color: #0c1c14; }
        .cal-tt-chip { background: #E1F5EE; color: #0F6E56; font-size: 11px; font-weight: 500; padding: 4px 12px; border-radius: 100px; }
        .cal-tt-dates { display: flex; border-bottom: 0.5px solid #e5e7eb; }
        .cal-tt-dates > div { flex: 1; padding: 14px 16px; }
        .cal-tt-dates > div + div { border-left: 0.5px solid #e5e7eb; }
        .cal-tt-dl { font-size: 10px; font-weight: 600; color: #9ab8a9; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 5px; }
        .cal-tt-dv { font-size: 14px; font-weight: 600; color: #0c1c14; }
        .cal-tt-row { display: flex; justify-content: space-between; padding: 12px 16px; border-bottom: 0.5px solid #e5e7eb; font-size: 13px; }
        .cal-tt-last { border-bottom: none; }
        .cal-tt-rl { color: #9ab8a9; }
        .cal-tt-rv { font-weight: 500; color: #0c1c14; }
        .cal-tt-price { color: #0F6E56 !important; }
      `;
      document.head.appendChild(style);
    }

    return () => {
      const el = document.getElementById("cal-tt-styles");
      if (el) el.remove();
    };
  }, []);

  return (
  <div style={{ display: "flex", width: "100%", overflow: "visible", borderTop: "1px solid #e3ede8", borderRadius: "0 0 14px 14px" }}>
      <style>{`
          /* ── Tooltip ── */
          .cal-tt {
            display: none; position: fixed; z-index: 9999;
            background: #fff; border: 0.5px solid #e5e7eb; border-radius: 10px;
            min-width: 220px; font-family: 'DM Sans', sans-serif;
            overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.10);
          }
          .cal-tt-top { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 0.5px solid #e5e7eb; }
          .cal-tt-name { font-size: 13px; font-weight: 600; color: #0c1c14; }
          .cal-tt-chip { background: #E1F5EE; color: #0F6E56; font-size: 11px; font-weight: 500; padding: 3px 10px; border-radius: 100px; }
          .cal-tt-dates { display: flex; border-bottom: 0.5px solid #e5e7eb; }
          .cal-tt-dates > div { flex: 1; padding: 9px 14px; }
          .cal-tt-dates > div + div { border-left: 0.5px solid #e5e7eb; }
          .cal-tt-dl { font-size: 10px; font-weight: 600; color: #9ab8a9; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 3px; }
          .cal-tt-dv { font-size: 13px; font-weight: 600; color: #0c1c14; }
          .cal-tt-row { display: flex; justify-content: space-between; padding: 8px 14px; border-bottom: 0.5px solid #e5e7eb; font-size: 12px; }
          .cal-tt-last { border-bottom: none; }
          .cal-tt-rl { color: #9ab8a9; }
          .cal-tt-rv { font-weight: 500; color: #0c1c14; }
          .cal-tt-price { color: #0F6E56 !important; }

          /* ── Toolbar ── */
          .cal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px 14px; }
          .cal-title { font-family: 'Sora', sans-serif; font-size: 1rem; font-weight: 800; color: #0c1c14; }
          .cal-controls { display: flex; gap: 8px; align-items: center; }
          .cal-btn { background: #fff; border: 1px solid #e3ede8; padding: 6px 12px; border-radius: 100px; font-size: .75rem; font-weight: 600; color: #0c1c14; cursor: pointer; display: flex; align-items: center; gap: 5px; white-space: nowrap; }
          .cal-btn-group { background: #f0f5f2; border-radius: 100px; padding: 3px; display: flex; }
          .cal-btn-group button { background: transparent; border: none; padding: 5px 12px; border-radius: 100px; font-size: .75rem; font-weight: 700; color: #6a8b7c; cursor: pointer; font-family: 'DM Sans', sans-serif; }
          .cal-btn-group button.active { background: #26a676; color: #fff; }

          /* ── Nav bar ── */
          .cal-nav { display: flex; flex-direction: row; align-items: center; gap: 10px; padding: 14px 24px; border-bottom: 1px solid #f0f5f2; background: #fff; flex-wrap: nowrap; white-space: nowrap; }
          .cal-nav > * { flex-shrink: 0; }
          .cal-nav-btn { width: 30px; height: 30px; border: 1px solid #e3ede8; border-radius: 50%; background: #fff; color: #6a8b7c; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .15s; }
          .cal-nav-btn:hover { background: #eaf8f1; color: #1e8760; border-color: #b7e4cf; }
          .cal-nav-label { font-family: 'Sora', sans-serif; font-size: 1rem; font-weight: 800; color: #0c1c14; padding: 0 6px; flex: 1; }
          .cal-nav-today { padding: 6px 14px; border: 1px solid #b7e4cf; background: #eaf8f1; color: #1e8760; border-radius: 100px; font-family: 'DM Sans', sans-serif; font-size: .75rem; font-weight: 700; cursor: pointer; margin-left: auto; }
          .cal-nav-today:hover { background: #d4f0e4; }

          /* ── Scroll container ── */
          .cal-scroll { overflow-x: auto; overflow-y: visible; width: 100%; border-top: 1px solid #e3ede8; scroll-behavior: smooth; position: relative; border-radius: 0 0 14px 14px; }
          .cal-scroll::-webkit-scrollbar { height: 8px; }
          .cal-scroll::-webkit-scrollbar-track { background: #f4f7f5; border-radius: 6px; margin: 0 4px; }
          .cal-scroll::-webkit-scrollbar-thumb { background: #b7e4cf; border-radius: 6px; border: 2px solid #f4f7f5; }
          .cal-scroll::-webkit-scrollbar-thumb:hover { background: #56c299; }
          .cal-scroll-inner { display: block; min-height: 500px; }

          /* ── Table ── */
          .cal-table { width: max-content; min-width: 100%; border-collapse: collapse; }
          .cal-table th { padding: 10px 6px; border-right: 1px solid #f0f5f2; border-bottom: 1px solid #e3ede8; font-size: .72rem; font-weight: 600; color: #9ab8a9; text-align: center; }
          .cal-table td { min-width: 56px; max-width: 56px; width: 56px; height: 48px; border-right: 1px solid #eef2f0; border-bottom: 1px solid #eef2f0; position: relative; padding: 0; background: #fff; }
          .cal-table td.today-col { background: #f0faf4; }
          .cal-table td.weekend-col { background: #fcfafa; }
          .cal-table td.month-start { border-left: 2px solid #b7e4cf; }
          .cal-table tbody tr:hover td { background: #fafcfb; }
          .cal-table tbody tr:hover td.today-col { background: #e8f5ee; }

          /* ── Month label ── */
          .cal-month-label { text-align: left !important; padding: 8px 14px !important; font-family: 'Sora', sans-serif; font-size: .8rem; font-weight: 800; color: #1a3028; background: #f5f9f7; border-bottom: 1px solid #e3ede8; border-right: 1px solid #dde8e3; white-space: nowrap; position: relative; }

          /* ── Day header row ── */
          .cal-day-row th { min-width: 56px; max-width: 56px; width: 56px; text-align: center; padding: 6px 4px; background: #f7faf8; border-bottom: 1px solid #e3ede8; border-right: 1px solid #eef2f0; font-size: .6rem; font-weight: 700; color: #7aab95; text-transform: uppercase; letter-spacing: .4px; }
          .cal-day-row th .day-num { display: block; margin-top: 1px; font-size: .85rem; font-weight: 800; color: #0c1c14; }
          .cal-day-row th.weekend { color: #ec4899; }
          .cal-day-row th.weekend .day-num { color: #ec4899; }
          .cal-day-row th.today { background: #e8f5ee; }
          .cal-day-row th.today .day-num { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #1e8760; color: #fff; border-radius: 50%; margin-top: 1px; font-size: .8rem; }
          .cal-day-row th.month-start { border-left: 2px solid #b7e4cf; }

          /* ── Sticky property column ── */
          .cal-prop-col { position: sticky; left: 0; z-index: 20; text-align: left; width: 200px; min-width: 200px; max-width: 200px; padding: 0; font-size: .78rem; font-weight: 600; color: #e8f5ee; border-right: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em; background: #0f2d1f; }
          .cal-month-row .cal-prop-col { background: #0a1f15; z-index: 21; font-size: .62rem; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #4d9e7a; padding: 8px 16px 8px 20px; border-bottom: 1px solid #1a3d28; border-right: 3px solid #1e8760; }
          .cal-day-row .cal-prop-col { background: #0d2619; z-index: 21; overflow: visible; border-bottom: 1px solid #1a3d28; border-right: 3px solid #1e8760; }
          .cal-table tbody .cal-prop-col { background: #0f2d1f; z-index: 20; border-right: 3px solid #1e8760; border-bottom: 1px solid #1a3d28; }
          .cal-table tbody tr:hover .cal-prop-col { background: #163d28; }

          /* ── Pills ── */
          .cal-pill { position: absolute; top: 50%; transform: translateY(-50%); height: 26px; display: flex; align-items: center; gap: 4px; padding: 0 8px 0 3px; border-radius: 100px; font-size: 10.5px; font-weight: 500; white-space: nowrap; overflow: hidden; cursor: pointer; z-index: 3; box-shadow: 0 1px 3px rgba(0,0,0,.06); transition: transform .15s, box-shadow .15s; }
          .cal-pill:hover { transform: translateY(-50%) scale(1.04); box-shadow: 0 4px 14px rgba(0,0,0,.12); z-index: 20; }
          .cal-pill-direct  { background: #d1fae5; border: 0.5px solid #6ee7b7; color: #065f46; }
          .cal-pill-website { background: #f1f5f9; border: 0.5px solid #cbd5e1; color: #334155; }
          .cal-pill-airbnb  { background: #fce7f3; border: 0.5px solid #f9a8d4; color: #9d174d; }
          .cal-pill-booking { background: #dbeafe; border: 0.5px solid #93c5fd; color: #1e40af; }
          .cal-pill-vrbo    { background: #ede9fe; border: 0.5px solid #c4b5fd; color: #5b21b6; }
          .cal-pill-agoda   { background: #f8fafc; border: 0.5px solid #e2e8f0; color: #1e293b; }
          .cal-pill-default { background: #f0fdf4; border: 0.5px solid #86efac; color: #166534; }
          .cal-pill-green   { background: #eaf8f1; border: 0.5px solid #b7e4cf; color: #1a6b44; }
          .cal-pill-red     { background: #fff0ee; border: 0.5px solid #ffd5ce; color: #a03020; }
          .cal-pill-ic { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; color: #fff; flex-shrink: 0; }
          .pill-text { overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
          .pill-meta { opacity: .55; font-size: 9.5px; flex-shrink: 0; margin-left: 1px; }
        `}</style>

      {/* FIXED SIDEBAR */}
      <div style={{ width: 240, minWidth: 240, background: "#eaf5ee", flexShrink: 0, borderRight: "1px solid #c8e6d6", overflow: "visible", display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#d6ede0", height: 36, display: "flex", alignItems: "center", padding: "0 16px 0 20px", borderBottom: "1px solid #e3ede8", fontSize: ".62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", color: "#5a8a70", flexShrink: 0 }}>
          Properties
        </div>
        <div style={{ background: "#eaf5ee", height: 44, display: "flex", alignItems: "center", padding: "0 8px", borderBottom: "1px solid #c8e6d6", flexShrink: 0, position: "relative", zIndex: 30, overflow: "visible" }} ref={filterPopRef}>
          <button
            className="cal-btn"
            onClick={() => setShowPropFilter((v) => !v)}
            style={{ width: "100%", justifyContent: "space-between", padding: "7px 12px", fontSize: ".72rem", borderRadius: 8, background: selectedProps.length > 0 ? "#e6f4ed" : "#fff", borderColor: selectedProps.length > 0 ? "#26a676" : "#d4e8dc", color: selectedProps.length > 0 ? "#1a6b44" : "#4a7a60" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              {selectedProps.length > 0 ? `${selectedProps.length} Selected` : "All Properties"}
            </div>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showPropFilter && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, width: 230, background: "#fff", borderRadius: 12, border: "1px solid #e3ede8", boxShadow: "0 8px 24px rgba(0,0,0,0.10)", zIndex: 999, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid #f0f5f2", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: ".7rem", fontWeight: 700, color: "#5a8a70", letterSpacing: ".5px", textTransform: "uppercase" }}>Properties</span>
                {selectedProps.length > 0 && (
                  <button onClick={clearProps} style={{ fontSize: ".68rem", fontWeight: 600, color: "#26a676", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Clear all</button>
                )}
              </div>
              <div style={{ maxHeight: 260, overflowY: "auto", padding: "6px 8px" }}>
                {properties.length === 0 ? (
                  <div style={{ padding: "14px", fontSize: ".8rem", color: "#9ab8a9", textAlign: "center", fontStyle: "italic" }}>No properties found</div>
                ) : (
                  properties.map((p) => (
                    <label key={p.id} onClick={() => toggleProp(p.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", cursor: "pointer", borderRadius: 8, fontSize: ".8rem", color: selectedProps.includes(p.id) ? "#1a6b44" : "#2a4e3c", fontWeight: selectedProps.includes(p.id) ? 700 : 500, background: selectedProps.includes(p.id) ? "#eaf8f1" : "transparent" }}>
                      <div style={{ width: 16, height: 16, borderRadius: 5, flexShrink: 0, border: selectedProps.includes(p.id) ? "2px solid #26a676" : "2px solid #cde0d6", background: selectedProps.includes(p.id) ? "#26a676" : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {selectedProps.includes(p.id) && (
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      {p.name}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        {displayedProps.map((prop) => (
          <div key={prop.id} style={{ height: 48, display: "flex", alignItems: "center", padding: "0 16px 0 20px", gap: 8, borderBottom: "1px solid #d6ede0", background: "#eaf5ee" }}
            onMouseEnter={e => e.currentTarget.style.background = "#d4ecde"}
            onMouseLeave={e => e.currentTarget.style.background = "#eaf5ee"}
          >
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#26a676", flexShrink: 0, opacity: 0.7 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, fontSize: ".78rem", fontWeight: 600, color: "#1a3d28", letterSpacing: "-0.01em" }}>
              {prop.name}
            </span>
          </div>
        ))}
      </div>

      {/* SCROLLABLE CALENDAR */}
      <div className="cal-scroll" ref={scrollRef} style={{ flex: 1, borderTop: "none", borderRadius: 0 }}>
      <div className="cal-scroll-inner">
        <table className="cal-table">
          <thead>
            <tr className="cal-month-row">
              {monthGroups.map((mg) => (
                <th
                  key={mg.label}
                  colSpan={mg.span}
                  className="cal-month-label"
                >
                  {mg.label}
                </th>
              ))}
            </tr>

            <tr className="cal-day-row">
              {dateRange.map((d, i) => {
                const ymd = ymdRange[i];
                const isToday = ymd === todayISO;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const isMonthStart = d.getDate() === 1;
                const cls = [
                  isToday ? "today" : "",
                  isWeekend ? "weekend" : "",
                  isMonthStart ? "month-start" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <th key={ymd} className={cls || undefined}>
                    {DAYS[d.getDay()]}
                    <span className="day-num">{d.getDate()}</span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {displayedProps.map((prop) => (
              <PropertyRow
                key={prop.id}
                prop={prop}
                allBookings={filteredBookings}
                dateRange={dateRange}
                ymdRange={ymdRange}
                todayISO={todayISO}
              />
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}