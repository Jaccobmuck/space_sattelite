import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requirePro?: boolean;
}

export default function ProtectedRoute({ children, requirePro = false }: ProtectedRouteProps) {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);

  // Wait for auth to initialize before redirecting
  if (!initialized) {
    return null;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requirePro && user.plan !== 'pro') {
    return <Navigate to="/account" replace />;
  }

  return <>{children}</>;
}
