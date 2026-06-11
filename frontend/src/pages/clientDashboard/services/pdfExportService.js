// ── Static imports — jsPDF and autoTable are bundled with the app ────────────
// Previously loaded from CDN at runtime, which failed on mobile when CDNs
// were blocked or unreachable. Now bundled via npm so no network request is
// needed at export time — works offline and on any network.
//
// Run once before deploying:
//   npm install jspdf jspdf-autotable
// ─────────────────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  // ── Stat-card accent colors ─────────────────────────────────────────────
  blue:       [37,  99,  235],
  blueLight:  [219, 230, 252],
  red:        [203, 68,  54],
  redLight:   [250, 226, 222],
  gold:       [232, 184, 92],
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
 * The property image and name are shown in the business profile card
 * (drawBusinessProfile) in the content area, so the page header stays clean: just HOSTOPS pill, title, period, generated.
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
 * Draws the BUSINESS PROFILE card for the LEFT column of page 1.
 *
 * Layout (title is ABOVE the image, image keeps its aspect ratio):
 *   ┌──────────────────────────────────────┐
 *   │ ▌ Business Name                      │  ← title on TOP
 *   │   PERFORMANCE DASHBOARD              │
 *   │   [Property badge if selected]       │
 *   │   ┌──────────────────────────────┐   │
 *   │   │      property image          │   │  ← below, "contain" fit (no stretch)
 *   │   └──────────────────────────────┘   │
 *   └──────────────────────────────────────┘
 *
 * @param {object} doc
 * @param {string} businessName
 * @param {string} propertyName       - selected property name, or '' for all
 * @param {number} x                  - left edge of the column
 * @param {number} y                  - top of the card
 * @param {number} w                  - width of the column
 * @param {string|null} imgDataUrl    - base64 property image, or null
 * @returns {number}                  - new Y after the card
 */
