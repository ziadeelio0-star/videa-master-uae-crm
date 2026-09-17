#!/usr/bin/env node
/**
 * Geocode every client in the DB. Prints a summary + the list of unresolved
 * clients so we can research their location online.
 */
import { listClientsWithCoords, setClientCoords } from "../server/db.ts";
import { geocodeClient } from "../server/geocode.ts";

const clients = await listClientsWithCoords();
const pending = clients.filter((c) => c.latitude == null || c.longitude == null);
console.log(`Geocoding ${pending.length} / ${clients.length} clients (skipping ${clients.length - pending.length} already resolved)\n`);

const unresolved = [];
let resolved = 0;

for (const c of pending) {
  process.stdout.write(`[${c.id}] ${c.companyName.slice(0, 50).padEnd(50)} → `);
  try {
    const hit = await geocodeClient({ companyName: c.companyName, address: c.address });
    if (hit) {
      await setClientCoords(c.id, { lat: hit.lat, lng: hit.lng, source: "google" });
      console.log(`OK  (${hit.lat.toFixed(4)}, ${hit.lng.toFixed(4)})`);
      resolved += 1;
    } else {
      console.log(`MISS  address="${c.address ?? ""}"`);
      unresolved.push(c);
    }
  } catch (e) {
    console.log(`ERR ${e instanceof Error ? e.message : e}`);
    unresolved.push(c);
  }
}

console.log(`\nResolved ${resolved} / ${pending.length}.`);
if (unresolved.length) {
  console.log("\nUnresolved:");
  for (const c of unresolved) {
    console.log(`  [${c.id}] ${c.companyName}  ::  ${c.address ?? "(no address)"}`);
  }
}
process.exit(0);
