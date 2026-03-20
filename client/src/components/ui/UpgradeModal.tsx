import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import { useNavigate } from 'react-router-dom';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
}

export default function UpgradeModal({ isOpen, onClose, featureName }: UpgradeModalProps) {
  const user = useAuthStore((s) => s.user);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const navigate = useNavigate();

  async function handleUpgrade() {
    if (!user) {
      navigate('/login');
      onClose();
      return;
    }

    setIsRedirecting(true);
    try {
      const { data } = await api.post('/api/billing/create-checkout-session');
      window.location.href = data.url;
    } catch {
      setIsRedirecting(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative bg-bg-secondary border border-border-glow rounded-lg p-6 max-w-md w-full"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-text-secondary hover:text-text-primary transition-colors text-lg"
            >
              ✕
            </button>

            <div className="text-center space-y-4">
              <div className="text-4xl">🔒</div>
              <h2 className="font-orbitron text-lg text-text-primary tracking-wide">
                PRO FEATURE
              </h2>
              <p className="text-text-secondary text-sm">
                <span className="text-accent-blue font-medium">{featureName}</span> is available
                exclusively for Pro subscribers.
              </p>

              <div className="border-t border-white/10 my-4" />

              <ul className="text-left space-y-2 text-sm text-text-secondary">
                <li className="flex items-center gap-2">
                  <span className="text-accent-green">✓</span>
                  Full satellite catalog access
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-green">✓</span>
                  Detailed orbit data & predictions
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-green">✓</span>
                  Pass predictions for your location
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-green">✓</span>
                  Real-time space weather alerts
                </li>
              </ul>

              <button
                onClick={handleUpgrade}
                disabled={isRedirecting}
                className="w-full bg-gradient-to-r from-purple-600/30 to-accent-blue/30 border border-purple-500/50 text-purple-300 font-orbitron tracking-wide py-2.5 rounded hover:from-purple-600/40 hover:to-accent-blue/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                {isRedirecting ? 'REDIRECTING...' : '⭐ UPGRADE TO PRO'}
              </button>

              {!user && (
                <p className="text-text-secondary text-xs">
                  You'll need to{' '}
                  <button onClick={() => { navigate('/login'); onClose(); }} className="text-accent-blue hover:underline">
                    sign in
                  </button>{' '}
                  first.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
