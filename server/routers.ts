import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import {
  ManagerApiError,
  ManagerConfigError,
  fetchAllCustomers,
  fetchAllInventoryItems,
  isManagerConfigured,
  pingBusinessName,
} from "./manager";
import {
  computePortfolioTotals,
} from "./financial";
import { geocodeClient } from "./geocode";

// Admin-only procedure — this is an internal company tool.
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

const clientInput = z.object({
  companyName: z.string().min(1),
  contactPerson: z.string().nullish(),
  email: z.string().email().nullish().or(z.literal("")),
  phone: z.string().nullish(),
  address: z.string().nullish(),
  industry: z.string().nullish(),
  activityLevel: z.enum(["high", "medium", "low", "inactive"]).default("medium"),
  notes: z.string().nullish(),
});

const machineInput = z.object({
  clientId: z.number().int().positive(),
  machineType: z.string().min(1),
  brand: z.string().nullish(),
  model: z.string().nullish(),
  serialNumber: z.string().nullish(),
  specifications: z.string().nullish(),
  notes: z.string().nullish(),
});

const toolInput = z.object({
  name: z.string().min(1),
  category: z.string().nullish(),
  unitPrice: z.string().nullish(),
  description: z.string().nullish(),
});

const transactionInput = z.object({
  clientId: z.number().int().positive(),
  type: z.enum(["purchase", "sharpening"]),
  description: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  amount: z.string().min(1), // decimal string
  status: z.enum(["paid", "pending", "overdue"]).default("pending"),
  transactionDate: z.date().optional(),
  notes: z.string().nullish(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  clients: router({
    list: adminProcedure
      .input(
        z.object({
          search: z.string().optional(),
          industry: z.string().optional(),
          activityLevel: z.string().optional(),
        }).optional()
      )
      .query(({ input }) => db.listClients(input?.search, input?.industry, input?.activityLevel)),
    get: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ input }) => db.getClientById(input.id)),
    create: adminProcedure.input(clientInput).mutation(({ input }) =>
      db.createClient({
        ...input,
        email: input.email === "" ? null : input.email,
      } as any)
    ),
    update: adminProcedure
      .input(z.object({ id: z.number().int().positive(), data: clientInput.partial() }))
      .mutation(({ input }) =>
        db.updateClient(input.id, {
          ...input.data,
          email: input.data.email === "" ? null : input.data.email,
        } as any)
      ),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await db.deleteClient(input.id);
        return { success: true };
      }),
    industries: adminProcedure.query(() => db.listIndustries()),
    stats: adminProcedure
      .input(z.object({ clientId: z.number().int().positive() }))
      .query(({ input }) => db.getClientStats(input.clientId)),

    /**
     * All clients + their coordinates, for the Maps page. Clients without
     * coords are still returned so the UI can offer a "geocode" action.
     */
    withCoords: adminProcedure.query(() => db.listClientsWithCoords()),

    /**
     * Geocode every client that doesn't yet have coordinates. Returns a
     * summary of how many were resolved vs left behind for manual review.
     */
    geocodeMissing: adminProcedure
      .input(z.object({ limit: z.number().int().positive().max(500).optional() }).optional())
      .mutation(async ({ input }) => {
        const all = await db.listClientsWithCoords();
        const pending = all.filter((c) => c.latitude == null || c.longitude == null);
        const targets = input?.limit ? pending.slice(0, input.limit) : pending;
        let resolved = 0;
        const unresolved: Array<{ id: number; companyName: string; address: string | null }> = [];
        for (const c of targets) {
          const hit = await geocodeClient({
            companyName: c.companyName,
            address: c.address,
          });
          if (hit) {
            await db.setClientCoords(c.id, {
              lat: hit.lat,
              lng: hit.lng,
              source: "google",
            });
            resolved += 1;
          } else {
            unresolved.push({
              id: c.id,
              companyName: c.companyName,
              address: c.address,
            });
          }
        }
        return { attempted: targets.length, resolved, unresolved };
      }),

    /**
     * Manual override — used when the Google geocoder can't resolve a
     * vague address and we set a researched location by hand.
     */
    setCoords: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          lat: z.number().gte(-90).lte(90),
          lng: z.number().gte(-180).lte(180),
          source: z.enum(["google", "manual", "research"]).default("manual"),
        })
      )
      .mutation(async ({ input }) => {
        await db.setClientCoords(input.id, {
          lat: input.lat,
          lng: input.lng,
          source: input.source,
        });
        return { success: true };
      }),

    spending: adminProcedure
      .input(z.object({ clientId: z.number().int().positive() }))
      .query(({ input }) => db.getClientSpendingAnalysis(input.clientId)),

    monthlyTrend: adminProcedure
      .input(z.object({ clientId: z.number().int().positive() }))
      .query(({ input }) => db.getClientMonthlyTrend(input.clientId)),
  }),

  machines: router({
    listByClient: adminProcedure
      .input(z.object({ clientId: z.number().int().positive() }))
      .query(({ input }) => db.listMachinesByClient(input.clientId)),
    create: adminProcedure.input(machineInput).mutation(({ input }) => db.createMachine(input as any)),
    update: adminProcedure
      .input(z.object({ id: z.number().int().positive(), data: machineInput.partial() }))
      .mutation(({ input }) => db.updateMachine(input.id, input.data as any)),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await db.deleteMachine(input.id);
        return { success: true };
      }),
  }),

  tools: router({
    list: adminProcedure.query(() => db.listTools()),
    listWithStats: adminProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(({ input }) => db.listToolsWithStats(input?.search)),
    create: adminProcedure.input(toolInput).mutation(({ input }) => db.createTool(input as any)),
    update: adminProcedure
      .input(z.object({ id: z.number().int().positive(), data: toolInput.partial() }))
      .mutation(({ input }) => db.updateTool(input.id, input.data as any)),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await db.deleteTool(input.id);
        return { success: true };
      }),
  }),

  clientTools: router({
    listByClient: adminProcedure
      .input(z.object({ clientId: z.number().int().positive() }))
      .query(({ input }) => db.listClientTools(input.clientId)),
    create: adminProcedure
      .input(
        z.object({
          clientId: z.number().int().positive(),
          toolId: z.number().int().positive(),
          machineId: z.number().int().positive().nullish(),
          usageFrequency: z.enum(["daily", "weekly", "monthly", "occasional"]).default("monthly"),
          notes: z.string().nullish(),
        })
      )
      .mutation(({ input }) => db.createClientTool(input as any)),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await db.deleteClientTool(input.id);
        return { success: true };
      }),
  }),

  transactions: router({
    list: adminProcedure
      .input(
        z
          .object({
            clientId: z.number().int().positive().optional(),
            type: z.enum(["purchase", "sharpening"]).optional(),
            status: z.enum(["paid", "pending", "overdue"]).optional(),
            search: z.string().optional(),
            limit: z.number().int().positive().optional(),
          })
          .optional()
      )
      .query(({ input }) => db.listTransactions(input)),
    create: adminProcedure.input(transactionInput).mutation(({ input }) =>
      db.createTransaction({
        ...input,
        transactionDate: input.transactionDate ?? new Date(),
      } as any)
    ),
    update: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          data: transactionInput.partial(),
        })
      )
      .mutation(({ input }) => db.updateTransaction(input.id, input.data as any)),
    delete: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await db.deleteTransaction(input.id);
        return { success: true };
      }),
  }),

  inventory: router({
    status: adminProcedure.query(async () => {
      const configured = isManagerConfigured();
      if (!configured) {
        return { configured: false, reachable: false, businessName: null, baseUrl: null } as const;
      }
      const baseUrl = (process.env.MANAGER_API_URL ?? "").replace(/\/+$/, "");
      try {
        const businessName = await pingBusinessName({ forceRefresh: true });
        return { configured: true, reachable: true, businessName, baseUrl } as const;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { configured: true, reachable: false, businessName: null, baseUrl, error: msg } as const;
      }
    }),
    listItems: adminProcedure
      .input(z.object({ forceRefresh: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        try {
          const res = await fetchAllInventoryItems({ forceRefresh: input?.forceRefresh ?? false });
          return {
            businessName: res.business.name,
            totalRecords: res.totalRecords,
            items: res.items.map((it) => ({
              key: it.key,
              itemCode: it.itemCode ?? "",
              itemName: it.itemName,
              description: it.description ?? "",
              purchasePrice: it.purchasePrice?.value ?? 0,
              averageCost: it.averageCost?.value ?? null,
              qtyOwned: it.qtyOwned ?? 0,
              totalValue: it.totalCost?.value ?? 0,
              currency: it.purchasePrice?.currency ?? "AED",
            })),
          };
        } catch (err) {
          if (err instanceof ManagerConfigError) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: err.message });
          }
          if (err instanceof ManagerApiError) {
            throw new TRPCError({
              code: "BAD_GATEWAY",
              message: `Manager.io returned ${err.status}. Is Manager.io running and the tunnel up?`,
            });
          }
          throw err;
        }
      }),
    listCustomers: adminProcedure
      .input(z.object({ forceRefresh: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        try {
          const res = await fetchAllCustomers({ forceRefresh: input?.forceRefresh ?? false });
          return {
            businessName: res.business.name,
            totalRecords: res.totalRecords,
            customers: res.customers.map((c) => ({
              key: c.key,
              code: c.code,
              name: c.name,
              accountsReceivable: c.accountsReceivable?.value ?? 0,
              status: c.status ?? null,
            })),
          };
        } catch (err) {
          if (err instanceof ManagerConfigError) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: err.message });
          }
          if (err instanceof ManagerApiError) {
            throw new TRPCError({
              code: "BAD_GATEWAY",
              message: `Manager.io returned ${err.status}. Is Manager.io running and the tunnel up?`,
            });
          }
          throw err;
        }
      }),
  }),

  dashboardSync: router({
    import: adminProcedure
      .input(
        z.object({
          fileBase64: z.string().min(1),
          fileName: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const buf = Buffer.from(input.fileBase64, "base64");
        if (buf.byteLength < 100) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Uploaded file is empty or corrupted.",
          });
        }
        try {
          const { importDashboardWorkbook } = await import("./dashboardImport");
          const summary = await importDashboardWorkbook(buf, {
            fileName: input.fileName,
          });
          return summary;
        } catch (err) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err instanceof Error ? err.message : "Failed to import workbook",
          });
        }
      }),
  }),

  financial: router({
    /**
     * Portfolio-wide roll-up used by the Dashboard KPI cards. Always computed
     * live from Manager.io so Outstanding / Paid / This-month totals match
     * the sum of every client's Statement of Account to the AED.
     */
    portfolioTotals: adminProcedure
      .input(z.object({ forceRefresh: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        try {
          return await computePortfolioTotals({ forceRefresh: input?.forceRefresh });
        } catch (e) {
          if (e instanceof ManagerConfigError) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: e.message });
          }
          if (e instanceof ManagerApiError) {
            throw new TRPCError({ code: "BAD_GATEWAY", message: e.message });
          }
          throw e;
        }
      }),
    clientStatement: adminProcedure
      .input(z.object({ clientId: z.number().int().positive() }))
      .query(async ({ input }) => {
        // Fast Excel-based Statement of Account - no Manager.io calls
        const client = await db.getClientById(input.clientId);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });
        
        const transactions = await db.getTransactionsByClient(input.clientId);
        const totalBilled = transactions.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
        const outstanding = typeof client.outstandingBalance === 'string' 
          ? parseFloat(client.outstandingBalance) 
          : (client.outstandingBalance ?? 0);
        const paid = totalBilled - outstanding;
        
        return {
          client,
          totalBilled: +totalBilled.toFixed(2),
          paid: +paid.toFixed(2),
          outstanding: +outstanding.toFixed(2),
          invoiceCount: transactions.length > 0 
            ? new Set(transactions.map((t: any) => t.invoiceNumber)).size 
            : 0,
        };
      }),
    clientsWithOutstanding: adminProcedure
      .query(async () => {
        return db.getClientsWithOutstanding();
      }),
    allClientTotals: adminProcedure
      .input(z.object({ forceRefresh: z.boolean().optional() }).optional())
      .query(async () => {
        // Fully local — computed from imported workbook data (transactions + clients.outstandingBalance)
        const totals = await db.getLocalClientTotals();
        return { totals, vatRate: 0.05 };
      }),
  }),

  analytics: router({
    kpis: adminProcedure.query(() => db.getDashboardKpisV2()),
    monthlyRevenue: adminProcedure
      .input(z.object({ monthsBack: z.number().int().positive().optional() }).optional())
      .query(({ input }) => db.getMonthlyRevenueV2(input?.monthsBack ?? 12)),
    topClients: adminProcedure
      .input(z.object({ limit: z.number().int().positive().optional() }).optional())
      .query(({ input }) => db.getTopClientsV2(input?.limit ?? 5)),
    clientsWithInvoice: adminProcedure.query(() => db.getClientsWithLastInvoice()),
    overdueClients: adminProcedure.query(() => db.getOverdueClients()),
    topPerformers: adminProcedure
      .input(z.object({ limit: z.number().int().positive().optional() }).optional())
      .query(({ input }) => db.getTopPerformers(input?.limit ?? 10)),
    receivablesAging: adminProcedure.query(() => db.getReceivablesAging()),
    quickStats: adminProcedure.query(() => db.getQuickStats()),
    profitabilityTrend: adminProcedure
      .input(z.object({ monthsBack: z.number().int().positive().optional() }).optional())
      .query(({ input }) => db.getProfitabilityTrend(input?.monthsBack ?? 12)),
    inventoryIntelligence: adminProcedure.query(() => db.getInventoryIntelligence()),
  }),

  operatingCost: router({
    /** High-level summary: totals + by category + by month + pivot. */
    summary: adminProcedure.query(() => db.getOperatingCostSummary()),
    /** Drill-down list of individual operating-cost rows with filters. */
    list: adminProcedure
      .input(
        z
          .object({
            category: z.string().optional(),
            month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
            search: z.string().optional(),
            limit: z.number().int().positive().max(1000).optional(),
          })
          .optional(),
      )
      .query(({ input }) => db.listOperatingCostRows(input)),
    /** Net Profit feed (Revenue / Gross / Operating / Net) for the Dashboard. */
    netProfit: adminProcedure.query(() => db.getNetProfitFeed()),
    /** Period-aware Dashboard KPIs (year + optional month; both omitted = all-time). */
    byPeriod: adminProcedure
      .input(
        z
          .object({
            year: z.number().int().min(2000).max(2100).optional(),
            month: z.number().int().min(1).max(12).optional(),
          })
          .optional()
      )
      .query(({ input }) => db.getDashboardByPeriod(input)),
  }),

  stockHistory: router({
    /** Search clients by company name (substring, case-insensitive). */
    searchClients: adminProcedure
      .input(z.object({ query: z.string().default(""), limit: z.number().int().positive().max(50).optional() }))
      .query(({ input }) => db.searchClientsForStockHistory(input.query, input.limit ?? 25)),
    /** List items purchased by a specific client (with optional flexible substring filter). */
    itemsByClient: adminProcedure
      .input(z.object({ clientId: z.number().int().positive(), search: z.string().optional() }))
      .query(({ input }) => db.getItemsByClient(input.clientId, input.search)),
    /** Full purchase history (every Fact Sales row) for a (client, item) pair. */
    itemPurchases: adminProcedure
      .input(z.object({ clientId: z.number().int().positive(), itemName: z.string().min(1) }))
      .query(({ input }) => db.getItemPurchaseHistory(input.clientId, input.itemName)),
  }),

  invoices: router({
    /** Search invoices by number (substring, case-insensitive). Returns per-invoice P&L summary. */
    search: adminProcedure
      .input(z.object({ query: z.string().default(""), limit: z.number().int().positive().max(500).optional() }))
      .query(({ input }) => db.searchInvoices(input.query, { limit: input.limit ?? 500 })),
    /** Full line-item detail + P&L for a specific invoice number. */
    detail: adminProcedure
      .input(z.object({ invoiceNumber: z.string().min(1) }))
      .query(({ input }) => db.getInvoiceDetail(input.invoiceNumber)),
  }),

});

export type AppRouter = typeof appRouter;
