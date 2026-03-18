import { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/appStore';
import { useImagery, useHasImagery } from '../../hooks/useImagery';
import { getOrbitalElements, getTLEEpochAge } from '../../utils/orbital';
import type { ImageryItem } from '../../types';

function SatellitePanel() {
  const { selectedSatellite, activePanel, selectSatellite, setActivePanel, pinSatellite, unpinSatellite, pinnedSatellites } = useAppStore();
  const [showImagery, setShowImagery] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageryItem | null>(null);

  const { hasImagery } = useHasImagery(
    selectedSatellite?.noradId ?? null,
    selectedSatellite?.name ?? null
  );

  const { data: imageryData, isLoading: imageryLoading } = useImagery(
    showImagery ? selectedSatellite?.noradId ?? null : null,
    showImagery ? selectedSatellite?.name ?? null : null
  );

  // Redirect to ISS panel if ISS is selected
  useEffect(() => {
    if (selectedSatellite?.noradId === 25544) {
      setActivePanel('iss');
    }
  }, [selectedSatellite, setActivePanel]);

  // Get orbital elements for eccentricity
  const orbitalElements = selectedSatellite?.tle1 && selectedSatellite?.tle2
    ? getOrbitalElements(selectedSatellite.tle1, selectedSatellite.tle2)
    : null;

  // Get TLE epoch age
  const tleEpochAge = selectedSatellite?.tle1
    ? getTLEEpochAge(selectedSatellite.tle1)
    : 0;

  const isOpen = activePanel === 'satellite' && selectedSatellite !== null && selectedSatellite.noradId !== 25544;

  return (
    <AnimatePresence>
      {isOpen && selectedSatellite && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute top-0 right-0 w-96 h-full glass-panel p-4 overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-orbitron text-lg text-accent-blue tracking-wider">
              {selectedSatellite.name}
            </h2>
            <button
              onClick={() => selectSatellite(null)}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <DataRow label="NORAD ID" value={selectedSatellite.noradId.toString()} />
            <DataRow label="ALTITUDE" value={`${selectedSatellite.alt.toFixed(1)} km`} />
            <DataRow label="VELOCITY" value={`${selectedSatellite.velocity.toFixed(2)} km/s`} />
            <DataRow label="PERIOD" value={`${selectedSatellite.period.toFixed(1)} min`} />
            <DataRow label="INCLINATION" value={`${selectedSatellite.inclination.toFixed(1)}°`} />
            {orbitalElements && (
              <DataRow label="ECCENTRICITY" value={orbitalElements.eccentricity.toFixed(6)} />
            )}
            <DataRow label="OWNER" value={selectedSatellite.owner} />
            <DataRow label="LATITUDE" value={`${selectedSatellite.lat.toFixed(4)}°`} />
            <DataRow label="LONGITUDE" value={`${selectedSatellite.lng.toFixed(4)}°`} />
            <div className="flex justify-between items-center py-1 border-b border-border-glow/30">
              <span className="text-text-secondary text-xs">TLE EPOCH AGE</span>
              <span className={`font-orbitron text-sm ${tleEpochAge > 7 ? 'text-accent-red' : 'text-text-primary'}`}>
                {tleEpochAge.toFixed(1)} days
                {tleEpochAge > 7 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-accent-red/20 text-accent-red text-xs rounded">
                    STALE
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            {(() => {
              const isPinned = pinnedSatellites.some(p => p.satellite.noradId === selectedSatellite.noradId);
              const pinnedData = pinnedSatellites.find(p => p.satellite.noradId === selectedSatellite.noradId);
              return (
                <button
                  onClick={() => isPinned ? unpinSatellite(selectedSatellite.noradId) : pinSatellite(selectedSatellite)}
                  className={`flex-1 px-3 py-2 rounded font-orbitron text-xs transition-colors ${
                    isPinned
                      ? 'bg-accent-red/20 border border-accent-red/50 text-accent-red hover:bg-accent-red/30'
                      : 'bg-accent-purple/20 border border-accent-purple/50 text-accent-purple hover:bg-accent-purple/30'
                  }`}
                  style={isPinned && pinnedData ? { borderColor: pinnedData.color, color: pinnedData.color } : {}}
                >
                  {isPinned ? '📌 UNPIN' : '📌 PIN'}
                </button>
              );
            })()}
            <button className="flex-1 px-3 py-2 bg-accent-green/20 border border-accent-green/50 rounded font-orbitron text-xs text-accent-green hover:bg-accent-green/30 transition-colors">
              PASSES
            </button>
          </div>

          {hasImagery && (
            <div className="mt-4">
              <button
                onClick={() => setShowImagery(!showImagery)}
                className="w-full px-3 py-2 bg-accent-cyan/20 border border-accent-cyan/50 rounded font-orbitron text-xs text-accent-cyan hover:bg-accent-cyan/30 transition-colors flex items-center justify-center gap-2"
              >
                📷 {showImagery ? 'HIDE IMAGERY' : 'VIEW IMAGERY'}
              </button>
            </div>
          )}

          <AnimatePresence>
            {showImagery && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-4 overflow-hidden"
              >
                {imageryLoading && (
                  <div className="text-center py-4">
                    <p className="text-text-secondary text-sm">Loading imagery...</p>
                  </div>
                )}

                {imageryData && imageryData.images.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-orbitron text-xs text-text-secondary">
                        SATELLITE IMAGERY
                      </h3>
                      <span className="text-xs text-accent-cyan">{imageryData.source}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {imageryData.images.map((image) => (
                        <motion.button
                          key={image.id}
                          onClick={() => setSelectedImage(image)}
                          className="relative aspect-video rounded overflow-hidden border border-border-glow hover:border-accent-cyan transition-colors group"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <img
                            src={image.thumbnailUrl}
                            alt={image.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = image.url;
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                            <span className="text-xs text-white truncate">{image.title}</span>
                          </div>
                          <div className="absolute top-1 right-1">
                            <span className={`text-xs px-1 rounded ${
                              image.type === 'weather' 
                                ? 'bg-accent-blue/80 text-white' 
                                : 'bg-accent-green/80 text-white'
                            }`}>
                              {image.type === 'weather' ? '🌤️' : '🌍'}
                            </span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {imageryData && imageryData.images.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-text-secondary text-sm">No imagery available</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedImage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                onClick={() => setSelectedImage(null)}
              >
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.9 }}
                  className="max-w-4xl max-h-[90vh] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-orbitron text-lg text-accent-cyan">
                        {selectedImage.title}
                      </h3>
                      <p className="text-text-secondary text-sm">
                        {new Date(selectedImage.date).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedImage(null)}
                      className="text-text-secondary hover:text-text-primary text-2xl"
                    >
                      ✕
                    </button>
                  </div>
                  <img
                    src={selectedImage.url}
                    alt={selectedImage.title}
                    className="max-w-full max-h-[70vh] object-contain rounded border border-border-glow"
                  />
                  {selectedImage.description && (
                    <p className="mt-2 text-text-secondary text-sm">
                      {selectedImage.description}
                    </p>
                  )}
                  <a
                    href={selectedImage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-accent-blue hover:text-accent-cyan text-sm"
                  >
                    Open full resolution ↗
                  </a>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-border-glow/30">
      <span className="text-text-secondary text-xs">{label}</span>
      <span className="font-orbitron text-sm text-text-primary">{value}</span>
    </div>
  );
}

export default memo(SatellitePanel);
