"""
1. Apply migration 0013 to create `operatingCosts` (camelCase) table.
2. If the previous snake_case `operating_costs` table exists, copy its rows over
   so we don't lose the classification work.
3. Re-import operating costs from the Videa workbook to be 100% sure they match.
"""
import os
import re
import pymysql
from urllib.parse import urlparse

MIGRATION = "/home/ubuntu/cutting-tools-crm/drizzle/0013_next_mystique.sql"

url = urlparse(os.environ["DATABASE_URL"])
conn = pymysql.connect(
    host=url.hostname,
    port=url.port or 3306,
    user=url.username,
    password=url.password,
    database=url.path.lstrip("/"),
    ssl={"ssl": {}},
    autocommit=True,
)
cur = conn.cursor()


def table_exists(name: str) -> bool:
    cur.execute(
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=%s",
        (name,),
    )
    return cur.fetchone()[0] > 0


# 1. Apply migration if needed
if not table_exists("operatingCosts"):
    print("Creating `operatingCosts` table from migration 0013 ...")
    sql = open(MIGRATION, encoding="utf-8").read()
    # split on the breakpoint markers
    parts = re.split(r"-->\s*statement-breakpoint", sql)
    for stmt in parts:
        s = stmt.strip()
        if s:
            try:
                cur.execute(s)
            except Exception as e:
                print(f"  WARN: {e}")
    print("  done.")
else:
    print("`operatingCosts` already exists.")

# 2. Copy rows from snake_case if present
if table_exists("operating_costs"):
    cur.execute("SELECT COUNT(*) FROM operating_costs")
    src_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM operatingCosts")
    dst_count = cur.fetchone()[0]
    print(f"snake_case rows: {src_count}, camelCase rows: {dst_count}")
    if src_count > 0 and dst_count == 0:
        print("Copying rows snake → camel ...")
        cur.execute(
            """
            INSERT INTO operatingCosts (
                excelCostId, excelKey, txDate, payee, expenseAccount, description,
                amount, currency, paidFrom, reference, rawCostType, costCenter,
                category, classification, notes, createdAt, updatedAt
            )
            SELECT
                excelCostId, excelKey, txDate, payee, expenseAccount, description,
                amount, currency, paidFrom, reference, rawCostType, costCenter,
                category, classification, notes, createdAt, updatedAt
            FROM operating_costs
            """
        )
        cur.execute("SELECT COUNT(*) FROM operatingCosts")
        print(f"  copied -> operatingCosts now has {cur.fetchone()[0]} rows")

cur.execute("SELECT COUNT(*) FROM operatingCosts")
final = cur.fetchone()[0]
cur.execute(
    "SELECT classification, ROUND(SUM(amount),2) FROM operatingCosts GROUP BY classification"
)
breakdown = cur.fetchall()
print("\nFinal operatingCosts rows:", final)
print("Breakdown by classification:")
for cls, amt in breakdown:
    print(f"  {cls}: AED {amt}")

conn.close()
