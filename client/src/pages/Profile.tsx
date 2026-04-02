import { useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePublicProfile, useProfileSightings } from '../hooks/useProfile';
import { useAuthStore } from '../store/authStore';
import FeedCard from '../components/community/FeedCard';
import SightingDetailSlideOver from '../components/community/SightingDetailSlideOver';
import FeedSkeleton from '../components/community/FeedSkeleton';

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const currentUser = useAuthStore((s) => s.user);

  const { data: profileData, isLoading: profileLoading } = usePublicProfile(username || null);
  const {
    data: sightingsData,
    isLoading: sightingsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useProfileSightings(username || null);

  // Infinite scroll observer
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  const profile = profileData?.profile;
  const stats = profileData?.stats;
  const allSightings = sightingsData?.pages.flatMap((page) => page.sightings) || [];
  const isOwnProfile = currentUser?.id === profile?.id;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
    });
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <header className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-lg border-b border-border-glow">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <Link to="/community" className="text-text-secondary hover:text-text-primary transition-colors">
              ← Back to Community
            </Link>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-bg-secondary" />
              <div className="space-y-2">
                <div className="h-6 bg-bg-secondary rounded w-32" />
                <div className="h-4 bg-bg-secondary rounded w-24" />
              </div>
            </div>
            <div className="h-20 bg-bg-secondary rounded-lg" />
          </div>
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <header className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-lg border-b border-border-glow">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <Link to="/community" className="text-text-secondary hover:text-text-primary transition-colors">
              ← Back to Community
            </Link>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6 text-center">
          <div className="text-6xl mb-4">👤</div>
          <h2 className="font-orbitron text-xl text-text-primary mb-2">Profile Not Found</h2>
          <p className="text-text-secondary">This user doesn't exist or hasn't set up their profile yet.</p>
        </main>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-lg border-b border-border-glow">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Link to="/community" className="text-text-secondary hover:text-text-primary transition-colors">
            ← Back to Community
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Profile header */}
        <div className="glass-panel p-6 rounded-xl mb-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-bg-secondary border-2 border-border-glow overflow-hidden flex-shrink-0">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-accent-blue font-orbitron text-2xl">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="font-orbitron text-xl text-text-primary truncate">
                {displayName}
              </h1>
              <p className="text-text-secondary text-sm">@{profile.username}</p>
              {profile.bio && (
                <p className="text-text-primary text-sm mt-2">{profile.bio}</p>
              )}
              {(profile.location_city || profile.location_region) && (
                <p className="text-text-secondary text-xs mt-2">
                  📍 {[profile.location_city, profile.location_region].filter(Boolean).join(', ')}
                </p>
              )}
              <p className="text-text-secondary/60 text-xs mt-2">
                Member since {formatDate(profile.created_at)}
              </p>
            </div>

            {/* Edit button for own profile */}
            {isOwnProfile && (
              <Link
                to="/account"
                className="px-3 py-1.5 bg-bg-secondary border border-border-glow rounded-lg text-text-secondary text-sm hover:text-text-primary hover:border-accent-blue transition-colors"
              >
                Edit Profile
              </Link>
            )}
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border-glow/30">
              <div className="text-center">
                <p className="font-orbitron text-2xl text-accent-cyan">
                  {stats.totalSightings}
                </p>
                <p className="text-text-secondary text-xs uppercase tracking-wide">
                  Sightings
                </p>
              </div>
              <div className="text-center">
                <p className="font-orbitron text-2xl text-accent-green">
                  {stats.uniqueSatellites}
                </p>
                <p className="text-text-secondary text-xs uppercase tracking-wide">
                  Satellites
                </p>
              </div>
              <div className="text-center">
                <p className="font-orbitron text-2xl text-accent-orange">
                  {stats.currentStreak}
                </p>
                <p className="text-text-secondary text-xs uppercase tracking-wide">
                  Day Streak
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Badges placeholder */}
        {/* TODO: Add gamification badges when implemented */}

        {/* Sightings feed */}
        <div>
          <h2 className="font-orbitron text-sm text-text-secondary uppercase tracking-wide mb-4">
            Public Sightings
          </h2>

          {sightingsLoading ? (
            <FeedSkeleton />
          ) : allSightings.length === 0 ? (
            <div className="glass-panel p-6 rounded-lg text-center">
              <p className="text-text-secondary">No public sightings yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allSightings.map((sighting, index) => (
                <FeedCard key={sighting.id} sighting={sighting} index={index} />
              ))}

              {/* Load more trigger */}
              {hasNextPage && (
                <div ref={loadMoreRef} className="py-4 text-center">
                  {isFetchingNextPage ? (
                    <div className="flex items-center justify-center gap-2 text-text-secondary">
                      <div className="w-4 h-4 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
                      <span className="text-sm">Loading more...</span>
                    </div>
                  ) : (
                    <div className="h-4" />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Sighting detail slide-over */}
      <SightingDetailSlideOver />
    </div>
  );
}
