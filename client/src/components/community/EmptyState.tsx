import { memo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  type: 'no_sightings' | 'no_nearby' | 'no_satellite';
  satelliteName?: string;
}

function EmptyState({ type, satelliteName }: EmptyStateProps) {
  const content = {
    no_sightings: {
      icon: '🛰️',
      title: 'No sightings yet',
      description: 'Be the first to share a satellite observation with the community!',
      cta: 'Log a Sighting',
      ctaLink: '/tonight',
    },
    no_nearby: {
      icon: '📍',
      title: 'No sightings nearby',
      description: 'No one has logged a sighting within 150km of your location yet.',
      cta: 'View Global Feed',
      ctaLink: null,
    },
    no_satellite: {
      icon: '🔭',
      title: `No sightings of ${satelliteName || 'this satellite'}`,
      description: 'Be the first to spot and log this satellite!',
      cta: 'Log a Sighting',
      ctaLink: '/tonight',
    },
  };

  const { icon, title, description, cta, ctaLink } = content[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="font-orbitron text-lg text-text-primary mb-2">{title}</h3>
      <p className="text-text-secondary text-sm max-w-xs mb-6">{description}</p>
      {ctaLink ? (
        <Link
          to={ctaLink}
          className="px-6 py-2 bg-accent-blue/20 border border-accent-blue/50 rounded-lg text-accent-blue font-medium hover:bg-accent-blue/30 transition-colors"
        >
          {cta}
        </Link>
      ) : (
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-accent-blue/20 border border-accent-blue/50 rounded-lg text-accent-blue font-medium hover:bg-accent-blue/30 transition-colors"
        >
          {cta}
        </button>
      )}
    </motion.div>
  );
}

export default memo(EmptyState);
