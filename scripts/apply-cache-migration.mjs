import { requireDb } from '../server/_core/db.ts';

const db = await requireDb();
const sql = `CREATE TABLE \`portfolioCache\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`billed\` decimal(14,2) NOT NULL DEFAULT '0',
  \`paid\` decimal(14,2) NOT NULL DEFAULT '0',
  \`outstanding\` decimal(14,2) NOT NULL DEFAULT '0',
  \`thisMonth\` decimal(14,2) NOT NULL DEFAULT '0',
  \`cachedAt\` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT \`portfolioCache_id\` PRIMARY KEY(\`id\`)
)`;

try {
  await db.execute(sql);
  console.log('✓ portfolioCache table created');
  process.exit(0);
} catch (e) {
  if (e.message.includes('already exists')) {
    console.log('✓ portfolioCache table already exists');
    process.exit(0);
  }
  console.error('✗ Error:', e.message);
  process.exit(1);
}
