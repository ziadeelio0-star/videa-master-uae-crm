/**
 * Tests for the Maps-related client procedures.
 *
 * Covers:
 *   1. `clients.withCoords` returns every client, flagging those without
 *      lat/lng so the UI can show a `missing` counter.
 *   2. `clients.setCoords` persists coordinates and stamps the source.
 *
 * We run these against the live test DB, so we wrap everything in a
 * try/finally that restores the original coordinates afterwards.
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-admin",
      email: "admin@test.com",
      name: "Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("clients map procedures", () => {
  it("withCoords returns all clients and exposes lat/lng + source fields", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const rows = await caller.clients.withCoords();

    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);

    const first = rows[0]!;
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("companyName");
    expect(first).toHaveProperty("latitude");
    expect(first).toHaveProperty("longitude");
    expect(first).toHaveProperty("geocodeSource");
    // Performance-tier fields required by the Map UI
    expect(first).toHaveProperty("totalRevenue");
    expect(first).toHaveProperty("transactionCount");
    expect(first).toHaveProperty("lastTransactionAt");
    // Must be numbers (not SQL-driver strings) for the UI to compare.
    expect(typeof first.totalRevenue).toBe("number");
    expect(typeof first.transactionCount).toBe("number");
  });

  it("at least one client has paid revenue so the map shows non-dormant tiers", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const rows = await caller.clients.withCoords();
    const withRevenue = rows.filter((r) => (r.totalRevenue ?? 0) > 0);
    expect(withRevenue.length).toBeGreaterThan(0);
  });

  it("setCoords persists coordinates and stamps the source", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const rows = await caller.clients.withCoords();
    const target = rows.find((r) => r.latitude != null && r.longitude != null);
    expect(target, "expected at least one geocoded client to use as fixture").toBeTruthy();
    if (!target) return;

    const original = {
      lat: target.latitude!,
      lng: target.longitude!,
      source: (target.geocodeSource ?? "google") as "google" | "manual" | "research",
    };

    try {
      await caller.clients.setCoords({
        id: target.id,
        lat: 25.1234,
        lng: 55.6789,
        source: "manual",
      });
      const after = await caller.clients.withCoords();
      const updated = after.find((r) => r.id === target.id)!;
      expect(updated.latitude).toBeCloseTo(25.1234, 4);
      expect(updated.longitude).toBeCloseTo(55.6789, 4);
      expect(updated.geocodeSource).toBe("manual");
    } finally {
      // Restore so this test doesn't pollute the shared DB.
      await db.setClientCoords(target.id, {
        lat: original.lat,
        lng: original.lng,
        source: original.source,
      });
    }
  });
});
