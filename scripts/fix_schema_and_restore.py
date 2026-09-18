"""Add the missing dueDate + agingBucket columns to transactions, then run TS restore."""
import os, pymysql, subprocess, sys
from urllib.parse import urlparse

url = urlparse(os.environ["DATABASE_URL"])
c = pymysql.connect(
    host=url.hostname,
    port=url.port or 3306,
    user=url.username,
    password=url.password,
    database=url.path.lstrip("/"),
    ssl={"ssl": {}},
    autocommit=True,
)
cur = c.cursor()

cur.execute("SHOW COLUMNS FROM transactions")
have = {r[0] for r in cur.fetchall()}
if "dueDate" not in have:
    print("Adding column transactions.dueDate ...")
    cur.execute("ALTER TABLE transactions ADD COLUMN dueDate TIMESTAMP NULL")
if "agingBucket" not in have:
    print("Adding column transactions.agingBucket ...")
    cur.execute(
        "ALTER TABLE transactions ADD COLUMN agingBucket "
        "ENUM('not_due','0_30','31_60','61_90','90_plus') NULL"
    )

cur.execute("SHOW COLUMNS FROM transactions")
print("Final columns:", [r[0] for r in cur.fetchall()])
c.close()
print("Schema fixed. Now running TS restore...")

r = subprocess.run(
    ["pnpm", "tsx", "scripts/emergency_restore.ts"],
    cwd="/home/ubuntu/cutting-tools-crm",
)
sys.exit(r.returncode)
