import { doublePrecision, integer, serial, pgTable, text, timestamp, varchar, numeric, index } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openid", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginmethod", { length: 64 }),
  role: varchar("role", { length: 32 }).default("user").notNull(),
  createdAt: timestamp("createdat").defaultNow().notNull(),
  updatedAt: timestamp("updatedat").defaultNow().notNull(),
  lastSignedIn: timestamp("lastsignedin").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Clients — companies that Videa Master Pro Tools Trading LLC serves.
 */
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  companyName: varchar("companyname", { length: 255 }).notNull(),
  contactPerson: varchar("contactperson", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 64 }),
  address: text("address"),
  industry: varchar("industry", { length: 128 }),
  activityLevel: varchar("activitylevel", { length: 32 }).default("medium").notNull(),
  managerCustomerKey: varchar("managercustomerkey", { length: 64 }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  geocodeSource: varchar("geocodesource", { length: 32 }),
  geocodedAt: timestamp("geocodedat"),
  notes: text("notes"),
  outstandingBalance: numeric("outstandingbalance", { precision: 12, scale: 2 }).default("0").notNull(),
  oldestUnpaidDate: timestamp("oldestunpaiddate"),
  excelClientId: integer("excelclientid"),
  createdAt: timestamp("createdat").defaultNow().notNull(),
  updatedAt: timestamp("updatedat").defaultNow().notNull(),
}, (t) => ({
  idxName: index("idx_client_name").on(t.companyName),
  idxIndustry: index("idx_client_industry").on(t.industry),
}));

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

/**
 * Machines — equipment owned by clients.
 */
export const machines = pgTable("machines", {
  id: serial("id").primaryKey(),
  clientId: integer("clientid").notNull(),
  machineType: varchar("machinetype", { length: 128 }).notNull(),
  brand: varchar("brand", { length: 128 }),
  model: varchar("model", { length: 128 }),
  serialNumber: varchar("serialnumber", { length: 128 }),
  specifications: text("specifications"),
  notes: text("notes"),
  createdAt: timestamp("createdat").defaultNow().notNull(),
  updatedAt: timestamp("updatedat").defaultNow().notNull(),
}, (t) => ({
  idxClient: index("idx_machine_client").on(t.clientId),
}));

export type Machine = typeof machines.$inferSelect;
export type InsertMachine = typeof machines.$inferInsert;

/**
 * Tools — catalog of cutting tools offered.
 */
export const tools = pgTable("tools", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 128 }),
  category: varchar("category", { length: 128 }),
  unitPrice: numeric("unitprice", { precision: 10, scale: 2 }).default("0"),
  description: text("description"),
  createdAt: timestamp("createdat").defaultNow().notNull(),
  updatedAt: timestamp("updatedat").defaultNow().notNull(),
}, (t) => ({
  idxName: index("idx_tool_name").on(t.name),
}));

export type Tool = typeof tools.$inferSelect;
export type InsertTool = typeof tools.$inferInsert;

/**
 * ClientTools — join table: which tools a client uses + usage notes.
 */
export const clientTools = pgTable("clienttools", {
  id: serial("id").primaryKey(),
  clientId: integer("clientid").notNull(),
  toolId: integer("toolid").notNull(),
  machineId: integer("machineid"),
  usageFrequency: varchar("usagefrequency", { length: 32 }).default("monthly").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdat").defaultNow().notNull(),
}, (t) => ({
  idxClient: index("idx_ct_client").on(t.clientId),
  idxTool: index("idx_ct_tool").on(t.toolId),
}));

export type ClientTool = typeof clientTools.$inferSelect;
export type InsertClientTool = typeof clientTools.$inferInsert;

/**
 * Transactions — purchases & sharpening orders.
 */
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  clientId: integer("clientid").notNull(),
  toolId: integer("toolid"),
  /** Fact_Sales column H — source-of-truth Item_ID from the workbook (e.g. "18016008 MAR180444536CON"). */
  itemId: varchar("itemid", { length: 128 }),
  type: varchar("type", { length: 32 }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  cogs: numeric("cogs", { precision: 12, scale: 2 }).default("0").notNull(),
  status: varchar("status", { length: 32 }).default("pending").notNull(),
  invoiceNumber: varchar("invoicenumber", { length: 64 }),
  transactionDate: timestamp("transactiondate").defaultNow().notNull(),
  dueDate: timestamp("duedate"),
  agingBucket: varchar("agingbucket", { length: 32 }),
  notes: text("notes"),
  createdAt: timestamp("createdat").defaultNow().notNull(),
  updatedAt: timestamp("updatedat").defaultNow().notNull(),
}, (t) => ({
  idxClient: index("idx_tx_client").on(t.clientId),
  idxDate: index("idx_tx_date").on(t.transactionDate),
  idxStatus: index("idx_tx_status").on(t.status),
  idxItemId: index("idx_tx_item_id").on(t.itemId),
}));

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * Portfolio cache — stores the last successful Manager.io portfolio totals
 * so the Dashboard can show stale data when Manager.io is unreachable.
 */
