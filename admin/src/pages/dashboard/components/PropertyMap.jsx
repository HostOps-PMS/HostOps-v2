const PROPERTIES = [
  { name: 'Haido Ville',   lat: 14.5995, lng: 120.9842, occupancy: 94, revenue: '₱2.84M' },
  { name: 'ABC Resort',    lat: 14.6760, lng: 121.0437, occupancy: 87, revenue: '₱2.21M' },
  { name: 'Mountain View', lat: 14.4445, lng: 121.0289, occupancy: 81, revenue: '₱1.98M' },
  { name: 'Sun Villa',     lat: 14.5547, lng: 121.0244, occupancy: 76, revenue: '₱1.54M' },
  { name: 'Paradise Inn',  lat: 14.6091, lng: 121.0223, occupancy: 72, revenue: '₱1.32M' },
  { name: 'Ocean Breeze',  lat: 14.5176, lng: 120.9822, occupancy: 68, revenue: '₱1.10M' },
];

const COLORS = ['#1a9e6e','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4'];

export default function PropertyMap() {
  return (
    <div className="db-table-card" style={{ flexShrink: 0, overflow: 'hidden' }}>
      <div className="db-table-card__head">
        <h2 className="db-table-card__title">Property Map</h2>
        <span style={{ fontSize: '.75rem', color: 'var(--color-muted)' }}>{PROPERTIES.length} properties</span>
      </div>

      <div style={{ display: 'flex', height: 325 }}>
        {/* Map iframe */}
        <div style={{ flex: 1, position: 'relative' }}>
          <iframe
            title="Property Map"
            src="https://www.openstreetmap.org/export/embed.html?bbox=120.95%2C14.42%2C121.07%2C14.70&layer=mapnik"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
          {/* Property pins overlay */}
          {PROPERTIES.map((p, i) => {
            const left = ((p.lng - 120.95) / (121.07 - 120.95)) * 100;
            const top  = ((14.70 - p.lat) / (14.70 - 14.42)) * 100;
            return (
              <div key={p.name} title={`${p.name} — ${p.revenue} | ${p.occupancy}% occ.`} style={{
                position: 'absolute',
                left: `${left}%`,
                top: `${top}%`,
                transform: 'translate(-50%, -50%)',
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: COLORS[i],
                border: '2.5px solid #fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                cursor: 'pointer',
                zIndex: 999,
              }} />
            );
          })}
        </div>

        {/* Legend */}
        <div style={{
          width: 160,
          flexShrink: 0,
          padding: '12px 14px',
          borderLeft: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          overflowY: 'auto',
        }}>
          {PROPERTIES.map((p, i) => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: COLORS[i], flexShrink: 0, marginTop: 2,
              }} />
              <div>
                <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--color-text)' }}>{p.name}</div>
                <div style={{ fontSize: '.68rem', color: '#1a9e6e', fontWeight: 600 }}>{p.revenue}</div>
                <div style={{ fontSize: '.68rem', color: 'var(--color-muted)' }}>{p.occupancy}% occ.</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}