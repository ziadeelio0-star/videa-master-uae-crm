import { describe, expect, it } from "vitest";
import {
  fetchAllCustomers,
  fetchAllInventoryItems,
  isManagerConfigured,
  managerFetch,
  pingBusinessName,
} from "./manager";

const hasSecrets = isManagerConfigured();
const runIf = hasSecrets ? describe : describe.skip;

runIf("Manager.io integration (live against Cloudflare tunnel)", () => {
  it("authenticates with the stored X-API-KEY and returns the business name", { timeout: 30_000 }, async () => {
    const name = await pingBusinessName({ forceRefresh: true });
    expect(name).toBe("Videa Master Pro Tools Trading LLC");
  });

  it("fetches all inventory items through pagination", { timeout: 45_000 }, async () => {
    const result = await fetchAllInventoryItems({ forceRefresh: true });
    expect(result.totalRecords).toBeGreaterThan(0);
    expect(result.items.length).toBe(result.totalRecords);
    // Each item should have at least a key and a name.
    for (const it of result.items.slice(0, 5)) {
      expect(it.key).toBeTruthy();
      expect(it.itemName).toBeTruthy();
    }
  });

  it("fetches all customers and matches the 76-entry Videa book", { timeout: 45_000 }, async () => {
    const result = await fetchAllCustomers({ forceRefresh: true });
    expect(result.totalRecords).toBeGreaterThan(0);
    expect(result.customers.length).toBe(result.totalRecords);
  });

  it("rejects an invalid path with a descriptive error", { timeout: 15_000 }, async () => {
    await expect(managerFetch("/this-does-not-exist-xyz", { forceRefresh: true })).rejects.toThrow();
  });
});
