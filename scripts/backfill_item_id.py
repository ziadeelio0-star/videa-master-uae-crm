"""
Backfill transactions.itemId from Fact_Sales (column H = Item_ID).

Strategy:
  Match each purchase transaction row to a Fact_Sales row by
  (clientId, transactionDate, invoiceNumber, description, amount).
  This composite key is unique enough across the 668 Fact_Sales rows to avoid collisions.

Then update transactions.itemId for every match found.
"""
import os
import re
from datetime import datetime
from openpyxl import load_workbook
import pymysql

XLSX = "/home/ubuntu/upload/Videa-Master-DashboardFinale.xlsx"
SHEET = "Fact_Sales"

url = os.environ["DATABASE_URL"]
m = re.match(r"mysql://([^:]+):([^@]+)@([^:]+):(\d+)/(\w+)", url)
u, p, h, port, db = m.groups()


def main() -> None:
    wb = load_workbook(XLSX, data_only=True, read_only=True)
    ws = wb[SHEET]
    rows = list(ws.iter_rows(values_only=True))
    header = rows[0]
    print("header:", header)

    # Indices (0-based)
    idx_invoice_no = header.index("Invoice_No")
    idx_invoice_date = header.index("Invoice_Date")
    idx_client_id = header.index("Client_ID")
    idx_item_id = header.index("Item_ID")
    idx_item_desc = header.index("Item_Description")
    idx_qty = header.index("Quantity")
    idx_net_revenue = header.index("Net_Revenue")

    # Build a lookup keyed by (clientId, invoice_no, item_desc) -> item_id
    # If multiple Fact_Sales rows share that triple, fall back to amount tie-break.
    lookup: dict[tuple, list[tuple]] = {}
    for r in rows[1:]:
        if r[idx_item_id] is None:
            continue
        key = (
            int(r[idx_client_id]) if r[idx_client_id] is not None else None,
            str(r[idx_invoice_no]) if r[idx_invoice_no] is not None else None,
            str(r[idx_item_desc]).strip() if r[idx_item_desc] else "",
        )
        lookup.setdefault(key, []).append(
            (
                str(r[idx_item_id]).strip(),
                float(r[idx_net_revenue]) if r[idx_net_revenue] is not None else 0.0,
                int(r[idx_qty]) if r[idx_qty] is not None else 0,
            )
        )
    print(f"Built lookup: {len(lookup)} composite keys covering {sum(len(v) for v in lookup.values())} fact sales rows")

    # Now scan transactions
    c = pymysql.connect(host=h, port=int(port), user=u, password=p, database=db, ssl={"ssl": {}})
    cur = c.cursor(pymysql.cursors.DictCursor)
    cur.execute(
        "SELECT id, clientId, invoiceNumber, description, amount, quantity FROM transactions WHERE type='purchase'"
    )
    txs = cur.fetchall()
    print(f"Loaded {len(txs)} purchase transactions")

    matched = 0
    ambiguous = 0
    not_found = 0
    updates: list[tuple[str, int]] = []

    for tx in txs:
        key = (
            int(tx["clientId"]),
            str(tx["invoiceNumber"]).strip() if tx["invoiceNumber"] else None,
            str(tx["description"]).strip() if tx["description"] else "",
        )
        cands = lookup.get(key, [])
        if not cands:
            not_found += 1
            continue
        if len(cands) == 1:
            updates.append((cands[0][0], tx["id"]))
            matched += 1
            continue
        # Tie-break by amount + qty
        tx_amt = float(tx["amount"])
        tx_qty = int(tx["quantity"])
        best = None
        for item_id, amt, qty in cands:
            if abs(amt - tx_amt) < 0.01 and qty == tx_qty:
                best = item_id
                break
        if best is None:
            # fall back to closest amount
            best = min(cands, key=lambda c: abs(c[1] - tx_amt))[0]
            ambiguous += 1
        updates.append((best, tx["id"]))
        matched += 1

    print(f"Matched: {matched}  Ambiguous(amount-tie-broken): {ambiguous}  Not found: {not_found}")

    # Apply updates
    cur2 = c.cursor()
    cur2.executemany("UPDATE transactions SET itemId = %s WHERE id = %s", updates)
    c.commit()
    print(f"Applied {len(updates)} itemId updates")

    # Verify
    cur.execute("SELECT COUNT(*) AS n FROM transactions WHERE type='purchase' AND itemId IS NOT NULL")
    print("transactions with itemId now:", cur.fetchone())
    cur.execute("SELECT COUNT(*) AS n FROM transactions WHERE type='purchase' AND itemId IS NULL")
    print("transactions still NULL:", cur.fetchone())
    cur.execute(
        "SELECT itemId, description, COUNT(*) c FROM transactions WHERE type='purchase' AND itemId IS NOT NULL GROUP BY itemId, description ORDER BY c DESC LIMIT 8"
    )
    print("\nTop itemIds:")
    for row in cur.fetchall():
        print(row)


if __name__ == "__main__":
    main()
