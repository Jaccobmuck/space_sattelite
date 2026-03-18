import { memo } from 'react';
import { motion } from 'framer-motion';

function LoadingScreen() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-primary">
      <div className="text-center">
        <motion.div
          className="text-6xl mb-6"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          🛰️
        </motion.div>
        <motion.h2
          className="font-orbitron text-xl text-accent-blue tracking-widest"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          INITIALIZING SENTRY
        </motion.h2>
        <motion.div
          className="mt-4 flex justify-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-accent-blue"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}

export default memo(LoadingScreen);
