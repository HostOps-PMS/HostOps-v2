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
// ── Header and footer geometry ─────────────────────────────────────────────
// HEADER_H: height of the dark header band drawn on every page.
// Content must not start before CONTENT_TOP on every page.
const HEADER_H       = 22;
const CONTENT_TOP    = HEADER_H + 5;   // first safe Y after the header
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

// ── Load an image URL as a base64 data URL ────────────────────────────────
// Returns null if the image fails to load (network error, CORS, etc.)
async function loadImageAsDataUrl(src) {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth  || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    // Append a cache-bust only for relative URLs to avoid CORS preflight issues
    img.src = src.startsWith('http') ? src : src + '?cb=' + Date.now();
  });
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

/**
 * Draws the full dark header band on every page.
 * Property image and name are now shown in the content area (drawPropertyBanner),
 * so the page header stays clean: just HOSTOPS pill, title, period, generated.
 *
 * @param {object} doc           - jsPDF instance
 * @param {string} businessName  - e.g. "Juan dela Cruz Properties"
 * @param {string} propertyName  - e.g. "Barkada Room" (selected property, or empty for all)
 * @param {object} period        - { from, to }
 * @param {number} pageWidth
 */
function drawPageHeader(doc, businessName, propertyName, period, pageWidth) {
  // ── Full dark header band ────────────────────────────────────────────────
  doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.rect(0, 0, pageWidth, HEADER_H, 'F');

  // ── Green bottom border of header ────────────────────────────────────────
  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.rect(0, HEADER_H, pageWidth, 1, 'F');

  // ── Left green pill — logo ───────────────────────────────────────────────
  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.roundedRect(12, 6, 22, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.text('HOSTOPS', 23, 12.5, { align: 'center' });

  // ── Title ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(C.white[0], C.white[1], C.white[2]);
  doc.text('Analytics Report', 40, 13);

  // ── Separator dot ────────────────────────────────────────────────────────
  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.circle(118, 11, 1, 'F');

  // ── Business name ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
  doc.text(businessName || 'Dashboard', 123, 13);

  // ── Right side — period + generated ──────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(C.green[0], C.green[1], C.green[2]);
  doc.text(fmtDate(period.from) + '  -  ' + fmtDate(period.to), pageWidth - 18, 10, { align: 'right' });
  doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
  doc.setFontSize(6.5);
  doc.text('Generated ' + new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }), pageWidth - 18, 17, { align: 'right' });
}

/**
 * Draws the property image + title block on the LEFT side of the content area.
 * This is drawn ABOVE the Platform Breakdown table on page 1 only.
 *
 * Layout (left column):
 *   ┌──────────────────────────────────────┐
 *   │  [property image, full width]        │
 *   │  Business Name                       │
 *   │  Property Name badge (if selected)   │
 *   └──────────────────────────────────────┘
 *
 * @param {object} doc
 * @param {string} businessName
 * @param {string} propertyName       - selected property name, or '' for all
 * @param {number} x                  - left edge of the column
 * @param {number} y                  - top of the block
 * @param {number} w                  - width of the column
 * @param {string|null} imgDataUrl    - base64 property image, or null
 * @returns {number}                  - new Y after the block
 */
