"""Audit client ID vs Excel ID divergence."""
import os, re, pymysql

url = os.environ['DATABASE_URL']
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/(\w+)', url)
u, p, h, port, db = m.groups()
c = pymysql.connect(host=h, port=int(port), user=u, password=p, database=db, ssl={'ssl': {}})
cur = c.cursor()
cur.execute("SELECT id, companyName, excelClientId, outstandingBalance FROM clients ORDER BY id")
rows = cur.fetchall()
print(f"Total clients: {len(rows)}")

divergent = [r for r in rows if r[2] is not None and r[0] != r[2]]
print(f"\nDivergent (DB id != excelClientId): {len(divergent)}")
for r in divergent[:15]:
    print(f"  DB:{r[0]:4d}  Excel:{r[2]:4d}  {r[1]:<40s}  AED {float(r[3]):>10.2f}")

null_excel = [r for r in rows if r[2] is None]
matching = [r for r in rows if r[2] is not None and r[0] == r[2]]
print(f"\nNULL excelClientId: {len(null_excel)}")
print(f"Already matching: {len(matching)}")

new_ids = {r[2] for r in rows if r[2] is not None}
old_ids = {r[0] for r in rows}
print(f"\nID ranges — DB: {min(old_ids)}..{max(old_ids)}  Excel: {min(new_ids) if new_ids else '-'}..{max(new_ids) if new_ids else '-'}")

# Collision check: which Excel IDs collide with existing DB IDs that belong to a DIFFERENT client?
print("\nCollision check:")
db_id_to_excel = {r[0]: r[2] for r in rows}
collisions = []
for r in rows:
    if r[2] is None:
        continue
    target_id = r[2]
    if target_id in db_id_to_excel and target_id != r[0]:
        # Another client currently owns the slot we want
        collisions.append((r[0], r[1], target_id))
print(f"  Slot collisions to resolve: {len(collisions)}")
for cl in collisions[:5]:
    print(f"  Client DB:{cl[0]} ({cl[1]}) wants slot {cl[2]} (currently held)")

# Transactions per client
cur.execute("SELECT clientId, COUNT(*) FROM transactions GROUP BY clientId")
tx = dict(cur.fetchall())
print(f"\nTransactions: {sum(tx.values())} rows across {len(tx)} clients")

cur.execute("SELECT COUNT(*) FROM machines")
print(f"Machines: {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(*) FROM clientTools")
print(f"ClientTools: {cur.fetchone()[0]}")

c.close()
