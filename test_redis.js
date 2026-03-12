const redis = require('redis');

async function test() {
  const client = redis.createClient({ url: 'redis://localhost:6379' });
  await client.connect();
  
  await client.set('feed:all:1:10', 'test1');
  await client.set('feed:queries:1:10', 'test2');
  
  const pattern = 'feed:*';
  if (pattern.includes('*')) {
    const keys = await client.keys(pattern);
    console.log('Keys found:', keys);
    if (keys.length > 0) {
      for (const k of keys) {
        await client.del(k);
      }
    }
  }
  
  const keysAfter = await client.keys(pattern);
  console.log('Keys after del:', keysAfter);
  await client.quit();
}

test().catch(console.error);