function drawBusinessProfile(doc, businessName, propertyName, x, y, w, imgDataUrl) {
  const pad      = 5;
  const imgBoxH  = 44;                       // image thumbnail height in mm
  const headerH  = propertyName ? 28 : 22;   // space for title + subtitle (+ badge)
  const cardH    = headerH + imgBoxH + pad;

  // ── Soft shadow ───────────────────────────────────────────────────────────
  doc.setFillColor(C.border[0], C.border[1], C.border[2]);
  doc.roundedRect(x + 0.8, y + 1, w, cardH, 3, 3, 'F');

  // ── White card (matches the rest of the report) ───────────────────────────
  doc.setFillColor(C.white[0], C.white[1], C.white[2]);
  doc.roundedRect(x, y, w, cardH, 3, 3, 'F');

  // ── Green top accent bar ──────────────────────────────────────────────────
  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.roundedRect(x, y, w, 2.5, 1, 1, 'F');

  // ── Border ────────────────────────────────────────────────────────────────
  doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, cardH, 3, 3, 'S');

  // ── Title (TOP) ───────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(C.text[0], C.text[1], C.text[2]);
  const maxChars = 28;
  const baseName = businessName || 'Dashboard';
  const safeName = baseName.length > maxChars ? baseName.slice(0, maxChars - 1) + '…' : baseName;
  doc.text(safeName, x + pad, y + 11);

  // ── Subtitle ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(C.green[0], C.green[1], C.green[2]);
  doc.text('PERFORMANCE DASHBOARD', x + pad, y + 16);

  // ── Property badge ────────────────────────────────────────────────────────
  if (propertyName) {
    const badgeY = y + 19.5;
    const badgeW = Math.min(w - pad * 2, propertyName.length * 1.8 + 9);
    doc.setFillColor(C.greenLight[0], C.greenLight[1], C.greenLight[2]);
    doc.roundedRect(x + pad, badgeY, badgeW, 6.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(C.greenMid[0], C.greenMid[1], C.greenMid[2]);
    const maxBadge = Math.floor(badgeW / 1.8);
    doc.text(
      propertyName.length > maxBadge ? propertyName.slice(0, maxBadge - 1) + '…' : propertyName,
      x + pad + badgeW / 2, badgeY + 4.4, { align: 'center' }
    );
  }

  // ── Image thumbnail (centered, on-brand light panel) ──────────────────────
  // A compact, roughly 4:3 panel keeps a square logo OR a photo looking tidy
  // instead of a wide letterbox. Centered horizontally under the text.
  const panelH = imgBoxH;
  const panelW = Math.min(w - pad * 2, panelH * 1.45);
  const panelX = x + (w - panelW) / 2;
  const panelY = y + headerH;

  // Light panel + subtle border (matches greenLight used across the report)
  doc.setFillColor(C.greenLight[0], C.greenLight[1], C.greenLight[2]);
  doc.roundedRect(panelX, panelY, panelW, panelH, 2.5, 2.5, 'F');
  doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
  doc.setLineWidth(0.25);
  doc.roundedRect(panelX, panelY, panelW, panelH, 2.5, 2.5, 'S');

  if (imgDataUrl) {
    // "Contain" fit: no stretching, no cropping — safe for logos and photos.
    let natW = 4, natH = 3;   // sensible default ratio if props can't be read
    try {
      const props = doc.getImageProperties(imgDataUrl);
      if (props && props.width && props.height) {
        natW = props.width;
        natH = props.height;
      }
    } catch {
      // keep default ratio
    }
    const innerPad = 2.5;
    const fitW  = panelW - innerPad * 2;
    const fitH  = panelH - innerPad * 2;
    const scale = Math.min(fitW / natW, fitH / natH);
    const drawW = natW * scale;
    const drawH = natH * scale;
    const dx    = panelX + (panelW - drawW) / 2;
    const dy    = panelY + (panelH - drawH) / 2;
    try {
      doc.addImage(imgDataUrl, 'JPEG', dx, dy, drawW, drawH, '', 'FAST');
    } catch {
      // Image failed — light panel stays as placeholder
    }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(C.subtext[0], C.subtext[1], C.subtext[2]);
    doc.text('No image', panelX + panelW / 2, panelY + panelH / 2 + 1, { align: 'center' });
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
 * Draws exactly FOUR fixed stat cards in a single full-width row:
 *   1. REVENUE          – green "hero" card (filled)
 *   2. BOOKINGS         – white card, blue accent
 *   3. CANCELLATIONS    – white card, red accent
 *   4. OCCUPANCY RATE   – white card, green accent
 *
 * Each `card` = { kind, label, value, sub, accent, accentLight }.
 *
 * @returns {number} new Y after the row
 */
function drawStatCards(doc, cards, y, pageWidth, margin) {
  const totalW = pageWidth - margin * 2;
  const gap    = 5;
  const n      = cards.length;                 // fixed: 4
  const cardW  = (totalW - gap * (n - 1)) / n;
  const cardH  = 36;

  cards.forEach((card, i) => {
    const cx = margin + i * (cardW + gap);
    const cy = y;

    // Soft shadow (shared by all cards)
    doc.setFillColor(C.border[0], C.border[1], C.border[2]);
    doc.roundedRect(cx + 0.8, cy + 1, cardW, cardH, 3, 3, 'F');

    if (card.kind === 'revenue') {
      // ── Green "hero" card ────────────────────────────────────────────────
      doc.setFillColor(C.green[0], C.green[1], C.green[2]);
      doc.roundedRect(cx, cy, cardW, cardH, 3, 3, 'F');
      // Darker band at the bottom for depth
      doc.setFillColor(C.greenMid[0], C.greenMid[1], C.greenMid[2]);
      doc.roundedRect(cx, cy + cardH - 11, cardW, 11, 3, 3, 'F');
      doc.rect(cx, cy + cardH - 13, cardW, 4, 'F');

      // "Chip" glyph (credit-card nod)
      doc.setFillColor(C.gold[0], C.gold[1], C.gold[2]);
      doc.roundedRect(cx + cardW - 13, cy + 6, 8, 6, 1, 1, 'F');

      // Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(C.greenLight[0], C.greenLight[1], C.greenLight[2]);
      doc.text('REVENUE', cx + 5, cy + 9);

      // Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(C.white[0], C.white[1], C.white[2]);
      doc.text(String(card.value), cx + 5, cy + 22);

      // Sub (total bookings) — sits on the dark band
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(C.muted[0], C.muted[1], C.muted[2]);
      doc.text(String(card.sub).toUpperCase(), cx + 5, cy + cardH - 4);

      // HostOps mark
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(C.greenLight[0], C.greenLight[1], C.greenLight[2]);
      doc.text('HostOps', cx + cardW - 5, cy + cardH - 4, { align: 'right' });
    } else {
      // ── White card with a colored accent ─────────────────────────────────
      const a  = card.accent;
      const aL = card.accentLight;

      doc.setFillColor(C.white[0], C.white[1], C.white[2]);
      doc.roundedRect(cx, cy, cardW, cardH, 3, 3, 'F');

      // Colored top bar
      doc.setFillColor(a[0], a[1], a[2]);
      doc.roundedRect(cx, cy, cardW, 2.5, 1, 1, 'F');

      // Border
      doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
      doc.setLineWidth(0.25);
      doc.roundedRect(cx, cy, cardW, cardH, 3, 3, 'S');

      // Icon circle (top-right)
      doc.setFillColor(aL[0], aL[1], aL[2]);
      doc.circle(cx + cardW - 9, cy + 11, 4.6, 'F');
      doc.setFillColor(a[0], a[1], a[2]);
      doc.circle(cx + cardW - 9, cy + 11, 1.7, 'F');

      // Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(C.subtext[0], C.subtext[1], C.subtext[2]);
      doc.text(card.label, cx + 5, cy + 9);

      // Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(a[0], a[1], a[2]);
      doc.text(String(card.value), cx + 5, cy + 23);

      // Sub
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(C.subtext[0], C.subtext[1], C.subtext[2]);
      doc.text(String(card.sub), cx + 5, cy + 31);
    }
  });

  return y + cardH + 5;
}

/**
 * Draws the Platform Breakdown table inside a COLUMN of width `w` at (x, y).
 * Used as the RIGHT column beside the business profile.
 *
 * @returns {number} new Y after the table
 */
function drawPlatformBreakdown(doc, channelEntries, x, y, w) {
  const totalRev = channelEntries.reduce((s, e) => s + (e[1].revenue || 0), 0);

  // ── Title bar ─────────────────────────────────────────────────────────────
  doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.roundedRect(x, y, w, 8, 1.5, 1.5, 'F');
  doc.setFillColor(C.green[0], C.green[1], C.green[2]);
  doc.rect(x, y, 3, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(C.white[0], C.white[1], C.white[2]);
  doc.text('PLATFORM BREAKDOWN', x + 6, y + 5.5);

  // ── Column geometry ───────────────────────────────────────────────────────
  const wChannel = w * 0.30;
  const wRev     = w * 0.28;
  const wBk      = w * 0.12;
  const wNts     = w * 0.12;
  const wShare   = w * 0.18;
  const xChannel = x;
  const xRev     = xChannel + wChannel;
  const xBk      = xRev + wRev;
  const xNts     = xBk + wBk;
  const xShare   = xNts + wNts;

  const colY = y + 13;

  // ── Headers ───────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(C.subtext[0], C.subtext[1], C.subtext[2]);
  doc.text('Channel', xChannel + 2, colY);
  doc.text('Revenue', xRev + 2,     colY);
  doc.text('Bk',      xBk + 2,      colY);
  doc.text('Nts',     xNts + 2,     colY);
  doc.text('Share',   xShare + wShare - 2, colY, { align: 'right' });

  // Header divider
  doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
  doc.setLineWidth(0.3);
  doc.line(x, colY + 2.5, x + w, colY + 2.5);

  // ── Rows ──────────────────────────────────────────────────────────────────
  const rowH = 9;
  channelEntries.forEach(([ch, v], ri) => {
    const rowY  = colY + 6 + ri * rowH;
    const share = totalRev > 0 ? ((v.revenue || 0) / totalRev * 100).toFixed(1) : '0.0';

    if (ri % 2 === 1) {
      doc.setFillColor(C.greenLight[0], C.greenLight[1], C.greenLight[2]);
      doc.rect(x, rowY - 4, w, rowH, 'F');
    }

    // Channel
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(C.text[0], C.text[1], C.text[2]);
    doc.text(String(ch), xChannel + 2, rowY + 1.5);

    // Revenue
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.green[0], C.green[1], C.green[2]);
    doc.text(fmtMoney(v.revenue || 0), xRev + 2, rowY + 1.5);

    // Bookings
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(C.text[0], C.text[1], C.text[2]);
    doc.text(String(v.bookings || 0), xBk + 2, rowY + 1.5);

    // Nights
    doc.text(String(v.nights || 0), xNts + 2, rowY + 1.5);

    // Share (right aligned)
    doc.setTextColor(C.subtext[0], C.subtext[1], C.subtext[2]);
    doc.text(share + '%', xShare + wShare - 2, rowY + 1.5, { align: 'right' });

    // Row divider
    doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
    doc.setLineWidth(0.15);
    doc.line(x, rowY + rowH - 4, x + w, rowY + rowH - 4);
  });

  // ── Total row ─────────────────────────────────────────────────────────────
  const totalRowY = colY + 6 + channelEntries.length * rowH + 1;
  doc.setFillColor(C.dark[0], C.dark[1], C.dark[2]);
  doc.roundedRect(x, totalRowY - 4, w, 9, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(C.white[0], C.white[1], C.white[2]);
  doc.text('TOTAL', xChannel + 2, totalRowY + 1.5);
  doc.setTextColor(C.green[0], C.green[1], C.green[2]);
  doc.text(fmtMoney(totalRev), xRev + 2, totalRowY + 1.5);

  return totalRowY + 9;
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
  // jsPDF and autoTable are imported statically at the top of this module —
  // no runtime CDN loading needed. autoTable self-registers on import.
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

  // ── PAGE 1 CONTENT ────────────────────────────────────────────────────────
  // 1) Stat cards full-width on top.
  // 2) Business profile (LEFT) + Platform Breakdown (RIGHT) side by side.
  const revenue      = stats.revenue       || stats.totalRevenue      || 0;
  const bookingCount = stats.bookings      || stats.totalBookings      || 0;
  const cancels      = stats.cancellations || stats.totalCancellations || 0;
  const nightsAff    = stats.nightsAffected|| stats.cancelledNights    || 0;
  const bookedN      = stats.bookedNights  || stats.totalNights        || 0;
  const occupancy    = stats.occupancyRate || stats.occupancy          || 0;

  const kpiCards = [
    {
      kind: 'revenue', label: 'REVENUE',
      value: fmtMoney(revenue),
      sub: 'Total bookings: ' + bookingCount,
    },
    {
      kind: 'bookings', label: 'BOOKINGS',
      value: String(bookingCount),
      sub: bookedN + ' nights total',
      accent: C.blue, accentLight: C.blueLight,
    },
    {
      kind: 'cancellations', label: 'CANCELLATIONS',
      value: String(cancels),
      sub: nightsAff + ' nights affected',
      accent: C.red, accentLight: C.redLight,
    },
    {
      kind: 'occupancy', label: 'OCCUPANCY RATE',
      value: occupancy + '%',
      sub: 'Selected period',
      accent: C.green, accentLight: C.greenLight,
    },
  ];

  // ── 1) Stat cards — full width, TOP (fixed row of 4) ──────────────────────
  y = drawStatCards(doc, kpiCards, y, pageWidth, margin);

  // ── 2) Two columns: business profile (left) | platform breakdown (right) ──
  const channelEntries = Object.entries(byChannel);
  const totalW = pageWidth - margin * 2;
  const colGap = 6;
  const leftW  = (totalW - colGap) * 0.40;   // business profile
  const rightW = (totalW - colGap) * 0.60;   // platform breakdown
  const leftX  = margin;
  const rightX = margin + leftW + colGap;

  const leftBottom  = drawBusinessProfile(doc, businessName, propertyName, leftX, y, leftW, propertyImageDataUrl);
  const rightBottom = drawPlatformBreakdown(doc, channelEntries, rightX, y, rightW);

  y = Math.max(leftBottom, rightBottom) + 4;

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

  const filename = 'hostops-report_' + (period.from || 'all') + '_' + (period.to || 'all') + '.pdf';

  // ── Mobile-safe PDF delivery ──────────────────────────────────────────────
  //
  // Three distinct environments need different handling:
  //
  //  1. iOS Safari / WKWebView
  //     • <a download> is silently ignored — the file never saves.
  //     • Blob URLs opened via window.open() are blocked by the popup guard.
  //     • Best path: write the data URI into an <iframe> inside a new tab.
  //       If window.open() is blocked (popup guard), fall back to a modal
  //       with a tap-to-open link — never navigate away from the app.
  //
  //  2. Android Chrome / Samsung Internet / other Android browsers
  //     • <a download> works in Chrome and most modern Android browsers, but
  //       silently fails in some WebViews and Samsung Internet <13.
  //     • Safest path: create a temporary blob URL, click a hidden <a>, then
  //       revoke the blob URL after a short delay. This is the most broadly
  //       compatible approach for Android.
  //
  //  3. Desktop browsers
  //     • jsPDF's doc.save() (blob + <a download>) works everywhere.
  //
  // Detection strategy:
  //   isIOS   — covers iPhone, iPad (including modern iPads that drop "iPad"
  //             from the UA and report as "Macintosh" with touch support).
  //   isMobile — catches Android and any other touch-based mobile browser.
  //             We use this as the trigger for the blob-URL approach.
  // ─────────────────────────────────────────────────────────────────────────

  const ua      = navigator.userAgent || '';
  const isIOS   = /iPad|iPhone|iPod/.test(ua) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMobile = isIOS || /Android/i.test(ua) ||
                  /webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  if (isIOS) {
    // ── iOS: open PDF via blob URL in a new tab ──────────────────────────
    // Data URIs for PDFs are too large for iOS Safari iframes — they render
    // as a blank/black page. Blob URLs are supported in Safari 14+ and work
    // reliably. We open the blob URL directly so Safari's native PDF viewer
    // picks it up and the user can use the share sheet to save to Files.
    let blobUrl = null;
    try {
      const blob = doc.output('blob');
      blobUrl = URL.createObjectURL(blob);
    } catch (_) {
      // Blob API unavailable — will fall through to data URI modal
    }

    let opened = false;
    if (blobUrl) {
      try {
        const newTab = window.open(blobUrl, '_blank');
        if (newTab) {
          opened = true;
          // Revoke after 60 s — enough time for Safari to load the PDF
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        }
      } catch (_) {
        // window.open() threw (strict popup blocker) — fall through to modal
      }

      if (!opened) {
        // Popup blocked: show in-page modal with a tap-to-open link
        _showPDFModal(blobUrl, filename);
        // Keep the blob alive long enough for the user to tap the link
        setTimeout(() => URL.revokeObjectURL(blobUrl), 300000);
      }
    } else {
      // Blob API failed — last resort: data URI modal (no iframe, just a link)
      _showPDFModal(doc.output('datauristring'), filename);
    }

  } else if (isMobile) {
    // ── Android / other mobile: blob URL + hidden <a> ───────────────────
    // More reliable than doc.save() on Android WebViews and Samsung Internet.
    try {
      const blob    = doc.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const a       = document.createElement('a');
      a.href        = blobUrl;
      a.download    = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after a short delay so the browser has time to start the download
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (_) {
      // Blob URL failed (some restricted WebViews) — fall back to data URI modal
      const dataUrl = doc.output('datauristring');
      _showPDFModal(dataUrl, filename);
    }

  } else {
    // ── Desktop: standard jsPDF save ─────────────────────────────────────
    doc.save(filename);
  }
}

/**
 * Shows a minimal in-page modal with a tap-to-open PDF link.
 * Used as the last-resort fallback when popup blockers prevent window.open()
 * on iOS, or when blob URLs are unavailable in restricted WebViews.
 *
 * The modal is self-contained (no React, no framework) so it works regardless
 * of where in the component tree exportDashboardPDF is called from.
 *
 * @param {string} dataUrl  - PDF data URI
 * @param {string} filename - suggested filename for the title
 */
function _showPDFModal(dataUrl, filename) {
  // Remove any existing modal first (double-export guard)
  const existing = document.getElementById('__hostops_pdf_modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = '__hostops_pdf_modal';
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'background:rgba(12,28,20,0.72)', 'backdrop-filter:blur(4px)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'padding:24px',
  ].join(';');

  overlay.innerHTML =
    '<div style="background:#fff;border-radius:16px;padding:28px 24px;max-width:340px;' +
    'width:100%;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,0.22)">' +
      '<div style="width:48px;height:48px;background:#eaf8f1;border-radius:50%;' +
      'display:flex;align-items:center;justify-content:center;margin:0 auto 16px">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#26a676" ' +
        'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
          '<polyline points="14 2 14 8 20 8"/>' +
        '</svg>' +
      '</div>' +
      '<p style="font-weight:700;font-size:16px;color:#0c1c14;margin:0 0 8px">' +
        'Your PDF is ready' +
      '</p>' +
      '<p style="font-size:13px;color:#6a8b7c;margin:0 0 20px;line-height:1.5">' +
        'Tap the button below to open it. From there you can use the share sheet ' +
        'to save it to Files or share it.' +
      '</p>' +
      '<a href="' + dataUrl + '" target="_blank" rel="noopener noreferrer" ' +
      'style="display:block;background:#26a676;color:#fff;border-radius:10px;' +
      'padding:13px 20px;font-weight:600;font-size:14px;text-decoration:none;' +
      'margin-bottom:10px">Open PDF</a>' +
      '<button id="__hostops_pdf_modal_close" ' +
      'style="background:none;border:none;color:#9ab8a9;font-size:13px;' +
      'cursor:pointer;padding:6px 12px">Dismiss</button>' +
    '</div>';

  document.body.appendChild(overlay);

  // Close on backdrop click or Dismiss button
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
  const closeBtn = document.getElementById('__hostops_pdf_modal_close');
  if (closeBtn) closeBtn.addEventListener('click', function() { overlay.remove(); });
}