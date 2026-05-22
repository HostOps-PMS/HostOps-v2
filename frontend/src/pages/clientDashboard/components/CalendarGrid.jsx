import React, { useEffect, useRef } from 'react';
import { toYMD, dayDiff, fmtMoney } from '../../utils/dateHelpers';
import { getChannelPillClass, getChannelColor, getChannelInitial } from '../utils/channelHelpers';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Builds the flat array of date objects for the calendar window.
 */
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

/**
 * Renders a single property row with booking pills.
 */
function PropertyRow({ prop, allBookings, dateRange, ymdRange, todayISO }) {
  const rangeStartYMD = ymdRange[0];
  const rangeEndYMD = ymdRange[ymdRange.length - 1];

  const propBookings = allBookings.filter((b) => {
    if (!b.apartment || b.apartment.id !== prop.id) return false;
    if (!b['guest-name'] && b['is-blocked-booking']) return false;
    const arrYMD = toYMD(b.arrival);
    const depYMD = toYMD(b.departure);
    return arrYMD <= rangeEndYMD && depYMD > rangeStartYMD;
  });

  propBookings.sort((a, b) => {
    const aArr = toYMD(a.arrival) < rangeStartYMD ? rangeStartYMD : toYMD(a.arrival);
    const bArr = toYMD(b.arrival) < rangeStartYMD ? rangeStartYMD : toYMD(b.arrival);
    return aArr < bArr ? -1 : aArr > bArr ? 1 : 0;
  });

  const ymdToIdx = {};
  ymdRange.forEach((ymd, i) => { ymdToIdx[ymd] = i; });

  const cellMap = {};
  propBookings.forEach((booking) => {
    const arrYMD = toYMD(booking.arrival);
    const depYMD = toYMD(booking.departure);
    const startIdx = arrYMD < rangeStartYMD ? 0 : (ymdToIdx[arrYMD] !== undefined ? ymdToIdx[arrYMD] : -1);
    if (startIdx < 0) return;

    const daysFromStart = dayDiff(ymdRange[startIdx], depYMD);
    const renderSpan = Math.max(1, Math.min(daysFromStart, ymdRange.length - startIdx));
    cellMap[startIdx] = { booking, renderSpan };
  });

  let skipUntil = -1;

  const cells = ymdRange.map((dayStr, idx) => {
    const day = dateRange[idx];
    const isToday = dayStr === todayISO;
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const isMonthStart = day.getDate() === 1;

    const tdClass = [
      isToday ? 'today-col' : '',
      isWeekend ? 'weekend-col' : '',
      isMonthStart ? 'month-start' : '',
    ].filter(Boolean).join(' ');

    if (idx <= skipUntil) {
      return <td key={dayStr} className={tdClass || undefined} />;
    }

    const entry = cellMap[idx];
    if (entry) {
      const { booking, renderSpan } = entry;
      skipUntil = idx + renderSpan - 1;
      const channel = (booking.channel && booking.channel.name) || 'Direct';
      const guests = (booking.adults || 0) + (booking.children || 0);
      const pillClass = getChannelPillClass(channel);
      const tooltipText = [
        booking['guest-name'] || 'Guest',
        channel,
        `${guests || 1} guest(s)`,
        fmtMoney(booking.price),
        `${toYMD(booking.arrival)} → ${toYMD(booking.departure)}`,
      ].join(' · ');

      return (
        <td key={dayStr} className={tdClass || undefined}>
          <div
            className={`cal-pill ${pillClass}`}
            style={{ width: `calc(${renderSpan * 100}% - 6px)`, left: 3 }}
            title={tooltipText}
          >
            <ChannelBadge channel={channel} />
            <span className="pill-text">{booking['guest-name'] || 'Guest'}</span>
            <span className="pill-meta">{guests || 1} · {fmtMoney(booking.price)}</span>
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

/**
 * Full calendar grid with sticky property column, month headers, and booking pills.
 */
export default function CalendarGrid({
  properties = [],
  bookings = [],
  calBaseDate,
  calMonthsCount,
  view = 'multi',
  channels = [],
  shouldScrollToToday,
  onScrollToTodayConsumed,
  onLoadMore,
}) {
  const scrollRef = useRef(null);
  const today = new Date();
  const todayISO = toYMD(today);

  const dateRange = buildDateRange(calBaseDate, calMonthsCount);
  const ymdRange = dateRange.map(toYMD);

  // Filter by channel if active
  const filteredBookings = channels.length > 0
    ? bookings.filter((b) => {
        const ch = (b.channel && b.channel.name) || 'Direct';
        return channels.includes(ch);
      })
    : bookings;

  const displayedProps = view === 'single' ? properties.slice(0, 1) : properties;

  // Build month header groups
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
      monthGroups.push({ label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, span: 0, startIdx: i });
    }
  });
  if (monthGroups.length) monthGroups[monthGroups.length - 1].span = dateRange.length - monthGroups[monthGroups.length - 1].startIdx;

  // Scroll to today
  useEffect(() => {
    if (!shouldScrollToToday || !scrollRef.current) return;
    const todayCell = scrollRef.current.querySelector('th.today');
    if (!todayCell) { scrollRef.current.scrollLeft = 0; }
    else {
      const stickyWidth = 200;
      const visibleWidth = scrollRef.current.clientWidth - stickyWidth;
      scrollRef.current.scrollLeft = Math.max(0, todayCell.offsetLeft - stickyWidth - visibleWidth / 2 + 32);
    }
    onScrollToTodayConsumed?.();
  }, [shouldScrollToToday, onScrollToTodayConsumed]);

  return (
    <div className="cal-scroll" ref={scrollRef}>
      <table className="cal-table">
        <thead>
          {/* Month label row */}
          <tr className="cal-month-row">
            <th className="cal-prop-col">Properties</th>
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

          {/* Day header row */}
          <tr className="cal-day-row">
            <th className="cal-prop-col" />
            {dateRange.map((d, i) => {
              const ymd = ymdRange[i];
              const isToday = ymd === todayISO;
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const isMonthStart = d.getDate() === 1;
              const cls = [
                isToday ? 'today' : '',
                isWeekend ? 'weekend' : '',
                isMonthStart ? 'month-start' : '',
              ].filter(Boolean).join(' ');

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

      {/* Inline "load more" button */}
      {onLoadMore && (
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <button
            onClick={onLoadMore}
            style={{
              padding: '8px 20px', background: '#eaf8f1', border: '1px solid #b7e4cf',
              borderRadius: 100, fontFamily: 'DM Sans', fontSize: '.78rem',
              fontWeight: 700, color: '#1e8760', cursor: 'pointer',
            }}
          >
            Load more months →
          </button>
        </div>
      )}
    </div>
  );
}