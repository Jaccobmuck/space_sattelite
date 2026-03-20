import { useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';

export default function AuthInitializer() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    if (accessToken) {
      refreshToken();
    }
  }, [accessToken, refreshToken]);

  return null;
}
