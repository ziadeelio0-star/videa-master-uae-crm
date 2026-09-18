/**
 * /api/tunnel/update
 *
 * A tiny endpoint the Windows cloudflared-watcher can POST to whenever it
 * detects a fresh `https://xxxx.trycloudflare.com` URL. It updates
 * process.env.MANAGER_API_URL in-place for the running server so the next
 * Manager.io call uses the new URL. No restart required.
 *
 * Security: caller must provide `TUNNEL_UPDATER_SECRET` as a bearer token.
 *
 * Note: this only updates the in-memory value. The persistent platform
 * secret is updated separately by the owner in Settings → Secrets. A
 * small helper tRPC procedure also exposes the currently-active URL so
 * the UI can show it.
 */
import type { Express, Request, Response } from "express";
import { clearManagerCache } from "./manager";

export function registerTunnelUpdater(app: Express) {
  app.post("/api/tunnel/update", async (req: Request, res: Response) => {
    try {
      const expected = process.env.TUNNEL_UPDATER_SECRET;
      if (!expected) {
        res.status(501).json({ ok: false, error: "TUNNEL_UPDATER_SECRET not configured" });
        return;
      }
      const authHeader = req.headers.authorization ?? "";
      const provided = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : (req.headers["x-tunnel-secret"] as string | undefined)?.trim() ?? "";
      if (provided !== expected) {
        res.status(401).json({ ok: false, error: "Invalid or missing secret" });
        return;
      }

      const body = (req.body ?? {}) as { url?: unknown };
      const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
      if (!rawUrl) {
        res.status(400).json({ ok: false, error: "Missing 'url' in JSON body" });
        return;
      }
      let parsed: URL;
      try {
        parsed = new URL(rawUrl);
      } catch {
        res.status(400).json({ ok: false, error: "'url' is not a valid URL" });
        return;
      }
      if (parsed.protocol !== "https:") {
        res.status(400).json({ ok: false, error: "URL must use https://" });
        return;
      }
      // Accept either bare tunnel host (append /api2) or full /api2 URL.
      let finalBase: string;
      if (parsed.pathname === "" || parsed.pathname === "/") {
        finalBase = `${parsed.origin}/api2`;
      } else {
        finalBase = `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
      }

      process.env.MANAGER_API_URL = finalBase;
      clearManagerCache();
      console.log(`[tunnelUpdater] MANAGER_API_URL updated to ${finalBase}`);
      res.json({ ok: true, managerApiUrl: finalBase, receivedAt: new Date().toISOString() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: msg });
    }
  });
}
