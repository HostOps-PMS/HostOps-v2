export default function PropertyPills({ propertyIds, propertyMap }) {
  if (!propertyIds || propertyIds.length === 0) {
    return <span style={{ color: '#aaa', fontSize: '0.8rem' }}>No properties</span>;
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {propertyIds.map((id) => (
        <span
          key={id}
          style={{
            fontSize: '0.74rem',
            padding: '2px 8px',
            borderRadius: 6,
            background: '#eef4ff',
            color: '#3b5fc0',
            fontWeight: 500,
            border: '1px solid #d0dcf8',
          }}
        >
          {propertyMap[id] || id}
        </span>
      ))}
    </div>
  );
}