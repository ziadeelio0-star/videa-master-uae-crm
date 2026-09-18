CREATE TABLE IF NOT EXISTS "syncstate" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "source" VARCHAR(64) NOT NULL,
  "filehash" VARCHAR(128) NOT NULL,
  "filename" VARCHAR(320),
  "summaryjson" TEXT,
  "lastsyncat" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedat" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("source")
);

INSERT INTO "syncstate" ("id", "source", "filehash", "filename", "summaryjson", "lastsyncat", "updatedat") VALUES
(1, 'dashboard', 'bd969693e765c1e6535312a77471a66e1d31af2c0f1d34dd93e9e1a29395ccca', 'Videa - Master - Dashboard Finale .xlsx', '{"clients":116,"tools":625,"transactions":1173,"invoices":412,"totalRevenue":1008140.55,"totalCOGS":413935.99,"grossProfit":594204.56,"balancesUpdated":37,"operatingCostsRows":489,"operatingCostsTotal":743387.98,"inventoryCostsTotal":299021.72,"warnings":["5 COGS-only invoice(s) not in Fact_Sales — created synthetic transaction(s) to capture COGS"]}', '2026-09-17T11:49:00.000Z', '2026-09-17T11:48:59.000Z')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('syncstate','id'), GREATEST((SELECT COALESCE(MAX(id),1) FROM "syncstate"),1), true);
