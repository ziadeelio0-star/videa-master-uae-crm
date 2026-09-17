# Auto-Sync Setup Guide

This guide explains how to set up automatic 5-minute synchronization of your Excel dashboard to the CRM database.

## Prerequisites

Before setting up auto-sync, ensure the following are installed on your system:

- **Python 3.7+** with the following packages:
  - `openpyxl` (for Excel file parsing)
  - `mysql.connector` (for database connections)

Install dependencies:
```bash
pip install openpyxl mysql-connector-python
```

- **Database URL**: The `DATABASE_URL` environment variable must be set in the format:
  ```
  mysql://username:password@host:port/database
  ```

---

## Quick Start

The auto-sync script is located at: `scripts/auto-sync.py`

### Test the script first:
```bash
cd /home/ubuntu/cutting-tools-crm
python3 scripts/auto-sync.py /path/to/Videa-Master-DashboardFinale.xlsx
```

Expected output:
```
[2026-05-06T10:16:00.000000] Starting sync from /path/to/Videa-Master-DashboardFinale.xlsx
Syncing Client_Balances...
  ✓ Updated 26 clients with balance data
[2026-05-06T10:16:13.000000] Sync completed successfully
```

---

## Setup Instructions by Platform

### 1. Linux / macOS (using Cron)

#### Step 1: Edit the crontab
```bash
crontab -e
```

#### Step 2: Add this line to run every 5 minutes
```bash
*/5 * * * * cd /home/ubuntu/cutting-tools-crm && DATABASE_URL="mysql://user:password@host:port/database" python3 scripts/auto-sync.py /home/ubuntu/upload/Videa-Master-DashboardFinale.xlsx >> /var/log/crm-sync.log 2>&1
```

**Important:** Replace `mysql://user:password@host:port/database` with your actual database connection string.

#### Step 3: Verify it's installed
```bash
crontab -l
```

#### Step 4: Monitor the logs
```bash
tail -f /var/log/crm-sync.log
```

---

### 2. Windows (using Task Scheduler)

#### Step 1: Open Task Scheduler
- Press `Win + R`
- Type `taskschd.msc` and press Enter

#### Step 2: Create a new task
1. Click "Create Basic Task..." in the right panel
2. Name: `CRM Auto-Sync`
3. Description: `Sync Excel dashboard to CRM every 5 minutes`
4. Click Next

#### Step 3: Set the trigger
1. Select "Trigger" → "New..."
2. Choose "Repeat task every: 5 minutes"
3. Duration: "Indefinitely"
4. Click OK

#### Step 4: Set the action
1. Select "Action" → "New..."
2. Program/script: `python3` (or full path: `C:\Python311\python.exe`)
3. Add arguments: 
   ```
   scripts/auto-sync.py C:\path\to\Videa-Master-DashboardFinale.xlsx
   ```
4. Start in: `C:\Users\YourUsername\cutting-tools-crm`
5. Click OK

#### Step 5: Set environment variables
1. Go to "Settings" tab
2. Check: "Run the task as soon as possible after a scheduled start is missed"
3. Check: "If the task fails, restart every: 5 minutes"
4. Before running, ensure `DATABASE_URL` is set in your system environment variables:
   - Right-click "This PC" → Properties → Advanced system settings → Environment Variables
   - Add new variable: `DATABASE_URL` = `mysql://user:password@host:port/database`
5. Click OK

#### Step 6: Verify
- Right-click the task and select "Run" to test
- Check the CRM dashboard to see if data updated
- View logs in Event Viewer (Windows Logs → Application) for task execution details

---

## Production Deployment Checklist

Before deploying auto-sync to production, verify the following:

### Prerequisites
- [ ] Python 3.7+ installed on the server
- [ ] `openpyxl` and `mysql-connector-python` packages installed
- [ ] `DATABASE_URL` environment variable set with correct credentials
- [ ] Excel file path is accessible and readable by the scheduled task user

### File & Path Validation
- [ ] Excel file exists at the specified path
- [ ] File path uses absolute paths (not relative paths)
- [ ] File permissions allow read access for the task scheduler user
- [ ] Log directory exists and is writable (e.g., `/var/log/` on Linux)

