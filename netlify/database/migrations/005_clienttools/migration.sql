CREATE TABLE IF NOT EXISTS "clienttools" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "clientid" INTEGER NOT NULL,
  "toolid" INTEGER NOT NULL,
  "machineid" INTEGER,
  "usagefrequency" VARCHAR(32) NOT NULL DEFAULT 'monthly',
  "notes" TEXT,
  "createdat" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
