export default function TopBar({ onAction }) {
  return (
    <header className="db-topbar">
      {/* Search */}
      <div className="db-topbar__search">
        <span className="db-topbar__search-icon">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="9" r="7" />
            <path d="M15 15l3 3" strokeLinecap="round" />
          </svg>
        </span>
        <input type="text" placeholder="Search…" />
      </div>

      {/* Actions */}
      <div className="db-topbar__actions">
        {/* Notifications */}
        <button className="db-topbar__icon-btn" title="Notifications">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M10 2a6 6 0 00-6 6v3l-1.5 2H17.5L16 11V8a6 6 0 00-6-6z" />
            <path d="M8.5 17a1.5 1.5 0 003 0" strokeLinecap="round" />
          </svg>
        </button>

        {/* New Record CTA */}
        <button className="db-topbar__btn" onClick={onAction}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 1v10M1 6h10" strokeLinecap="round" />
          </svg>
          New Record
        </button>

        {/* Avatar */}
        <div className="db-topbar__avatar" title="Admin User">A</div>
      </div>
    </header>
  );
}
