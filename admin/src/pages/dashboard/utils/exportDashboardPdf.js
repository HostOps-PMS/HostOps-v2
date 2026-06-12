import { jsPDF }   from 'jspdf';
import autoTable   from 'jspdf-autotable';
import logoUrl     from '../../../assets/HostOpsLOGO.png';

// ─── Formatters ───────────────────────────────────────────────────
function fmt(v) { return v == null ? '-' : String(v); }
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
function fmtDateShort(str) {
  if (!str) return '-';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

// ─── Design tokens — HostOps Green theme ─────────────────────────
const NAVY      = [30,  60,  45];   // dark green (replaces navy)
const BLUE      = [34, 170, 110];   // #22AA6E primary green accent
const BLUE_DIM  = [20, 110,  70];   // deeper green
const WHITE     = [255, 255, 255];
const GRAY_LINE = [220, 237, 228];  // green-tinted border
const GRAY_MID  = [107, 130, 118];  // muted green-gray text
const GRAY_HINT = [160, 185, 172];  // hint text
const OFF_WHITE = [247, 252, 249];  // green-tinted off white
const NEAR_BLK  = [30,  60,  45];   // dark green for primary text
const RED_HDR   = [192,  57,  43];  // cancellations header underline
const RED_TINT  = [253, 248, 248];  // cancellations alt row
const RED_TEXT  = [192,  57,  43];

// ─── Page layout ──────────────────────────────────────────────────
const PAGE_W    = 210;
const PAGE_H    = 297;
const L_COL     = 56;               // left sidebar width (cover page)
const MARGIN    = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const MONO      = 'courier';        // jsPDF built-in monospace

// ─── Continuation page top bar ────────────────────────────────────
function drawTopBar(doc) {
  doc.setFillColor(34, 170, 110);
  doc.rect(0, 0, PAGE_W, 4, 'F');
  doc.setFillColor(220, 237, 228);
  doc.rect(0, 4, PAGE_W, 1, 'F');
}

// ─── Section header — numbered, underlined ────────────────────────
function sectionHeader(doc, num, label, cursorRef, accentColor = BLUE) {
  let cursor = cursorRef;
  // Check if we need a new page
  if (cursor > PAGE_H - 40) {
    doc.addPage();
    drawTopBar(doc);
    cursor = 18;
  }
  // Number
  doc.setFont(MONO, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...accentColor);
  doc.text(num, MARGIN, cursor + 1);
  // Label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...NAVY);
  doc.text(label.toUpperCase(), MARGIN + 10, cursor + 1);
  // Rule
  doc.setDrawColor(...GRAY_LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN + 10 + doc.getTextWidth(label.toUpperCase()) + 4, cursor - 1, MARGIN + CONTENT_W, cursor - 1);
  return cursor + 9;
}

// ─── Shared autoTable config ──────────────────────────────────────
function tblCfg({ startY, head, body, headUnderColor = NAVY, altRow = OFF_WHITE, colStyles = {} }) {
  return {
    startY,
    margin:     { left: MARGIN, right: MARGIN },
    head,
    body,
    styles: {
      fontSize:    7.5,
      cellPadding: { top: 6, right: 6, bottom: 6, left: 0 },
      textColor:   GRAY_MID,
      font:        'helvetica',
      lineColor:   GRAY_LINE,
      lineWidth:   0,
    },
    headStyles: {
      fillColor:   WHITE,
      textColor:   GRAY_HINT,
      fontStyle:   'bold',
      fontSize:    6.5,
      cellPadding: { top: 5, right: 6, bottom: 5, left: 0 },
      lineWidth:   0,
    },
    alternateRowStyles: { fillColor: altRow },
    columnStyles:       colStyles,
    // Thick bottom border on header row via didDrawCell
    didDrawCell: (data) => {
      if (data.section === 'head' && data.row.index === 0) {
        const { doc: d, cell } = data;
        d.setDrawColor(...headUnderColor);
        d.setLineWidth(0.6);
        d.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
      }
      // Thin row separators
      if (data.section === 'body') {
        const { doc: d, cell } = data;
        d.setDrawColor(...GRAY_LINE);
        d.setLineWidth(0.15);
        d.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
      }
    },
    tableLineWidth: 0,
  };
}

// ─── Page footer ─────────────────────────────────────────────────
function drawFooter(doc, p, total) {
  doc.setDrawColor(...GRAY_LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, PAGE_H - 10, MARGIN + CONTENT_W, PAGE_H - 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...GRAY_HINT);
  doc.text('HostPilot  ·  Admin Dashboard  ·  Confidential', MARGIN, PAGE_H - 5.5);
  doc.text(`Page ${p} of ${total}`, PAGE_W - MARGIN, PAGE_H - 5.5, { align: 'right' });
}

// ─────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────
export async function exportDashboardPdf({ overview = {}, stats = [], appliedRange = {} }) {
  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let   cursor = 0;

  const periodStr = (appliedRange.from && appliedRange.to)
    ? `${fmtDate(appliedRange.from)}  –  ${fmtDate(appliedRange.to)}`
    : 'Current Month';
  const periodShort = (appliedRange.from && appliedRange.to)
    ? `${fmtDateShort(appliedRange.from)} – ${fmtDateShort(appliedRange.to)}, ${new Date(appliedRange.to).getFullYear()}`
    : 'Current Month';

  // ══════════════════════════════════════════════════════════════
  // PAGE 1 — COVER: full-bleed hero layout
  // ══════════════════════════════════════════════════════════════

  // ── Hero header band ────────────────────────────────────────
  const HERO_H = 70;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, HERO_H, 'F');
  doc.setFillColor(40, 80, 58);
  doc.rect(0, HERO_H - 6, PAGE_W, 6, 'F');

// Logo image
  doc.addImage(logoUrl, 'PNG', MARGIN, 10, 14, 14);

  // Wordmark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.text('HOSTPILOT', MARGIN + 18, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...BLUE);
  doc.text('ADMIN PLATFORM', MARGIN + 18, 23);

  // Confidential badge
  doc.setFillColor(...BLUE);
  doc.roundedRect(PAGE_W - MARGIN - 32, 12, 32, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...NAVY);
  doc.text('CONFIDENTIAL', PAGE_W - MARGIN - 16, 16.5, { align: 'center' });

  // Period / Generated (top right)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...GRAY_HINT);
  doc.text('REPORTING PERIOD', PAGE_W - MARGIN, 26, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...WHITE);
  doc.text(periodStr, PAGE_W - MARGIN, 31, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...GRAY_HINT);
  doc.text('GENERATED', PAGE_W - MARGIN, 38, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...WHITE);
  doc.text(
    new Date().toLocaleDateString('en-PH', { dateStyle: 'medium' }) + '  ·  ' +
    new Date().toLocaleTimeString('en-PH', { timeStyle: 'short' }) + ' PHT',
    PAGE_W - MARGIN, 43, { align: 'right' }
  );

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...WHITE);
  doc.text('Admin Dashboard', MARGIN, 50);
  doc.setTextColor(...BLUE);
  doc.text('Performance Report', MARGIN, 60);

  // ── KPI grid (3 cols x 2 rows) ──────────────────────────────
  const kpis = [
    { label: 'Monthly Revenue', value: fmtMoney(overview.monthlyRevenue ?? 0) },
    { label: 'Total Bookings',  value: fmt(overview.totalBookings ?? 0) },
    { label: 'Cancellations',   value: fmt(overview.totalCancellations ?? 0), red: true },
    { label: 'Active Clients',  value: fmt(overview.totalClients ?? 0) },
    { label: 'Properties',      value: fmt(overview.totalProperties ?? 0) },
    { label: 'Avg Occupancy',   value: (overview.overallOccupancy ?? 0) + '%' },
  ];

  const KPI_COLS   = 3;
  const KPI_GAP    = 5;
  const KPI_W      = (CONTENT_W - KPI_GAP * (KPI_COLS - 1)) / KPI_COLS;
  const KPI_H      = 22;
  const kpiStartY  = HERO_H + 10;

  kpis.forEach((k, i) => {
    const col = i % KPI_COLS;
    const row = Math.floor(i / KPI_COLS);
    const x = MARGIN + col * (KPI_W + KPI_GAP);
    const y = kpiStartY + row * (KPI_H + KPI_GAP);

    doc.setFillColor(...WHITE);
    doc.setDrawColor(...GRAY_LINE);
    doc.setLineWidth(0.25);
    doc.rect(x, y, KPI_W, KPI_H, 'FD');

    doc.setFillColor(...(k.red ? RED_TEXT : BLUE));
    doc.rect(x, y, KPI_W, 1.5, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...GRAY_HINT);
    doc.text(k.label.toUpperCase(), x + 4, y + 8);

    doc.setFont(MONO, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...(k.red ? RED_TEXT : NAVY));
    doc.text(k.value, x + 4, y + 17);
  });

  let coverY = kpiStartY + KPI_H * 2 + KPI_GAP + 10;

  // ── Two columns: Top Clients | Revenue by Channel ───────────
  const COL_GAP = 8;
  const LEFT_W  = CONTENT_W * 0.55;
  const RIGHT_X = MARGIN + LEFT_W + COL_GAP;
  const RIGHT_W = CONTENT_W - LEFT_W - COL_GAP;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text('TOP CLIENTS', MARGIN, coverY);
  doc.text('REVENUE BY CHANNEL', RIGHT_X, coverY);
  doc.setDrawColor(...GRAY_LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, coverY + 2, MARGIN + LEFT_W, coverY + 2);
  doc.line(RIGHT_X, coverY + 2, RIGHT_X + RIGHT_W, coverY + 2);

  let listY = coverY + 9;
  const topClientsCover = (overview.topClients ?? []).slice(0, 5);
  topClientsCover.forEach((c, i) => {
    doc.setFillColor(...BLUE);
    doc.circle(MARGIN + 3, listY - 1, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...WHITE);
    doc.text((c.clientName ?? '-').slice(0, 2).toUpperCase(), MARGIN + 3, listY + 0.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY);
    doc.text(c.clientName ?? '-', MARGIN + 9, listY + 1);

    doc.setFont(MONO, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY);
    doc.text(fmtMoney(c.revenue), MARGIN + LEFT_W, listY + 1, { align: 'right' });

    if (i < topClientsCover.length - 1) {
      doc.setDrawColor(...GRAY_LINE);
      doc.setLineWidth(0.15);
      doc.line(MARGIN, listY + 4, MARGIN + LEFT_W, listY + 4);
    }
    listY += 9;
  });

  const byChannelCover = overview.byChannel ?? {};
  const channelEntries = Object.entries(byChannelCover);
  const maxChRevenue = Math.max(1, ...channelEntries.map(([, d]) => d.revenue ?? 0));
  let chY = coverY + 9;
  channelEntries.slice(0, 5).forEach(([ch, d]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text(ch, RIGHT_X, chY);

    doc.setFont(MONO, 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...NAVY);
    doc.text(fmtMoney(d.revenue), RIGHT_X + RIGHT_W, chY, { align: 'right' });

    const pct = (d.revenue ?? 0) / maxChRevenue;
    doc.setFillColor(...GRAY_LINE);
    doc.rect(RIGHT_X, chY + 2, RIGHT_W, 1.5, 'F');
    doc.setFillColor(...BLUE);
    doc.rect(RIGHT_X, chY + 2, RIGHT_W * pct, 1.5, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...GRAY_HINT);
    doc.text(`${fmt(d.bookings)} bookings  ·  ${fmt(d.nights)} nights`, RIGHT_X, chY + 7);

    chY += 12;
  });

  coverY = Math.max(listY, chY) + 4;

  // ── Property Occupancy grid (3 cols x 2 rows) ───────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text('PROPERTY OCCUPANCY', MARGIN, coverY);
  doc.setDrawColor(...GRAY_LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, coverY + 2, MARGIN + CONTENT_W, coverY + 2);

  const occCover  = (overview.occupancyBreakdown ?? []).slice(0, 6);
  const OCC_COLS  = 3;
  const OCC_GAP   = 5;
  const OCC_W     = (CONTENT_W - OCC_GAP * (OCC_COLS - 1)) / OCC_COLS;
  const OCC_H     = 16;
  const occStartY = coverY + 8;

  occCover.forEach((o, i) => {
    const col = i % OCC_COLS;
    const row = Math.floor(i / OCC_COLS);
    const x = MARGIN + col * (OCC_W + OCC_GAP);
    const y = occStartY + row * (OCC_H + OCC_GAP);

    doc.setFillColor(...OFF_WHITE);
    doc.setDrawColor(...GRAY_LINE);
    doc.setLineWidth(0.2);
    doc.rect(x, y, OCC_W, OCC_H, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...NAVY);
    const nameLines = doc.splitTextToSize(o.propertyName ?? '-', OCC_W - 6);
    doc.text(nameLines[0], x + 3, y + 5);

    doc.setFont(MONO, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...((o.occupancy ?? 0) > 0 ? NAVY : GRAY_HINT));
    doc.text(`${o.occupancy ?? 0}%`, x + 3, y + 11.5);

    const pct = (o.occupancy ?? 0) / 100;
    doc.setFillColor(...GRAY_LINE);
    doc.rect(x + 3, y + OCC_H - 3, OCC_W - 6, 1.5, 'F');
    if (pct > 0) {
      doc.setFillColor(...BLUE);
      doc.rect(x + 3, y + OCC_H - 3, (OCC_W - 6) * pct, 1.5, 'F');
    }
  });

  coverY = occStartY + OCC_H * 2 + OCC_GAP + 8;

  // ── Contents pills ───────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...GRAY_HINT);
  doc.text('CONTENTS', MARGIN, coverY);

  const contentItems = ['01 Top Clients', '02 Occupancy', '03 Channels', '04 Bookings', '05 Cancellations'];
  let pillX = MARGIN;
  const pillY = coverY + 4;
  contentItems.forEach(item => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    const w = doc.getTextWidth(item) + 6;
    doc.setFillColor(...OFF_WHITE);
    doc.setDrawColor(...GRAY_LINE);
    doc.setLineWidth(0.2);
    doc.roundedRect(pillX, pillY, w, 6, 1.5, 1.5, 'FD');
    doc.setTextColor(...BLUE_DIM);
    doc.text(item, pillX + 3, pillY + 4);
    pillX += w + 3;
  });

  // ══════════════════════════════════════════════════════════════
  // PAGE 2+ — Data pages
  // ══════════════════════════════════════════════════════════════
  doc.addPage();
  drawTopBar(doc);
  cursor = 18;

  // ── Section 01: Top Clients ───────────────────────────────────
  const topClients = overview.topClients ?? [];
  if (topClients.length > 0) {
    cursor = sectionHeader(doc, '01', 'Top Clients by Revenue', cursor);
    autoTable(doc, tblCfg({
      startY:    cursor,
      head:      [['Rank', 'Client', 'Revenue', 'Bookings', 'Properties']],
      body:      topClients.map((c, i) => [
        String(i + 1).padStart(2, '0'),
        c.clientName ?? '-',
        fmtMoney(c.revenue),
        fmt(c.bookings),
        Array.isArray(c.properties) ? c.properties.length : '-',
      ]),
      colStyles: {
        0: { cellWidth: 14, font: MONO, fontStyle: 'bold', textColor: BLUE },
        1: { fontStyle: 'bold', textColor: NAVY },
        2: { halign: 'right', cellWidth: 30, font: MONO, textColor: NAVY },
        3: { halign: 'right', cellWidth: 24, font: MONO },
        4: { halign: 'right', cellWidth: 24, font: MONO },
      },
    }));
    cursor = doc.lastAutoTable.finalY + 8;
  }

  // ── Section 02: Occupancy — as inline progress bars via didDrawCell ──
  const occupancy = overview.occupancyBreakdown ?? [];
  if (occupancy.length > 0) {
    if (cursor > PAGE_H - 60) { doc.addPage(); drawTopBar(doc); cursor = 18; }
    cursor = sectionHeader(doc, '02', 'Property Occupancy', cursor);

    autoTable(doc, {
      startY: cursor,
      margin: { left: MARGIN, right: MARGIN },
      head:   [['Property  ·  Client', 'Occupancy']],
      body:   occupancy.map(o => [
        `${o.propertyName ?? '-'}  ·  ${o.clientName ?? '-'}`,
        (o.occupancy ?? 0),
      ]),
      styles: {
        fontSize:    7.5,
        cellPadding: { top: 7, right: 6, bottom: 7, left: 0 },
        textColor:   GRAY_MID,
        font:        'helvetica',
        lineWidth:   0,
      },
      headStyles: {
        fillColor:   WHITE,
        textColor:   GRAY_HINT,
        fontStyle:   'bold',
        fontSize:    6.5,
        cellPadding: { top: 5, right: 6, bottom: 5, left: 0 },
        lineWidth:   0,
      },
      alternateRowStyles: { fillColor: OFF_WHITE },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: CONTENT_W - 120, halign: 'right' },
      },
      didDrawCell: (data) => {
        // Header thick line
        if (data.section === 'head') {
          const { doc: d, cell } = data;
          d.setDrawColor(...NAVY); d.setLineWidth(0.6);
          d.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
        }
        // Row separator
        if (data.section === 'body') {
          const { doc: d, cell } = data;
          d.setDrawColor(...GRAY_LINE); d.setLineWidth(0.15);
          d.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
        }
        // Draw inline bar in col 1 body
        if (data.section === 'body' && data.column.index === 1) {
          const pct    = Number(data.row.raw[1]) / 100;
          const { doc: d, cell } = data;
          const barH   = 2.5;
          const barY   = cell.y + cell.height / 2 - barH / 2 + 1;
          const barW   = 36;
          const barX   = cell.x + cell.width - barW - 14;
          // track
          d.setFillColor(...GRAY_LINE);
          d.rect(barX, barY, barW, barH, 'F');
          // fill
          if (pct > 0) {
            d.setFillColor(...BLUE);
            d.rect(barX, barY, barW * pct, barH, 'F');
          }
          // label
          d.setFont(MONO, 'bold');
          d.setFontSize(7);
          d.setTextColor(...(pct > 0 ? NAVY : GRAY_HINT));
          d.text(`${data.row.raw[1]}%`, cell.x + cell.width - 1, cell.y + cell.height / 2 + 1.5, { align: 'right' });
        }
      },
      tableLineWidth: 0,
    });
    cursor = doc.lastAutoTable.finalY + 8;
  }

  // ── Section 03: Revenue by Channel ───────────────────────────
  const byChannel   = overview.byChannel ?? {};
  const channelKeys = Object.keys(byChannel);
  if (channelKeys.length > 0) {
    if (cursor > PAGE_H - 50) { doc.addPage(); drawTopBar(doc); cursor = 18; }
    cursor = sectionHeader(doc, '03', 'Revenue by Channel', cursor);
    autoTable(doc, tblCfg({
      startY:    cursor,
      head:      [['Channel', 'Revenue', 'Bookings', 'Nights']],
      body:      channelKeys.map(ch => {
        const d = byChannel[ch];
        return [ch, fmtMoney(d.revenue), fmt(d.bookings), fmt(d.nights)];
      }),
      colStyles: {
        0: { fontStyle: 'bold', textColor: NAVY },
        1: { halign: 'right', cellWidth: 32, font: MONO, textColor: NAVY },
        2: { halign: 'right', cellWidth: 24, font: MONO },
        3: { halign: 'right', cellWidth: 24, font: MONO },
      },
    }));
    cursor = doc.lastAutoTable.finalY + 8;
  }

  // ── Section 04: Recent Bookings ───────────────────────────────
  const recentBookings = overview.recentBookings ?? [];
  if (recentBookings.length > 0) {
    if (cursor > PAGE_H - 50) { doc.addPage(); drawTopBar(doc); cursor = 18; }
    cursor = sectionHeader(doc, '04', `Recent Bookings  ·  ${periodShort}`, cursor);
    autoTable(doc, tblCfg({
      startY:    cursor,
      head:      [['Guest', 'Property', 'Channel', 'Arrival', 'Nts', 'Price']],
      body:      recentBookings.slice(0, 30).map(b => [
        b.guestName    ?? '-',
        b.propertyName ?? '-',
        b.channel      ?? '-',
        fmtDateShort(b.arrival),
        fmt(b.nights),
        fmtMoney(b.price),
      ]),
      colStyles: {
        0: { fontStyle: 'bold', textColor: NAVY },
        2: { cellWidth: 26 },
        3: { cellWidth: 22, font: MONO },
        4: { halign: 'right', cellWidth: 12, font: MONO },
        5: { halign: 'right', cellWidth: 24, font: MONO, textColor: NAVY, fontStyle: 'bold' },
      },
    }));
    cursor = doc.lastAutoTable.finalY + 8;
  }

  // ── Section 05: Recent Cancellations ─────────────────────────
  const recentCancellations = overview.recentCancellations ?? [];
  if (recentCancellations.length > 0) {
    if (cursor > PAGE_H - 50) { doc.addPage(); drawTopBar(doc); cursor = 18; }
    cursor = sectionHeader(doc, '05', `Recent Cancellations  ·  ${periodShort}`, cursor, RED_HDR);
    autoTable(doc, tblCfg({
      startY:         cursor,
      head:           [['Guest', 'Property', 'Client', 'Arrival', 'Nights']],
      headUnderColor: RED_HDR,
      altRow:         RED_TINT,
      body:           recentCancellations.slice(0, 30).map(c => [
        c.guestName    ?? '-',
        c.propertyName ?? '-',
        c.clientName   ?? '-',
        fmtDateShort(c.arrival),
        fmt(c.nights),
      ]),
      colStyles: {
        0: { fontStyle: 'bold', textColor: NAVY },
        3: { cellWidth: 26, font: MONO },
        4: { halign: 'right', cellWidth: 18, font: MONO },
      },
    }));
  }

  // ── Footers on all pages ──────────────────────────────────────
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, p, total);
  }

  // ── Save ──────────────────────────────────────────────────────
  const from = appliedRange.from?.replaceAll('-', '') ?? 'start';
  const to   = appliedRange.to?.replaceAll('-', '')   ?? 'end';
  doc.save(`hostpilot-${from}-${to}.pdf`);
}