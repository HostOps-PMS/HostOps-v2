function fmtMoney(val) {
  const n = Number(val || 0);
  return 'PHP ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ymd) {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length < 3) return ymd;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[+parts[1] - 1] + ' ' + +parts[2] + ', ' + parts[0];
}

const C = {
  dark:       [12,  28,  20],
  green:      [38,  166, 118],
  greenLight: [234, 248, 241],
  greenMid:   [20,  80,  50],
  white:      [255, 255, 255],
  muted:      [154, 184, 169],
  text:       [12,  28,  20],
  subtext:    [106, 139, 122],
  border:     [216, 235, 224],
  gray:       [248, 250, 248],
};

const PAGE_H         = 210;
const FOOTER_Y       = PAGE_H - 10;
const FOOTER_TY      = PAGE_H - 4;
const CONTENT_BOTTOM = FOOTER_Y - 3;

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

async function ensureLibs() {
  if (!window.jspdf) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }
  if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('jsPDF failed to load.');
  if (typeof window.jspdf.jsPDF.API.autoTable !== 'function') {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
  }
}

function drawFooter(doc, pageNum, pageCount, period, pageWidth) {
  doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.rect(0, FOOTER_Y, pageWidth, 10, 'F');
  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.rect(0, FOOTER_Y, pageWidth, 0.6, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
  doc.text('HostOps Analytics', 18, FOOTER_TY);
  doc.text('Page ' + pageNum + ' of ' + pageCount, pageWidth / 2, FOOTER_TY, { align: 'center' });
  doc.text(fmtDate(period.from) + ' - ' + fmtDate(period.to), pageWidth - 18, FOOTER_TY, { align: 'right' });
}

function drawPageHeader(doc, ownerName, period, pageWidth) {
  // Full dark header band
  doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.rect(0, 0, pageWidth, 22, 'F');

  // Green bottom border of header
  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.rect(0, 22, pageWidth, 1, 'F');

  // Left green pill — logo
  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.roundedRect(12, 6, 22, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.text('HOSTOPS', 23, 12.5, { align: 'center' });

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(C.white[0], C.white[1], C.white[2]);
  doc.text('Analytics Report', 40, 13);

  // Separator dot
  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.circle(118, 11, 1, 'F');

  // Owner name
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
  doc.text(ownerName, 123, 13);

  // Right side — period + generated
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(C.green[0], C.green[1], C.green[2]);
  doc.text(fmtDate(period.from) + '  -  ' + fmtDate(period.to), pageWidth - 18, 10, { align: 'right' });
  doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
  doc.setFontSize(6.5);
  doc.text('Generated ' + new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }), pageWidth - 18, 17, { align: 'right' });
}

function drawSectionLabel(doc, label, y, pageWidth, margin) {
  doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 9, 1.5, 1.5, 'F');
  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.rect(margin, y, 3.5, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(C.white[0], C.white[1], C.white[2]);
  doc.text(label.toUpperCase(), margin + 8, y + 6.2);
  return y + 13;
}