function drawPropertyBanner(doc, businessName, propertyName, x, y, w, imgDataUrl) {
  const imgH     = 28;   // image height in mm
  const padding  = 3;

  // ── Background card ───────────────────────────────────────────────────────
  const cardH = imgH + (propertyName ? 22 : 16);
  doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.roundedRect(x, y, w, cardH, 2, 2, 'F');

  // ── Green top accent bar ──────────────────────────────────────────────────
  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.roundedRect(x, y, w, 2.5, 1, 1, 'F');

  // ── Property image ────────────────────────────────────────────────────────
  if (imgDataUrl) {
    try {
      doc.addImage(imgDataUrl, 'JPEG', x, y + 2.5, w, imgH, '', 'FAST');
    } catch {
      // Image failed — leave blank
    }
  } else {
    // Placeholder: dark rect with icon-style "no image" indicator
    doc.setFillColor(C.greenMid[0], C.greenMid[1], C.greenMid[2]);
    doc.rect(x, y + 2.5, w, imgH, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
    doc.text('No image', x + w / 2, y + 2.5 + imgH / 2 + 1, { align: 'center' });
  }

  // ── Business name ─────────────────────────────────────────────────────────
  const textY = y + 2.5 + imgH + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(C.white[0], C.white[1], C.white[2]);
  // Truncate if too long for the column
  const maxChars = Math.floor(w / 2);
  const safeName = (businessName || 'Dashboard').length > maxChars
    ? (businessName || 'Dashboard').slice(0, maxChars - 1) + '…'
    : (businessName || 'Dashboard');
  doc.text(safeName, x + padding, textY);

  // ── Property name badge ───────────────────────────────────────────────────
  if (propertyName) {
    const badgeY  = textY + 5;
    const badgeW  = Math.min(w - padding * 2, propertyName.length * 1.7 + 8);
    doc.setFillColor(C.greenMid[0], C.greenMid[1], C.greenMid[2]);
    doc.roundedRect(x + padding, badgeY - 3.5, badgeW, 7, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(C.green[0], C.green[1], C.green[2]);
    doc.text(
      propertyName.length > Math.floor(badgeW / 1.7) ? propertyName.slice(0, Math.floor(badgeW / 1.7) - 1) + '…' : propertyName,
      x + padding + badgeW / 2, badgeY + 0.5, { align: 'center' }
    );
  }

  return y + cardH + 4;
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

/**
 * Draws the two-column block:
 *   LEFT  column: property image+title banner  THEN  Platform Breakdown table
 *   RIGHT column: KPI stat cards (2 cols × 3 rows)
 *
 * The two columns share the same top Y and we return the lower of the two
 * bottom edges so the caller can continue below.
 */
function drawKpiAndBreakdown(
  doc, kpiCards, channelEntries, byChannel,
  y, pageWidth, margin,
  businessName, propertyName, propertyImageDataUrl
) {
  const totalRev   = channelEntries.reduce((s, e) => s + (e[1].revenue || 0), 0);
  const gap        = 6;   // gap between left and right columns

  // ── Column widths ─────────────────────────────────────────────────────────
  // Left column holds: property banner + platform breakdown
  // Right column holds: KPI cards
  const totalW   = pageWidth - margin * 2;
  const leftW    = totalW * 0.48;   // ~48 % for breakdown side
  const rightW   = totalW - leftW - gap;
  const leftX    = margin;
  const rightX   = margin + leftW + gap;

  // ── LEFT: property image + title banner ───────────────────────────────────
  let leftY = y;
  leftY = drawPropertyBanner(doc, businessName, propertyName, leftX, leftY, leftW, propertyImageDataUrl);

  // ── LEFT: Platform Breakdown table ────────────────────────────────────────
  const tableX = leftX;
  const tableW = leftW;

  // Table title bar
  doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.roundedRect(tableX, leftY, tableW, 8, 1.5, 1.5, 'F');
  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.rect(tableX, leftY, 3, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(C.white[0], C.white[1], C.white[2]);
  doc.text('PLATFORM BREAKDOWN', tableX + 6, leftY + 5.5);

  // Column headers
  const colY      = leftY + 12;
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

  const leftBottom = totalRowY + 9;

  // ── RIGHT: KPI stat cards (2 cols × 3 rows) ───────────────────────────────
  const cardCols = 2;
  const cardGap  = 4;
  const cardW    = (rightW - cardGap) / cardCols;
  const cardH    = 20;

  kpiCards.forEach((card, i) => {
    const col = i % cardCols;
    const row = Math.floor(i / cardCols);
    const cx  = rightX + col * (cardW + cardGap);
    const cy  = y + row * (cardH + cardGap);

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

  const kpiRows   = Math.ceil(kpiCards.length / cardCols);
  const rightBottom = y + kpiRows * (cardH + cardGap);

  return Math.max(leftBottom, rightBottom) + 6;
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

/**
 * Export the dashboard as a PDF.
 *
 * @param {object} dashState - DashboardContext state
 * @param {object} [user]    - The logged-in user object from AuthContext.
 *                             Used for businessName and property images.
 *                             Shape: { businessName, firstName, lastName, properties: [{ _id, propertyName, propertyPicture }] }
 */
export async function exportDashboardPDF(dashState, user) {
  await ensureLibs();

  const jsPDF     = window.jspdf.jsPDF;
  const data      = dashState.rawData || {};
  const stats     = data.stats        || {};
  const byChannel = data.byChannel    || {};
  const bookings  = data.bookings     || [];
  const period    = data.period       || { from: dashState.from, to: dashState.to };

  // ── Resolve business name ────────────────────────────────────────────────
  // Priority: user.businessName → user.firstName + lastName → data.ownerName → 'Dashboard'
  const businessName = (
    (user && (user.businessName || [user.firstName, user.lastName].filter(Boolean).join(' ').trim())) ||
    data.ownerName ||
    'Dashboard'
  ).trim() || 'Dashboard';

  // ── Resolve property name for the selected view ───────────────────────────
  // dashState.selectedPropertyName is set by selectProperty() in DashboardContext.
  const propertyName = (dashState.selectedPropertyName || '').trim();

  // ── Resolve property image ────────────────────────────────────────────────
  // Find the matching property in user.properties using selectedPropertyId.
  // Only load an image when a specific property is selected — not for "all".
  let propertyImageDataUrl = null;
  if (user && Array.isArray(user.properties) && user.properties.length > 0) {
    let targetProp = null;
    if (dashState.selectedPropertyId) {
      targetProp = user.properties.find(
        (p) =>
          String(p._id) === String(dashState.selectedPropertyId) ||
          String(p.id)  === String(dashState.selectedPropertyId)
      );
    }
    if (targetProp) {
      const imgSrc = targetProp.propertyPicture || targetProp.propertyPictureOriginal || '';
      if (imgSrc) {
        propertyImageDataUrl = await loadImageAsDataUrl(imgSrc);
      }
    }
  }

  const doc       = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin    = 14;

  // ── PAGE 1 HEADER ─────────────────────────────────────────────────────────
  drawPageHeader(doc, businessName, propertyName, period, pageWidth);
  let y = CONTENT_TOP;

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
  y = drawKpiAndBreakdown(
    doc, kpiCards, channelEntries, byChannel,
    y, pageWidth, margin,
    businessName, propertyName, propertyImageDataUrl
  );

  // ── BOOKINGS TABLE ────────────────────────────────────────────────────────
  if (bookings.length > 0) {
    // Make sure there's enough room for the section label + at least one table row.
    // If not, add a new page. CONTENT_TOP is the safe start Y after the header.
    if (y + 40 > CONTENT_BOTTOM) { doc.addPage(); y = CONTENT_TOP; }
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

    // ── autoTable: fix header-overlap issue ──────────────────────────────────
    // The `didDrawPage` callback fires AFTER each new page is created by
    // autoTable. It must:
    //   1. Redraw the page header (branding).
    //   2. Return the new startY to autoTable via `doc.autoTable.previous` is
    //      not reliable — instead we use the `margin.top` option which tells
    //      autoTable to leave that many mm at the top of every continuation
    //      page, preventing the table header from being drawn under our banner.
    //
    // Setting `margin.top = CONTENT_TOP` (≈ 27mm) ensures autoTable starts
    // the continuation-page table header below our branding header on every
    // additional page.
    doc.autoTable({
      startY: y,
      head: [['Guest', 'Room', 'Channel', 'Check-in', 'Check-out', 'Amount', 'Balance / Notes']],
      body: bookingRows,
      margin: { left: margin, right: margin, top: CONTENT_TOP },
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
      // ── didDrawPage: redraws the brand header on every continuation page ──
      // This fires after autoTable adds a new page. We redraw our header so
      // the branding is present on all pages. autoTable respects margin.top
      // (set above) so it automatically positions the table header below
      // CONTENT_TOP — we do NOT need to manually set doc.autoTableSetDefaults
      // or manipulate cursor.y here.
      didDrawPage: () => {
        drawPageHeader(doc, businessName, propertyName, period, pageWidth);
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