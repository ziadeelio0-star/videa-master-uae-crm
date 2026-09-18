"""Inspect transactions for the Stock History feature."""
import os, re, pymysql
url = os.environ['DATABASE_URL']
m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/(\w+)', url)
u, p, h, port, db = m.groups()
c = pymysql.connect(host=h, port=int(port), user=u, password=p, database=db, ssl={'ssl': {}})
cur = c.cursor(pymysql.cursors.DictCursor)

cur.execute("""SELECT id, clientId, toolId, type, description, quantity, amount, transactionDate, invoiceNumber
               FROM transactions WHERE type='purchase' ORDER BY transactionDate DESC LIMIT 12""")
print('=== sample purchase transactions ===')
for r in cur.fetchall():
    print(r)

cur.execute("SELECT type, COUNT(*) c FROM transactions GROUP BY type")
print('\n=== counts by type ===')
print(cur.fetchall())

cur.execute("SELECT COUNT(*) c FROM transactions WHERE toolId IS NOT NULL")
print('with toolId:', cur.fetchone())
cur.execute("SELECT COUNT(*) c FROM transactions WHERE toolId IS NULL")
print('without toolId:', cur.fetchone())

cur.execute("SELECT COUNT(DISTINCT description) c FROM transactions WHERE type='purchase'")
print('distinct purchase descriptions:', cur.fetchone())

cur.execute("""SELECT description, COUNT(*) cnt, SUM(quantity) qty, SUM(amount) amt
               FROM transactions WHERE type='purchase'
               GROUP BY description ORDER BY cnt DESC LIMIT 10""")
print('\n=== most common purchase descriptions ===')
for r in cur.fetchall():
    print(r)

# Pick one client with many purchases
cur.execute("""SELECT clientId, COUNT(*) cnt FROM transactions WHERE type='purchase'
               GROUP BY clientId ORDER BY cnt DESC LIMIT 3""")
print('\n=== top buying clients ===')
top = cur.fetchall()
print(top)

if top:
    cid = top[0]['clientId']
    cur.execute("""SELECT description, quantity, amount, (amount/NULLIF(quantity,0)) unit_price, transactionDate, invoiceNumber, toolId
                   FROM transactions WHERE type='purchase' AND clientId=%s
                   ORDER BY transactionDate DESC LIMIT 15""", (cid,))
    print(f'\n=== purchases of clientId {cid} ===')
    for r in cur.fetchall():
        print(r)
