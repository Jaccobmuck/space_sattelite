import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { AxiosError } from 'axios';

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: 'bg-accent-green/20 border-accent-green/50 text-accent-green',
    error: 'bg-accent-red/20 border-accent-red/50 text-accent-red',
    info: 'bg-accent-blue/20 border-accent-blue/50 text-accent-blue',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`fixed top-4 right-4 z-[200] px-4 py-3 rounded border text-sm ${colors[type]}`}
    >
      {message}
    </motion.div>
  );
}

function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  children,
  variant = 'default',
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'danger';
}) {
  return (
    <div className={`border rounded ${variant === 'danger' ? 'border-accent-red/30' : 'border-white/10'}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-orbitron tracking-wide transition-colors ${
          variant === 'danger'
            ? 'text-accent-red/70 hover:text-accent-red'
            : 'text-text-secondary hover:text-text-primary'
        }`}
      >
        {title}
        <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getAxiosErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    return err.response?.data?.error || fallback;
  }
  return fallback;
}

export default function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const updateUserEmail = useAuthStore((s) => s.updateUserEmail);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [upgradeStatus, setUpgradeStatus] = useState<'success' | 'cancelled' | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Section toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showDanger, setShowDanger] = useState(false);

  // Change password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Change email form
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // Delete account form
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (searchParams.get('upgrade') === 'success') {
      setUpgradeStatus('success');
      setSearchParams({}, { replace: true });
      useAuthStore.getState().refreshToken();
    } else if (searchParams.get('upgrade') === 'cancelled') {
      setUpgradeStatus('cancelled');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  async function handleUpgrade() {
    setIsRedirecting(true);
    try {
      const { data } = await api.post('/api/billing/create-checkout-session');
      window.location.href = data.url;
    } catch (err) {
      setIsRedirecting(false);
      setToast({ message: getAxiosErrorMessage(err, 'Failed to start checkout'), type: 'error' });
    }
  }

  async function handleManageSubscription() {
    setIsRedirecting(true);
    try {
      const { data } = await api.post('/api/billing/portal');
      window.location.href = data.url;
    } catch (err) {
      setIsRedirecting(false);
      setToast({ message: getAxiosErrorMessage(err, 'Failed to open billing portal'), type: 'error' });
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setToast({ message: 'New passwords do not match', type: 'error' });
      return;
    }
    setPwLoading(true);
    try {
      await api.patch('/api/account/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setToast({ message: 'Password updated. You will be logged out shortly.', type: 'success' });
      setTimeout(async () => {
        await logout();
        navigate('/login');
      }, 2000);
    } catch (err) {
      const msg = getAxiosErrorMessage(err, 'Failed to update password');
      if (err instanceof AxiosError && err.response?.status === 423) {
        setToast({ message: 'Account is temporarily locked. Try again in 15 minutes.', type: 'error' });
      } else {
        setToast({ message: msg, type: 'error' });
      }
    } finally {
      setPwLoading(false);
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailLoading(true);
    try {
      const { data } = await api.patch('/api/account/email', {
        new_email: newEmail,
        password: emailPassword,
      });
      updateUserEmail(data.email);
      setNewEmail('');
      setEmailPassword('');
      setShowEmail(false);
      setToast({ message: 'Email updated successfully.', type: 'success' });
    } catch (err) {
      setToast({ message: getAxiosErrorMessage(err, 'Failed to update email'), type: 'error' });
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setDeleteLoading(true);
    try {
      await api.delete('/api/account', { data: { password: deletePassword } });
      await logout();
      navigate('/');
    } catch (err) {
      setToast({ message: getAxiosErrorMessage(err, 'Failed to delete account'), type: 'error' });
    } finally {
      setDeleteLoading(false);
      setDeleteConfirm(false);
    }
  }

  if (!user) return null;

  const inputClass =
    'w-full bg-bg-primary/50 border border-white/10 rounded px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent-blue/50 transition-colors';
  const btnPrimary =
    'w-full bg-accent-blue/20 border border-accent-blue/50 text-accent-blue font-orbitron tracking-wide py-2 rounded hover:bg-accent-blue/30 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4 py-8">
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <span className="text-4xl">🛰️</span>
          <h1 className="font-orbitron text-2xl font-bold text-accent-blue tracking-wider mt-2 glow-text">
            ACCOUNT
          </h1>
        </div>

        <div className="bg-bg-secondary/80 backdrop-blur-md border border-border-glow rounded-lg p-6 space-y-6">
          {upgradeStatus === 'success' && (
            <div className="bg-accent-green/20 border border-accent-green/50 text-accent-green rounded px-4 py-3 text-sm">
              🎉 Welcome to Pro! Your account has been upgraded.
            </div>
          )}
          {upgradeStatus === 'cancelled' && (
            <div className="bg-accent-yellow/20 border border-yellow-500/50 text-yellow-400 rounded px-4 py-3 text-sm">
              Checkout was cancelled. You can upgrade anytime.
            </div>
          )}

          {/* User info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary text-sm font-orbitron tracking-wide">EMAIL</span>
              <span className="text-text-primary">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary text-sm font-orbitron tracking-wide">PLAN</span>
              <span
                className={`px-3 py-1 rounded text-sm font-orbitron tracking-wide ${
                  user.plan === 'pro'
                    ? 'bg-accent-purple/20 border border-purple-500/50 text-purple-400'
                    : 'bg-white/5 border border-white/10 text-text-secondary'
                }`}
              >
                {user.plan === 'pro' ? '⭐ PRO' : 'FREE'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary text-sm font-orbitron tracking-wide">MEMBER SINCE</span>
              <span className="text-text-primary text-sm">
                {new Date(user.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="border-t border-white/10" />

          {/* Pro features / upgrade */}
          {user.plan === 'free' && (
            <div className="space-y-3">
              <h3 className="font-orbitron text-sm text-text-secondary tracking-wide">PRO FEATURES</h3>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-center gap-2">
                  <span className="text-accent-green">✓</span>
                  Full satellite catalog (100+ satellites)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-green">✓</span>
                  Detailed satellite data & orbit visualization
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-green">✓</span>
                  Pass predictions for your location
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-green">✓</span>
                  Real-time space weather monitoring
                </li>
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            {user.plan === 'free' ? (
              <button
                onClick={handleUpgrade}
                disabled={isRedirecting}
                className="w-full bg-gradient-to-r from-purple-600/30 to-accent-blue/30 border border-purple-500/50 text-purple-300 font-orbitron tracking-wide py-2.5 rounded hover:from-purple-600/40 hover:to-accent-blue/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRedirecting ? 'REDIRECTING...' : '⭐ UPGRADE TO PRO'}
              </button>
            ) : (
              <button
                onClick={handleManageSubscription}
                disabled={isRedirecting}
                className="w-full bg-accent-blue/20 border border-accent-blue/50 text-accent-blue font-orbitron tracking-wide py-2.5 rounded hover:bg-accent-blue/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRedirecting ? 'REDIRECTING...' : 'MANAGE SUBSCRIPTION'}
              </button>
            )}

            <button
              onClick={() => navigate('/')}
              className="w-full bg-white/5 border border-white/10 text-text-secondary font-orbitron tracking-wide py-2.5 rounded hover:bg-white/10 transition-colors"
            >
              BACK TO TRACKER
            </button>

            <button
              onClick={handleLogout}
              className="w-full text-accent-red/70 hover:text-accent-red text-sm font-orbitron tracking-wide py-2 transition-colors"
            >
              SIGN OUT
            </button>
          </div>

          <div className="border-t border-white/10" />

          {/* Change Password */}
          <CollapsibleSection
            title="CHANGE PASSWORD"
            isOpen={showPassword}
            onToggle={() => setShowPassword(!showPassword)}
          >
            <form onSubmit={handleChangePassword} className="space-y-3">
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                required
              />
              <input
                type="password"
                placeholder="New password (min 8 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                minLength={8}
                maxLength={128}
                required
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                required
              />
              <button type="submit" disabled={pwLoading} className={btnPrimary}>
                {pwLoading ? 'SAVING...' : 'SAVE PASSWORD'}
              </button>
            </form>
          </CollapsibleSection>

          {/* Change Email */}
          <CollapsibleSection
            title="CHANGE EMAIL"
            isOpen={showEmail}
            onToggle={() => setShowEmail(!showEmail)}
          >
            <form onSubmit={handleChangeEmail} className="space-y-3">
              <input
                type="email"
                placeholder="New email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className={inputClass}
                required
              />
              <input
                type="password"
                placeholder="Confirm your password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                className={inputClass}
                required
              />
              <button type="submit" disabled={emailLoading} className={btnPrimary}>
                {emailLoading ? 'SAVING...' : 'SAVE EMAIL'}
              </button>
            </form>
          </CollapsibleSection>

          {/* Danger Zone */}
          <CollapsibleSection
            title="DANGER ZONE"
            isOpen={showDanger}
            onToggle={() => { setShowDanger(!showDanger); setDeleteConfirm(false); }}
            variant="danger"
          >
            <p className="text-text-secondary text-xs">
              This will permanently delete your account, cancel any active subscriptions, and remove all data. This action cannot be undone.
            </p>
            <form onSubmit={handleDeleteAccount} className="space-y-3">
              <input
                type="password"
                placeholder="Enter your password to confirm"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className={inputClass}
                required
              />
              <button
                type="submit"
                disabled={deleteLoading}
                className="w-full bg-accent-red/20 border border-accent-red/50 text-accent-red font-orbitron tracking-wide py-2 rounded hover:bg-accent-red/30 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteLoading ? 'DELETING...' : deleteConfirm ? 'CONFIRM DELETE — THIS IS PERMANENT' : 'DELETE ACCOUNT'}
              </button>
            </form>
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}
