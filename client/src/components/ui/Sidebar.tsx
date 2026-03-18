import { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, ConstellationFilter } from '../../store/appStore';
import type { SatelliteCategory, Satellite } from '../../types';

const CONSTELLATION_FILTERS: { id: ConstellationFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '🌐' },
  { id: 'stations', label: 'Stations', icon: '🛸' },
  { id: 'starlink', label: 'Starlink', icon: '📡' },
  { id: 'gps', label: 'GPS', icon: '📍' },
  { id: 'weather', label: 'Weather', icon: '🌤️' },
  { id: 'amateur', label: 'Amateur', icon: '📻' },
  { id: 'debris', label: 'Debris', icon: '💫' },
];

const IMAGERY_SATELLITE_IDS = new Set([
  41866, 43226, 51850, // GOES 16, 17, 18
  25544, // ISS
  27424, // Aqua
  25994, // Terra
  39084, // Landsat 8
  49260, // Landsat 9
]);

const IMAGERY_NAME_PATTERNS = ['goes', 'noaa', 'metop', 'aqua', 'terra', 'landsat'];

function hasImagerySupport(sat: Satellite): boolean {
  if (IMAGERY_SATELLITE_IDS.has(sat.noradId)) return true;
  const name = sat.name.toLowerCase();
  return IMAGERY_NAME_PATTERNS.some(pattern => name.includes(pattern));
}

const CATEGORY_FILTERS: { id: SatelliteCategory; label: string; color: string }[] = [
  { id: 'weather', label: 'Weather', color: 'bg-accent-blue' },
  { id: 'comm', label: 'Comm', color: 'bg-accent-orange' },
  { id: 'nav', label: 'Nav/GPS', color: 'bg-accent-green' },
  { id: 'science', label: 'Science', color: 'bg-accent-cyan' },
  { id: 'iss', label: 'ISS', color: 'bg-accent-red' },
  { id: 'debris', label: 'Debris', color: 'bg-text-secondary' },
];

