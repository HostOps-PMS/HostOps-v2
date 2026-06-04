const STATUS_STYLES = {
  active:   { bg: '#e6f9f0', color: '#0d7a4e', dot: '#1db874', label: 'Active' },
  inactive: { bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af', label: 'Inactive' },
};

export default function Badge({ active }) {
  const s = active ? STATUS_STYLES.active : STATUS_STYLES.inactive;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: '0.72rem', fontWeight: 600,
      padding: '3px 10px', borderRadius: 999,
      background: s.bg, color: s.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {s.label}
    </span>
  );
}