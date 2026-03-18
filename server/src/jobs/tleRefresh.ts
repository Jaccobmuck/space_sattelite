import cron from 'node-cron';
import { fetchTLEData, getTLECacheAge } from '../services/tleService.js';

export function startTLERefreshJob(): void {
  console.log('🛰️  Starting TLE refresh job (every 2 hours)');

  fetchTLEData()
    .then((data) => {
      console.log(`✓ Initial TLE fetch complete: ${data.length} satellites`);
    })
    .catch((error) => {
      console.error('✗ Initial TLE fetch failed:', error);
    });

  cron.schedule('0 */2 * * *', async () => {
    console.log('🔄 Running scheduled TLE refresh...');

    try {
      const data = await fetchTLEData();
      console.log(`✓ TLE refresh complete: ${data.length} satellites`);
    } catch (error) {
      console.error('✗ TLE refresh failed:', error);
    }
  });

  cron.schedule('*/30 * * * *', () => {
    const cacheAge = getTLECacheAge();
    if (cacheAge !== null) {
      const ageMinutes = Math.round(cacheAge / 60000);
      console.log(`📊 TLE cache age: ${ageMinutes} minutes`);
    }
  });
}
