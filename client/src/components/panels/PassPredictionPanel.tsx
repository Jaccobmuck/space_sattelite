import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/appStore';
import { usePasses } from '../../hooks/usePasses';

function PassPredictionPanel() {
  const { activePanel, setActivePanel, userLocation, selectSatellite } = useAppStore();
  const { data, isLoading, error } = usePasses();

  const isOpen = activePanel === 'passes';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute top-0 right-0 w-[500px] h-full glass-panel p-4 overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-orbitron text-lg text-accent-cyan tracking-wider flex items-center gap-2">
              📡 PASS PREDICTIONS
            </h2>
            <button
              onClick={() => setActivePanel(null)}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              ✕
            </button>
          </div>

          {!userLocation && (
            <div className="text-center py-8 text-text-secondary">
              <p className="font-mono text-sm">Location required</p>
              <p className="text-xs mt-2">Enable location access for pass predictions</p>
            </div>
          )}

          {userLocation && isLoading && (
            <div className="text-center py-8 text-text-secondary">
              <p className="font-mono text-sm">Calculating passes...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-accent-red">
              <p className="font-mono text-sm">Error loading passes</p>
            </div>
          )}

          {data && (
            <div className="space-y-4">
              <div className="p-2 rounded bg-bg-primary/50 text-xs text-text-secondary">
                Observer: {data.observer.lat.toFixed(2)}°, {data.observer.lng.toFixed(2)}°
              </div>

              {data.passes.length === 0 ? (
                <div className="text-center py-8 text-text-secondary">
                  <p className="font-mono text-sm">No visible passes in the next 7 days</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-6 gap-2 text-xs font-orbitron text-text-secondary px-2">
                    <span>SATELLITE</span>
                    <span>DATE</span>
                    <span>RISE</span>
                    <span>MAX EL</span>
                    <span>DUR</span>
                    <span>QUALITY</span>
                  </div>
                  {data.passes.map((pass, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const satellites = useAppStore.getState().satellites;
                        const sat = satellites.find(s => s.noradId === pass.noradId);
                        if (sat) selectSatellite(sat);
                      }}
                      className={`w-full grid grid-cols-6 gap-2 text-sm p-2 rounded border transition-colors ${
                        pass.satellite.includes('ISS')
                          ? 'border-accent-red/50 bg-accent-red/10 hover:bg-accent-red/20'
                          : 'border-border-glow hover:bg-white/5'
                      }`}
                    >
                      <span className="text-text-primary truncate text-left">
                        {pass.satellite.split(' ')[0]}
                      </span>
                      <span className="text-text-secondary">
                        {new Date(pass.riseTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="font-mono text-accent-cyan">
                        {new Date(pass.riseTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`font-orbitron ${
                        pass.maxElevation >= 60 ? 'text-accent-green' :
                        pass.maxElevation >= 30 ? 'text-accent-cyan' :
                        'text-text-secondary'
                      }`}>
                        {pass.maxElevation}°
                      </span>
                      <span className="text-text-secondary">
                        {Math.round(pass.duration / 60)}m
                      </span>
                      <span className={`font-orbitron text-xs ${
                        pass.quality === 'excellent' ? 'text-accent-green' :
                        pass.quality === 'good' ? 'text-accent-cyan' :
                        'text-text-secondary'
                      }`}>
                        {pass.quality.toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(PassPredictionPanel);
