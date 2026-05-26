/**
 * Analytics PDF Export Service
 * Loads jsPDF + jspdf-autotable dynamically from CDN — no npm install needed.
 *
 * Fixes:
 *  - Removed bookings section (per request)
 *  - Fixed garbled revenue: jsPDF Helvetica does not support Unicode ₱,
 *    replaced with ASCII-safe "PHP " prefix
 *  - Fixed header dash (–) also not in Helvetica, replaced with " to "
 */

/* ─── Formatters ────────────────────────────────────────────────── */

// jsPDF's built-in Helvetica does NOT render Unicode chars like ₱ or –.
// Use plain ASCII equivalents to avoid garbled output.
function fmtMoney(val) {
  const n = Number(val || 0);
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return 'PHP ' + formatted;
}

function fmtDate(ymd) {
  if (!ymd) return '';
  const parts = ymd.split('-');
  const y = parts[0], m = parts[1], d = parts[2];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[+m - 1] + ' ' + +d + ', ' + y;
}

/* ─── Color palette (matches dashboard) ────────────────────────── */
const C = {
  darkGreen:  [12,  28,  20],
  green:      [38,  166, 118],
  greenLight: [234, 248, 241],
  white:      [255, 255, 255],
  muted:      [154, 184, 169],
  text:       [12,  28,  20],
  subtext:    [106, 139, 122],
  border:     [216, 235, 224],
};

/* ─── Dynamically load a script tag (CDN) ───────────────────────── */
function loadScript(src) {
  return new Promise(function(resolve, reject) {
    if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
    var s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = function() { reject(new Error('Failed to load: ' + src)); };
    document.head.appendChild(s);
  });
}

/* ─── Ensure jsPDF + autoTable are available ───────────────────── */
async function ensureLibs() {
  if (!window.jspdf) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error('jsPDF failed to load from CDN.');
  }
  if (typeof window.jspdf.jsPDF.API.autoTable !== 'function') {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
  }
}

/* ─── Helper: draw a section heading ───────────────────────────── */
function sectionTitle(doc, label, y, pageWidth, margin) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(C.text[0], C.text[1], C.text[2]);
  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.rect(margin, y - 3, 3, 6, 'F');
  doc.text(label, margin + 6, y + 1);
  doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
  doc.setLineWidth(0.3);
  doc.line(margin + 6, y + 4, pageWidth - margin, y + 4);
  return y + 10;
}

