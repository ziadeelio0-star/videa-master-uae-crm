#!/usr/bin/env python3
"""Import every Fact_Cost row into the operatingCosts table with a precise
classification.

Classification logic — single source of truth, kept here AND mirrored in the
backend sync code so that a re-sync produces identical buckets.

cost_type → category, classification:
  Inventory Purchase                → other_operating, INVENTORY  (excluded from Operating)
  Salary Elio / Salary Naseer       → salaries, OPERATING
  Rent                              → rent, OPERATING
  Office charges                    → office, OPERATING
  Maintenance & repairs             → maintenance, OPERATING
  Fuel                              → fuel, OPERATING
  Electricity                       → utilities, OPERATING
  VAT                               → tax, OPERATING
  Partner account                   → other_operating, OPERATING

Blank cost_type → classify by Expense_Account (Arabic + English):
  هاتف / phone / wifi               → phone_internet
  أتعاب قانونية / legal             → legal
  أتعاب محاسبية / accounting        → accounting
  أجهزة الكمبيوتر / IT              → it_equipment
  Office Kitchen Supplies           → office
  دعايه وإعلان / marketing          → marketing
  كهرباء / electricity / hvac       → utilities
  رسوم مصرفية / bank                → bank_fees
  تكاليف ضريبية / tax / VAT         → tax
  Suspense                          → other_operating
  default                           → other_operating  (still OPERATING — it's
                                       an admin expense the workbook simply
                                       didn't tag)
"""
from __future__ import annotations
import os, re, urllib.parse, openpyxl, mysql.connector
from datetime import datetime

WB = "/home/ubuntu/upload/Videa-Master-DashboardFinale.xlsx"

def connect():
    parsed = urllib.parse.urlparse(os.environ["DATABASE_URL"])
    return mysql.connector.connect(
        host=parsed.hostname, port=parsed.port or 3306,
        user=urllib.parse.unquote(parsed.username or ""),
        password=urllib.parse.unquote(parsed.password or ""),
        database=parsed.path.lstrip("/"),
        ssl_disabled=False, ssl_verify_cert=False,
    )

# --- Classification rules ------------------------------------------------- #

EXPLICIT_TYPE_MAP = {
    "Salary Elio": ("salaries", "operating"),
    "Salary Naseer": ("salaries", "operating"),
    "Rent": ("rent", "operating"),
    "Office charges": ("office", "operating"),
    "Maintenance & repairs": ("maintenance", "operating"),
    "Fuel": ("fuel", "operating"),
    "Electricity": ("utilities", "operating"),
    "VAT": ("tax", "operating"),
    "Partner account": ("other_operating", "operating"),
    "Inventory Purchase": ("other_operating", "inventory"),
}

# Each rule is (regex_pattern, category).  All produce classification=operating.
BLANK_DESC_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"هاتف|phone|wifi|internet|du\b|etisalat", re.I), "phone_internet"),
    (re.compile(r"كهرباء|electric(ity)?|hvac|water|dewa", re.I), "utilities"),
    (re.compile(r"أتعاب قانونية|legal", re.I), "legal"),
    (re.compile(r"أتعاب محاسبية|accounting|bookkeep", re.I), "accounting"),
    (re.compile(r"أجهزة الكمبيوتر|computer|laptop|software|adobe|microsoft|it\b", re.I), "it_equipment"),
    (re.compile(r"office kitchen|kitchen|coffee|water cooler|stationery|أدوات مكتبية|مطبوعات|office supplies", re.I), "office"),
    (re.compile(r"دعايه|advert|marketing|إعلان|sponsor", re.I), "marketing"),
    (re.compile(r"رسوم مصرفية|bank fee|wire fee|transfer fee", re.I), "bank_fees"),
    (re.compile(r"تكاليف ضريبية|vat|tax", re.I), "tax"),
    (re.compile(r"إصلاح|maintenance|repair|service", re.I), "maintenance"),
    (re.compile(r"fuel|gas|petrol|مركبات|vehicle", re.I), "fuel"),
    (re.compile(r"rent|إيجار", re.I), "rent"),
    (re.compile(r"salary|راتب|wage", re.I), "salaries"),
]

