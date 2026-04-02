import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useCreateJournalEntry } from '../../hooks/useJournal';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import StarRating from './StarRating';
import type { JournalOutcome } from '../../types';

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  satelliteName: string;
  passTimestamp: string;
}

function JournalEntryModal({
  isOpen,
  onClose,
  satelliteName,
  passTimestamp,
}: JournalEntryModalProps) {
  const navigate = useNavigate();
  const userLocation = useAppStore((s) => s.userLocation);
  const user = useAuthStore((s) => s.user);
  const { mutate: createEntry, isPending } = useCreateJournalEntry();

  const [outcome, setOutcome] = useState<JournalOutcome | null>(null);
  const [starRating, setStarRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  // TODO: Use createdEntryId for shareable card download flow
  const [, setCreatedEntryId] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!outcome) return;

    createEntry(
      {
        satellite_name: satelliteName,
        pass_timestamp: passTimestamp,
        outcome,
        star_rating: outcome === 'saw_it' && starRating > 0 ? starRating : undefined,
        notes: notes.trim() || undefined,
        is_public: outcome === 'saw_it' ? isPublic : false,
        lat: userLocation?.lat,
        lng: userLocation?.lng,
        city: userLocation?.city,
        region: userLocation?.country,
      },
      {
        onSuccess: (entry) => {
          if (outcome === 'saw_it' && isPublic) {
            setCreatedEntryId(entry.id);
            setShowSuccess(true);
          } else {
            handleClose();
          }
        },
      }
    );
  };

  const handleClose = () => {
    setOutcome(null);
    setStarRating(0);
    setNotes('');
    setIsPublic(true);
    setShowSuccess(false);
    setCreatedEntryId(null);
    onClose();
  };

  const handleViewCommunity = () => {
    handleClose();
    navigate('/community');
  };

  const handleShareCard = () => {
    // TODO: Implement shareable card download flow
    // For now, just close the modal
    handleClose();
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/70"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md glass-panel p-6 rounded-xl">
              {showSuccess ? (
                // Success state with action buttons
                <div className="text-center">
                  <div className="text-5xl mb-4">🎉</div>
                  <h2 className="font-orbitron text-xl text-accent-green mb-2">
                    Sighting Logged!
                  </h2>
                  <p className="text-text-secondary text-sm mb-6">
                    Your observation of {satelliteName} has been shared with the community.
                  </p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleViewCommunity}
                      className="w-full px-4 py-3 bg-accent-blue/20 border border-accent-blue/50 rounded-lg text-accent-blue font-medium hover:bg-accent-blue/30 transition-colors"
                    >
                      View in Community Feed
                    </button>
                    <button
                      onClick={handleShareCard}
                      className="w-full px-4 py-3 bg-accent-purple/20 border border-accent-purple/50 rounded-lg text-accent-purple font-medium hover:bg-accent-purple/30 transition-colors"
                    >
                      Share Card
                    </button>
                    <button
                      onClick={handleClose}
                      className="w-full px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                // Entry form
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-orbitron text-lg text-accent-blue">
                      Did you see it?
                    </h2>
                    <button
                      onClick={handleClose}
                      className="text-text-secondary hover:text-text-primary transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="glass-panel p-3 rounded-lg mb-4">
                    <p className="font-orbitron text-accent-cyan text-sm">
                      {satelliteName}
                    </p>
                    <p className="text-text-secondary text-xs mt-1">
                      {new Date(passTimestamp).toLocaleString()}
                    </p>
                  </div>

                  {/* Outcome selection */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { id: 'saw_it' as JournalOutcome, label: 'Saw it!', icon: '✅' },
                      { id: 'missed_it' as JournalOutcome, label: 'Missed it', icon: '😔' },
                      { id: 'cloudy' as JournalOutcome, label: 'Cloudy', icon: '☁️' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setOutcome(opt.id)}
                        className={`p-3 rounded-lg border text-center transition-colors ${
                          outcome === opt.id
                            ? 'bg-accent-blue/20 border-accent-blue/50 text-accent-blue'
                            : 'bg-bg-secondary border-border-glow text-text-secondary hover:border-accent-blue/30'
                        }`}
                      >
                        <div className="text-2xl mb-1">{opt.icon}</div>
                        <div className="text-xs">{opt.label}</div>
                      </button>
                    ))}
                  </div>

                  {/* Star rating (only for saw_it) */}
                  {outcome === 'saw_it' && (
                    <div className="mb-4">
                      <label className="block text-text-secondary text-xs uppercase tracking-wide mb-2">
                        How was the view?
                      </label>
                      <StarRating value={starRating} onChange={setStarRating} />
                    </div>
                  )}

                  {/* Notes */}
                  <div className="mb-4">
                    <label className="block text-text-secondary text-xs uppercase tracking-wide mb-2">
                      Notes (optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value.slice(0, 280))}
                      placeholder="Describe your observation..."
                      maxLength={280}
                      rows={3}
                      className="w-full px-3 py-2 bg-bg-secondary border border-border-glow rounded-lg text-text-primary text-sm placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-blue resize-none"
                    />
                    <p className="text-text-secondary/60 text-xs text-right mt-1">
                      {notes.length}/280
                    </p>
                  </div>

                  {/* Share to community toggle (only for saw_it) */}
                  {outcome === 'saw_it' && (
                    <div className="mb-6">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div
                          onClick={() => setIsPublic(!isPublic)}
                          className={`relative w-12 h-6 rounded-full transition-colors ${
                            isPublic ? 'bg-accent-green' : 'bg-bg-secondary'
                          }`}
                        >
                          <motion.div
                            animate={{ x: isPublic ? 24 : 2 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="absolute top-1 w-4 h-4 bg-white rounded-full"
                          />
                        </div>
                        <span className="text-text-primary text-sm">
                          Share to community feed
                        </span>
                      </label>
                      <p className="text-text-secondary/60 text-xs mt-1 ml-15">
                        {isPublic
                          ? 'Your sighting will be visible to everyone'
                          : 'Only you will see this entry'}
                      </p>
                    </div>
                  )}

                  {/* Submit button */}
                  <button
                    onClick={handleSubmit}
                    disabled={!outcome || isPending}
                    className="w-full px-4 py-3 bg-accent-blue/20 border border-accent-blue/50 rounded-lg text-accent-blue font-orbitron text-sm tracking-wide hover:bg-accent-blue/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? 'Saving...' : 'Log Observation'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default memo(JournalEntryModal);
