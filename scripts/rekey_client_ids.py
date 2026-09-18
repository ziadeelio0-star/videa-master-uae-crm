"""
Re-key clients so id == Excel ID.

Strategy (safe in MySQL/TiDB without dropping FKs):
  1. Connect with autocommit OFF.
  2. Build a complete map old_id -> new_id for ALL 81 clients (every client
     ends up at its Excel ID). First fix the 3 known misassigned excelClientIds
     by name; then for the 55 NULL ones, fill them by name match.
  3. Move every client to a "stage" id (offset = 100_000) to avoid collisions
     during the swap. Update transactions.clientId in lockstep.
  4. Move from stage id to final new_id. Update transactions.clientId again.
  5. Verify per-row and total counts before COMMIT.

If anything fails, ROLLBACK leaves the database untouched.
"""
import os, re, sys, pymysql
from openpyxl import load_workbook

XLSX = "/home/ubuntu/upload/Videa-Master-DashboardFinale.xlsx"
STAGE_OFFSET = 100_000

# Manual fixes for 3 known mis-mappings (DB id -> correct Excel id)
MANUAL_FIXES = {
    87: 6,    # Westream FZ LLC -> Westreamer FZ LLC (Excel 6)
    107: 26,  # Al Safa Kitchen Cabinets -> Excel 26
    126: 45,  # Al Shandgha Wood Industries -> Excel 45
}

def normalize(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())

def connect():
    url = os.environ["DATABASE_URL"]
    m = re.match(r"mysql://([^:]+):([^@]+)@([^:]+):(\d+)/(\w+)", url)
    u, p, h, port, db = m.groups()
    return pymysql.connect(
        host=h, port=int(port), user=u, password=p, database=db,
        ssl={"ssl": {}}, autocommit=False
    )

def load_excel():
    wb = load_workbook(XLSX, data_only=True, read_only=True)
    ws = wb["Dim_Clients"]
    out = {}
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0: continue
        if not row or row[0] is None: continue
        try:
            out[int(row[0])] = str(row[1]).strip()
        except (ValueError, TypeError):
            pass
    return out

def main(dry_run=True):
    excel = load_excel()
    print(f"Excel has {len(excel)} clients (IDs {min(excel)}..{max(excel)})")
    excel_by_norm = {normalize(n): eid for eid, n in excel.items()}

    conn = connect()
    cur = conn.cursor()

    # Snapshot state
    cur.execute("SELECT id, companyName, excelClientId FROM clients ORDER BY id")
    db_rows = cur.fetchall()
    cur.execute("SELECT COUNT(*) FROM transactions")
    tx_total_before = cur.fetchone()[0]
    print(f"DB has {len(db_rows)} clients, {tx_total_before} transactions before migration")

    # Build target map: db_id -> target excel_id
    target = {}
    for db_id, name, eid in db_rows:
        if db_id in MANUAL_FIXES:
            target[db_id] = MANUAL_FIXES[db_id]
            continue
        if eid is not None:
            target[db_id] = eid
            continue
        norm = normalize(name)
        if norm in excel_by_norm:
            target[db_id] = excel_by_norm[norm]
        else:
            print(f"  ERROR: cannot map DB:{db_id} '{name}' to any Excel row")
            conn.rollback()
            sys.exit(1)

    # Validate: target ids must be unique
    new_ids = list(target.values())
    if len(set(new_ids)) != len(new_ids):
        from collections import Counter
        dup = [i for i, c in Counter(new_ids).items() if c > 1]
        print(f"  ERROR: duplicate target IDs: {dup}")
        conn.rollback()
        sys.exit(1)
    print(f"All {len(target)} clients have unique target IDs (range {min(new_ids)}..{max(new_ids)})")

    # Identify which clients actually need to move
    to_move = {db_id: tid for db_id, tid in target.items() if db_id != tid}
    print(f"{len(to_move)} clients need to be re-keyed; {len(target) - len(to_move)} are already in place")

    if not to_move:
        print("Nothing to do.")
        conn.rollback()
        return

    if dry_run:
        print("\nDry run, no changes applied.")
        for db_id, new_id in list(to_move.items())[:10]:
            print(f"  DB:{db_id:4d} -> {new_id:4d}")
        conn.rollback()
        return

    # ---- PHASE A: move every moving client to stage id (db_id + STAGE_OFFSET) ----
    print("\nPhase A: moving to stage IDs...")
    for db_id in to_move:
        stage_id = db_id + STAGE_OFFSET
        cur.execute("UPDATE clients SET id = %s WHERE id = %s", (stage_id, db_id))
        cur.execute("UPDATE transactions SET clientId = %s WHERE clientId = %s", (stage_id, db_id))
        cur.execute("UPDATE machines SET clientId = %s WHERE clientId = %s", (stage_id, db_id))
        cur.execute("UPDATE clientTools SET clientId = %s WHERE clientId = %s", (stage_id, db_id))

    # ---- PHASE B: move from stage to final ----
    print("Phase B: moving to final IDs...")
    for db_id, new_id in to_move.items():
        stage_id = db_id + STAGE_OFFSET
        cur.execute("UPDATE clients SET id = %s, excelClientId = %s WHERE id = %s",
                    (new_id, new_id, stage_id))
        cur.execute("UPDATE transactions SET clientId = %s WHERE clientId = %s",
                    (new_id, stage_id))
        cur.execute("UPDATE machines SET clientId = %s WHERE clientId = %s",
                    (new_id, stage_id))
        cur.execute("UPDATE clientTools SET clientId = %s WHERE clientId = %s",
                    (new_id, stage_id))

    # Also update excelClientId on already-correct clients in case it was NULL
    for db_id, eid in target.items():
        if db_id == eid:
            cur.execute("UPDATE clients SET excelClientId = %s WHERE id = %s", (eid, db_id))

    # Verify integrity
    cur.execute("SELECT COUNT(*) FROM clients")
    n_clients = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM transactions")
    tx_total_after = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM transactions WHERE clientId NOT IN (SELECT id FROM clients)")
    orphans = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM clients WHERE id != excelClientId OR excelClientId IS NULL")
    mismatch = cur.fetchone()[0]

    print(f"\nVerification:")
    print(f"  Clients: {n_clients} (expected {len(db_rows)})")
    print(f"  Transactions: {tx_total_after} (expected {tx_total_before})")
    print(f"  Orphan transactions: {orphans} (expected 0)")
    print(f"  ID/Excel-ID mismatches: {mismatch} (expected 0)")

    if (n_clients == len(db_rows)
            and tx_total_after == tx_total_before
            and orphans == 0
            and mismatch == 0):
        conn.commit()
        print("\nCOMMITTED.")
    else:
        conn.rollback()
        print("\nINTEGRITY CHECK FAILED — ROLLED BACK.")
        sys.exit(1)

    conn.close()


if __name__ == "__main__":
    main(dry_run="--apply" not in sys.argv)