function Sidebar() {
  const { 
    sidebarCollapsed, 
    toggleSidebar, 
    satellites, 
    selectedSatellite,
    constellationFilter,
    setConstellationFilter,
    setSearchHighlight,
    selectSatellite,
  } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<SatelliteCategory>>(new Set());
  const [showImageryOnly, setShowImageryOnly] = useState(false);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    // If searching by NORAD ID, highlight the satellite
    const noradId = parseInt(query, 10);
    if (!isNaN(noradId) && query.length >= 4) {
      const sat = satellites.find(s => s.noradId === noradId);
      if (sat) {
        setSearchHighlight(noradId);
        return;
      }
    }
    
    // Clear highlight if not a valid NORAD ID search
    setSearchHighlight(null);
  }, [satellites, setSearchHighlight]);

  const handleSatelliteClick = useCallback((sat: Satellite) => {
    selectSatellite(sat);
    setSearchHighlight(sat.noradId);
  }, [selectSatellite, setSearchHighlight]);

  const toggleFilter = (category: SatelliteCategory) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const filteredSatellites = satellites.filter((sat) => {
    const matchesSearch = sat.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilters.size === 0 || activeFilters.has(sat.category);
    const matchesImagery = !showImageryOnly || hasImagerySupport(sat);
    return matchesSearch && matchesFilter && matchesImagery;
  });

  const imageryCount = satellites.filter(hasImagerySupport).length;

  const stats = {
    total: satellites.length,
    weather: satellites.filter((s) => s.category === 'weather').length,
    comm: satellites.filter((s) => s.category === 'comm').length,
    nav: satellites.filter((s) => s.category === 'nav').length,
    science: satellites.filter((s) => s.category === 'science').length,
  };

  return (
    <motion.aside
      className="h-full bg-bg-secondary/80 backdrop-blur-md border-r border-border-glow flex flex-col"
      animate={{ width: sidebarCollapsed ? 60 : 240 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <button
        onClick={toggleSidebar}
        className="p-3 text-text-secondary hover:text-text-primary transition-colors border-b border-border-glow"
      >
        {sidebarCollapsed ? '→' : '←'}
      </button>

      <AnimatePresence>
        {!sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="p-3 border-b border-border-glow">
              <h3 className="font-orbitron text-xs text-text-secondary mb-2 tracking-wider">
                STATISTICS
              </h3>
              <div className="space-y-1 text-sm">
                <StatRow label="Total" value={stats.total} color="text-text-primary" />
                <StatRow label="Weather" value={stats.weather} color="text-accent-blue" />
                <StatRow label="Comm" value={stats.comm} color="text-accent-orange" />
                <StatRow label="Nav/GPS" value={stats.nav} color="text-accent-green" />
                <StatRow label="Science" value={stats.science} color="text-accent-cyan" />
                <StatRow label="Has Imagery" value={imageryCount} color="text-accent-purple" />
              </div>
            </div>

            <div className="p-3 border-b border-border-glow">
              <input
                type="text"
                placeholder="Search by name or NORAD ID..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full px-3 py-2 bg-bg-primary border border-border-glow rounded text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-blue"
              />
            </div>

            <div className="p-3 border-b border-border-glow">
              <h3 className="font-orbitron text-xs text-text-secondary mb-2 tracking-wider">
                CONSTELLATIONS
              </h3>
              <div className="flex flex-wrap gap-1">
                {CONSTELLATION_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setConstellationFilter(filter.id)}
                    className={`px-2 py-1 rounded text-xs transition-all flex items-center gap-1 ${
                      constellationFilter === filter.id
                        ? 'bg-accent-cyan text-white'
                        : 'bg-bg-primary text-text-secondary hover:text-text-primary border border-border-glow'
                    }`}
                  >
                    <span>{filter.icon}</span>
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 border-b border-border-glow">
              <h3 className="font-orbitron text-xs text-text-secondary mb-2 tracking-wider">
                FILTER BY TYPE
              </h3>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setShowImageryOnly(!showImageryOnly)}
                  className={`px-2 py-1 rounded text-xs transition-all flex items-center gap-1 ${
                    showImageryOnly
                      ? 'bg-accent-purple text-white'
                      : 'bg-bg-primary text-text-secondary hover:text-text-primary border border-border-glow'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-purple" />
                  📷 Imagery
                </button>
                {CATEGORY_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => toggleFilter(filter.id)}
                    className={`px-2 py-1 rounded text-xs transition-all flex items-center gap-1 ${
                      activeFilters.has(filter.id)
                        ? `${filter.color} text-white`
                        : 'bg-bg-primary text-text-secondary hover:text-text-primary border border-border-glow'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${filter.color}`} />
                    {filter.label}
                  </button>
                ))}
              </div>
              {(activeFilters.size > 0 || showImageryOnly) && (
                <button
                  onClick={() => {
                    setActiveFilters(new Set());
                    setShowImageryOnly(false);
                  }}
                  className="mt-2 text-xs text-accent-blue hover:text-accent-cyan transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {(searchQuery || activeFilters.size > 0 || showImageryOnly) ? (
                <div className="space-y-1">
                  {filteredSatellites.length === 0 ? (
                    <p className="text-xs text-text-secondary text-center py-4">
                      No satellites found
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-text-secondary mb-2">
                        {filteredSatellites.length} satellite{filteredSatellites.length !== 1 ? 's' : ''} found
                      </p>
                      {filteredSatellites.slice(0, 30).map((sat) => (
                        <SatelliteListItem
                          key={sat.noradId}
                          name={sat.name}
                          category={sat.category}
                          isSelected={selectedSatellite?.noradId === sat.noradId}
                          onClick={() => handleSatelliteClick(sat)}
                        />
                      ))}
                      {filteredSatellites.length > 30 && (
                        <p className="text-xs text-text-secondary text-center py-2">
                          +{filteredSatellites.length - 30} more
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xs text-text-secondary text-center py-4">
                  Search or filter to view satellites
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-secondary">{label}</span>
      <span className={`font-orbitron ${color}`}>{value}</span>
    </div>
  );
}

function SatelliteListItem({
  name,
  category,
  isSelected,
  onClick,
}: {
  name: string;
  category: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const categoryColors: Record<string, string> = {
    weather: 'bg-accent-blue',
    comm: 'bg-accent-orange',
    nav: 'bg-accent-green',
    iss: 'bg-accent-red',
    science: 'bg-accent-cyan',
    debris: 'bg-text-secondary',
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center gap-2 ${
        isSelected
          ? 'bg-accent-blue/20 text-accent-blue'
          : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${categoryColors[category] || 'bg-text-secondary'}`} />
      <span className="truncate">{name}</span>
    </button>
  );
}

export default memo(Sidebar);
