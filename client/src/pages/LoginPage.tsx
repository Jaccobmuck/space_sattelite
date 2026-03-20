import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { AxiosError } from 'axios';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.error || 'Login failed');
      } else {
        setError('Login failed');
      }
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-4xl">🛰️</span>
          <h1 className="font-orbitron text-2xl font-bold text-accent-blue tracking-wider mt-2 glow-text">
            SENTRY
          </h1>
          <p className="text-text-secondary mt-2">Sign in to your account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-bg-secondary/80 backdrop-blur-md border border-border-glow rounded-lg p-6 space-y-4"
        >
          {error && (
            <div className="bg-accent-red/20 border border-accent-red/50 text-accent-red rounded px-4 py-2 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-orbitron text-text-secondary mb-1 tracking-wide">
              EMAIL
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg-primary border border-white/10 rounded px-3 py-2 text-text-primary focus:border-accent-blue focus:outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-orbitron text-text-secondary mb-1 tracking-wide">
              PASSWORD
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg-primary border border-white/10 rounded px-3 py-2 text-text-primary focus:border-accent-blue focus:outline-none transition-colors"
              placeholder="Min 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-accent-blue/20 border border-accent-blue/50 text-accent-blue font-orbitron tracking-wide py-2.5 rounded hover:bg-accent-blue/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'SIGNING IN...' : 'SIGN IN'}
          </button>

          <p className="text-center text-text-secondary text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-accent-blue hover:underline">
              Register
            </Link>
          </p>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full text-text-secondary/60 hover:text-text-secondary text-sm py-1 transition-colors"
          >
            Continue without signing in →
          </button>
        </form>
      </div>
    </div>
  );
}
