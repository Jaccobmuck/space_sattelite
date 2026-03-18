import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/appStore';

function PinnedSatellitesStrip() {
  const { pinnedSatellites, unpinSatellite, selectSatellite } = useAppStore();

  if (pinnedSatellites.length === 0) return null;

  return (
    <div className="fixed left-64 top-20 z-40">
      <AnimatePresence>
        {pinnedSatellites.map((pinned, index) => (
          <motion.div
            key={pinned.satellite.noradId}
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            transition={{ delay: index * 0.1 }}
            className="mb-2 bg-bg-panel backdrop-blur-md border rounded-lg p-2 w-48"
            style={{ borderColor: pinned.color }}
          >
            <div className="flex items-center justify-between mb-1">
              <button
                onClick={() => selectSatellite(pinned.satellite)}
                className="font-orbitron text-xs truncate flex-1 text-left hover:opacity-80"
                style={{ color: pinned.color }}
              >
                {pinned.satellite.name}
              </button>
              <button
                onClick={() => unpinSatellite(pinned.satellite.noradId)}
                className="text-text-secondary hover:text-text-primary ml-2 text-xs"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-secondary">ALT</span>
                <span className="font-mono" style={{ color: pinned.color }}>
                  {pinned.satellite.alt.toFixed(0)}km
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">VEL</span>
                <span className="font-mono" style={{ color: pinned.color }}>
                  {pinned.satellite.velocity.toFixed(1)}km/s
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">LAT</span>
                <span className="font-mono text-text-primary">
                  {pinned.satellite.lat.toFixed(1)}°
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">LNG</span>
                <span className="font-mono text-text-primary">
                  {pinned.satellite.lng.toFixed(1)}°
                </span>
              </div>
            </div>
            <div className="mt-1 flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: pinned.color }}
              />
              <span className="text-text-secondary text-xs">
                {pinned.satellite.category.toUpperCase()}
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default memo(PinnedSatellitesStrip);
