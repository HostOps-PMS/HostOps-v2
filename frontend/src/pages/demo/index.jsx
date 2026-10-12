import AuthContext from '../AuthContext';
import { DashboardProvider } from '../clientDashboard/context/DashboardContext';
import DashboardPage from '../clientDashboard';
import InboxPage from '../clientDashboard/components/InboxPage';
import { demoAuth } from './demoData';

// Public /demo and /demo/inbox: the real client dashboard and inbox, fed by sample data instead of the API.
export default function DemoPage({ inbox = false }) {
  return (
    <AuthContext.Provider value={demoAuth}>
      <DashboardProvider demo>
        {inbox ? <InboxPage /> : <DashboardPage />}
      </DashboardProvider>
    </AuthContext.Provider>
  );
}
