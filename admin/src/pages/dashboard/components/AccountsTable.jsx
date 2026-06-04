import React, { useState, useMemo } from 'react';
import { FiSearch, FiChevronDown, FiChevronUp } from 'react-icons/fi';

export default function AccountsTable({ accounts, loading, onRowClick }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

  const filteredAndSorted = useMemo(() => {
    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) return [];
    
    let result = [...accounts];

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(acc => 
        (acc.email && acc.email.toLowerCase().includes(q)) ||
        (acc.firstName && acc.firstName.toLowerCase().includes(q)) ||
        (acc.lastName && acc.lastName.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== 'All') {
      const now = Date.now();
      const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;
      
      result = result.filter(acc => {
        const status = (acc.status || 'Unverified').toLowerCase();
        const lastLogin = acc.lastLogin ? new Date(acc.lastLogin).getTime() : 0;
        
        if (statusFilter === 'Locked') return status === 'locked';
        if (statusFilter === 'Deactivated') return status === 'deactivated';
        if (statusFilter === 'Inactive') return lastLogin && (now - lastLogin > FIFTEEN_DAYS) && status !== 'locked' && status !== 'deactivated';
        if (statusFilter === 'Verified') return status === 'verified';
        if (statusFilter === 'Unverified') return status === 'unverified';
        if (statusFilter === 'Partially Verified') return status === 'partially verified';
        return true;
      });
    }

    // Sorting
    result.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === 'createdAt' || sortConfig.key === 'lastLogin') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }

      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [accounts, search, statusFilter, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <FiChevronUp /> : <FiChevronDown />;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadgeClass = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'locked' || s === 'deactivated') return 'badge-danger';
    if (s === 'verified') return 'badge-success';
    if (s === 'partially verified') return 'badge-warning';
    return 'badge-secondary';
  };

  const getRoleLabel = (role) => {
    if (role === 'client') return 'Business';
    if (role === 'team_leader') return 'Team Leader';
    if (role === 'staff') return 'Staff';
    if (role === 'admin') return 'Admin';
    return role;
  };

  const getRoleBadgeClass = (role) => {
    if (role === 'client') return 'badge-role-business';
    if (role === 'team_leader') return 'badge-role-team-leader';
    if (role === 'staff') return 'badge-role-staff';
    if (role === 'admin') return 'badge-admin';
    return 'badge-secondary';
  };

  return (
    <div className="accounts-table-card">
      <div className="accounts-table-header">
        <h3 className="db-card__title">All Accounts ({filteredAndSorted.length})</h3>
        <div className="table-controls">
          <div className="search-box">
            <FiSearch className="search-icon" />
            <input 
              type="text" 
              placeholder="Search email or name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Verified">Verified</option>
            <option value="Partially Verified">Partially Verified</option>
            <option value="Unverified">Unverified</option>
            <option value="Locked">Locked</option>
            <option value="Deactivated">Deactivated</option>
            <option value="Inactive">Inactive (&gt;15 days)</option>
          </select>
        </div>
      </div>

      <div className="db-table-wrapper">
        <table className="db-table">
          <thead>
            <tr>
              <th>Email</th>
              <th onClick={() => requestSort('role')} className="sortable">
                Role {getSortIcon('role')}
              </th>
              <th onClick={() => requestSort('status')} className="sortable">
                Status {getSortIcon('status')}
              </th>
              <th onClick={() => requestSort('createdAt')} className="sortable">
                Created Date {getSortIcon('createdAt')}
              </th>
              <th onClick={() => requestSort('lastLogin')} className="sortable">
                Last Login {getSortIcon('lastLogin')}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {[200, 80, 80, 100, 100].map((w, j) => (
                    <td key={j}>
                      <div className="db-skeleton" style={{ height: 14, width: w }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--color-muted)' }}>
                  No accounts found.
                </td>
              </tr>
            ) : (
              filteredAndSorted.map(acc => (
                <tr key={acc.id} onClick={() => onRowClick(acc)}>
                  <td>
                    <div className="td-email">{acc.email}</div>
                    <div className="td-subname">
                      {acc.firstName} {acc.lastName}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${getRoleBadgeClass(acc.role)}`}>
                      {getRoleLabel(acc.role)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(acc.status)}`} style={{ textTransform: 'capitalize' }}>
                      {acc.status || 'Unverified'}
                    </span>
                  </td>
                  <td>{formatDate(acc.createdAt)}</td>
                  <td>{formatDate(acc.lastLogin)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
