export default function Badge({ active }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.03em',
        padding: '2px 9px',
        borderRadius: 999,
        background: active ? '#d4f0e4' : '#f0f0f0',
        color: active ? '#1e8760' : '#888',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: active ? '#26a676' : '#bbb',
          display: 'inline-block',
        }}
      />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}