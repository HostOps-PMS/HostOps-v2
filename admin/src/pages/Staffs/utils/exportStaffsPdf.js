import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── HostOps brand palette ─────────────────────────────────────────────────
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
  red:        [203, 68,  54],
  redLight:   [250, 226, 222],
};

const PAGE_H    = 210;
const HEADER_H  = 22;
const CONTENT_Y = HEADER_H + 5;
const FOOTER_Y  = PAGE_H - 9;

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function drawHeader(doc, pageWidth, total, activeCount) {
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, pageWidth, HEADER_H, 'F');
  doc.setFillColor(...C.green);
  doc.rect(0, HEADER_H, pageWidth, 1.5, 'F');

  // Left accent bar
  doc.setFillColor(...C.green);
  doc.rect(0, 0, 3, HEADER_H, 'F');

  doc.setFillColor(...C.green);
  doc.roundedRect(8, 7, 24, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.white);
  doc.text('HOSTOPS', 20, 12.5, { align: 'center' });

  doc.setDrawColor(...C.muted);
  doc.setLineWidth(0.3);
  doc.line(36, 5, 36, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.white);
  doc.text('STAFF DIRECTORY', 41, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('Personnel Management Report', 41, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.muted);
  doc.text('Generated ' + new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }), pageWidth - 14, 11, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.greenLight);
  doc.text(total + ' Staff  ·  ' + activeCount + ' Active', pageWidth - 14, 18, { align: 'right' });
}

function drawFooter(doc, pageNum, pageCount, pageWidth) {
  doc.setFillColor(...C.dark);
  doc.rect(0, FOOTER_Y, pageWidth, 9, 'F');
  doc.setFillColor(...C.green);
  doc.rect(0, FOOTER_Y, pageWidth, 0.6, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('HostOps Admin — Staff Directory', 14, FOOTER_Y + 6);
  doc.text('Page ' + pageNum + ' of ' + pageCount, pageWidth / 2, FOOTER_Y + 6, { align: 'center' });
  doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth - 14, FOOTER_Y + 6, { align: 'right' });
}

function deliverPdf(doc, filename) {
  const ua      = navigator.userAgent || '';
  const isIOS   = /iPad|iPhone|iPod/.test(ua) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMobile = isIOS || /Android/i.test(ua) || /webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  if (isIOS) {
    let blobUrl = null;
    try { blobUrl = URL.createObjectURL(doc.output('blob')); } catch (_) {}
    if (blobUrl) {
      try {
        const tab = window.open(blobUrl, '_blank');
        if (tab) { setTimeout(() => URL.revokeObjectURL(blobUrl), 60000); return; }
      } catch (_) {}
      _showModal(blobUrl);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 300000);
    } else {
      _showModal(doc.output('datauristring'));
    }
  } else if (isMobile) {
    try {
      const blobUrl = URL.createObjectURL(doc.output('blob'));
      const a = Object.assign(document.createElement('a'), { href: blobUrl, download: filename, style: 'display:none' });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (_) { _showModal(doc.output('datauristring')); }
  } else {
    doc.save(filename);
  }
}

function _showModal(dataUrl) {
  const el = document.getElementById('__hp_pdf_modal');
  if (el) el.remove();
  const overlay = document.createElement('div');
  overlay.id = '__hp_pdf_modal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(12,28,20,0.8);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:24px';
  overlay.innerHTML = '<div style="background:#fff;border-radius:16px;padding:28px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,0.22)">' +
    '<div style="width:48px;height:48px;background:#eaf8f1;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">' +
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#26a676" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>' +
    '<p style="font-weight:700;font-size:16px;color:#0c1c14;margin:0 0 8px">PDF Ready</p>' +
    '<p style="font-size:13px;color:#6a8b7a;margin:0 0 20px;line-height:1.5">Tap below to open. Use the share sheet to save to Files.</p>' +
    '<a href="' + dataUrl + '" target="_blank" rel="noopener noreferrer" style="display:block;background:#26a676;color:#fff;border-radius:10px;padding:13px 20px;font-weight:600;font-size:14px;text-decoration:none;margin-bottom:10px">Open PDF</a>' +
    '<button id="__hp_pdf_modal_close" style="background:none;border:none;color:#9ab8a9;font-size:13px;cursor:pointer;padding:6px 12px">Dismiss</button></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('__hp_pdf_modal_close')?.addEventListener('click', () => overlay.remove());
}

