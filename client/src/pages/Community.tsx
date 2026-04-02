import { useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useCommunityFeed } from '../hooks/useCommunityFeed';
import { useCommunityStore } from '../store/communitySlice';
import { useAppStore } from '../store/appStore';
import FeedCard from '../components/community/FeedCard';
import FeedTabs from '../components/community/FeedTabs';
import SatelliteFilter from '../components/community/SatelliteFilter';
import SightingDetailSlideOver from '../components/community/SightingDetailSlideOver';
import EmptyState from '../components/community/EmptyState';
import FeedSkeleton from '../components/community/FeedSkeleton';

export default function Community() {
  const activeTab = useCommunityStore((s) => s.activeTab);
  const selectedSatellite = useCommunityStore((s) => s.selectedSatelliteFilter);
  const userLocation = useAppStore((s) => s.userLocation);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useCommunityFeed({
    tab: activeTab,
    satellite: activeTab === 'by_satellite' ? selectedSatellite || undefined : undefined,
    lat: activeTab === 'near_you' ? userLocation?.lat : undefined,
    lng: activeTab === 'near_you' ? userLocation?.lng : undefined,
  });

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

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  const allSightings = data?.pages.flatMap((page) => page.sightings) || [];
  const isEmpty = !isLoading && allSightings.length === 0;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg-primary/80 backdrop-blur-lg border-b border-border-glow">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <Link to="/" className="text-text-secondary hover:text-text-primary transition-colors">
              ← Back
            </Link>
            <h1 className="font-orbitron text-xl text-accent-blue tracking-wider">
              Community
            </h1>
            <div className="w-12" /> {/* Spacer for centering */}
          </div>
          <FeedTabs />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Satellite filter for "By Satellite" tab */}
        {activeTab === 'by_satellite' && (
          <div className="mb-4">
            <SatelliteFilter />
          </div>
        )}

        {/* Location prompt for "Near You" tab */}
        {activeTab === 'near_you' && !userLocation && (
          <div className="glass-panel p-4 rounded-lg mb-4 text-center">
            <p className="text-text-secondary text-sm mb-3">
              Enable location access to see sightings near you
            </p>
            <button
              onClick={() => {
                if ('geolocation' in navigator) {
                  navigator.geolocation.getCurrentPosition(
                    () => window.location.reload(),
                    () => alert('Location access denied')
                  );
                }
              }}
              className="px-4 py-2 bg-accent-blue/20 border border-accent-blue/50 rounded-lg text-accent-blue text-sm hover:bg-accent-blue/30 transition-colors"
            >
              Enable Location
            </button>
          </div>
        )}

        {/* Feed */}
        {isLoading ? (
          <FeedSkeleton />
        ) : isEmpty ? (
          <EmptyState
            type={
              activeTab === 'near_you'
                ? 'no_nearby'
                : activeTab === 'by_satellite'
                ? 'no_satellite'
                : 'no_sightings'
            }
            satelliteName={selectedSatellite || undefined}
          />
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

            {/* End of feed */}
            {!hasNextPage && allSightings.length > 0 && (
              <div className="py-6 text-center">
                <p className="text-text-secondary/60 text-sm">
                  You've reached the end of the feed
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Sighting detail slide-over */}
      <SightingDetailSlideOver />
    </div>
  );
}
