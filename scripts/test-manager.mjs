import { pingBusinessName } from '../server/manager.ts';

try {
  const name = await pingBusinessName();
  console.log('✓ Manager.io reachable. Business:', name);
  process.exit(0);
} catch (e) {
  console.error('✗ Manager.io error:', e.message);
  console.error('Full error:', e);
  process.exit(1);
}
