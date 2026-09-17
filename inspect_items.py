"""Inspect item-related fields across tools and transactions."""
import os, re, pymysql
url = os.environ['DATABASE_URL']
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/(\w+)', url)
u, p, h, port, db = m.groups()
c = pymysql.connect(host=h, port=int(port), user=u, password=p, database=db, ssl={'ssl': {}})
cur = c.cursor(pymysql.cursors.DictCursor)

print('=== tools row sample ===')
cur.execute("SELECT id, name, category, description, unitPrice FROM tools LIMIT 8")
for r in cur.fetchall():
    print(r)

print('\n=== tools count ===')
cur.execute("SELECT COUNT(*) c FROM tools")
print(cur.fetchone())

print('\n=== transactions w/ toolId vs without ===')
cur.execute("SELECT COUNT(*) c FROM transactions WHERE type='purchase' AND toolId IS NOT NULL")
print('with toolId (purchase):', cur.fetchone())
cur.execute("SELECT COUNT(*) c FROM transactions WHERE type='purchase' AND toolId IS NULL")
print('without toolId (purchase):', cur.fetchone())

print('\n=== sample transactions joined with tools ===')
cur.execute("""SELECT t.id, t.toolId, t.description as tx_desc, tl.name as tool_name,
                      tl.description as tool_desc, tl.category, t.quantity, t.amount
               FROM transactions t LEFT JOIN tools tl ON tl.id = t.toolId
               WHERE t.type='purchase' LIMIT 8""")
for r in cur.fetchall():
    print(r)

print('\n=== distinct tx descriptions (item codes) sample ===')
cur.execute("SELECT DISTINCT description FROM transactions WHERE type='purchase' LIMIT 12")
for r in cur.fetchall():
    print(r['description'])