function drawKpiAndBreakdown(doc, kpiCards, channelEntries, byChannel, y, pageWidth, margin) {
  const totalRev = channelEntries.reduce((s, e) => s + (e[1].revenue || 0), 0);

  // Left column: KPI cards (6 stacked in 2 cols x 3 rows)
  const kpiAreaW = 148;
  const cardCols = 2;
  const gap      = 4;
  const cardW    = (kpiAreaW - gap) / cardCols;
  const cardH    = 20;

  kpiCards.forEach((card, i) => {
    const col = i % cardCols;
    const row = Math.floor(i / cardCols);
    const cx  = margin + col * (cardW + gap);
    const cy  = y + row * (cardH + gap);

    // Shadow
    doc.setFillColor(C.border[0], C.border[1], C.border[2]);
    doc.roundedRect(cx + 0.8, cy + 0.8, cardW, cardH, 2, 2, 'F');

    // Card bg
    doc.setFillColor(C.white[0], C.white[1], C.white[2]);
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, 'F');

    // Green top bar
    doc.setFillColor(C.green[0], C.green[1], C.green[2]);
    doc.roundedRect(cx, cy, cardW, 2.5, 1, 1, 'F');

    // Border
    doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
    doc.setLineWidth(0.25);
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, 'S');

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(C.subtext[0], C.subtext[1], C.subtext[2]);
    doc.text(card.label.toUpperCase(), cx + 4, cy + 9);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(C.text[0], C.text[1], C.text[2]);
    doc.text(String(card.value), cx + 4, cy + 17);
  });

  // Right column: Platform Breakdown table
  const tableX = margin + kpiAreaW + 6;
  const tableW = pageWidth - tableX - margin;

  // Table header
  doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.roundedRect(tableX, y, tableW, 8, 1.5, 1.5, 'F');
  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.rect(tableX, y, 3, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(C.white[0], C.white[1], C.white[2]);
  doc.text('PLATFORM BREAKDOWN', tableX + 6, y + 5.5);

  // Column headers
  const colY      = y + 12;
  const colLabels = ['Channel', 'Revenue', 'Bk', 'Nts', 'Share'];
  const colWidths = [tableW * 0.32, tableW * 0.30, tableW * 0.12, tableW * 0.12, tableW * 0.14];
  let colX        = tableX;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(C.subtext[0], C.subtext[1], C.subtext[2]);
  colLabels.forEach((lbl, ci) => {
    doc.text(lbl, colX + 2, colY, ci > 0 ? { align: 'left' } : {});
    colX += colWidths[ci];
  });

  // Divider
  doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
  doc.setLineWidth(0.3);
  doc.line(tableX, colY + 2, tableX + tableW, colY + 2);

  // Rows
  channelEntries.forEach(([ch, v], ri) => {
    const rowY  = colY + 6 + ri * 10;
    const share = totalRev > 0 ? ((v.revenue || 0) / totalRev * 100).toFixed(1) : '0.0';

    if (ri % 2 === 1) {
      doc.setFillColor(C.greenLight[0], C.greenLight[1], C.greenLight[2]);
      doc.rect(tableX, rowY - 4, tableW, 10, 'F');
    }

    const vals = [ch, fmtMoney(v.revenue || 0), String(v.bookings || 0), String(v.nights || 0), share + '%'];
    let rx = tableX;

    vals.forEach((val, ci) => {
      if (ci === 1) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(C.green[0], C.green[1], C.green[2]);
        doc.setFontSize(7);
      } else if (ci === 4) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(C.subtext[0], C.subtext[1], C.subtext[2]);
        doc.setFontSize(7);
      } else {
        doc.setFont('helvetica', ci === 0 ? 'bold' : 'normal');
        doc.setTextColor(C.text[0], C.text[1], C.text[2]);
        doc.setFontSize(7);
      }
      doc.text(val, rx + 2, rowY + 2);
      rx += colWidths[ci];
    });

    // Row divider
    doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
    doc.setLineWidth(0.15);
    doc.line(tableX, rowY + 5, tableX + tableW, rowY + 5);
  });

  // Total row
  const totalRowY = colY + 6 + channelEntries.length * 10 + 2;
  doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.rect(tableX, totalRowY - 3, tableW, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(C.white[0], C.white[1], C.white[2]);
  doc.text('TOTAL', tableX + 2, totalRowY + 3);
  doc.setTextColor(C.green[0], C.green[1], C.green[2]);
  doc.text(fmtMoney(totalRev), tableX + colWidths[0] + 2, totalRowY + 3);

  const kpiRows    = Math.ceil(kpiCards.length / cardCols);
  const kpiHeight  = kpiRows * (cardH + gap);
  const tableHeight = totalRowY + 9 - y;
  return y + Math.max(kpiHeight, tableHeight) + 6;
}

function getGuestName(b) {
  const first = (b.firstname || b['first-name'] || '').trim();
  const last  = (b.lastname  || b['last-name']  || '').trim();
  const full  = (first + ' ' + last).trim();
  if (full) return full;
  const notice = (b.notice || '').trim();
  if (notice && notice.length < 40) return notice;
  return 'Walk-in';
}

function getBalance(b) {
  const raw = b['price-details'] || b.priceDetails || '';
  if (!raw) return '';
  const lines = raw.split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean);
  const paid  = lines.find(l => l.toLowerCase().includes('total paid'));
  if (paid) return paid;
  const bal   = lines.find(l => l.toLowerCase().includes('balance'));
  if (bal) return bal;
  return lines[lines.length - 1] || '';
}

