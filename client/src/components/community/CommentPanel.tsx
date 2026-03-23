import { memo } from 'react';
import type { CommunityComment } from '../../types';

interface CommentPanelProps {
  comments: CommunityComment[];
  isLoading: boolean;
}

function CommentPanel({ comments, isLoading }: CommentPanelProps) {
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-bg-secondary" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-bg-secondary rounded w-24" />
              <div className="h-4 bg-bg-secondary rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-text-secondary text-sm">No comments yet</p>
        <p className="text-text-secondary/60 text-xs mt-1">Be the first to comment!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => {
        const displayName = comment.user.display_name || comment.user.username;
        return (
          <div key={comment.id} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-bg-secondary border border-border-glow overflow-hidden flex-shrink-0">
              {comment.user.avatar ? (
                <img
                  src={comment.user.avatar}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-accent-blue font-orbitron text-xs">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-text-primary text-sm font-medium truncate">
                  {displayName}
                </span>
                <span className="text-text-secondary/60 text-xs">
                  {formatTimeAgo(comment.created_at)}
                </span>
              </div>
              <p className="text-text-primary text-sm mt-0.5 break-words">
                {comment.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(CommentPanel);
