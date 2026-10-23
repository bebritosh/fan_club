import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AthletesList from './pages/AthletesList.jsx';
import AthleteProfile from './pages/AthleteProfile.jsx';
import ClubsDirectory from './pages/ClubsDirectory.jsx';
import TransfersHistory from './pages/TransfersHistory.jsx';
import EventsCalendar from './pages/EventsCalendar.jsx';
import Analytics from './pages/Analytics.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import AuthPage from './pages/AuthPage.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="app-loading">Подключаем рабочее пространство…</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />

      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="athletes" element={<AthletesList />} />
        <Route path="athletes/:id" element={<AthleteProfile />} />
        <Route path="clubs" element={<ClubsDirectory />} />
        <Route path="transfers" element={<TransfersHistory />} />
        <Route path="events" element={<EventsCalendar />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}