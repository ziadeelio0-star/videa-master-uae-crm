#!/usr/bin/env node

/**
 * Auto-sync script for Videa Master Pro CRM
 * Imports all transactions from Excel dashboard every 5 minutes
 * Includes fuzzy matching for client names
 * 
 * Usage:
 *   node scripts/auto-sync-complete.mjs --excel /path/to/file.xlsx
 *   
 * Or set up as cron job:
 *   (every 5 minutes) cd /home/ubuntu/cutting-tools-crm && node scripts/auto-sync-complete.mjs --excel /path/to/file.xlsx
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
const args = process.argv.slice(2);
let excelPath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--excel' && i + 1 < args.length) {
    excelPath = args[i + 1];
  }
}

if (!excelPath) {
  console.error('❌ Error: --excel parameter required');
  console.error('Usage: node auto-sync-complete.mjs --excel /path/to/file.xlsx');
  process.exit(1);
}

if (!fs.existsSync(excelPath)) {
  console.error(`❌ Error: Excel file not found: ${excelPath}`);
  process.exit(1);
}

// Parse database URL
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ Error: DATABASE_URL environment variable not set');
  process.exit(1);
}

const urlMatch = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^/]+)\/(.+?)(\?|$)/);
if (!urlMatch) {
  console.error('❌ Error: Invalid DATABASE_URL format');
  process.exit(1);
}

const [, user, password, hostPort, database] = urlMatch;
const [host, port] = hostPort.split(':');

// Fuzzy matching function
function fuzzyMatch(name, clientMap, threshold = 0.75) {
  if (!name) return null;
  
  const nameLower = name.toLowerCase();
  if (nameLower in clientMap) {
    return clientMap[nameLower];
  }
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const [dbName, dbId] of Object.entries(clientMap)) {
    const score = calculateSimilarity(nameLower, dbName);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = dbId;
    }
  }
  
  return bestMatch;
}

// Calculate string similarity (Levenshtein-like)
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function getEditDistance(s1, s2) {
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

// Parse date
function parseDate(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === 'string') {
    try {
      return new Date(dateVal);
    } catch {
      return null;
    }
  }
  if (typeof dateVal === 'number') {
    return new Date(dateVal * 1000);
  }
  return null;
}

async function main() {
  console.log('=' .repeat(70));
  console.log('AUTO-SYNC: Importing Excel Dashboard');
  console.log('=' .repeat(70));
  console.log(`Excel file: ${excelPath}`);
  console.log(`Database: ${user}@${host}:${port}/${database}\n`);

  let connection;
  try {
    // Connect to database
    connection = await mysql.createConnection({
      host,
      port: parseInt(port) || 3306,
      user,
      password,
      database,
      ssl: { rejectUnauthorized: false },
    });

    console.log('✅ Connected to database\n');

    // Load Excel file
    const workbook = XLSX.readFile(excelPath);
    
    // Get client map
    const clientRows = XLSX.utils.sheet_to_json(workbook.Sheets['Dim_Clients']);
    const clientMap = {};
    
    for (const row of clientRows) {
      const name = row['Client_Name'] || row['Name'];
      if (name) {
        clientMap[name.toLowerCase()] = name;
      }
    }

    // Get database client map
    const [dbClients] = await connection.query(
      'SELECT id, companyName FROM clients'
    );
    
    const dbClientMap = {};
    for (const client of dbClients) {
      dbClientMap[client.companyName.toLowerCase()] = client.id;
    }

    console.log(`Found ${dbClients.length} clients in database\n`);

    // Build COGS map
    const cogsRows = XLSX.utils.sheet_to_json(workbook.Sheets['COGS'] || {});
    const cogsMap = {};
    
    for (const row of cogsRows) {
      const invoice = row['Invoice_No'] || row['InvoiceNumber'];
      const cogs = row['COGS'] || row['Cogs'];
      if (invoice && cogs) {
        cogsMap[String(invoice)] = parseFloat(cogs);
      }
    }

    // Clear existing transactions
    await connection.query('DELETE FROM transactions');
    console.log('✅ Cleared existing transactions\n');

    // Import transactions
    console.log('=' .repeat(70));
    console.log('Importing transactions...');
    console.log('=' .repeat(70));

    const salesRows = XLSX.utils.sheet_to_json(workbook.Sheets['Fact_Sales']);
    let importedCount = 0;
    let skippedCount = 0;
    let fuzzyMatchCount = 0;
    
    const batch = [];
    const batchSize = 100;

    for (const row of salesRows) {
      try {
        const clientName = row['Client_Name'];
        const invoiceNo = String(row['Invoice_No'] || '').trim();
        const invoiceDate = parseDate(row['Invoice_Date']);
        const itemDesc = row['Item_Description'];
        const qty = row['Quantity'] || 1;
        const amount = parseFloat(row['Amount']) || 0;
        const cogsVal = parseFloat(row['COGS']) || 0;
        const paidFlag = row['Paid_Flag'];

        // Skip invalid rows
        if (!amount || amount === 0 || !itemDesc || !invoiceDate) {
          skippedCount++;
          continue;
        }

        // Find client
        let clientId = null;
        const clientNameLower = clientName ? clientName.toLowerCase() : null;
        
        if (clientNameLower && clientNameLower in dbClientMap) {
          clientId = dbClientMap[clientNameLower];
        } else if (clientName) {
          // Try fuzzy matching
          clientId = fuzzyMatch(clientName, dbClientMap, 0.75);
          if (clientId) fuzzyMatchCount++;
        }

        if (!clientId) {
          skippedCount++;
          continue;
        }

        const txType = itemDesc.toLowerCase().includes('sharp') ? 'sharpening' : 'purchase';
        const cogs = cogsVal || cogsMap[invoiceNo] || 0;
        const status = paidFlag === 1 ? 'paid' : 'pending';

        batch.push([
          clientId,
          null, // toolId
          txType,
          itemDesc,
          qty,
          amount,
          cogs,
          status,
          invoiceNo,
          invoiceDate,
        ]);

        if (batch.length >= batchSize) {
          await connection.query(
            `INSERT INTO transactions 
            (clientId, toolId, type, description, quantity, amount, cogs, status, invoiceNumber, transactionDate)
            VALUES ?`,
            [batch]
          );
          importedCount += batch.length;
          console.log(`  Inserted ${importedCount} transactions...`);
          batch.length = 0;
        }
      } catch (error) {
        skippedCount++;
        continue;
      }
    }

    // Insert remaining batch
    if (batch.length > 0) {
      await connection.query(
        `INSERT INTO transactions 
        (clientId, toolId, type, description, quantity, amount, cogs, status, invoiceNumber, transactionDate)
        VALUES ?`,
        [batch]
      );
      importedCount += batch.length;
    }

    console.log(`✅ Imported ${importedCount} transactions`);
    console.log(`✅ Fuzzy matched: ${fuzzyMatchCount} rows`);
    console.log(`⚠️  Skipped: ${skippedCount} rows\n`);

    // Verify
    const [[{ count: totalTx }]] = await connection.query(
      'SELECT COUNT(*) as count FROM transactions'
    );
    
    const [[{ total: totalRev }]] = await connection.query(
      'SELECT SUM(amount) as total FROM transactions'
    );
    
    const [[{ total: totalCogs }]] = await connection.query(
      'SELECT SUM(cogs) as total FROM transactions'
    );

    console.log('=' .repeat(70));
    console.log('VERIFICATION');
    console.log('=' .repeat(70));
    console.log(`Total Transactions: ${totalTx}`);
    console.log(`Total Revenue: AED ${(totalRev || 0).toFixed(2)}`);
    console.log(`Total COGS: AED ${(totalCogs || 0).toFixed(2)}`);
    console.log(`Gross Profit: AED ${((totalRev || 0) - (totalCogs || 0)).toFixed(2)}\n`);

    console.log('✅ AUTO-SYNC COMPLETE!');
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();