/* ─── Main export function ──────────────────────────────────────── */
export async function exportDashboardPDF(dashState) {
  await ensureLibs();

  var jsPDF = window.jspdf.jsPDF;

  var data       = dashState.rawData || {};
  var stats      = data.stats       || {};
  var byChannel  = data.byChannel   || {};
  var properties = data.properties  || [];
  var period     = data.period      || { from: dashState.from, to: dashState.to };
  var ownerName  = data.ownerName   || 'Dashboard';

  var doc       = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  var pageWidth = doc.internal.pageSize.getWidth();
  var margin    = 18;

  /* ── Cover header band ─────────────────────────────────────── */
  doc.setFillColor(C.darkGreen[0], C.darkGreen[1], C.darkGreen[2]);
  doc.rect(0, 0, pageWidth, 46, 'F');

  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.roundedRect(margin, 10, 10, 10, 2, 2, 'F');
  doc.setTextColor(C.white[0], C.white[1], C.white[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('HO', margin + 2.5, 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('HostOps Analytics Report', margin + 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
  // Use plain " - " instead of em dash (–) — not in Helvetica
  doc.text(ownerName + '  |  ' + fmtDate(period.from) + ' - ' + fmtDate(period.to), margin + 14, 26);
  doc.text(
    'Generated: ' + new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }),
    margin + 14, 33,
  );

  var badgeRight = pageWidth - margin;
  doc.setFillColor(25, 60, 40);
  doc.roundedRect(badgeRight - 52, 12, 52, 22, 4, 4, 'F');
  doc.setTextColor(C.green[0], C.green[1], C.green[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('REPORT PERIOD', badgeRight - 26, 20, { align: 'center' });
  doc.setFontSize(8.5);
  doc.setTextColor(C.white[0], C.white[1], C.white[2]);
  doc.text(fmtDate(period.from), badgeRight - 26, 27, { align: 'center' });
  doc.text(fmtDate(period.to),   badgeRight - 26, 32, { align: 'center' });

  var y = 56;

  /* ── KPI Summary ───────────────────────────────────────────── */
  y = sectionTitle(doc, 'Key Performance Indicators', y, pageWidth, margin);

  // Try multiple field name variants since API shape may differ
  var revenue      = stats.revenue      || stats.totalRevenue      || 0;
  var bookingCount = stats.bookings     || stats.totalBookings      || 0;
  var cancels      = stats.cancellations|| stats.totalCancellations || 0;
  var nightsAff    = stats.nightsAffected || stats.cancelledNights  || stats.affectedNights || 0;
  var bookedN      = stats.bookedNights || stats.totalNights        || 0;
  var occupancy    = stats.occupancyRate|| stats.occupancy          || 0;

  var kpiData = [
    ['Total Revenue',   fmtMoney(revenue)],
    ['Total Bookings',  String(bookingCount)],
    ['Cancellations',   String(cancels)],
    ['Nights Affected', String(nightsAff)],
    ['Booked Nights',   String(bookedN)],
    ['Occupancy Rate',  occupancy + '%'],
  ];

  doc.autoTable({
    startY: y,
    head: [['Metric', 'Value']],
    body: kpiData,
    margin: { left: margin, right: margin },
    headStyles:         { fillColor: C.green, textColor: C.white, fontStyle: 'bold', fontSize: 9 },
    bodyStyles:         { fontSize: 10 },
    columnStyles:       { 1: { fontStyle: 'bold', textColor: C.darkGreen } },
    alternateRowStyles: { fillColor: C.greenLight },
    styles:             { font: 'helvetica', cellPadding: 4 },
  });

  y = doc.lastAutoTable.finalY + 14;

  /* ── Platform Breakdown ────────────────────────────────────── */
  var channelEntries = Object.entries(byChannel);
  if (channelEntries.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    y = sectionTitle(doc, 'Platform Breakdown', y, pageWidth, margin);

    var totalRev = channelEntries.reduce(function(s, e) { return s + (e[1].revenue || 0); }, 0);

    var channelRows = channelEntries.map(function(entry) {
      var ch = entry[0];
      var v  = entry[1];
      var share = totalRev > 0 ? ((v.revenue || 0) / totalRev * 100).toFixed(1) : '0.0';
      return [ch, fmtMoney(v.revenue || 0), String(v.bookings || 0), String(v.nights || 0), share + '%'];
    });

    doc.autoTable({
      startY: y,
      head: [['Channel', 'Revenue', 'Bookings', 'Nights', 'Share']],
      body: channelRows,
      margin: { left: margin, right: margin },
      headStyles:         { fillColor: C.green, textColor: C.white, fontStyle: 'bold', fontSize: 9 },
      bodyStyles:         { fontSize: 9.5 },
      columnStyles:       { 1: { fontStyle: 'bold' }, 4: { textColor: C.subtext } },
      alternateRowStyles: { fillColor: C.greenLight },
      styles:             { font: 'helvetica', cellPadding: 3.5 },
    });

    y = doc.lastAutoTable.finalY + 14;
  }

  /* ── Footer on every page ──────────────────────────────────── */
  var pageCount = doc.internal.getNumberOfPages();
  for (var i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(C.darkGreen[0], C.darkGreen[1], C.darkGreen[2]);
    doc.rect(0, 285, pageWidth, 12, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
    doc.text('HostOps Analytics', margin, 292);
    doc.text('Page ' + i + ' of ' + pageCount, pageWidth / 2, 292, { align: 'center' });
    doc.text(fmtDate(period.from) + ' - ' + fmtDate(period.to), pageWidth - margin, 292, { align: 'right' });
  }

  /* ── Save ──────────────────────────────────────────────────── */
  var from = period.from || 'all';
  var to   = period.to   || 'all';
  doc.save('hostops-report_' + from + '_' + to + '.pdf');
}