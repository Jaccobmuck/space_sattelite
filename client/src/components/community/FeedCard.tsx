import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import type { CommunitySighting } from '../../types';
import { useLike } from '../../hooks/useLike';
import { useAuthStore } from '../../store/authStore';
import { useCommunityStore } from '../../store/communitySlice';

interface FeedCardProps {
  sighting: CommunitySighting;
  index: number;
}

function FeedCard({ sighting, index }: FeedCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageFullscreen, setImageFullscreen] = useState(false);
  const { mutate: toggleLike, isPending: isLiking } = useLike();
  const user = useAuthStore((s) => s.user);
  const openSighting = useCommunityStore((s) => s.openSighting);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    toggleLike(sighting.id);
  };

  const handleCardClick = () => {
    openSighting(sighting.id);
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageFullscreen(true);
  };

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

  const displayName = sighting.user.display_name || sighting.user.username;
  const location = [sighting.city, sighting.region].filter(Boolean).join(', ');

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
        onClick={handleCardClick}
        className="glass-panel p-4 rounded-lg cursor-pointer hover:border-accent-blue/50 transition-colors"
      >
        {/* Header: User info */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-bg-secondary border border-border-glow overflow-hidden flex-shrink-0">
            {sighting.user.avatar ? (
              <img
                src={sighting.user.avatar}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-accent-blue font-orbitron text-sm">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text-primary font-medium truncate">{displayName}</p>
            <p className="text-text-secondary text-xs">{formatTimeAgo(sighting.created_at)}</p>
          </div>
        </div>

        {/* Satellite info */}
        <div className="mb-3">
          <h3 className="font-orbitron text-accent-cyan text-sm tracking-wide">
            {sighting.satellite_name}
          </h3>
          <div className="flex items-center gap-2 text-xs text-text-secondary mt-1">
            <span>{new Date(sighting.pass_timestamp).toLocaleString()}</span>
            {location && (
              <>
                <span>•</span>
                <span>{location}</span>
              </>
            )}
          </div>
        </div>

        {/* Star rating */}
        {sighting.star_rating && (
          <div className="mb-3">
            {renderStars(sighting.star_rating)}
          </div>
        )}

        {/* Notes */}
        {sighting.notes && (
          <div className="mb-3">
            <p
              className={`text-text-primary text-sm ${
                !isExpanded ? 'line-clamp-2' : ''
              }`}
            >
              {sighting.notes}
            </p>
            {sighting.notes.length > 100 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-accent-blue text-xs mt-1 hover:underline"
              >
                {isExpanded ? 'show less' : 'read more'}
              </button>
            )}
          </div>
        )}

        {/* Card image thumbnail */}
        {sighting.card_image && (
          <div
            onClick={handleImageClick}
            className="mb-3 rounded-lg overflow-hidden border border-border-glow hover:border-accent-cyan transition-colors"
          >
            <img
              src={sighting.card_image}
              alt="Sighting card"
              className="w-full h-40 object-cover"
            />
          </div>
        )}

        {/* Actions: Like & Comments */}
        <div className="flex items-center gap-4 pt-2 border-t border-border-glow/30">
          <motion.button
            onClick={handleLike}
            disabled={!user || isLiking}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-1.5 text-sm transition-colors ${
              sighting.user_liked
                ? 'text-accent-red'
                : 'text-text-secondary hover:text-accent-red'
            } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <motion.span
              animate={sighting.user_liked ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              {sighting.user_liked ? '❤️' : '🤍'}
            </motion.span>
            <span>{sighting.like_count}</span>
          </motion.button>

          <button
            onClick={handleCardClick}
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent-blue transition-colors"
          >
            <span>💬</span>
            <span>{sighting.comment_count}</span>
            {sighting.comment_count > 0 && (
              <span className="text-xs">View comments</span>
            )}
          </button>
        </div>
      </motion.div>

      {/* Fullscreen image modal */}
      {imageFullscreen && sighting.card_image && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setImageFullscreen(false)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
        >
          <motion.img
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            src={sighting.card_image}
            alt="Sighting card"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
          <button
            onClick={() => setImageFullscreen(false)}
            className="absolute top-4 right-4 text-white text-2xl hover:text-accent-blue transition-colors"
          >
            ✕
          </button>
        </motion.div>
      )}
    </>
  );
}

export default memo(FeedCard);
