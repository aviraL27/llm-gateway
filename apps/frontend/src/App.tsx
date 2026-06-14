import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RequestLogsPage from './pages/RequestLogsPage';
import ApiKeysPage from './pages/ApiKeysPage';
import TeamSettingsPage from './pages/TeamSettingsPage';
import RealtimePage from './pages/RealtimePage';

// Private route component
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('llm-gateway-token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// App shell layout component
function AppLayout() {
  const location = useLocation();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Command Center';
      case '/logs':
        return 'Request Inspector';
      case '/keys':
        return 'Access Credentials';
      case '/realtime':
        return 'Live Stream';
      case '/settings':
        return 'System Configuration';
      default:
        return 'Command Center';
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <TopBar title={getPageTitle()} />
        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/logs" element={<RequestLogsPage />} />
            <Route path="/keys" element={<ApiKeysPage />} />
            <Route path="/realtime" element={<RealtimePage />} />
            <Route path="/settings" element={<TeamSettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
