import { Outlet } from 'react-router';
import Sidebar from './components/Sidebar';

export default function TeamLeaderLayout() {
  return (
    <div className="db-layout">
      <Sidebar />
      <div className="db-main">
        <Outlet />
      </div>
    </div>
  );
}
