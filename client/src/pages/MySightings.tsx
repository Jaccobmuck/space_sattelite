import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useJournalEntries, useDeleteJournalEntry, useToggleJournalVisibility } from '../hooks/useJournal';
import { motion } from 'framer-motion';

export default function MySightings() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useJournalEntries(page, 20);
  const { mutate: deleteEntry, isPending: isDeleting } = useDeleteJournalEntry();
  const { mutate: toggleVisibility } = useToggleJournalVisibility();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const entries = data?.entries || [];
  const pagination = data?.pagination;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={star <= rating ? 'text-accent-orange' : 'text-text-secondary/30'}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  const getOutcomeEmoji = (outcome: string) => {
    switch (outcome) {
      case 'saw_it': return '✅';
      case 'missed_it': return '😔';
      case 'cloudy': return '☁️';
      default: return '📝';
    }
  };

  const handleDelete = (id: string) => {
    deleteEntry(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-lg border-b border-border-glow">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-text-secondary hover:text-text-primary transition-colors">
              ← Back
            </Link>
            <h1 className="font-orbitron text-xl text-accent-blue tracking-wider">
              My Sightings
            </h1>
            <Link
              to="/community"
              className="text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              Community
            </Link>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="glass-panel p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-xs uppercase tracking-wide">Total Sightings</p>
              <p className="font-orbitron text-2xl text-accent-cyan">
                {pagination?.total || 0}
              </p>
            </div>
            <div className="text-4xl">🔭</div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 pb-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-panel p-4 rounded-lg animate-pulse">
                <div className="h-5 bg-bg-secondary rounded w-1/3 mb-2" />
                <div className="h-4 bg-bg-secondary rounded w-1/2 mb-2" />
                <div className="h-4 bg-bg-secondary rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🛰️</div>
            <h2 className="font-orbitron text-xl text-text-primary mb-2">No sightings yet</h2>
            <p className="text-text-secondary text-sm mb-6">
              Start logging your satellite observations!
            </p>
            <Link
              to="/"
              className="px-6 py-2 bg-accent-blue/20 border border-accent-blue/50 rounded-lg text-accent-blue font-medium hover:bg-accent-blue/30 transition-colors"
            >
              View Pass Predictions
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-4 rounded-lg"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getOutcomeEmoji(entry.outcome)}</span>
                    <h3 className="font-orbitron text-accent-cyan">
                      {entry.satellite_name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleVisibility(entry.id)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        entry.is_public
                          ? 'bg-accent-green/20 text-accent-green'
                          : 'bg-bg-secondary text-text-secondary'
                      }`}
                      title={entry.is_public ? 'Public - click to make private' : 'Private - click to make public'}
                    >
                      {entry.is_public ? '🌐 Public' : '🔒 Private'}
                    </button>
                  </div>
                </div>

                <p className="text-text-secondary text-sm mb-2">
                  {formatDate(entry.pass_timestamp)}
                </p>

                {entry.star_rating && (
                  <div className="mb-2">{renderStars(entry.star_rating)}</div>
                )}

                {(entry.city || entry.region) && (
                  <p className="text-text-secondary text-xs mb-2">
                    📍 {[entry.city, entry.region].filter(Boolean).join(', ')}
                  </p>
                )}

                {entry.notes && (
                  <p className="text-text-primary text-sm mb-3">{entry.notes}</p>
                )}

                {/* Delete button */}
                <div className="flex justify-end pt-2 border-t border-border-glow/30">
                  {deleteConfirmId === entry.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-text-secondary text-xs">Delete this sighting?</span>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        disabled={isDeleting}
                        className="px-3 py-1 bg-accent-red/20 border border-accent-red/50 rounded text-accent-red text-xs hover:bg-accent-red/30 transition-colors disabled:opacity-50"
                      >
                        {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-3 py-1 bg-bg-secondary border border-border-glow rounded text-text-secondary text-xs hover:text-text-primary transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(entry.id)}
                      className="text-text-secondary/60 hover:text-accent-red text-xs transition-colors"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </motion.div>
            ))}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 py-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isFetching}
                  className="px-4 py-2 bg-bg-secondary border border-border-glow rounded text-text-secondary text-sm hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ← Previous
                </button>
                <span className="text-text-secondary text-sm">
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!pagination.hasMore || isFetching}
                  className="px-4 py-2 bg-bg-secondary border border-border-glow rounded text-text-secondary text-sm hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
