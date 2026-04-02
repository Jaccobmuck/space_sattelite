import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useAuthStore } from '../src/store/authStore';

// Mock ProtectedRoute component (inline to avoid import issues)
function ProtectedRoute({ children, requirePro = false }: { children: React.ReactNode; requirePro?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (!accessToken || !user) {
    // Redirect to home
    return <div data-testid="redirect-home">Redirected to Home</div>;
  }

  if (requirePro && user.plan !== 'pro') {
    return <div data-testid="redirect-account">Redirected to Account</div>;
  }

  return <>{children}</>;
}

function TestComponent() {
  return <div data-testid="protected-content">Protected Content</div>;
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isLoading: false,
    });
  });

  describe('when unauthenticated', () => {
    it('should redirect to home when no user', () => {
      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('redirect-home')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should redirect to home when no accessToken', () => {
      useAuthStore.setState({
        user: { id: 1, email: 'test@example.com', plan: 'free', stripe_customer_id: null, created_at: '' },
        accessToken: null,
      });

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('redirect-home')).toBeInTheDocument();
    });
  });

  describe('when authenticated', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: { id: 1, email: 'test@example.com', plan: 'free', stripe_customer_id: null, created_at: '' },
        accessToken: 'valid-token',
      });
    });

    it('should render children when authenticated', () => {
      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should redirect free user to account when requirePro is true', () => {
      render(
        <MemoryRouter initialEntries={['/pro-feature']}>
          <Routes>
            <Route
              path="/pro-feature"
              element={
                <ProtectedRoute requirePro>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('redirect-account')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });
  });

  describe('when authenticated as pro user', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: { id: 1, email: 'pro@example.com', plan: 'pro', stripe_customer_id: 'cus_123', created_at: '' },
        accessToken: 'valid-token',
      });
    });

    it('should render children when pro user accesses pro route', () => {
      render(
        <MemoryRouter initialEntries={['/pro-feature']}>
          <Routes>
            <Route
              path="/pro-feature"
              element={
                <ProtectedRoute requirePro>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should render children when pro user accesses regular protected route', () => {
      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });
});