def classify(cost_type: str | None, expense_account: str | None) -> tuple[str, str]:
    """Returns (category, classification)."""
    ct = (cost_type or "").strip()
    if ct in EXPLICIT_TYPE_MAP:
        return EXPLICIT_TYPE_MAP[ct]
    if ct == "":
        desc = expense_account or ""
        for pat, cat in BLANK_DESC_RULES:
            if pat.search(desc):
                return (cat, "operating")
        return ("other_operating", "operating")
    # Unknown explicit cost_type → still operating, bucket = other_operating
    return ("other_operating", "operating")


def main():
    wb = openpyxl.load_workbook(WB, data_only=True)
    ws = wb["Fact_Cost"]
    headers = [c.value for c in ws[1]]
    H = {h: i for i, h in enumerate(headers) if h is not None}

    conn = connect()
    cur = conn.cursor()

    # Wipe & re-insert (table is idempotent on excelKey but a clean reset is
    # safest for the very first import).
    cur.execute("DELETE FROM operatingCosts")

    insert_sql = """
        INSERT INTO operatingCosts
        (excelCostId, excelKey, txDate, payee, expenseAccount, description,
         amount, currency, paidFrom, reference, rawCostType, costCenter,
         category, classification, notes)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """

    inserted = 0
    by_cls: dict[str, float] = {}
    by_cat: dict[str, float] = {}
    skipped = 0
    for r in range(2, ws.max_row + 1):
        row = [c.value for c in ws[r]]
        if all(v is None for v in row):
            continue
        date_v = row[H["Date"]]
        amt_v = row[H["Amount"]]
        if date_v is None or amt_v is None:
            skipped += 1
            continue
        try:
            amt = float(amt_v)
        except Exception:
            skipped += 1
            continue
        if isinstance(date_v, datetime):
            tx_date = date_v
        else:
            tx_date = datetime.fromisoformat(str(date_v))
        cost_type = row[H["Cost_Type"]]
        expense_account = row[H["Expense_Account"]]
        category, classification = classify(cost_type, expense_account)

        cur.execute(insert_sql, (
            (str(row[H["Cost_ID"]]) if row[H["Cost_ID"]] is not None else None),
            row[H["_Key"]],
            tx_date,
            row[H["Payee"]],
            expense_account,
            row[H["Description"]],
            amt,
            row[H["Currency"]] or "AED",
            row[H["Paid_From"]],
            (str(row[H["Reference"]]) if row[H["Reference"]] is not None else None),
            cost_type,
            row[H["Cost_Center"]],
            category,
            classification,
            None,
        ))
        inserted += 1
        by_cls[classification] = by_cls.get(classification, 0) + amt
        by_cat[category] = by_cat.get(category, 0) + amt

    conn.commit()
    cur.close()
    conn.close()

    print(f"Inserted {inserted} cost rows (skipped {skipped} blank/invalid).")
    print("\nBy classification (AED):")
    for k, v in sorted(by_cls.items(), key=lambda kv: -kv[1]):
        print(f"  {k:14s} {v:>14,.2f}")
    print("\nBy category (AED):")
    for k, v in sorted(by_cat.items(), key=lambda kv: -kv[1]):
        print(f"  {k:18s} {v:>14,.2f}")
    op = by_cls.get("operating", 0)
    inv = by_cls.get("inventory", 0)
    ship = by_cls.get("shipping", 0)
    print(f"\nOperating Cost total: AED {op:,.2f}")
    print(f"Inventory (excluded from operating): AED {inv:,.2f}")
    print(f"Shipping (excluded from operating):  AED {ship:,.2f}")
    print(f"Operating + Inventory + Shipping = AED {(op+inv+ship):,.2f} "
          f"(should equal Fact_Cost grand total)")


if __name__ == "__main__":
    main()
