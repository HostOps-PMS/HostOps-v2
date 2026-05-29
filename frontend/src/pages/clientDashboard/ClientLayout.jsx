import React from 'react';
import { Outlet } from 'react-router-dom';
import ClientSidebar from './components/ClientSidebar';
import '../clientDashboard/ClientSidebar.css';

/**
 * ClientLayout — wraps all authenticated client pages with a sidebar.
 * The sidebar provides navigation between Dashboard, Team Leader, and Staff.
 * The active page is rendered via React Router's <Outlet />.
 */
export default function ClientLayout() {
  return (
    <div className="cs-layout">
      <ClientSidebar />
      <div className="cs-main">
        <Outlet />
      </div>
    </div>
  );
}
