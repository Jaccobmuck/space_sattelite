import { memo } from 'react';
import { motion } from 'framer-motion';

interface StarRatingProps {
  value: number;
  onChange: (rating: number) => void;
  readonly?: boolean;
}

function StarRating({ value, onChange, readonly = false }: StarRatingProps) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button
          key={star}
          type="button"
          onClick={() => !readonly && onChange(star)}
          disabled={readonly}
          whileHover={!readonly ? { scale: 1.2 } : {}}
          whileTap={!readonly ? { scale: 0.9 } : {}}
          className={`text-2xl transition-colors ${
            readonly ? 'cursor-default' : 'cursor-pointer'
          } ${star <= value ? 'text-accent-orange' : 'text-text-secondary/30 hover:text-accent-orange/50'}`}
        >
          ★
        </motion.button>
      ))}
    </div>
  );
}

export default memo(StarRating);
