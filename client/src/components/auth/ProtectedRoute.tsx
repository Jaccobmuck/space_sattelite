import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requirePro?: boolean;
}

export default function ProtectedRoute({ children, requirePro = false }: ProtectedRouteProps) {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requirePro && user.plan !== 'pro') {
    return <Navigate to="/account" replace />;
  }

  return <>{children}</>;
}
