import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL missing'); process.exit(1); }

const files = [
  '/tmp/batch_tools_00.sql',
  '/tmp/batch_tx_00.sql',
  '/tmp/batch_tx_01.sql',
  '/tmp/batch_tx_02.sql',
].filter(f => fs.existsSync(f));

console.log('Connecting to DB...');
const conn = await mysql.createConnection({
  uri: url,
  multipleStatements: true,
  charset: 'utf8mb4',
});

for (const f of files) {
  const sql = fs.readFileSync(f, 'utf8');
  console.log(`\n>>> Running ${path.basename(f)}  (${sql.length} chars)`);
  try {
    const [res] = await conn.query(sql);
    console.log('   OK', Array.isArray(res) ? `rows: ${res.affectedRows ?? res.length ?? '?'}` : '');
  } catch (e) {
    console.error('   FAILED', e.message);
    process.exitCode = 1;
    break;
  }
}

await conn.end();
console.log('\nDone.');
