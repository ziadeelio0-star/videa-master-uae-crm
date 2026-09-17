#!/usr/bin/env python3
"""Apply migration 0013_next_mystique.sql (creates operatingCosts table)."""
import os, re, urllib.parse, mysql.connector

url = os.environ["DATABASE_URL"]
parsed = urllib.parse.urlparse(url)
conn = mysql.connector.connect(
    host=parsed.hostname,
    port=parsed.port or 3306,
    user=urllib.parse.unquote(parsed.username or ""),
    password=urllib.parse.unquote(parsed.password or ""),
    database=parsed.path.lstrip("/"),
    ssl_disabled=False,
    ssl_verify_cert=False,
)
cur = conn.cursor()

with open("/home/ubuntu/cutting-tools-crm/drizzle/0013_next_mystique.sql") as f:
    sql = f.read()

# Drizzle uses --> statement-breakpoint as the separator
parts = [p.strip() for p in re.split(r"-->\s*statement-breakpoint", sql) if p.strip()]
for i, stmt in enumerate(parts, 1):
    print(f"[{i}/{len(parts)}] {stmt[:80]}...")
    try:
        cur.execute(stmt)
    except mysql.connector.Error as e:
        if e.errno == 1050:  # table exists
            print("   table already exists, skipping")
        else:
            raise
conn.commit()
cur.close()
conn.close()
print("Done.")