export const portfolioCache = pgTable("portfoliocache", {
  id: serial("id").primaryKey(),
  billed: numeric("billed", { precision: 14, scale: 2 }).notNull().default("0"),
  paid: numeric("paid", { precision: 14, scale: 2 }).notNull().default("0"),
  outstanding: numeric("outstanding", { precision: 14, scale: 2 }).notNull().default("0"),
  thisMonth: numeric("thismonth", { precision: 14, scale: 2 }).notNull().default("0"),
  cachedAt: timestamp("cachedat").defaultNow().notNull(),
});

export type PortfolioCache = typeof portfolioCache.$inferSelect;
export type InsertPortfolioCache = typeof portfolioCache.$inferInsert;

/**
 * API Configuration — stores user-managed credentials for external services.
 * Allows users to update API keys directly in the app without needing
 * to contact support or restart the server.
 */
export const apiConfig = pgTable("apiconfig", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedat").defaultNow().notNull(),
});

export type ApiConfig = typeof apiConfig.$inferSelect;
export type InsertApiConfig = typeof apiConfig.$inferInsert;

/**
 * Operating Costs — sourced from the Fact_Cost sheet of the master workbook.
 *
 * Every Fact_Cost row whose cost_type is NOT "Inventory Purchase" (and not
 * shipping, which the workbook bundles into Inventory Purchase) is imported
 * here. Rows are tagged with a normalized `category` so that operating costs
 * can be summarized monthly and a true Net Profit (Gross Profit − Operating
 * Cost) can be reported on the Dashboard.
 *
 * `excelCostId` and `excelKey` together identify the row in the workbook so
 * re-syncs do not duplicate.
 */
export const operatingCosts = pgTable(
  "operatingcosts",
  {
    id: serial("id").primaryKey(),
    excelCostId: varchar("excelcostid", { length: 64 }),
    excelKey: varchar("excelkey", { length: 320 }),
    txDate: timestamp("txdate").notNull(),
    payee: varchar("payee", { length: 320 }),
    expenseAccount: varchar("expenseaccount", { length: 320 }),
    description: text("description"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 8 }).default("AED").notNull(),
    paidFrom: varchar("paidfrom", { length: 128 }),
    reference: varchar("reference", { length: 128 }),
    rawCostType: varchar("rawcosttype", { length: 128 }),
    costCenter: varchar("costcenter", { length: 128 }),
    // Normalized classification: which expense bucket this cost belongs to.
    category: varchar("category", { length: 32 }).notNull(),
    // Top-level grouping so the Dashboard knows what to subtract from gross.
    classification: varchar("classification", { length: 32 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdat").defaultNow().notNull(),
    updatedAt: timestamp("updatedat").defaultNow().notNull(),
  },
  (t) => ({
    idxDate: index("idx_op_cost_date").on(t.txDate),
    idxCategory: index("idx_op_cost_category").on(t.category),
    idxClassification: index("idx_op_cost_classification").on(t.classification),
    idxExcelKey: index("idx_op_cost_excel_key").on(t.excelKey),
  })
);

export type OperatingCost = typeof operatingCosts.$inferSelect;
export type InsertOperatingCost = typeof operatingCosts.$inferInsert;

/**
 * Sync State — single-row table that records the SHA256 of the last successfully
 * imported Dashboard workbook so we can skip a re-import when the same bytes
 * are uploaded again. This makes the auto-sync-on-refresh flow effectively free
 * when the workbook hasn't changed.
 */
export const syncState = pgTable("syncstate", {
  id: serial("id").primaryKey(),
  /** Stable key, currently always "dashboard". Lets us add other sync sources later. */
  source: varchar("source", { length: 64 }).notNull().unique(),
  /** Hex SHA256 of the workbook bytes. */
  fileHash: varchar("filehash", { length: 128 }).notNull(),
  /** File name as uploaded, for display. */
  fileName: varchar("filename", { length: 320 }),
  /** Cached summary JSON of the last successful import. */
  summaryJson: text("summaryjson"),
  /** When the import that produced this summary completed. */
  lastSyncAt: timestamp("lastsyncat").defaultNow().notNull(),
  updatedAt: timestamp("updatedat").defaultNow().notNull(),
});

export type SyncState = typeof syncState.$inferSelect;
export type InsertSyncState = typeof syncState.$inferInsert;
