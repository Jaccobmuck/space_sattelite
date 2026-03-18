import { memo, useEffect, useRef } from 'react';
import { useAppStore, TimeSpeed } from '../../store/appStore';

const SPEED_OPTIONS: { value: TimeSpeed; label: string }[] = [
  { value: 0, label: 'Pause' },
  { value: 1, label: '1×' },
  { value: 10, label: '10×' },
  { value: 60, label: '60×' },
  { value: 600, label: '600×' },
];

function TimeControls() {
  const {
    simulatedTime,
    timeMultiplier,
    setTimeMultiplier,
    advanceSimulatedTime,
    resetSimulatedTime,
  } = useAppStore();

  const lastTimeRef = useRef(Date.now());
  const animationFrameRef = useRef<number | null>(null);

  // Advance simulated time using requestAnimationFrame
  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (timeMultiplier > 0) {
        advanceSimulatedTime(delta);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [timeMultiplier, advanceSimulatedTime]);

  const formatTime = (date: Date) => {
    return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  };

  const isAccelerated = timeMultiplier > 1;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-bg-panel backdrop-blur-md border border-border-glow rounded-full px-4 py-2 flex items-center gap-3 shadow-glow-blue">
        {/* Speed buttons */}
        <div className="flex items-center gap-1">
          {SPEED_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setTimeMultiplier(option.value)}
              className={`px-3 py-1 rounded-full text-xs font-mono transition-all ${
                timeMultiplier === option.value
                  ? 'bg-accent-blue text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/10'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-border-glow" />

        {/* Time display - only show when accelerated */}
        {isAccelerated && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-accent-cyan font-mono">
              {formatTime(simulatedTime)}
            </span>
            <button
              onClick={resetSimulatedTime}
              className="px-2 py-1 rounded text-xs text-accent-orange hover:text-white hover:bg-accent-orange/20 transition-all"
              title="Reset to real time"
            >
              Reset
            </button>
          </div>
        )}

        {/* Real time indicator when at 1x */}
        {timeMultiplier === 1 && (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
            <span className="text-xs text-text-secondary">Live</span>
          </div>
        )}

        {/* Paused indicator */}
        {timeMultiplier === 0 && (
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent-orange" />
            <span className="text-xs text-text-secondary">Paused</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(TimeControls);
