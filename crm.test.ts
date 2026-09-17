import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeCtx(role: "admin" | "user" = "admin"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-admin",
    email: "admin@videamaster.ae",
    name: "Test Admin",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

describe("CRM — analytics and client procedures", () => {
  it("returns real KPIs reflecting the seeded company data", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const kpis = await caller.analytics.kpis();

    expect(typeof kpis.totalRevenue).toBe("number");
    expect(typeof kpis.outstanding).toBe("number");
    expect(typeof kpis.monthlyRevenue).toBe("number");
    expect(kpis.activeClients).toBeGreaterThan(0);
    // We seeded 76 clients from the company dashboard
    expect(kpis.activeClients).toBeGreaterThanOrEqual(70);
  });

  it("produces monthly revenue split by type", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const rows = await caller.analytics.monthlyRevenue({ monthsBack: 24 });
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((r) => {
      expect(r).toHaveProperty("month");
      expect(["purchase", "sharpening"]).toContain(r.type);
      expect(typeof r.total).toBe("number");
    });
  });

  it("returns top clients ranked by revenue", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const top = await caller.analytics.topClients({ limit: 5 });
    expect(top.length).toBeGreaterThan(0);
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].total).toBeGreaterThanOrEqual(top[i].total);
    }
  });

  it("lists clients and supports case-insensitive, tokenised search", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const all = await caller.clients.list();
    expect(all.length).toBeGreaterThan(0);

    // Pick a client whose name has a middle token we can stress-test with.
    const target = all.find((c) => c.companyName.toLowerCase().includes("khansaheb"))
      ?? all[0];
    const sample = target.companyName.slice(0, 5);

    // 1) substring
    const filtered = await caller.clients.list({ search: sample });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((c) => c.id === target.id)).toBe(true);

    // 2) the same query in lowercase must also match (case-insensitive)
    const lower = await caller.clients.list({ search: sample.toLowerCase() });
    expect(lower.some((c) => c.id === target.id)).toBe(true);

    // 3) the same query in uppercase must also match
    const upper = await caller.clients.list({ search: sample.toUpperCase() });
    expect(upper.some((c) => c.id === target.id)).toBe(true);

    // 4) Multi-token search: every space-separated token must be present (AND).
    //    We take the first two words of the target name and re-search.
    const firstTwoWords = target.companyName.split(/\s+/).slice(0, 2).join(" ").toLowerCase();
    if (firstTwoWords.includes(" ")) {
      const multi = await caller.clients.list({ search: firstTwoWords });
      expect(multi.some((c) => c.id === target.id)).toBe(true);
    }

    // 5) nonsense query returns zero matches (not the full list)
    const none = await caller.clients.list({ search: "zzzzzzzzzzz" });
    expect(none.length).toBe(0);
  });

  it("returns per-client stats with monthly breakdown", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const top = await caller.analytics.topClients({ limit: 1 });
    expect(top.length).toBe(1);

    const stats = await caller.clients.stats({ clientId: top[0].clientId });
    expect(stats).toHaveProperty("totalSpend");
    expect(stats).toHaveProperty("outstanding");
    expect(stats).toHaveProperty("monthly");
    expect(Array.isArray(stats.monthly)).toBe(true);
  });

  it("creates, lists, and deletes a client with full round-trip", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const suffix = Date.now().toString();
    const created = await caller.clients.create({
      companyName: `Vitest Client ${suffix}`,
      contactPerson: "QA",
      email: `qa+${suffix}@videamaster.ae`,
      phone: null,
      address: null,
      industry: "Wood",
      activityLevel: "medium",
      notes: null,
    });
    expect(created.id).toBeGreaterThan(0);

    const fetched = await caller.clients.get({ id: created.id });
    expect(fetched?.companyName).toBe(`Vitest Client ${suffix}`);

    const deleted = await caller.clients.delete({ id: created.id });
    expect(deleted).toEqual({ success: true });

    const afterDelete = await caller.clients.get({ id: created.id });
    expect(afterDelete).toBeFalsy();
  });

  it("rejects non-admin users for protected procedures", async () => {
    const caller = appRouter.createCaller(makeCtx("user"));
    await expect(caller.clients.list()).rejects.toThrow();
  });
});

describe("CRM — full CRUD round-trip for machines, tools, clientTools and transactions", () => {
  it("performs end-to-end CRUD across all related entities", { timeout: 30_000 }, async () => {
    const caller = appRouter.createCaller(makeCtx());
    const suffix = Date.now().toString();

    // 1. Create a client to attach everything to
    const client = await caller.clients.create({
      companyName: `CRUD Test ${suffix}`,
      contactPerson: "QA",
      email: null,
      phone: null,
      address: null,
      industry: "Wood",
      activityLevel: "high",
      notes: null,
    });
    expect(client.id).toBeGreaterThan(0);

    try {
      // 2. Machine CRUD
      const machine = await caller.machines.create({
        clientId: client.id,
        machineType: "CNC Router",
        brand: "SCM",
        model: "Morbidelli X200",
        serialNumber: `SN-${suffix}`,
        specifications: "5-axis",
        notes: null,
      });
      expect(machine.id).toBeGreaterThan(0);

      await caller.machines.update({
        id: machine.id,
        data: { model: "Morbidelli X200 Pro" },
      });
      const machines = await caller.machines.listByClient({ clientId: client.id });
      expect(machines.some((m) => m.id === machine.id && m.model === "Morbidelli X200 Pro")).toBe(
        true
      );

      // 3. Tool CRUD
      const tool = await caller.tools.create({
        name: `QA Saw Blade ${suffix}`,
        category: "Saw Blade",
        unitPrice: "150.00",
        description: "QA test tool",
      });
      expect(tool.id).toBeGreaterThan(0);

      await caller.tools.update({
        id: tool.id,
        data: { unitPrice: "175.00" },
      });

      // 4. ClientTool link CRUD
      const link = await caller.clientTools.create({
        clientId: client.id,
        toolId: tool.id,
        machineId: machine.id,
        usageFrequency: "weekly",
        notes: "Primary blade",
      });
      expect(link.id).toBeGreaterThan(0);

      const clientToolsList = await caller.clientTools.listByClient({ clientId: client.id });
      expect(clientToolsList.some((ct) => ct.id === link.id)).toBe(true);

      // 5. Transaction CRUD
      const tx = await caller.transactions.create({
        clientId: client.id,
        type: "purchase",
        description: "QA purchase",
        quantity: 3,
        amount: "525.00",
        status: "pending",
        notes: null,
      });
      expect(tx.id).toBeGreaterThan(0);

      await caller.transactions.update({
        id: tx.id,
        data: { status: "paid" },
      });

      const txList = await caller.transactions.list({ clientId: client.id });
      expect(txList.some((t) => t.id === tx.id && t.status === "paid")).toBe(true);

      await caller.transactions.delete({ id: tx.id });
      await caller.clientTools.delete({ id: link.id });
      await caller.machines.delete({ id: machine.id });
      await caller.tools.delete({ id: tool.id });
    } finally {
      await caller.clients.delete({ id: client.id });
    }
  });
});