// ─────────────────────────────────────────────────────────────────────────────
export function exportStaffsPdf({ staffs = [], clients = [], propertyMap = {}, filterClient = '', search = '' } = {}) {
  const clientMap    = Object.fromEntries(clients.map(c => [String(c._id), c]));
  const activeCount  = staffs.filter(s => s.isActive).length;

  function resolveClient(s) {
    const id = String(s.clientId?._id || s.clientId || '');
    const c  = clientMap[id];
    return c ? (c.businessName || [c.firstName, c.lastName].filter(Boolean).join(' ') || '—') : '—';
  }

  function resolveProps(ids) {
    if (!ids || !ids.length) return '—';
    return ids.map(id => propertyMap[String(id)] || String(id)).join(', ');
  }

  const doc       = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin    = 14;

  drawHeader(doc, pageWidth, staffs.length, activeCount);

  // ── Filter strip ──────────────────────────────────────────────────────────
  let y = CONTENT_Y + 1;
  const filterParts = [
    filterClient ? ('Business: ' + (clientMap[filterClient]?.businessName || filterClient)) : '',
    search.trim() ? ('Search: "' + search.trim() + '"') : '',
  ].filter(Boolean);
  const filterLabel = filterParts.join('  ·  ') || 'All staffs';

  doc.setFillColor(...C.greenLight);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 9, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.greenMid);
  doc.text(filterLabel, margin + 5, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.subtext);
  doc.text(
    staffs.length + ' result' + (staffs.length !== 1 ? 's' : '') +
    '   ·   Active: ' + activeCount +
    '   ·   Inactive: ' + (staffs.length - activeCount),
    pageWidth - margin - 5, y + 6, { align: 'right' }
  );
  y += 14;

  // ── Table ─────────────────────────────────────────────────────────────────
  const rows = staffs.map((s, i) => [
    i + 1,
    [s.firstName, s.lastName].filter(Boolean).join(' ') || '—',
    s.email || '—',
    resolveClient(s),
    resolveProps(s.propertyIds),
    s.isActive ? 'Active' : 'Inactive',
    fmt(s.createdAt),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Staff Name', 'Email', 'Business', 'Properties', 'Status', 'Created']],
    body: rows,
    margin: { left: margin, right: margin, top: CONTENT_Y + 14 },
    headStyles: { fillColor: C.dark, textColor: C.white, fontStyle: 'bold', fontSize: 8, cellPadding: 4 },
    bodyStyles: { fontSize: 8, cellPadding: 3.5 },
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center', textColor: C.subtext },
      1: { cellWidth: 40, fontStyle: 'bold' },
      2: { cellWidth: 54 },
      3: { cellWidth: 40 },
      4: { cellWidth: 'auto', fontSize: 7, textColor: C.subtext },
      5: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 28, textColor: C.subtext },
    },
    alternateRowStyles: { fillColor: C.greenLight },
    styles: { font: 'helvetica', lineColor: C.border, lineWidth: 0.2, overflow: 'ellipsize' },
    didParseCell(data) {
      if (data.section !== 'body' || data.column.index !== 5) return;
      data.cell.styles.textColor = data.cell.raw === 'Active' ? C.green : C.subtext;
    },
    didDrawPage: () => drawHeader(doc, pageWidth, staffs.length, activeCount),
  });

  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { doc.setPage(i); drawFooter(doc, i, pages, pageWidth); }

  deliverPdf(doc, 'hostops-staffs-' + new Date().toISOString().slice(0, 10) + '.pdf');
}
