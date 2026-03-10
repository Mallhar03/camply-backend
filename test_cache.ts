import 'dotenv/config';
import { getCached, setCache, invalidateCache, redisClient, connectRedis } from './src/config/redis.js';

async function run() {
  try {
    await connectRedis();
    console.log('Connected to:', process.env.REDIS_URL);
    
    await setCache('feed:test', { test: true });
    console.log('Keys command testing...');
    try {
      const keys = await redisClient.keys('feed:*');
      console.log('Keys:', keys);
    } catch (e) {
      console.error('Keys failed:', e.message);
    }
  } catch (err) {
    console.error('Fatal:', err.message);
  } finally {
    await redisClient.quit();
  }
}

run().catch(console.error);
