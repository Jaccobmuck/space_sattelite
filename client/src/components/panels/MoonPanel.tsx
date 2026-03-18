import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/appStore';
import { useMoonPhase } from '../../hooks/useMoonPhase';

function MoonPhaseIcon({ phase, animate = true }: { phase: number; animate?: boolean }) {
  const size = 120;
  const radius = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  
  const [displayPhase, setDisplayPhase] = useState(0);
  
  useEffect(() => {
    if (animate) {
      const duration = 1500;
      const startTime = Date.now();
      const startPhase = displayPhase;
      
      const animatePhase = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayPhase(startPhase + (phase - startPhase) * eased);
        
        if (progress < 1) {
          requestAnimationFrame(animatePhase);
        }
      };
      
      requestAnimationFrame(animatePhase);
    } else {
      setDisplayPhase(phase);
    }
  }, [phase, animate]);

  const illuminatedSide = displayPhase < 0.5 ? 'right' : 'left';
  const phaseAngle = displayPhase < 0.5 ? displayPhase * 2 : (displayPhase - 0.5) * 2;
  const curveOffset = radius * Math.cos(phaseAngle * Math.PI);

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, type: 'spring' }}
    >
      <svg width={size} height={size} className="mx-auto drop-shadow-[0_0_15px_rgba(226,232,240,0.3)]">
        <defs>
          <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0" />
          </radialGradient>
          <filter id="moonShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.5" />
          </filter>
        </defs>
        <circle cx={cx} cy={cy} r={radius + 10} fill="url(#moonGlow)" />
        <circle 
          cx={cx} 
          cy={cy} 
          r={radius} 
          fill="#1a1a2e" 
          stroke="#38bdf8" 
          strokeWidth="1.5"
          filter="url(#moonShadow)"
        />
        <motion.path
          d={`
            M ${cx} ${cy - radius}
            A ${radius} ${radius} 0 0 ${illuminatedSide === 'right' ? 1 : 0} ${cx} ${cy + radius}
            A ${Math.abs(curveOffset) || 0.01} ${radius} 0 0 ${phaseAngle < 0.5 ? 1 : 0} ${cx} ${cy - radius}
          `}
          fill="#e2e8f0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
        <circle 
          cx={cx - radius * 0.3} 
          cy={cy - radius * 0.2} 
          r={radius * 0.15} 
          fill="#c8ccd0" 
          opacity={0.4}
        />
        <circle 
          cx={cx + radius * 0.2} 
          cy={cy + radius * 0.3} 
          r={radius * 0.1} 
          fill="#c8ccd0" 
          opacity={0.3}
        />
        <circle 
          cx={cx - radius * 0.1} 
          cy={cy + radius * 0.4} 
          r={radius * 0.08} 
          fill="#c8ccd0" 
          opacity={0.25}
        />
      </svg>
    </motion.div>
  );
}

function MoonCycleTimeline({ phase }: { phase: number }) {
  const phases = [
    { name: 'New', position: 0 },
    { name: 'Waxing Crescent', position: 0.125 },
    { name: 'First Quarter', position: 0.25 },
    { name: 'Waxing Gibbous', position: 0.375 },
    { name: 'Full', position: 0.5 },
    { name: 'Waning Gibbous', position: 0.625 },
    { name: 'Last Quarter', position: 0.75 },
    { name: 'Waning Crescent', position: 0.875 },
  ];

  return (
    <div className="relative h-8 bg-bg-primary/50 rounded-full border border-border-glow overflow-hidden">
      <div className="absolute inset-0 flex">
        {phases.map((p) => (
          <div
            key={p.name}
            className="flex-1 border-r border-border-glow/30 last:border-r-0"
            title={p.name}
          />
        ))}
      </div>
      <motion.div
        className="absolute top-1 bottom-1 w-3 bg-accent-cyan rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]"
        initial={{ left: '0%' }}
        animate={{ left: `calc(${phase * 100}% - 6px)` }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
      />
    </div>
  );
}

function MoonPanel() {
  const { activePanel, setActivePanel } = useAppStore();
  const { data, isLoading, error } = useMoonPhase();

  const isOpen = activePanel === 'moon';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="absolute top-0 right-0 w-80 h-full glass-panel p-4 overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-orbitron text-lg text-text-primary tracking-wider flex items-center gap-2">
              🌙 LUNAR DATA
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
              <p className="font-mono text-sm">Loading moon data...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-accent-red">
              <p className="font-mono text-sm">Error loading moon data</p>
            </div>
          )}

          {data && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <MoonPhaseIcon phase={data.phase} />
                <h3 className="font-orbitron text-lg text-accent-cyan mt-3">
                  {data.phaseName}
                </h3>
                <p className="text-text-secondary text-sm">
                  {data.illumination}% illuminated
                </p>
              </div>

              <div className="p-3 rounded border border-border-glow bg-bg-primary/50">
                <h3 className="font-orbitron text-xs text-text-secondary mb-2">LUNAR CYCLE</h3>
                <MoonCycleTimeline phase={data.phase} />
                <div className="flex justify-between text-xs text-text-secondary mt-2">
                  <span>New</span>
                  <span>Full</span>
                  <span>New</span>
                </div>
              </div>

              <div className="p-3 rounded border border-border-glow bg-bg-primary/50">
                <h3 className="font-orbitron text-xs text-text-secondary mb-2">MOON AGE</h3>
                <p className="font-orbitron text-xl text-accent-blue">
                  {data.age} <span className="text-sm text-text-secondary">days</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded border border-border-glow bg-bg-primary/50">
                  <h3 className="font-orbitron text-xs text-text-secondary mb-1">NEXT FULL</h3>
                  <p className="font-mono text-sm text-text-primary">
                    {new Date(data.nextFullMoon).toLocaleDateString()}
                  </p>
                </div>
                <div className="p-3 rounded border border-border-glow bg-bg-primary/50">
                  <h3 className="font-orbitron text-xs text-text-secondary mb-1">NEXT NEW</h3>
                  <p className="font-mono text-sm text-text-primary">
                    {new Date(data.nextNewMoon).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {(data.moonrise || data.moonset) && (
                <div className="p-3 rounded border border-border-glow bg-bg-primary/50">
                  <h3 className="font-orbitron text-xs text-text-secondary mb-2">TODAY</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-text-secondary">Moonrise</span>
                      <p className="font-mono text-text-primary">{data.moonrise || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-text-secondary">Moonset</span>
                      <p className="font-mono text-text-primary">{data.moonset || 'N/A'}</p>
                    </div>
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

export default memo(MoonPanel);
