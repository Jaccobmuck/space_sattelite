import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/appStore';
import { useISS } from '../../hooks/useISS';

function ISSPanel() {
  const { activePanel, setActivePanel } = useAppStore();
  const { data, isLoading, error } = useISS();

  const isOpen = activePanel === 'iss';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute top-0 right-0 w-96 h-full glass-panel p-4 overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-orbitron text-lg text-accent-red tracking-wider flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-accent-red pulse-dot" />
              ISS TRACKER
            </h2>
            <button
              onClick={() => setActivePanel(null)}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              ✕
            </button>
          </div>

          {isLoading && (
            <div className="text-center py-8 text-text-secondary">
              <p className="font-mono text-sm">Loading ISS data...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-accent-red">
              <p className="font-mono text-sm">Error loading ISS data</p>
            </div>
          )}

          {data && (
            <div className="space-y-4">
              <div className="p-3 rounded border border-border-glow bg-bg-primary/50">
                <h3 className="font-orbitron text-xs text-text-secondary mb-2">CURRENT POSITION</h3>
                {data.position ? (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-text-secondary">LAT</span>
                      <p className="font-orbitron text-accent-cyan">{data.position.lat.toFixed(4)}°</p>
                    </div>
                    <div>
                      <span className="text-text-secondary">LNG</span>
                      <p className="font-orbitron text-accent-cyan">{data.position.lng.toFixed(4)}°</p>
                    </div>
                    <div>
                      <span className="text-text-secondary">ALT</span>
                      <p className="font-orbitron text-accent-blue">{data.position.alt.toFixed(1)} km</p>
                    </div>
                    <div>
                      <span className="text-text-secondary">VELOCITY</span>
                      <p className="font-orbitron text-accent-green">{data.position.velocity.toFixed(2)} km/s</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-text-secondary text-sm">Position unavailable</p>
                )}
              </div>

              {data.crew.length > 0 && (
                <div className="p-3 rounded border border-border-glow bg-bg-primary/50">
                  <h3 className="font-orbitron text-xs text-text-secondary mb-2">
                    CREW ({data.crew.length})
                  </h3>
                  <div className="space-y-1">
                    {data.crew.map((member, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-accent-green" />
                        <span className="text-text-primary">{member.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.passes.length > 0 && (
                <div className="p-3 rounded border border-border-glow bg-bg-primary/50">
                  <h3 className="font-orbitron text-xs text-text-secondary mb-2">UPCOMING PASSES</h3>
                  <div className="space-y-2">
                    {data.passes.slice(0, 3).map((pass, i) => (
                      <div key={i} className="text-sm border-b border-border-glow/30 pb-2 last:border-0">
                        <div className="flex justify-between">
                          <span className="text-text-secondary">
                            {new Date(pass.riseTime).toLocaleDateString()}
                          </span>
                          <span className={`font-orbitron ${
                            pass.quality === 'excellent' ? 'text-accent-green' :
                            pass.quality === 'good' ? 'text-accent-cyan' : 'text-text-secondary'
                          }`}>
                            {pass.maxElevation}°
                          </span>
                        </div>
                        <div className="text-text-primary">
                          {new Date(pass.riseTime).toLocaleTimeString()} - {Math.round(pass.duration / 60)} min
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(ISSPanel);
