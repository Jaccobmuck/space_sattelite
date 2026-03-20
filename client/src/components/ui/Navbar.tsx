import { memo, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import type { PanelType } from '../../types';

type LocationStatus = 'idle' | 'loading' | 'success' | 'error';

const navItems: { id: PanelType; label: string; icon: string }[] = [
  { id: 'iss', label: 'ISS', icon: '🛸' },
  { id: 'moon', label: 'MOON', icon: '🌙' },
  { id: 'weather', label: 'WEATHER', icon: '☀️' },
  { id: 'passes', label: 'PASSES', icon: '📡' },
];

function Navbar() {
  const { activePanel, setActivePanel, satellites, userLocation, setUserLocation } = useAppStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [utcTime, setUtcTime] = useState(new Date().toISOString().slice(11, 19));
  const [locationStatus, setLocationStatus] = useState<LocationStatus>(
    userLocation ? 'success' : 'idle'
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setUtcTime(new Date().toISOString().slice(11, 19));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (userLocation && locationStatus === 'idle') {
      setLocationStatus('success');
    }
  }, [userLocation, locationStatus]);

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationStatus('error');
      return;
    }

    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus('success');
      },
      () => {
        setLocationStatus('error');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [setUserLocation]);

  return (
    <nav className="fixed top-0 left-0 right-0 h-14 bg-bg-secondary/90 backdrop-blur-md border-b border-border-glow z-50">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-3">
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-2xl">🛰️</span>
            <h1 className="font-orbitron text-xl font-bold text-accent-blue tracking-wider glow-text">
              SENTRY
            </h1>
          </motion.div>
        </div>

        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <motion.button
              key={item.id}
              onClick={() => setActivePanel(activePanel === item.id ? null : item.id)}
              className={`px-4 py-2 rounded font-orbitron text-sm tracking-wide transition-all ${
                activePanel === item.id
                  ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/50'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </motion.button>
          ))}
        </div>

        <div className="flex items-center gap-6">
          <motion.button
            onClick={requestLocation}
            disabled={locationStatus === 'loading'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-all ${
              locationStatus === 'success'
                ? 'bg-accent-green/20 text-accent-green border border-accent-green/50'
                : locationStatus === 'error'
                ? 'bg-accent-red/20 text-accent-red border border-accent-red/50 hover:bg-accent-red/30'
                : locationStatus === 'loading'
                ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/50 cursor-wait'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/5 border border-transparent'
            }`}
            whileHover={locationStatus !== 'loading' ? { scale: 1.02 } : {}}
            whileTap={locationStatus !== 'loading' ? { scale: 0.98 } : {}}
            title={
              locationStatus === 'success' && userLocation
                ? `${userLocation.lat.toFixed(2)}°, ${userLocation.lng.toFixed(2)}°`
                : locationStatus === 'error'
                ? 'Location access denied - click to retry'
                : 'Get your location'
            }
          >
            <span className={locationStatus === 'loading' ? 'animate-pulse' : ''}>📍</span>
            <span className="font-orbitron text-xs tracking-wide">
              {locationStatus === 'loading'
                ? 'LOCATING...'
                : locationStatus === 'success'
                ? 'LOCATED'
                : locationStatus === 'error'
                ? 'RETRY'
                : 'LOCATE ME'}
            </span>
          </motion.button>

          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-accent-green pulse-dot" />
            <span className="text-text-secondary font-mono">
              {satellites.length} SATELLITES
            </span>
          </div>

          <div className="font-orbitron text-accent-cyan tracking-widest">
            <span className="text-text-secondary text-xs mr-2">UTC</span>
            {utcTime}
          </div>

          {user ? (
            <motion.button
              onClick={() => navigate('/account')}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-sm bg-accent-blue/10 border border-accent-blue/30 text-accent-blue hover:bg-accent-blue/20 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {user.plan === 'pro' && <span>⭐</span>}
              <span className="font-orbitron text-xs tracking-wide">ACCOUNT</span>
            </motion.button>
          ) : (
            <motion.button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 border border-transparent transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="font-orbitron text-xs tracking-wide">SIGN IN</span>
            </motion.button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default memo(Navbar);
