import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/appStore';
import { useSpaceWeather, UpgradeRequiredError } from '../../hooks/useSpaceWeather';
import UpgradeModal from '../ui/UpgradeModal';

const LEVEL_COLORS: Record<string, string> = {
  quiet: 'text-accent-green',
  minor: 'text-accent-cyan',
  moderate: 'text-accent-orange',
  strong: 'text-accent-orange',
  severe: 'text-accent-red',
  extreme: 'text-accent-red',
};

function WeatherPanel() {
  const { activePanel, setActivePanel } = useAppStore();
  const { data, isLoading, error } = useSpaceWeather();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const isUpgradeRequired = error instanceof UpgradeRequiredError;
  const isOpen = activePanel === 'weather';

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
            <h2 className="font-orbitron text-lg text-accent-orange tracking-wider flex items-center gap-2">
              ☀️ SPACE WEATHER
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
              <p className="font-mono text-sm">Loading space weather data...</p>
            </div>
          )}

          {error && isUpgradeRequired && (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🔒</div>
              <p className="font-orbitron text-sm text-text-secondary mb-3">PRO FEATURE</p>
              <p className="text-text-secondary text-sm mb-4">Space weather data requires a Pro subscription.</p>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600/30 to-accent-blue/30 border border-purple-500/50 text-purple-300 font-orbitron text-xs tracking-wide rounded hover:from-purple-600/40 hover:to-accent-blue/40 transition-all"
              >
                UPGRADE TO PRO
              </button>
              <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} featureName="Space Weather" />
            </div>
          )}

          {error && !isUpgradeRequired && (
            <div className="text-center py-8 text-accent-red">
              <p className="font-mono text-sm">Error loading weather data</p>
            </div>
          )}

          {data && (
            <div className="space-y-4">
              {data.alerts.length > 0 && (
                <div className="space-y-2">
                  {data.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 rounded border ${
                        alert.severity === 'alert' ? 'border-accent-red bg-accent-red/10' :
                        alert.severity === 'warning' ? 'border-accent-orange bg-accent-orange/10' :
                        'border-accent-cyan bg-accent-cyan/10'
                      }`}
                    >
                      <p className="font-mono text-sm">{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 rounded border border-border-glow bg-bg-primary/50">
                <h3 className="font-orbitron text-xs text-text-secondary mb-2">SOLAR ACTIVITY</h3>
                <div className="flex items-center justify-between">
                  <span className={`font-orbitron text-xl uppercase ${LEVEL_COLORS[data.solarActivity.level]}`}>
                    {data.solarActivity.level}
                  </span>
                  {data.solarActivity.flareClass && (
                    <span className="font-mono text-sm text-text-secondary">
                      {data.solarActivity.flareClass}-class
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded border border-border-glow bg-bg-primary/50">
                <h3 className="font-orbitron text-xs text-text-secondary mb-2">GEOMAGNETIC ACTIVITY</h3>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-text-secondary">Kp Index</span>
                  <span className={`font-orbitron text-2xl ${
                    data.geomagneticActivity.kpIndex >= 5 ? 'text-accent-red' :
                    data.geomagneticActivity.kpIndex >= 4 ? 'text-accent-orange' :
                    'text-accent-green'
                  }`}>
                    {data.geomagneticActivity.kpIndex}
                  </span>
                </div>
                {data.geomagneticActivity.stormLevel && (
                  <div className="text-sm text-accent-orange">
                    Storm Level: {data.geomagneticActivity.stormLevel}
                  </div>
                )}
                <div className="mt-2 flex gap-1">
                  {[...Array(9)].map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-2 rounded ${
                        i < data.geomagneticActivity.kpIndex
                          ? i >= 7 ? 'bg-accent-red' : i >= 4 ? 'bg-accent-orange' : 'bg-accent-green'
                          : 'bg-bg-secondary'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="p-3 rounded border border-border-glow bg-bg-primary/50">
                <h3 className="font-orbitron text-xs text-text-secondary mb-2">AURORA VISIBILITY</h3>
                <span className={`font-orbitron text-lg uppercase ${
                  data.aurora.visibility === 'high' ? 'text-accent-green' :
                  data.aurora.visibility === 'moderate' ? 'text-accent-cyan' :
                  data.aurora.visibility === 'low' ? 'text-accent-orange' :
                  'text-text-secondary'
                }`}>
                  {data.aurora.visibility}
                </span>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(WeatherPanel);
