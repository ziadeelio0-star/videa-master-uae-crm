CREATE TABLE IF NOT EXISTS "machines" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "clientid" INTEGER NOT NULL,
  "machinetype" VARCHAR(128) NOT NULL,
  "brand" VARCHAR(128),
  "model" VARCHAR(128),
  "serialnumber" VARCHAR(128),
  "specifications" TEXT,
  "notes" TEXT,
  "createdat" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedat" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