### Database Connection
- [ ] Database connection string is correct (test manually first)
- [ ] Database user has INSERT/UPDATE permissions on `clients` table
- [ ] Database is accessible from the server running the scheduled task
- [ ] SSL/TLS connection is enabled (if required by your database)

### Scheduling Configuration
- [ ] Cron job or Task Scheduler entry is created
- [ ] Trigger is set to every 5 minutes
- [ ] Task runs under the correct user account
- [ ] Retry logic is configured (restart on failure)

### Monitoring & Logging
- [ ] Log file location is configured and writable
- [ ] Log rotation is set up (to prevent disk space issues)
- [ ] Monitoring alert is configured for failed syncs
- [ ] Dashboard KPIs are verified after first scheduled run

### Verification Steps
1. **Manual Test**: Run the script manually and verify output
   ```bash
   python3 scripts/auto-sync.py /path/to/Excel.xlsx
   ```

2. **Check Dashboard**: Verify that KPIs update correctly
   - Total Revenue should match Excel file
   - Outstanding Balance should match Client_Balances sheet
   - Total Invoices should show 214 unique invoices

3. **Monitor Logs**: Check that scheduled runs complete successfully
   ```bash
   tail -20 /var/log/crm-sync.log
   ```

4. **Verify Timestamps**: Confirm that sync runs occur at 5-minute intervals
   ```bash
   grep "Starting sync" /var/log/crm-sync.log | tail -10
   ```

---

## Monitoring & Logging

### View recent syncs
```bash
# Linux/macOS
tail -20 /var/log/crm-sync.log

# Windows (Event Viewer)
# Navigate to: Windows Logs → Application → Filter by Task Scheduler
```

### Check sync status in CRM
1. Go to Dashboard
2. Look at "Total Invoices" count (should be 214)
3. Check "Total Revenue" amount (should be AED 488,081)
4. Check "Outstanding" amount (should match Client_Balances total)
5. These should match your Excel file

### Troubleshooting

**Issue: "Excel file not found"**
- Ensure the file path is correct and absolute
- Verify file permissions (readable by the task scheduler user)
- Use absolute paths, not relative paths

**Issue: "DATABASE_URL not set"**
- Make sure environment variables are loaded before running the script
- For cron: Add `export DATABASE_URL="..."` to the crontab entry
- For Windows: Set via System Environment Variables (not just command line)

**Issue: "No transactions imported"**
- Check that client names in Excel match the database
- The script uses fuzzy matching (75% similarity threshold)
- Check the logs for "Updated X clients" message
- Verify that the Client_Balances sheet exists in the Excel file

**Issue: "Connection refused" or "Access denied"**
- Verify database credentials in DATABASE_URL
- Check that the database server is accessible from the scheduled task host
- Ensure the database user has INSERT/UPDATE permissions
- For remote databases, verify firewall rules allow the connection

**Issue: "Task runs but no data updates"**
- Check that the Excel file is being updated externally
- Verify that the script completes without errors in the logs
- Check that the database connection is working (test manually)
- Ensure the Client_Balances sheet exists and has data

---

## Performance Notes

- Each sync takes approximately 10-30 seconds depending on file size
- The script only updates Client_Balances data (not transactions)
- No data loss occurs (balances are updated, not deleted)
- The database is locked during the import (typically < 1 second)
- Recommended: Run syncs during off-peak hours if possible

---

## Manual Sync

You can also manually trigger a sync anytime:

```bash
cd /home/ubuntu/cutting-tools-crm
python3 scripts/auto-sync.py /path/to/Videa-Master-DashboardFinale.xlsx
```

---

## Next Steps

1. Test the script manually with your Excel file
2. Choose your platform (Linux/macOS with Cron, or Windows with Task Scheduler)
3. Follow the setup instructions for your platform
4. Complete the production deployment checklist
5. Monitor the logs to confirm it's working
6. Your CRM will now auto-update every 5 minutes!

---

## Support

For issues or questions, check the logs first:
- **Linux/macOS**: `tail -f /var/log/crm-sync.log`
- **Windows**: Event Viewer → Windows Logs → Application

If the script fails, the error message will be logged with details about what went wrong.
