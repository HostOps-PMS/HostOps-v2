import { toYMD, dayDiff, fmtMoney } from "../../utils/dateHelpers";
import React, { useEffect, useRef, useState } from "react";
import { useDashboard } from "../context/DashboardContext";
import {
  getChannelPillClass,
  getChannelColor,
  getChannelInitial,
  getChannelLogo,
  getBookingColor,
} from "../utils/channelHelpers";
import DOMPurify from "dompurify";

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
  const logo = getChannelLogo(channel);
  return (
    <span className="cal-pill-ic" style={{ background: logo ? '#fff' : color, border: logo ? '0.5px solid #e3ede8' : 'none' }}>
      {logo ? (
        <img
          src={logo}
          alt={channel}
          style={{ width: 13, height: 13, objectFit: 'contain', borderRadius: 2, display: 'block' }}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentNode.style.background = color;
            e.target.parentNode.style.border = 'none';
            e.target.parentNode.textContent = initial;
          }}
        />
      ) : initial}
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

                tt.innerHTML = DOMPurify.sanitize(`
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
                `);
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

function SingleCalendarView({ prop, allBookings, dark }) {
  const today = new Date();
  const todayISO = toYMD(today);
  const year = today.getFullYear();
  const month = today.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();

  // Monday-start grid
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // convert to Mon=0

  const propBookings = allBookings.filter((b) => {
    if (!b.apartment) return false;
    if (String(b.apartment.id) !== String(prop.id)) return false;
    if (!b['guest-name'] && b['is-blocked-booking']) return false;
    return true;
  });

  // Build a map: dateISO -> booking
  const bookedMap = {};
  [...propBookings].sort((a, b) =>
    (new Date(b.departure) - new Date(b.arrival)) - (new Date(a.departure) - new Date(a.arrival))
  ).forEach((b) => {
    const arr = new Date(b.arrival);
    const dep = new Date(b.departure);
    for (let d = new Date(arr); d < dep; d.setDate(d.getDate() + 1)) {
      const iso = toYMD(d);
      if (!bookedMap[iso]) bookedMap[iso] = b;
    }
  });

  // Stats
  const monthStart = toYMD(new Date(year, month, 1));
  const monthEnd = toYMD(new Date(year, month + 1, 0));
  const monthBookings = propBookings.filter((b) => {
    return toYMD(b.arrival) <= monthEnd && toYMD(b.departure) > monthStart;
  });
  const bookedNights = Object.keys(bookedMap).filter(
    (d) => d >= monthStart && d <= monthEnd
  ).length;
  const occupancy = Math.round((bookedNights / totalDays) * 100);
  const revenue = monthBookings.reduce((s, b) => s + (b.price || 0), 0);

  const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  const cells = [];
  // leading empty cells
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  // trailing empty cells
  while (cells.length % 7 !== 0) cells.push(null);

  // Build booking bar segments — track which day starts a bar
  const barStarts = {};
  propBookings.forEach((b) => {
    const arrISO = toYMD(new Date(b.arrival));
    const effectiveStart = arrISO < monthStart ? monthStart : arrISO;
    const depISO = toYMD(new Date(b.departure));
    let span = 0;
    let cur = new Date(effectiveStart);
    while (toYMD(cur) < depISO && toYMD(cur) <= monthEnd) {
      span++;
      cur.setDate(cur.getDate() + 1);
    }
    barStarts[effectiveStart] = { booking: b, span };
  });

  const cardBg = dark ? '#0f2d1f' : '#fff';
  const borderCol = dark ? '#1e3a2a' : '#e3ede8';
  const textPrimary = dark ? '#eaf5f0' : '#0c1c14';
  const textSecondary = dark ? '#7aab95' : '#9ab8a9';
  const surfaceBg = dark ? '#0a1f15' : '#f5f9f7';
  const cellBg = dark ? '#0d2619' : '#fff';
  const cellBorder = dark ? '#1a3d28' : '#eef2f0';
  const weekendBg = dark ? '#0c2416' : '#fdf8f8';
  const todayBg = dark ? '#1a4a2e' : '#f0faf4';

const [viewYear, setViewYear] = useState(year);
const [viewMonth, setViewMonth] = useState(month);
const [showBookings, setShowBookings] = useState(false);

  const MONTHS_FULL_NAV = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const navFirstDay = new Date(viewYear, viewMonth, 1);
  const navLastDay = new Date(viewYear, viewMonth + 1, 0);
  const navTotalDays = navLastDay.getDate();
  let navStartDow = navFirstDay.getDay();
  navStartDow = navStartDow === 0 ? 6 : navStartDow - 1;
  const navMonthStart = toYMD(new Date(viewYear, viewMonth, 1));
  const navMonthEnd = toYMD(new Date(viewYear, viewMonth + 1, 0));
  const navCells = [];
  for (let i = 0; i < navStartDow; i++) navCells.push(null);
  for (let d = 1; d <= navTotalDays; d++) navCells.push(d);
  while (navCells.length % 7 !== 0) navCells.push(null);
  const navBookedMap = {};
  // Sort longer bookings first so they don't get overwritten by shorter ones
  [...propBookings].sort((a, b) =>
    (new Date(b.departure) - new Date(b.arrival)) - (new Date(a.departure) - new Date(a.arrival))
  ).forEach((b) => {
    const arr = new Date(b.arrival);
    const dep = new Date(b.departure);
    for (let d = new Date(arr); d < dep; d.setDate(d.getDate() + 1)) {
      const iso = toYMD(d);
      if (!navBookedMap[iso]) navBookedMap[iso] = b;
    }
  });
  const navBarStarts = {};
  // Sort by arrival so earlier bookings get priority, longer bookings win ties
  const sortedNavBookings = [...propBookings].sort((a, b) => {
    const aStart = toYMD(new Date(a.arrival)) < navMonthStart ? navMonthStart : toYMD(new Date(a.arrival));
    const bStart = toYMD(new Date(b.arrival)) < navMonthStart ? navMonthStart : toYMD(new Date(b.arrival));
    if (aStart !== bStart) return aStart < bStart ? -1 : 1;
    // same start: longer booking wins
    return (new Date(b.departure) - new Date(b.arrival)) - (new Date(a.departure) - new Date(a.arrival));
  });
  sortedNavBookings.forEach((b) => {
    const arrISO = toYMD(new Date(b.arrival));
    const effectiveStart = arrISO < navMonthStart ? navMonthStart : arrISO;
    const depISO = toYMD(new Date(b.departure));

    let cur = new Date(effectiveStart);
    while (toYMD(cur) < depISO && toYMD(cur) <= navMonthEnd) {
      const segStart = toYMD(cur);
      const segIdx = navCells.findIndex(d => d !== null && toYMD(new Date(viewYear, viewMonth, d)) === segStart);
      const segColPos = segIdx >= 0 ? segIdx % 7 : 0;
      const daysLeftInWeek = 7 - segColPos;
      let segSpan = 0;
      const segCur = new Date(cur);
      while (toYMD(segCur) < depISO && toYMD(segCur) <= navMonthEnd && segSpan < daysLeftInWeek) {
        segSpan++;
        segCur.setDate(segCur.getDate() + 1);
      }
      const isFirstSeg = segStart === (arrISO < navMonthStart ? navMonthStart : arrISO);
      const isLastSeg = toYMD(segCur) >= depISO || toYMD(segCur) > navMonthEnd;
      // Only register if slot is not already taken by an earlier/longer booking
      if (!navBarStarts[segStart]) {
        navBarStarts[segStart] = { booking: b, span: segSpan, isFirst: isFirstSeg, isLast: isLastSeg };
      }
      cur = segCur;
    }
  });
  const navMonthBookings = propBookings.filter((b) => toYMD(b.arrival) <= navMonthEnd && toYMD(b.departure) > navMonthStart);
  const navBookedNights = Object.keys(navBookedMap).filter((d) => d >= navMonthStart && d <= navMonthEnd).length;
  const navOccupancy = Math.round((navBookedNights / navTotalDays) * 100);
  const navRevenue = navMonthBookings.reduce((s, b) => s + (b.price || 0), 0);

  return (
    <div style={{ width: '100%', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @media (max-width: 768px) {
          /* Stats strip — 2 col grid, compact */
          .single-cal-stats { grid-template-columns: repeat(2, 1fr) !important; }
          .single-cal-stats > div { padding: 10px 14px !important; }
          .single-cal-stats > div > div:first-child { font-size: 10px !important; }
          .single-cal-stats > div > div:last-child { font-size: 18px !important; }
          .single-cal-stats > div:nth-child(2) { border-right: none !important; }
          .single-cal-stats > div:nth-child(3) { border-top: 1px solid #e3ede8 !important; }
          .single-cal-stats > div:nth-child(4) { border-top: 1px solid #e3ede8 !important; border-right: none !important; }

          /* Layout */
          .single-cal-layout { flex-direction: column !important; }

          /* Sidebar: hidden on mobile, shown as modal when toggled */
          .single-cal-sidebar { display: flex !important; }
          .single-cal-bookings-btn { display: none !important; }
          .single-cal-close-btn { display: none !important; }
          @media (max-width: 768px) {
            .single-cal-sidebar { display: none !important; width: 100% !important; min-width: unset !important; border-left: none !important; position: fixed !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; z-index: 1001 !important; width: 90vw !important; max-height: 80vh !important; border-radius: 16px !important; box-shadow: 0 20px 60px rgba(0,0,0,0.25) !important; overflow: hidden !important; }
            .single-cal-sidebar.mobile-open { display: flex !important; flex-direction: column !important; }
            .single-cal-bookings-btn { display: flex !important; }
            .single-cal-close-btn { display: flex !important; }
          }

          /* Month nav header — tighter */
          .single-cal-month-header { padding: 8px 12px !important; }

          /* Calendar cells — shorter height, smaller font */
          .single-cal-cell { min-height: 64px !important; padding: 4px !important; }
          .single-cal-cell-date { font-size: 11px !important; }
          .single-cal-today-circle { width: 18px !important; height: 18px !important; font-size: 11px !important; }

          /* Booking bars — smaller text, prevent overflow */
          .single-cal-bar { height: 20px !important; top: 24px !important; font-size: 9px !important; padding: 0 4px 0 2px !important; }
          .single-cal-bar-icon { width: 14px !important; height: 14px !important; }
          .single-cal-bar-price { display: none !important; }

          /* Day labels row */
          .single-cal-daylabels > div { font-size: 9px !important; padding: 6px 2px !important; }
        }
        @media (min-width: 769px) {
          .single-cal-month-header { justify-content: space-between !important; }
        }
        @media (max-width: 768px) {
          .single-cal-month-header { justify-content: center !important; flex-direction: column !important; align-items: center !important; }
        }
      `}</style>
      {/* Stats strip */}
      <div className="single-cal-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderBottom: `1px solid ${borderCol}` }}>
        {[
          { label: 'Bookings this month', value: navMonthBookings.length, green: true },
          { label: 'Occupancy', value: `${navOccupancy}%`, green: true },
          { label: 'Revenue (month)', value: fmtMoney(navRevenue), green: false },
          { label: 'Nights available', value: navTotalDays - navBookedNights, green: false },
        ].map((s, i) => (
          <div key={i} style={{ padding: '14px 20px', borderRight: i < 3 ? `1px solid ${borderCol}` : 'none', background: surfaceBg }}>
            <div style={{ fontSize: 11, color: textSecondary, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: s.green ? '#1D9E75' : textPrimary }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Two-column layout: calendar left, upcoming bookings right */}
      <div className="single-cal-layout" style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>

      {/* LEFT: Calendar */}
      <div style={{ flex: 1, minWidth: 0, borderRight: `1px solid ${borderCol}` }}>

      {/* Month header + nav + legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${borderCol}`, background: cardBg, flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => { const d = new Date(viewYear, viewMonth - 1, 1); setViewMonth(d.getMonth()); setViewYear(d.getFullYear()); }} style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${borderCol}`, background: cardBg, color: textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: textPrimary, minWidth: 140, textAlign: 'center' }}>{MONTHS_FULL_NAV[viewMonth]} {viewYear}</span>
          <button onClick={() => { const d = new Date(viewYear, viewMonth + 1, 1); setViewMonth(d.getMonth()); setViewYear(d.getFullYear()); }} style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${borderCol}`, background: cardBg, color: textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: textSecondary, alignItems: 'center', marginLeft: 24 }}>
          {[
            { color: '#1D9E75', label: 'Booked' },
            { color: '#9FE1CB', border: '#9FE1CB', label: 'Available' },
          ].map((l) => (
            <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color, border: l.border ? `0.5px solid ${l.border}` : 'none', display: 'inline-block' }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="single-cal-daylabels" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: surfaceBg, borderBottom: `1px solid ${borderCol}` }}>
        {DAY_LABELS.map((d, i) => (
          <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: i >= 5 ? '#D4537E' : textSecondary, letterSpacing: '0.05em' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {navCells.map((day, idx) => {
          if (!day) return (
            <div key={`empty-${idx}`} style={{ minHeight: 88, background: surfaceBg, borderRight: `1px solid ${cellBorder}`, borderBottom: `1px solid ${cellBorder}` }} />
          );

          const dateISO = toYMD(new Date(viewYear, viewMonth, day));
          const isToday = dateISO === todayISO;
          const colPos = idx % 7; // position in 7-col grid (0=Mon)
          const daysRemainingInWeek = 7 - colPos; // how many cols left including this one
          const dow = colPos;
          const isWeekend = dow >= 5;
          const booking = navBookedMap[dateISO];
          const barInfo = navBarStarts[dateISO];
          const channel = barInfo
            ? ((barInfo.booking.channel && barInfo.booking.channel.name) || 'Direct')
            : booking
              ? ((booking.channel && booking.channel.name) || 'Direct')
              : null;

          let bg = cellBg;
          if (isToday) bg = todayBg;
          else if (isWeekend) bg = weekendBg;

          return (
            <div key={dateISO} className="single-cal-cell" style={{ minHeight: 88, background: bg, borderRight: `1px solid ${cellBorder}`, borderBottom: `1px solid ${cellBorder}`, padding: 6, position: 'relative' }}>
              {/* Date number */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                {isToday ? (
                  <span className="single-cal-today-circle" style={{ width: 22, height: 22, borderRadius: '50%', background: '#1D9E75', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500 }}>{day}</span>
                ) : (
                  <span className="single-cal-cell-date" style={{ fontSize: 13, fontWeight: 500, color: isWeekend ? '#D4537E' : textPrimary }}>{day}</span>
                )}
              </div>

              {/* Available indicator */}
              {!booking && (
                <div style={{ textAlign: 'center', marginTop: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#9FE1CB', margin: '0 auto 3px' }} />
                </div>
              )}

              {/* Booking bar — only render at bar start */}
              {barInfo && (
                <div className="single-cal-bar" style={{
                  position: 'absolute',
                  top: 30,
                  left: 2,
                  width: `calc(${Math.min(barInfo.span, daysRemainingInWeek) * 100}% - 4px)`,
                  height: 26,
                  background: getBookingColor(barInfo.booking['guest-name']),
                  opacity: barInfo.isFirst ? 1 : 0.88,
                  borderRadius: barInfo.isFirst && barInfo.isLast ? 100
                    : barInfo.isFirst ? '100px 0 0 100px'
                    : barInfo.isLast ? '0 100px 100px 0'
                    : 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '0 8px 0 3px',
                  zIndex: 2,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.10)',
                }}>
                  {barInfo.isFirst && (
                    <span className="single-cal-bar-icon" style={{ width: 18, height: 18, borderRadius: '50%', background: getChannelLogo(((barInfo.booking.channel && barInfo.booking.channel.name) || 'Direct')) ? '#fff' : getChannelColor((barInfo.booking.channel && barInfo.booking.channel.name) || 'Direct'), border: getChannelLogo(((barInfo.booking.channel && barInfo.booking.channel.name) || 'Direct')) ? '0.5px solid rgba(255,255,255,0.4)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {getChannelLogo((barInfo.booking.channel && barInfo.booking.channel.name) || 'Direct') ? (
                        <img src={getChannelLogo((barInfo.booking.channel && barInfo.booking.channel.name) || 'Direct')} alt="" style={{ width: 12, height: 12, objectFit: 'contain', display: 'block' }} />
                      ) : (
                        <span style={{ fontSize: 8, fontWeight: 700, color: '#fff' }}>{getChannelInitial((barInfo.booking.channel && barInfo.booking.channel.name) || 'Direct')}</span>
                      )}
                    </span>
                  )}
                  {!barInfo.isFirst && (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginRight: 4, flexShrink: 0 }}>↩</span>
                  )}
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {barInfo.booking['guest-name'] || 'Guest'}
                  </span>
                  {barInfo.isFirst && (
                    <span className="single-cal-bar-price" style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginLeft: 6, flexShrink: 0 }}>
                      · {fmtMoney(barInfo.booking.price)}
                    </span>
                  )}
                  {!barInfo.isLast && (
                    <span style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 8, background: 'rgba(0,0,0,0.15)', borderRadius: '0 0 0 0' }} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: View Upcoming Bookings tab button */}
      <button
        onClick={() => setShowBookings(true)}
        style={{
          display: 'none',
          margin: '12px 16px 16px',
          padding: '11px 0',
          width: 'calc(100% - 32px)',
          background: '#1D9E75',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
        className="single-cal-bookings-btn"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        View Upcoming Bookings ({navMonthBookings.length})
      </button>

      </div> {/* end LEFT calendar column */}

      {/* MODAL OVERLAY — mobile only */}
      {showBookings && (
        <div
          onClick={() => setShowBookings(false)}
          className="single-cal-modal-overlay"
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'none',
          }}
        />
      )}

      {/* RIGHT: Upcoming bookings */}
      <div className={`single-cal-sidebar${showBookings ? ' mobile-open' : ''}`} style={{ width: 335, minWidth: 295, flexShrink: 0, background: surfaceBg, borderLeft: `1px solid ${borderCol}`, display: 'flex', flexDirection: 'column', alignSelf: 'stretch' }}>
        <div style={{ padding: '13px 20px', borderBottom: `1px solid ${borderCol}`, background: cardBg, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: textSecondary, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Upcoming bookings</div>
          <button
            onClick={() => setShowBookings(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: textSecondary, padding: 4, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      <div style={{ padding: '12px 16px', background: surfaceBg, flex: 1, overflowY: 'auto', maxHeight: 480, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {navMonthBookings.length === 0 ? (
            <div style={{ fontSize: 13, color: textSecondary, fontStyle: 'italic' }}>No bookings this month</div>
          ) : (
            navMonthBookings.map((b, i) => {
              const ch = (b.channel && b.channel.name) || 'Direct';
              const initials = (b['guest-name'] || 'G').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              const chLogo = getChannelLogo(ch);
              const nights = Math.round((new Date(b.departure) - new Date(b.arrival)) / 86400000);
              const guests = (b.adults || 0) + (b.children || 0) || 1;
              const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: cardBg, border: `1px solid ${borderCol}`, borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: chLogo ? '#fff' : getChannelColor(ch), border: chLogo ? '1px solid #e3ede8' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                    {chLogo ? (
                      <img
                        src={chLogo}
                        alt={ch}
                        style={{ width: 22, height: 22, objectFit: 'contain' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentNode.style.background = getChannelColor(ch);
                          e.target.parentNode.style.border = 'none';
                          e.target.parentNode.textContent = initials;
                        }}
                      />
                    ) : (
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: getChannelColor(ch), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
                        {initials}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {b['guest-name'] || 'Guest'}
                      <span style={{ fontSize: 10, background: '#E1F5EE', color: '#0F6E56', borderRadius: 10, padding: '2px 8px' }}>{ch}</span>
                    </div>
                    <div style={{ fontSize: 11, color: textSecondary, marginTop: 2 }}>
                      {fmt(b.arrival)} – {fmt(b.departure)} · {guests} guests · {nights} night{nights !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#0F6E56', whiteSpace: 'nowrap' }}>{fmtMoney(b.price)}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
      </div> {/* end RIGHT column */}
      </div> {/* end two-column layout */}
    </div>
  );
}

export default function CalendarGrid({

  properties = [],
  bookings = [],
  calBaseDate,
  calMonthsCount,
  view = "multi",
  channels = [],
  singlePropId,
  shouldScrollToToday,
  onScrollToTodayConsumed,
  onLoadMore,
}) {
const { dark } = useDashboard();
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
      if (!e.target.closest('.cal-sidebar')) {
        document.querySelectorAll('.prop-name-tooltip').forEach(t => t.style.display = 'none');
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

  const singleProp = view === "single"
    ? (properties.find(p => String(p.id) === String(singlePropId))
      || (selectedProps.length > 0 ? properties.filter(p => selectedProps.includes(p.id)) : properties)[0])
    : null;

  let displayedProps = properties;
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

  if (singleProp) {
    return (
      <div style={{ width: "100%" }}>
        <SingleCalendarView prop={singleProp} allBookings={filteredBookings} dark={dark} />
      </div>
    );
  }

  return (
  <div style={{ display: "flex", width: "100%", overflow: "visible", borderTop: dark ? "1px solid #1e3a2a" : "1px solid #e3ede8", borderRadius: "0 0 14px 14px", "--cal-td-bg": "#fff", "--cal-td-today": "#f0faf4", "--cal-td-weekend": "#fcfafa", "--cal-month-bg": "#f5f9f7", "--cal-month-color": "#1a3028", "--cal-dayrow-bg": "#f7faf8", "--cal-daynum-color": "#0c1c14", "--cal-border": "1px solid #e3ede8" }}>
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
          .cal-scroll-inner { display: block; min-height: 0; }

          /* ── Table ── */
          .cal-table { width: max-content; min-width: 100%; border-collapse: collapse; }
          .cal-table th { padding: 10px 6px; border-right: 1px solid #f0f5f2; border-bottom: 1px solid #e3ede8; font-size: .72rem; font-weight: 600; color: #9ab8a9; text-align: center; }
          .cal-table td { min-width: 56px; max-width: 56px; width: 56px; height: 48px; border-right: 1px solid #eef2f0; border-bottom: 1px solid #eef2f0; position: relative; padding: 0; background: #fff; }
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
          .cal-scroll-inner { display: block; min-height: 0; }

          /* ── Table ── */
          .cal-table { width: max-content; min-width: 100%; border-collapse: collapse; }
          .cal-table th { padding: 10px 6px; border-right: 1px solid #f0f5f2; border-bottom: 1px solid #e3ede8; font-size: .72rem; font-weight: 600; color: #9ab8a9; text-align: center; }
          .cal-table td { min-width: 56px; max-width: 56px; width: 56px; height: 48px; border-right: 1px solid #eef2f0; border-bottom: 1px solid #eef2f0; position: relative; padding: 0; background: var(--cal-td-bg, #fff); }
          .cal-table td.today-col { background: var(--cal-td-today, #f0faf4); }
          .cal-table td.weekend-col { background: var(--cal-td-weekend, #fcfafa); }
          .cal-table td.month-start { border-left: 2px solid #b7e4cf; }
          .cal-table tbody tr:hover td { background: #fafcfb; }
          .cal-table tbody tr:hover td.today-col { background: #e8f5ee; }

          /* ── Month label ── */
          .cal-month-label { text-align: left !important; padding: 8px 14px !important; font-family: 'Sora', sans-serif; font-size: .8rem; font-weight: 800; color: var(--cal-month-color, #1a3028); background: var(--cal-month-bg, #f5f9f7); border-bottom: var(--cal-border, 1px solid #e3ede8); border-right: var(--cal-border, 1px solid #dde8e3); white-space: nowrap; position: relative; }

          /* ── Day header row ── */
          .cal-day-row th { min-width: 56px; max-width: 56px; width: 56px; text-align: center; padding: 6px 4px; background: var(--cal-dayrow-bg, #f7faf8); border-bottom: var(--cal-border, 1px solid #e3ede8); border-right: 1px solid #eef2f0; font-size: .6rem; font-weight: 700; color: #7aab95; text-transform: uppercase; letter-spacing: .4px; }
          .cal-day-row th .day-num { display: block; margin-top: 1px; font-size: .85rem; font-weight: 800; color: var(--cal-daynum-color, #0c1c14); }
          .cal-day-row th.weekend { color: #ec4899; }
          .cal-day-row th.weekend .day-num { color: #ec4899; }
          .cal-day-row th.today { background: #e8f5ee; }
          .cal-day-row th.today .day-num { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #1e8760; color: #fff; border-radius: 50%; margin-top: 1px; font-size: .8rem; }
          .cal-day-row th.month-start { border-left: 2px solid #b7e4cf; }

          /* ── Sticky property column ── */
          .cal-prop-col { position: sticky; left: 0; z-index: 20; text-align: left; width: 200px; min-width: 200px; max-width: 200px; padding: 0; font-size: .78rem; font-weight: 600; color: #e8f5ee; border-right: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em; background: #0f2d1f; }
          .cal-month-row .cal-prop-col { background: #0a1f15; z-index: 21; font-size: .62rem; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #4d9e7a; padding: 8px 16px 8px 20px; border-bottom: 1px solid #1a3d28; border-right: 3px solid #1e8760; }
          .cal-day-row .cal-prop-col { background: #0d2619; z-index: 21; overflow: visible; border-bottom: 1px solid #1a3d28; border-right: 3px solid #1e8760; }
          .cal-table tbody .cal-prop-col { background: #0f2d1f; z-index: 20; border-right: 3px solid #1e8760; border-bottom: 1px solid #1a3d28; height: 48px; }
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

          /* ── Responsive ── */
          @media (max-width: 768px) {
            /* Multi view: shrink sticky sidebar */
            .cal-sidebar { width: 180px !important; min-width: 180px !important; }
            .cal-sidebar span { font-size: .75rem !important; }
            .cal-table td { min-width: 44px !important; max-width: 44px !important; width: 44px !important; height: 44px !important; }
            .cal-table th { min-width: 44px !important; max-width: 44px !important; width: 44px !important; padding: 6px 2px !important; font-size: .6rem !important; }
            .cal-table tbody tr { height: 48px !important; }
            .cal-table tbody td { height: 48px !important; }
            .cal-pill-ic { width: 15px !important; height: 15px !important; font-size: 7px !important; }
            .pill-meta { display: none !important; }

            /* Single view: stack vertically */
            .single-cal-layout { flex-direction: column !important; }
            .single-cal-sidebar { display: none; width: 100% !important; min-width: unset !important; border-left: none !important; border-top: 1px solid #e3ede8 !important; }
            .single-cal-sidebar.mobile-open { display: flex !important; flex-direction: column !important; }
            .single-cal-bookings-btn { display: flex !important; }
            .single-cal-close-btn { display: flex !important; }

            /* Single view: stats 2-col */
            .single-cal-stats { grid-template-columns: repeat(2, 1fr) !important; }
            .single-cal-stats > div:nth-child(2) { border-right: none !important; }
            .single-cal-stats > div:nth-child(3) { border-top: 1px solid #e3ede8; }
            .single-cal-stats > div:nth-child(4) { border-top: 1px solid #e3ede8; border-right: none !important; }
          }

          @media (max-width: 480px) {
            .cal-sidebar { width: 160px !important; min-width: 160px !important; }
            .cal-sidebar span { font-size: .72rem !important; }
            .cal-table td { min-width: 40px !important; max-width: 40px !important; width: 40px !important; height: 40px !important; }
            .cal-table th { min-width: 40px !important; max-width: 40px !important; width: 40px !important; }
          }
        `}</style>

      {/* FIXED SIDEBAR */}
      <div className="cal-sidebar" style={{ width: 240, minWidth: 240, background: dark ? "#0f2d1f" : "#eaf5ee", flexShrink: 0, borderRight: dark ? "1px solid #1e3a2a" : "1px solid #c8e6d6", overflow: "visible", display: "flex", flexDirection: "column" }}>
        <div style={{ background: dark ? "#0a1f15" : "#d6ede0", height: 36, display: "flex", alignItems: "center", padding: "0 16px 0 20px", borderBottom: dark ? "1px solid #1a3d28" : "1px solid #e3ede8", fontSize: ".62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".8px", color: dark ? "#4d9e7a" : "#5a8a70", flexShrink: 0 }}>
          Properties
        </div>
        <div style={{ background: dark ? "#0d2619" : "#eaf5ee", height: 44, display: "flex", alignItems: "center", padding: "0 8px", borderBottom: dark ? "1px solid #1a3d28" : "1px solid #c8e6d6", flexShrink: 0, position: "relative", zIndex: 30, overflow: "visible" }} ref={filterPopRef}>
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
          <div key={prop.id} style={{ height: 48, minHeight: 48, maxHeight: 48, boxSizing: 'border-box', display: "flex", alignItems: "center", padding: "0 16px 0 20px", gap: 8, borderBottom: dark ? "1px solid #1a3d28" : "1px solid #d6ede0", background: dark ? "#0f2d1f" : "#eaf5ee", position: "relative" }}
            onMouseEnter={e => e.currentTarget.style.background = dark ? "#163d28" : "#d4ecde"}
            onMouseLeave={e => e.currentTarget.style.background = dark ? "#0f2d1f" : "#eaf5ee"}
            onClick={e => {
              const tooltip = e.currentTarget.querySelector('.prop-name-tooltip');
              if (!tooltip) return;
              const isVisible = tooltip.style.display === 'block';
              document.querySelectorAll('.prop-name-tooltip').forEach(t => t.style.display = 'none');
              tooltip.style.display = isVisible ? 'none' : 'block';
              e.stopPropagation();
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#26a676", flexShrink: 0, opacity: 0.7 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0, fontSize: ".78rem", fontWeight: 600, color: dark ? "#c8e6d6" : "#1a3d28", letterSpacing: "-0.01em" }}>
              {prop.name}
            </span>
            <div className="prop-name-tooltip" style={{
              display: 'none', position: 'absolute', left: '100%', top: '50%',
              transform: 'translateY(-50%)', marginLeft: 8, background: dark ? '#0a1f15' : '#fff',
              border: dark ? '1px solid #2a5c3c' : '1px solid #e3ede8',
              borderRadius: 8, padding: '6px 12px', fontSize: '.78rem', fontWeight: 600,
              color: dark ? '#c8e6d6' : '#1a3d28', whiteSpace: 'nowrap',
              boxShadow: '0 4px 14px rgba(0,0,0,0.12)', zIndex: 100,
            }}>
              {prop.name}
            </div>
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