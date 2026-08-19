import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';

// Monaco is a large dependency; keep it out of the login/dashboard bundle.
const InterviewSessionPage = lazy(() => import('./pages/InterviewSessionPage'));
const CandidateJoinPage = lazy(() => import('./pages/CandidateJoinPage'));

function Loading() {
  return <div className="p-6 text-slate-500">Loading…</div>;
}

export default function App() {
  const token = useAuthStore((s) => s.token);

  return (
    <Suspense fallback={<Loading />}>
    <Routes>
      <Route path="/" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/join/:sessionCode" element={<CandidateJoinPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interview/:id"
        element={
          <ProtectedRoute>
            <InterviewSessionPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
