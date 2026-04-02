import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSetUsername, useCheckUsername } from '../../hooks/useProfile';

interface UsernameSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function UsernameSetupModal({ isOpen, onClose, onSuccess }: UsernameSetupModalProps) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: checkUsername } = useCheckUsername();
  const { mutate: setUserUsername, isPending } = useSetUsername();

  const validateUsername = (value: string) => {
    if (value.length < 3) return 'Username must be at least 3 characters';
    if (value.length > 20) return 'Username must be 20 characters or less';
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Only letters, numbers, and underscores allowed';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const available = await checkUsername(username.toLowerCase());
      if (!available) {
        setError('Username is already taken');
        return;
      }

      setUserUsername(username.toLowerCase(), {
        onSuccess: () => {
          onSuccess();
          onClose();
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Failed to set username');
        },
      });
    } catch {
      setError('Failed to check username availability');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/70"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-sm glass-panel p-6 rounded-xl">
              <h2 className="font-orbitron text-xl text-accent-blue mb-2">
                Choose Your Username
              </h2>
              <p className="text-text-secondary text-sm mb-6">
                Pick a unique username to share sightings with the community. This cannot be changed later.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-text-secondary text-xs uppercase tracking-wide mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
                      @
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                        setError(null);
                      }}
                      placeholder="your_username"
                      maxLength={20}
                      disabled={isPending}
                      className="w-full pl-8 pr-3 py-2 bg-bg-secondary border border-border-glow rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-blue disabled:opacity-50"
                    />
                  </div>
                  {error && (
                    <p className="text-accent-red text-xs mt-2">{error}</p>
                  )}
                  <p className="text-text-secondary/60 text-xs mt-2">
                    3-20 characters, letters, numbers, and underscores only
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isPending}
                    className="flex-1 px-4 py-2 bg-bg-secondary border border-border-glow rounded-lg text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!username || isPending}
                    className="flex-1 px-4 py-2 bg-accent-blue/20 border border-accent-blue/50 rounded-lg text-accent-blue font-medium hover:bg-accent-blue/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? 'Setting...' : 'Set Username'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default memo(UsernameSetupModal);
