CREATE TABLE IF NOT EXISTS "users" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "openid" VARCHAR(64) NOT NULL,
  "name" TEXT,
  "email" VARCHAR(320),
  "loginmethod" VARCHAR(64),
  "role" VARCHAR(32) NOT NULL DEFAULT 'user',
  "createdat" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedat" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastsignedin" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("openid")
);

INSERT INTO "users" ("id", "openid", "name", "email", "loginmethod", "role", "createdat", "updatedat", "lastsignedin") VALUES
(1, 'H3oNA7UF3emgYw6ZLCNiMn', 'Elio Ziade', 'ziadeelio0@gmail.com', 'google', 'admin', '2026-04-30T04:30:51.000Z', '2026-09-17T11:49:29.000Z', '2026-09-17T11:49:29.000Z')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('users','id'), GREATEST((SELECT COALESCE(MAX(id),1) FROM "users"),1), true);
