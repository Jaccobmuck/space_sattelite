import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import type { JournalEntry } from '../../types';
import { useToggleJournalVisibility, useDeleteJournalEntry } from '../../hooks/useJournal';
import StarRating from './StarRating';

interface JournalCardProps {
  entry: JournalEntry;
}

function JournalCard({ entry }: JournalCardProps) {
  const [showActions, setShowActions] = useState(false);
  const { mutate: toggleVisibility, isPending: isToggling } = useToggleJournalVisibility();
  const { mutate: deleteEntry, isPending: isDeleting } = useDeleteJournalEntry();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const outcomeConfig = {
    saw_it: { icon: '✅', label: 'Saw it', color: 'text-accent-green' },
    missed_it: { icon: '😔', label: 'Missed it', color: 'text-accent-orange' },
    cloudy: { icon: '☁️', label: 'Cloudy', color: 'text-text-secondary' },
  };

  const outcome = outcomeConfig[entry.outcome];
  const location = [entry.city, entry.region].filter(Boolean).join(', ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel p-4 rounded-lg"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-orbitron text-accent-cyan text-sm tracking-wide">
            {entry.satellite_name}
          </h3>
          <p className="text-text-secondary text-xs mt-1">
            {formatDate(entry.pass_timestamp)}
          </p>
          {location && (
            <p className="text-text-secondary/60 text-xs">📍 {location}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-sm ${outcome.color}`}>
            <span>{outcome.icon}</span>
            <span className="text-xs">{outcome.label}</span>
          </span>
          <button
            onClick={() => setShowActions(!showActions)}
            className="text-text-secondary hover:text-text-primary transition-colors p-1"
          >
            ⋮
          </button>
        </div>
      </div>

      {/* Star rating */}
      {entry.star_rating && (
        <div className="mb-3">
          <StarRating value={entry.star_rating} onChange={() => {}} readonly />
        </div>
      )}

      {/* Notes */}
      {entry.notes && (
        <p className="text-text-primary text-sm mb-3">{entry.notes}</p>
      )}

      {/* Card image */}
      {entry.card_image && (
        <div className="mb-3 rounded-lg overflow-hidden border border-border-glow">
          <img
            src={entry.card_image}
            alt="Sighting card"
            className="w-full object-cover"
          />
        </div>
      )}

      {/* Visibility badge */}
      <div className="flex items-center justify-between text-xs">
        <span
          className={`px-2 py-1 rounded ${
            entry.is_public
              ? 'bg-accent-green/20 text-accent-green'
              : 'bg-bg-secondary text-text-secondary'
          }`}
        >
          {entry.is_public ? '🌍 Public' : '🔒 Private'}
        </span>
        <span className="text-text-secondary/60">
          {new Date(entry.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Actions dropdown */}
      {showActions && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 pt-3 border-t border-border-glow/30 flex gap-2"
        >
          <button
            onClick={() => toggleVisibility(entry.id)}
            disabled={isToggling}
            className="flex-1 px-3 py-2 bg-bg-secondary border border-border-glow rounded text-text-secondary text-xs hover:text-text-primary hover:border-accent-blue transition-colors disabled:opacity-50"
          >
            {isToggling ? '...' : entry.is_public ? 'Make Private' : 'Make Public'}
          </button>
          <button
            onClick={() => {
              if (confirm('Delete this entry?')) {
                deleteEntry(entry.id);
              }
            }}
            disabled={isDeleting}
            className="px-3 py-2 bg-accent-red/10 border border-accent-red/30 rounded text-accent-red text-xs hover:bg-accent-red/20 transition-colors disabled:opacity-50"
          >
            {isDeleting ? '...' : 'Delete'}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

export default memo(JournalCard);
