import { useEffect, useRef, useState } from 'react';
import { useDashboard } from '../context/DashboardContext';

const REPORT_URL = 'https://api.texionix.telexph.com/report/wanderwave.html';

/* ─── Leaving-the-page quips — cycled in order, one per modal open ── */
const LEAVING_LINES = [
  'The bug reporting form lives on another site. Think of it as a short field trip.',
  'You are being handed over to the bug form. It has been expecting you.',
  'Off to the bug report page. Your dashboard will hold your spot, promise.',
  'The bug form opens elsewhere. Nothing here gets lost, we checked twice.',
  'Time to tell someone about that bug. The form is one click away.',
  'Every bug report starts with a brave soul clicking Continue. Be that soul.',
  'The external form awaits. It is friendlier than it sounds.',
  'Bugs do not report themselves. Sadly. We tried asking nicely.',
  'You are leaving for a good cause. The bug form counts as a good cause.',
  'The report page is on another server. It gets lonely. Go say hi.',
  'One click and you are on the bug form. Your data stays exactly where it is.',
  'Somewhere out there, a bug is about to have a very bad day.',
  'Heads up: new tab incoming. Your dashboard survives untouched.',
  'The bug form is external, which is a fancy way of saying it is a different page.',
  'Report the bug, become a legend. Or at least mildly appreciated.',
  'This opens the bug form on another site. No unsaved work will be harmed.',
  'The developers genuinely want to hear about this. Rare, we know.',
  'You are about to make a QA engineer very happy. Or very stressed.',
  'The bug form is that way. It has a nice view of the server logs.',
  'Leaving this page. Briefly. Dramatically. In a new tab.',
  'Your bug report is one Continue away from existing. No pressure.',
  'A new tab opens, a bug gets documented, balance is restored.',
  'The external form is standing by. It does not bite, unlike some bugs.',
  'Continue to file the report. Cancel to let the bug live free.',
  'Off to the bug form you go. Come back whenever, we are not going anywhere.',
];

/**
 * Confirmation shown before sending the user to the external bug-report form.
 * The trigger lives in the Navbar action cluster; this component is the modal only.
 */
export default function BugReportWidget({ open, onClose }) {
  const { dark } = useDashboard();

  // Walk LEAVING_LINES in order, one line per open, wrapping back to the start.
  // The index is kept in a ref so re-renders while open never advance it.
  const lineIdxRef = useRef(0);
  const [line, setLine] = useState(LEAVING_LINES[0]);

  useEffect(() => {
    if (!open) return;
    setLine(LEAVING_LINES[lineIdxRef.current]);
    lineIdxRef.current = (lineIdxRef.current + 1) % LEAVING_LINES.length;
  }, [open]);

  // Close on Escape while the confirmation is open
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // HostOps theme
  const brand   = '#1e8760';
  const brandDk = '#157a55';
  const surface = dark ? '#0f1f17' : '#ffffff';
  const border  = dark ? '#1c3528' : '#dce8e1';
  const text    = dark ? '#e4f0ea' : '#0c1c14';
  const muted   = dark ? '#5d9a7d' : '#6e8a7c';

  function handleLeave() {
    window.open(REPORT_URL, '_blank', 'noopener,noreferrer');
    onClose();
  }

  return (
    <>
      <div
        onClick={e => e.target === e.currentTarget && onClose()}
        style={{
          position: 'fixed', inset: 0,
          background: dark ? 'rgba(0,0,0,0.6)' : 'rgba(8,20,14,0.4)',
          zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        }}
      >
        <div
          className="brw-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="brw-title"
          style={{
            background: surface, borderRadius: 16, width: '100%', maxWidth: 420,
            border: `1px solid ${border}`,
            boxShadow: dark ? '0 20px 60px rgba(0,0,0,0.5)' : '0 20px 60px rgba(0,0,0,0.12)',
            animation: 'brw-in 0.22s cubic-bezier(0.16,1,0.3,1)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '24px 22px 20px', textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, margin: '0 auto 16px',
              background: `linear-gradient(135deg, ${brand}, ${brandDk})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 6px 20px ${brand}40`,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </div>

            <h3 id="brw-title" style={{ fontSize: 17, fontWeight: 700, color: text, margin: '0 0 8px' }}>
              You are leaving this page
            </h3>
            <p style={{
              color: muted, fontSize: 13, lineHeight: 1.6, margin: '0 0 22px',
              minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {line}
            </p>

            <div className="brw-actions" style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${border}`,
                  background: 'transparent', color: text, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleLeave}
                style={{
                  flex: 2, padding: '11px', borderRadius: 10, border: 'none',
                  background: brand, color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                Continue
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes brw-in {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (max-width: 480px) {
          .brw-modal { border-radius: 14px !important; margin: 8px !important; }
          .brw-actions { flex-direction: column-reverse !important; }
          .brw-actions button { flex: unset !important; width: 100% !important; }
        }
      `}</style>
    </>
  );
}