export async function exportDashboardPDF(dashState) {
  await ensureLibs();

  const jsPDF     = window.jspdf.jsPDF;
  const data      = dashState.rawData || {};
  const stats     = data.stats        || {};
  const byChannel = data.byChannel    || {};
  const bookings  = data.bookings     || [];
  const period    = data.period       || { from: dashState.from, to: dashState.to };
  const ownerName = data.ownerName    || 'Dashboard';

  const doc       = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin    = 14;

  // ── PAGE 1 HEADER ─────────────────────────────────────────────────────────
  drawPageHeader(doc, ownerName, period, pageWidth);
  let y = 28;

  // ── KPI + PLATFORM BREAKDOWN SIDE BY SIDE ────────────────────────────────
  const revenue      = stats.revenue       || stats.totalRevenue      || 0;
  const bookingCount = stats.bookings      || stats.totalBookings      || 0;
  const cancels      = stats.cancellations || stats.totalCancellations || 0;
  const nightsAff    = stats.nightsAffected|| stats.cancelledNights    || 0;
  const bookedN      = stats.bookedNights  || stats.totalNights        || 0;
  const occupancy    = stats.occupancyRate || stats.occupancy          || 0;

  const kpiCards = [
    { label: 'Total Revenue',   value: fmtMoney(revenue) },
    { label: 'Total Bookings',  value: String(bookingCount) },
    { label: 'Cancellations',   value: String(cancels) },
    { label: 'Nights Affected', value: String(nightsAff) },
    { label: 'Booked Nights',   value: String(bookedN) },
    { label: 'Occupancy Rate',  value: occupancy + '%' },
  ];

  const channelEntries = Object.entries(byChannel);
  y = drawKpiAndBreakdown(doc, kpiCards, channelEntries, byChannel, y, pageWidth, margin);

  // ── BOOKINGS TABLE ────────────────────────────────────────────────────────
  if (bookings.length > 0) {
    if (y + 40 > CONTENT_BOTTOM) { doc.addPage(); y = 16; }
    y = drawSectionLabel(doc, 'Bookings (' + bookings.length + ')', y, pageWidth, margin);

    const bookingRows = bookings.map(b => [
      getGuestName(b),
      (b.apartment && b.apartment.name) || b.apartmentName || b.property || '-',
      (b.channel && b.channel.name) || (typeof b.channel === 'string' ? b.channel : '') || b.source || '-',
      fmtDate(b.arrival   || b.checkIn  || ''),
      fmtDate(b.departure || b.checkOut || ''),
      fmtMoney(b.price || b.amount || 0),
      getBalance(b),
    ]);

    doc.autoTable({
      startY: y,
      head: [['Guest', 'Room', 'Channel', 'Check-in', 'Check-out', 'Amount', 'Balance / Notes']],
      body: bookingRows,
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor:   C.dark,
        textColor:   C.white,
        fontStyle:   'bold',
        fontSize:    8.5,
        cellPadding: 4,
      },
      bodyStyles: {
        fontSize:    8,
        cellPadding: 3.5,
      },
      columnStyles: {
        0: { cellWidth: 46 },
        1: { cellWidth: 34 },
        2: { cellWidth: 28 },
        3: { cellWidth: 26 },
        4: { cellWidth: 26 },
        5: { cellWidth: 32, fontStyle: 'bold', halign: 'right', textColor: C.green },
        6: { cellWidth: 'auto', fontSize: 7.5, textColor: C.subtext },
      },
      alternateRowStyles: { fillColor: C.greenLight },
      styles: {
        font:      'helvetica',
        lineColor: C.border,
        lineWidth: 0.2,
        overflow:  'ellipsize',
      },
      didDrawPage: () => {
        drawPageHeader(doc, ownerName, period, pageWidth);
      },
    });
  }

  // ── FOOTERS ───────────────────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(doc, i, pageCount, period, pageWidth);
  }

  doc.save('hostops-report_' + (period.from || 'all') + '_' + (period.to || 'all') + '.pdf');
}