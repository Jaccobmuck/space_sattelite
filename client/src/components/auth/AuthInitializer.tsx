import { useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';

export default function AuthInitializer() {
  const initialize = useAuthStore((s) => s.initialize);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    initialize();
  }, [initialize]);

  return null;
}
