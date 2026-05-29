// src/pages/clientAccount/components/ClientAccountTable.jsx
import React from 'react';

export default function ClientAccountTable({
  accounts,
  clients,
  filtered,
  loading,
  error,
  search,
  filterParent,
  propertyMap,
  onSearchChange,
  onFilterParentChange,
  onEdit,
  onDelete,
}) {
  function getClientName(clientId) {
    const c = clients.find((cl) => String(cl._id) === String(clientId));
    if (!c) return '—';
    return `${c.firstName} ${c.lastName || ''}`.trim();
  }

  function getPropertyCount(account) {
    if (!account.propertyIds?.length) return 0;
    return account.propertyIds.length;
  }

  return (
    <>
      {/* Filters */}
      <div className="cl-filters">
        <div className="cl-search-wrap">
          <svg className="cl-search-icon" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="9" r="7" />
            <path d="M15 15l3 3" strokeLinecap="round" />
          </svg>
          <input
            className="cl-search"
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <select
          className="cl-filter-select"
          value={filterParent}
          onChange={(e) => onFilterParentChange(e.target.value)}
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c._id} value={c._id}>
              {c.firstName} {c.lastName || ''} — {c.email}
            </option>
          ))}
        </select>
        <span className="cl-count">
          {filtered.length} {filtered.length === 1 ? 'account' : 'accounts'}
        </span>
      </div>

      {/* Table */}
      <div className="cl-table-wrap">
        <table className="cl-table">
          <thead>
            <tr>
              <th>ACCOUNT</th>
              <th>CLIENT (PARENT)</th>
              <th>ROLE / LABEL</th>
              <th>PROPERTIES</th>
              <th>STATUS</th>
              <th>CREATED</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#9ab8a9' }}>
                  Loading...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#e53e3e' }}>
                  {error}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#9ab8a9' }}>
                  No client accounts found
                </td>
              </tr>
            ) : (
              filtered.map((account) => (
                <tr key={account._id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1a2e22' }}>
                      {account.firstName} {account.lastName || ''}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#6b8f71', marginTop: 2 }}>
                      {account.email}
                    </div>
                    {account.mustChangePassword && (
                      <span className="cl-badge cl-badge--warn" style={{ marginTop: 4, display: 'inline-block' }}>
                        Must change pw
                      </span>
                    )}
                  </td>
                  <td style={{ color: '#374f3c', fontSize: '0.85rem' }}>
                    {getClientName(account.parentClientId)}
                  </td>
                  <td style={{ color: '#374f3c', fontSize: '0.85rem' }}>
                    {account.accountRole || <span style={{ color: '#b0c4b8' }}>—</span>}
                  </td>
                  <td style={{ color: '#374f3c', fontSize: '0.85rem' }}>
                    {getPropertyCount(account) > 0 ? (
                      <span style={{ fontWeight: 600 }}>{getPropertyCount(account)} properties</span>
                    ) : (
                      <span style={{ color: '#b0c4b8' }}>None assigned</span>
                    )}
                  </td>
                  <td>
                    <span className={`cl-badge ${account.isActive ? 'cl-badge--active' : 'cl-badge--inactive'}`}>
                      {account.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ color: '#6b8f71', fontSize: '0.82rem' }}>
                    {new Date(account.createdAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="cl-action-btn" onClick={() => onEdit(account)}>
                        Edit
                      </button>
                      <button className="cl-action-btn cl-action-btn--danger" onClick={() => onDelete(account)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
