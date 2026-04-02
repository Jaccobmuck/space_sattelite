import { memo } from 'react';
import { motion } from 'framer-motion';
import type { FeedTab } from '../../types';
import { useCommunityStore } from '../../store/communitySlice';
import { useAppStore } from '../../store/appStore';

const TABS: { id: FeedTab; label: string; icon: string }[] = [
  { id: 'global', label: 'Global', icon: '🌍' },
  { id: 'near_you', label: 'Near You', icon: '📍' },
  { id: 'by_satellite', label: 'By Satellite', icon: '🛰️' },
];

function FeedTabs() {
  const activeTab = useCommunityStore((s) => s.activeTab);
  const setActiveTab = useCommunityStore((s) => s.setActiveTab);
  const userLocation = useAppStore((s) => s.userLocation);

  const handleTabClick = (tab: FeedTab) => {
    if (tab === 'near_you' && !userLocation) {
      // Request location if not available
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          () => setActiveTab(tab),
          () => alert('Location access is required for the Near You feed')
        );
      }
      return;
    }
    setActiveTab(tab);
  };

  return (
    <div className="flex gap-2 p-2 bg-bg-secondary/50 rounded-lg">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleTabClick(tab.id)}
          className={`relative flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? 'text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 bg-accent-blue/20 border border-accent-blue/50 rounded-md"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            />
          )}
          <span className="relative flex items-center justify-center gap-1.5">
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export default memo(FeedTabs);
