import { toYMD, dayDiff, fmtMoney } from '../../utils/dateHelpers';
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
      <td className="cal-prop-col">{prop.name}</td>
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
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggleProp(propId) {
    setSelectedProps((prev) =>
      prev.includes(propId) ? prev.filter((id) => id !== propId) : [...prev, propId]
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

  let displayedProps =
    view === "single" ? properties.slice(0, 1) : properties;
  if (selectedProps.length > 0) {
    displayedProps = displayedProps.filter(p => selectedProps.includes(p.id));
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
    <div className="cal-scroll" ref={scrollRef}>
      <style>{`
        .cal-tt, body .cal-tt {
          display: none;
          position: absolute;
          z-index: 9999;
          background: #fff;
          border: 0.5px solid #e5e7eb;
          border-radius: 10px;
          min-width: 220px;
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.10);
        }
        .cal-tt-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          border-bottom: 0.5px solid #e5e7eb;
        }
        .cal-tt-name { font-size: 13px; font-weight: 600; color: #0c1c14; }
        .cal-tt-chip {
          background: #E1F5EE; color: #0F6E56;
          font-size: 11px; font-weight: 500;
          padding: 3px 10px; border-radius: 100px;
        }
        .cal-tt-dates {
          display: flex;
          border-bottom: 0.5px solid #e5e7eb;
        }
        .cal-tt-dates > div { flex: 1; padding: 9px 14px; }
        .cal-tt-dates > div + div { border-left: 0.5px solid #e5e7eb; }
        .cal-tt-dl { font-size: 10px; font-weight: 600; color: #9ab8a9; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 3px; }
        .cal-tt-dv { font-size: 13px; font-weight: 600; color: #0c1c14; }
        .cal-tt-row {
          display: flex; justify-content: space-between;
          padding: 8px 14px;
          border-bottom: 0.5px solid #e5e7eb;
          font-size: 12px;
        }
        .cal-tt-last { border-bottom: none; }
        .cal-tt-rl { color: #9ab8a9; }
        .cal-tt-rv { font-weight: 500; color: #0c1c14; }
        .cal-tt-price { color: #0F6E56 !important; }
      `}</style>

      <div className="cal-scroll-inner">
        <table className="cal-table">
          <thead>
            <tr className="cal-month-row">
              <th className="cal-prop-col">Properties</th>
              {monthGroups.map((mg) => (
                <th key={mg.label} colSpan={mg.span} className="cal-month-label">
                  {mg.label}
                </th>
              ))}
            </tr>

            <tr className="cal-day-row">
              <th className="cal-prop-col" style={{ overflow: 'visible', zIndex: 30 }}>
                <div style={{ position: 'relative' }} ref={filterPopRef}>
                  <button
                    className="cal-btn"
                    onClick={() => setShowPropFilter((v) => !v)}
                    style={{ width: '100%', justifyContent: 'space-between', padding: '6px 10px', fontSize: '.72rem', background: selectedProps.length > 0 ? '#eaf8f1' : '#fff', borderColor: selectedProps.length > 0 ? '#b7e4cf' : '#e3ede8' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
                      </svg>
                      {selectedProps.length > 0 ? `${selectedProps.length} Selected` : 'All Properties'}
                    </div>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>

                  {showPropFilter && (
                    <div className="hp-popover" style={{ top: '100%', left: 0, marginTop: 6, minWidth: 200, maxHeight: 300, overflowY: 'auto' }}>
                      <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#9ab8a9', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 8, padding: '0 6px' }}>Filter Properties</div>
                      {
                        properties.length === 0 ? (
                          <div style={{ padding: '10px', fontSize: '.8rem', color: '#9ab8a9', textAlign: 'center', fontStyle: 'italic' }}>
                            No Properties Found
                          </div>
                        ) : (
                          properties.map((p) => (
                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', cursor: 'pointer', borderRadius: 8, fontSize: '.8rem', color: '#0c1c14', fontWeight: 600 }}>
                              <input type="checkbox" checked={selectedProps.includes(p.id)} onChange={() => toggleProp(p.id)} style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#26a676' }} />
                              {p.name}
                            </label>
                          )))
                      }
                      {selectedProps.length > 0 && (
                        <div style={{ borderTop: '1px solid #f0f5f2', marginTop: 8, paddingTop: 8, display: 'flex' }}>
                          <button onClick={clearProps} style={{ flex: 1, padding: 6, background: '#f0f5f2', color: '#2a4e3c', border: 'none', borderRadius: 6, fontFamily: 'inherit', fontSize: '.75rem', fontWeight: 600, cursor: 'pointer' }}>Clear All</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </th>
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

        {onLoadMore && (
          <button
            type="button"
            className="cal-end-scroll-btn"
            onClick={onLoadMore}
            title="Load 2 more months"
            aria-label="Load 2 more months"
          >
            <span className="scroll-fade" />
            <span className="hover-highlight" />
            <span className="arrow-container">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h12" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
