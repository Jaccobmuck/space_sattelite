import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCommunityStore } from '../../store/communitySlice';
import { useSighting } from '../../hooks/useSighting';
import { useComments } from '../../hooks/useComments';
import { useLike } from '../../hooks/useLike';
import { useAuthStore } from '../../store/authStore';
import CommentPanel from './CommentPanel';
import CommentInput from './CommentInput';

function SightingDetailSlideOver() {
  const openSightingId = useCommunityStore((s) => s.openSightingId);
  const closeSighting = useCommunityStore((s) => s.closeSighting);
  const user = useAuthStore((s) => s.user);
  const [imageFullscreen, setImageFullscreen] = useState(false);

  const { data: sighting, isLoading: sightingLoading } = useSighting(openSightingId);
  const { data: commentsData, isLoading: commentsLoading } = useComments(openSightingId);
  const { mutate: toggleLike, isPending: isLiking } = useLike();

  const handleLike = () => {
    if (!user || !sighting) return;
    toggleLike(sighting.id);
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-lg ${star <= rating ? 'text-accent-orange' : 'text-text-secondary/30'}`}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AnimatePresence>
      {openSightingId && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSighting}
            className="fixed inset-0 z-40 bg-black/50"
          />

          {/* Slide-over panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 z-50 w-full max-w-md h-full bg-bg-primary border-l border-border-glow overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border-glow">
              <h2 className="font-orbitron text-lg text-accent-blue">Sighting Details</h2>
              <button
                onClick={closeSighting}
                className="text-text-secondary hover:text-text-primary transition-colors text-xl"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {sightingLoading ? (
                <div className="p-4 space-y-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-bg-secondary" />
                    <div className="space-y-2">
                      <div className="h-4 bg-bg-secondary rounded w-32" />
                      <div className="h-3 bg-bg-secondary rounded w-24" />
                    </div>
                  </div>
                  <div className="h-48 bg-bg-secondary rounded-lg" />
                  <div className="h-20 bg-bg-secondary rounded" />
                </div>
              ) : sighting ? (
                <div className="p-4 space-y-4">
                  {/* User info */}
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-bg-secondary border border-border-glow overflow-hidden">
                      {sighting.user.avatar ? (
                        <img
                          src={sighting.user.avatar}
                          alt={sighting.user.display_name || sighting.user.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-accent-blue font-orbitron">
                          {(sighting.user.display_name || sighting.user.username).charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-text-primary font-medium">
                        {sighting.user.display_name || sighting.user.username}
                      </p>
                      <p className="text-text-secondary text-sm">@{sighting.user.username}</p>
                    </div>
                  </div>

                  {/* Satellite info */}
                  <div className="glass-panel p-3 rounded-lg">
                    <h3 className="font-orbitron text-accent-cyan tracking-wide">
                      {sighting.satellite_name}
                    </h3>
                    <p className="text-text-secondary text-sm mt-1">
                      {formatDate(sighting.pass_timestamp)}
                    </p>
                    {(sighting.city || sighting.region) && (
                      <p className="text-text-secondary text-sm">
                        📍 {[sighting.city, sighting.region].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Star rating */}
                  {sighting.star_rating && (
                    <div className="flex items-center gap-2">
                      <span className="text-text-secondary text-sm">Rating:</span>
                      {renderStars(sighting.star_rating)}
                    </div>
                  )}

                  {/* Card image */}
                  {sighting.card_image && (
                    <div
                      onClick={() => setImageFullscreen(true)}
                      className="rounded-lg overflow-hidden border border-border-glow cursor-pointer hover:border-accent-cyan transition-colors"
                    >
                      <img
                        src={sighting.card_image}
                        alt="Sighting card"
                        className="w-full object-cover"
                      />
                    </div>
                  )}

                  {/* Notes */}
                  {sighting.notes && (
                    <div>
                      <h4 className="text-text-secondary text-xs uppercase tracking-wide mb-1">
                        Notes
                      </h4>
                      <p className="text-text-primary">{sighting.notes}</p>
                    </div>
                  )}

                  {/* Like button */}
                  <div className="flex items-center gap-4 py-2 border-y border-border-glow/30">
                    <motion.button
                      onClick={handleLike}
                      disabled={!user || isLiking}
                      whileTap={{ scale: 0.95 }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        sighting.user_liked
                          ? 'bg-accent-red/20 text-accent-red'
                          : 'bg-bg-secondary text-text-secondary hover:text-accent-red'
                      } ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <motion.span
                        animate={sighting.user_liked ? { scale: [1, 1.3, 1] } : {}}
                        transition={{ duration: 0.3 }}
                      >
                        {sighting.user_liked ? '❤️' : '🤍'}
                      </motion.span>
                      <span>{sighting.like_count} likes</span>
                    </motion.button>

                    <div className="text-text-secondary">
                      💬 {sighting.comment_count} comments
                    </div>
                  </div>

                  {/* Comments section */}
                  <div>
                    <h4 className="text-text-secondary text-xs uppercase tracking-wide mb-3">
                      Comments
                    </h4>
                    <CommentPanel
                      comments={commentsData?.comments || []}
                      isLoading={commentsLoading}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center">
                  <p className="text-text-secondary">Sighting not found</p>
                </div>
              )}
            </div>

            {/* Comment input */}
            {sighting && (
              <div className="p-4 border-t border-border-glow">
                <CommentInput sightingId={sighting.id} />
              </div>
            )}
          </motion.div>

          {/* Fullscreen image modal */}
          {imageFullscreen && sighting?.card_image && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setImageFullscreen(false)}
              className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4"
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
      )}
    </AnimatePresence>
  );
}

export default memo(SightingDetailSlideOver);
