import { useState } from 'react';
import './dashboard.css';

import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import TopSummaryCards from './components/TopSummaryCards';
import DashboardCharts from './components/DashboardCharts';
import AccountsTable from './components/AccountsTable';
import AccountDetailsModal from './components/AccountDetailsModal';

import { useAccounts } from './hooks/useAccounts';

export default function Dashboard() {
  const [selectedAccount, setSelectedAccount] = useState(null);

  /* ── data ── */
  const { accounts, loading, error } = useAccounts();

  const handleRowClick = (account) => {
    setSelectedAccount(account);
  };

  const closeModal = () => {
    setSelectedAccount(null);
  };

  return (
    <div className="db-layout">
      <Sidebar />

      <div className="db-main">
        <TopBar onAction={() => {}} />

        <div className="db-content">
          <header className="db-content__header">
            <div>
              <h1 className="db-content__title">Account Monitoring</h1>
              <p className="db-content__sub">Overview of all system accounts</p>
            </div>
          </header>

          {error && (
            <div className="db-error-banner">
              <p>Error loading accounts: {error}</p>
            </div>
          )}

          <TopSummaryCards accounts={accounts} loading={loading} />
          
          <DashboardCharts accounts={accounts} loading={loading} />

          <AccountsTable 
            accounts={accounts} 
            loading={loading} 
            onRowClick={handleRowClick} 
          />
        </div>
      </div>

      {selectedAccount && (
        <AccountDetailsModal account={selectedAccount} onClose={closeModal} />
      )}
    </div>
  );
}
