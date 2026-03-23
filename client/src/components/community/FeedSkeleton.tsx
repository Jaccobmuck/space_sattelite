import { memo } from 'react';

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="glass-panel p-4 rounded-lg animate-pulse">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-bg-secondary" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-bg-secondary rounded w-24" />
              <div className="h-3 bg-bg-secondary rounded w-16" />
            </div>
          </div>

          {/* Satellite info */}
          <div className="mb-3 space-y-2">
            <div className="h-4 bg-bg-secondary rounded w-32" />
            <div className="h-3 bg-bg-secondary rounded w-48" />
          </div>

          {/* Stars */}
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className="w-4 h-4 bg-bg-secondary rounded" />
            ))}
          </div>

          {/* Notes */}
          <div className="space-y-2 mb-3">
            <div className="h-3 bg-bg-secondary rounded w-full" />
            <div className="h-3 bg-bg-secondary rounded w-3/4" />
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-2 border-t border-border-glow/30">
            <div className="h-6 bg-bg-secondary rounded w-16" />
            <div className="h-6 bg-bg-secondary rounded w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default memo(FeedSkeleton);
