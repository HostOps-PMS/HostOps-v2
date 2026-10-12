import AuthContext from '../AuthContext';
import { DashboardProvider } from '../clientDashboard/context/DashboardContext';
import DashboardPage from '../clientDashboard';
import { demoAuth } from './demoData';

// Public /demo: the real client dashboard, fed by sample data instead of the API.
export default function DemoPage() {
  return (
    <AuthContext.Provider value={demoAuth}>
      <DashboardProvider demo>
        <DashboardPage />
      </DashboardProvider>
    </AuthContext.Provider>
  );
}
