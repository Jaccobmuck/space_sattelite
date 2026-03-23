import { memo } from 'react';
import { useCommunityStore } from '../../store/communitySlice';
import { useSatellitesList } from '../../hooks/useCommunityFeed';

function SatelliteFilter() {
  const selectedSatellite = useCommunityStore((s) => s.selectedSatelliteFilter);
  const setSatelliteFilter = useCommunityStore((s) => s.setSatelliteFilter);
  const { data } = useSatellitesList();

  const satellites = data || [];

  return (
    <div className="relative">
      <select
        value={selectedSatellite || ''}
        onChange={(e) => setSatelliteFilter(e.target.value || null)}
        className="w-full px-3 py-2 bg-bg-secondary border border-border-glow rounded-lg text-text-primary text-sm appearance-none cursor-pointer focus:outline-none focus:border-accent-blue"
      >
        <option value="">All Satellites</option>
        {satellites.map((sat) => (
          <option key={sat} value={sat}>
            {sat}
          </option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
        ▼
      </div>
    </div>
  );
}

export default memo(SatelliteFilter);
