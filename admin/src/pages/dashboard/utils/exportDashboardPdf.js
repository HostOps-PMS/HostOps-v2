// utils/exportDashboardPdf.js
// ─────────────────────────────────────────────────────────────────
// Client-side PDF export for the admin dashboard overview.
//
// Uses static top-level imports (not dynamic) so Vite/bundler
// guarantees the module evaluation order — this is what fixes the
// "doc.autoTable is not a function" error.
//
// autoTable is called as:  autoTable(doc, config)
// NOT as:                  doc.autoTable(config)
// because the prototype-patch approach is unreliable with bundlers.
//
// Call:  exportDashboardPdf({ overview, stats, appliedRange })
// ─────────────────────────────────────────────────────────────────

import { jsPDF }    from 'jspdf';
import autoTable    from 'jspdf-autotable';

// ─── Formatters ───────────────────────────────────────────────────
function fmt(v) {
  if (v == null) return '-';
  return String(v);
}

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '-';
  if (v >= 1_000_000) return 'P' + (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 1_000)     return 'P' + (v / 1_000).toFixed(1) + 'K';
  return 'P' + Number(v).toLocaleString();
}

function fmtDate(str) {
  if (!str) return '-';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Design tokens ────────────────────────────────────────────────
const GREEN       = [26,  158, 110];
const GREEN_LIGHT = [232, 245, 233];
const GRAY_LINE   = [220, 220, 220];
const GRAY_TEXT   = [120, 120, 120];
const BLACK       = [17,  17,  17];
const WHITE       = [255, 255, 255];
const RED         = [192, 57,  43];
const RED_LIGHT   = [255, 248, 248];

// ─── Page layout ──────────────────────────────────────────────────
const PAGE_W    = 210;
const PAGE_H    = 297;
const MARGIN    = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ─────────────────────────────────────────────────────────────────
// Shared table config factory — keeps all tables visually consistent
// ─────────────────────────────────────────────────────────────────
function tableConfig({ startY, head, body, headColor = GREEN, altRowColor = [248, 252, 250], columnStyles = {} }) {
  return {
    startY,
    margin:      { left: MARGIN, right: MARGIN },
    head,
    body,
    styles:              { fontSize: 8, cellPadding: 2.5, textColor: BLACK, font: 'helvetica' },
    headStyles:          { fillColor: headColor, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles:  { fillColor: altRowColor },
    columnStyles,
    tableLineColor:      GRAY_LINE,
    tableLineWidth:      0.1,
  };
}

// ─────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────
export async function exportDashboardPdf({ overview = {}, stats = [], appliedRange = {} }) {
  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let   cursor = MARGIN;

  // ── Internal helpers ──────────────────────────────────────────
  const topBar = () => {
    doc.setFillColor(...GREEN);
    doc.rect(0, 0, PAGE_W, 5, 'F');
  };

  const checkPage = (needed = 12) => {
    if (cursor + needed > PAGE_H - 16) {
      doc.addPage();
      cursor = MARGIN;
      topBar();
    }
  };

  const rule = () => {
    doc.setDrawColor(...GRAY_LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, cursor, MARGIN + CONTENT_W, cursor);
    cursor += 4;
  };

  const sectionTitle = (label) => {
    checkPage(16);
    doc.setFillColor(...GREEN_LIGHT);
    doc.roundedRect(MARGIN, cursor, CONTENT_W, 7, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...GREEN);
    doc.text(label.toUpperCase(), MARGIN + 3, cursor + 5);
    cursor += 11;
  };

  // ── Page 1 — Cover header ─────────────────────────────────────
  topBar();
  cursor = 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...GREEN);
  doc.text('HostPilot', MARGIN, cursor);
  cursor += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...GRAY_TEXT);
  doc.text('Admin Dashboard Report', MARGIN, cursor);
  cursor += 5;

  // Period row — uses the appliedRange from the date filter
  const periodStr   = (appliedRange.from && appliedRange.to)
    ? `Period: ${fmtDate(appliedRange.from)}  to  ${fmtDate(appliedRange.to)}`
    : 'Period: Current month';
  const generatedStr = `Generated: ${new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}`;

  doc.setFontSize(8);
  doc.setTextColor(...GRAY_TEXT);
  doc.text(periodStr,    MARGIN,          cursor);
  doc.text(generatedStr, PAGE_W - MARGIN, cursor, { align: 'right' });
  cursor += 3;
  rule();

  // ── KPI cards ─────────────────────────────────────────────────
  sectionTitle('Key Metrics');

  const kpis = [
    { label: 'Total Clients',    value: fmt(overview.totalClients    ?? 0)       },
    { label: 'Total Properties', value: fmt(overview.totalProperties ?? 0)       },
    { label: 'Revenue (Period)', value: fmtMoney(overview.monthlyRevenue ?? 0)   },
    { label: 'Bookings',         value: fmt(overview.totalBookings   ?? 0)       },
    { label: 'Cancellations',    value: fmt(overview.totalCancellations ?? 0)    },
    { label: 'Avg Occupancy',    value: (overview.overallOccupancy  ?? 0) + '%'  },
  ];

  const COLS  = 3;
  const CARD_W = (CONTENT_W - (COLS - 1) * 3) / COLS;
  const CARD_H = 17;

  kpis.forEach((kpi, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x   = MARGIN + col * (CARD_W + 3);
    const y   = cursor + row * (CARD_H + 3);

    doc.setFillColor(...WHITE);
    doc.setDrawColor(...GRAY_LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, CARD_W, CARD_H, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_TEXT);
    doc.text(kpi.label, x + 4, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...BLACK);
    doc.text(kpi.value, x + 4, y + 13.5);
  });

  cursor += Math.ceil(kpis.length / COLS) * (CARD_H + 3) + 5;
  rule();

  // ── Top Clients ────────────────────────────────────────────────
  const topClients = overview.topClients ?? [];
  if (topClients.length > 0) {
    sectionTitle('Top Clients by Revenue');
    autoTable(doc, tableConfig({
      startY: cursor,
      head:   [['#', 'Client', 'Revenue', 'Bookings', 'Properties']],
      body:   topClients.map((c, i) => [
        i + 1,
        c.clientName ?? '-',
        fmtMoney(c.revenue),
        fmt(c.bookings),
        Array.isArray(c.properties) ? c.properties.length : '-',
      ]),
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        2: { halign: 'right', cellWidth: 32 },
        3: { halign: 'right', cellWidth: 24 },
        4: { halign: 'right', cellWidth: 28 },
      },
    }));
    cursor = doc.lastAutoTable.finalY + 5;
    rule();
  }

  // ── Occupancy Breakdown ────────────────────────────────────────
  const occupancy = overview.occupancyBreakdown ?? [];
  if (occupancy.length > 0) {
    checkPage(20);
    sectionTitle('Property Occupancy');
    autoTable(doc, tableConfig({
      startY: cursor,
      head:   [['Property', 'Client', 'Occupancy %']],
      body:   occupancy.map(o => [
        o.propertyName ?? '-',
        o.clientName   ?? '-',
        (o.occupancy   ?? 0) + '%',
      ]),
      columnStyles: { 2: { halign: 'right', cellWidth: 30 } },
    }));
    cursor = doc.lastAutoTable.finalY + 5;
    rule();
  }

  // ── Revenue by Channel ─────────────────────────────────────────
  const byChannel  = overview.byChannel ?? {};
  const channelKeys = Object.keys(byChannel);
  if (channelKeys.length > 0) {
    checkPage(20);
    sectionTitle('Revenue by Channel');
    autoTable(doc, tableConfig({
      startY: cursor,
      head:   [['Channel', 'Revenue', 'Bookings', 'Nights']],
      body:   channelKeys.map(ch => {
        const d = byChannel[ch];
        return [ch, fmtMoney(d.revenue), fmt(d.bookings), fmt(d.nights)];
      }),
      columnStyles: {
        1: { halign: 'right', cellWidth: 35 },
        2: { halign: 'right', cellWidth: 26 },
        3: { halign: 'right', cellWidth: 26 },
      },
    }));
    cursor = doc.lastAutoTable.finalY + 5;
    rule();
  }

  // ── Recent Bookings ────────────────────────────────────────────
  const recentBookings = overview.recentBookings ?? [];
  if (recentBookings.length > 0) {
    checkPage(20);
    sectionTitle(`Recent Bookings  (${appliedRange.from ?? ''} - ${appliedRange.to ?? ''})`);
    autoTable(doc, tableConfig({
      startY: cursor,
      head:   [['Guest', 'Property', 'Channel', 'Arrival', 'Nights', 'Price']],
      body:   recentBookings.slice(0, 30).map(b => [
        b.guestName    ?? '-',
        b.propertyName ?? '-',
        b.channel      ?? '-',
        fmtDate(b.arrival),
        fmt(b.nights),
        fmtMoney(b.price),
      ]),
      columnStyles: {
        2: { cellWidth: 26 },
        3: { cellWidth: 24 },
        4: { halign: 'right', cellWidth: 16 },
        5: { halign: 'right', cellWidth: 24 },
      },
    }));
    cursor = doc.lastAutoTable.finalY + 5;
    rule();
  }

  // ── Recent Cancellations ───────────────────────────────────────
  const recentCancellations = overview.recentCancellations ?? [];
  if (recentCancellations.length > 0) {
    checkPage(20);
    sectionTitle(`Recent Cancellations  (${appliedRange.from ?? ''} - ${appliedRange.to ?? ''})`);
    autoTable(doc, tableConfig({
      startY:      cursor,
      head:        [['Guest', 'Property', 'Client', 'Arrival', 'Nights']],
      body:        recentCancellations.slice(0, 30).map(c => [
        c.guestName    ?? '-',
        c.propertyName ?? '-',
        c.clientName   ?? '-',
        fmtDate(c.arrival),
        fmt(c.nights),
      ]),
      headColor:   RED,
      altRowColor: RED_LIGHT,
      columnStyles: {
        3: { cellWidth: 28 },
        4: { halign: 'right', cellWidth: 18 },
      },
    }));
    cursor = doc.lastAutoTable.finalY + 5;
  }

  // ── Footer on every page ───────────────────────────────────────
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFillColor(...GREEN);
    doc.rect(0, PAGE_H - 8, PAGE_W, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text('HostPilot Admin  -  Confidential', MARGIN, PAGE_H - 3);
    doc.text(`Page ${p} of ${total}`, PAGE_W - MARGIN, PAGE_H - 3, { align: 'right' });
  }

  // ── Save — filename includes the selected date range ──────────
  const from     = appliedRange.from?.replaceAll('-', '') ?? 'start';
  const to       = appliedRange.to?.replaceAll('-', '')   ?? 'end';
  doc.save(`hostpilot-${from}-${to}.pdf`);
}