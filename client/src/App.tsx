import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy, useEffect } from 'react';
import Navbar from './components/ui/Navbar';
import Sidebar from './components/ui/Sidebar';
import LoadingScreen from './components/ui/LoadingScreen';
import TimeControls from './components/ui/TimeControls';
import PinnedSatellitesStrip from './components/ui/PinnedSatellitesStrip';
import { useSatellites } from './hooks/useSatellites';
import { useAppStore } from './store/appStore';

const Globe = lazy(() => import('./components/Globe/Globe'));
const SatellitePanel = lazy(() => import('./components/panels/SatellitePanel'));
const ISSPanel = lazy(() => import('./components/panels/ISSPanel'));
const MoonPanel = lazy(() => import('./components/panels/MoonPanel'));
const WeatherPanel = lazy(() => import('./components/panels/WeatherPanel'));
const PassPredictionPanel = lazy(() => import('./components/panels/PassPredictionPanel'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function SatelliteDataLoader() {
  useSatellites();
  return null;
}

function GeolocationLoader() {
  const setUserLocation = useAppStore((state) => state.setUserLocation);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('Geolocation error:', error.message);
        }
      );
    }
  }, [setUserLocation]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SatelliteDataLoader />
      <GeolocationLoader />
      <div className="relative w-full h-full bg-bg-primary overflow-hidden">
        <Navbar />
        <div className="flex h-[calc(100%-56px)] mt-14">
          <Sidebar />
          <main className="flex-1 relative">
            <Suspense fallback={<LoadingScreen />}>
              <Globe />
            </Suspense>
            <Suspense fallback={null}>
              <SatellitePanel />
              <ISSPanel />
              <MoonPanel />
              <WeatherPanel />
              <PassPredictionPanel />
            </Suspense>
            <TimeControls />
            <PinnedSatellitesStrip />
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default App;
