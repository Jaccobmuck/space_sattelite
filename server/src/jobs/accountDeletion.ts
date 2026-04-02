import cron from 'node-cron';
import { processPendingAccountDeletions } from '../services/accountDeletionService.js';
import { logger } from '../lib/logger.js';

export function startAccountDeletionJob(): void {
  logger.info('Starting account deletion job', {
    schedule: '*/5 * * * *',
  });

  void processPendingAccountDeletions().catch((error) => {
    logger.error('Initial account deletion sweep failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  cron.schedule('*/5 * * * *', async () => {
    await processPendingAccountDeletions();
  });
}
