import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const outputDir = process.argv[2];
if (!outputDir) throw new Error("Usage: node export_crm_migration.mjs <output-dir>");
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const url = new URL(dbUrl);
const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
if (!database) throw new Error("DATABASE_URL does not include a database name");
let tls = { rejectUnauthorized: true };
const sslParam = url.searchParams.get("ssl");
if (sslParam) {
  try { tls = { ...tls, ...JSON.parse(sslParam) }; } catch { /* keep secure defaults */ }
}

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(path.join(outputDir, "tables"), { recursive: true });

const connection = await mysql.createConnection({
  host: url.hostname,
  port: url.port ? Number(url.port) : 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database,
  ssl: tls,
  decimalNumbers: false,
  dateStrings: false,
});

const [tableRows] = await connection.query("SHOW TABLES");
const tableKey = `Tables_in_${database}`;
const tables = tableRows.map((row) => row[tableKey] ?? Object.values(row)[0]).sort();
const manifest = {
  exportedAt: new Date().toISOString(),
  databaseName: database,
  tables: [],
};

function jsonReplacer(_key, value) {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return { type: "Buffer", base64: value.toString("base64") };
  return value;
}

for (const table of tables) {
  const safe = table.replace(/[^a-zA-Z0-9_-]/g, "_");
  const [columns] = await connection.query(`SHOW COLUMNS FROM \`${table.replaceAll("`", "``")}\``);
  const [rows] = await connection.query(`SELECT * FROM \`${table.replaceAll("`", "``")}\``);
  await fs.writeFile(
    path.join(outputDir, "tables", `${safe}.json`),
    JSON.stringify({ table, columns, rows }, jsonReplacer, 2) + "\n",
    "utf8",
  );
  manifest.tables.push({ table, rowCount: rows.length, jsonFile: `tables/${safe}.json` });
}
await connection.end();
await fs.writeFile(path.join(outputDir, "EXPORT_MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

const dumpPath = path.join(outputDir, "database-full.sql");
const args = [
  "--quick",
  "--skip-lock-tables",
  "--hex-blob",
  "--set-gtid-purged=OFF",
  "--column-statistics=0",
  "--default-character-set=utf8mb4",
  "--ssl-mode=REQUIRED",
  "--host", url.hostname,
  "--port", url.port || "3306",
  "--user", decodeURIComponent(url.username),
  database,
];
await new Promise((resolve, reject) => {
  const child = spawn("mysqldump", args, {
    env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const out = createWriteStream(dumpPath, { mode: 0o600 });
  let stderr = "";
  child.stdout.pipe(out);
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  child.on("error", reject);
  child.on("close", (code) => {
    out.close(() => {
      if (code === 0) resolve();
      else reject(new Error(`mysqldump exited ${code}: ${stderr}`));
    });
  });
});

console.log(JSON.stringify({ database, tables: manifest.tables, dumpPath }, null, 2));
