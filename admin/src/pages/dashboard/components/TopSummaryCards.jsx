import React from 'react';
import { FiUsers, FiBriefcase, FiUserCheck, FiLock } from 'react-icons/fi';

export default function TopSummaryCards({ accounts, loading }) {
  if (loading) {
    return (
      <div className="db-summary-cards">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="db-card skeleton" style={{ height: '120px' }}></div>
        ))}
      </div>
    );
  }

  const stats = {
    businesses: 0,
    staffs: 0,
    teamLeaders: 0,
    lockedAccounts: 0,
  };

  accounts.forEach((acc) => {
    if (acc.role === 'client') stats.businesses++;
    if (acc.role === 'staff') stats.staffs++;
    if (acc.role === 'team_leader') stats.teamLeaders++;
    if (acc.status === 'locked' || acc.status === 'Locked') stats.lockedAccounts++;
  });

  const cards = [
    { title: 'Total Businesses', value: stats.businesses, icon: <FiBriefcase />, color: 'var(--blue)' },
    { title: 'Total Staffs', value: stats.staffs, icon: <FiUsers />, color: 'var(--green)' },
    { title: 'Total Team Leaders', value: stats.teamLeaders, icon: <FiUserCheck />, color: 'var(--yellow)' },
    { title: 'Total Locked Accounts', value: stats.lockedAccounts, icon: <FiLock />, color: 'var(--red)' },
  ];

  return (
    <div className="db-summary-cards">
      {cards.map((card, idx) => (
        <div key={idx} className="db-card stat-card">
          <div className="stat-card__icon" style={{ color: card.color, backgroundColor: `${card.color}15` }}>
            {card.icon}
          </div>
          <div className="stat-card__info">
            <h3 className="stat-card__title">{card.title}</h3>
            <p className="stat-card__value">{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
