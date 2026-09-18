/**
 * POST /api/dashboard/sync-excel
 *
 * Accepts the Videa Master Dashboard workbook as a binary upload and runs the
 * full unified import (clients, transactions, item IDs, balances, operating
 * costs) so the CRM stays in sync with the Excel file with zero manual UI work.
 *
 * Designed to be called from a Windows scheduled task / PowerShell watcher
 * that re-uploads the file every time it changes on disk, e.g.:
 *
 *   curl.exe -sS -X POST "$BASE/api/dashboard/sync-excel" `
 *     -H "X-Sync-Secret: $env:TUNNEL_UPDATER_SECRET" `
 *     --data-binary "@C:\path\Videa-Master-Dashboard.xlsx"
 *
 * Security: caller must present `TUNNEL_UPDATER_SECRET` as `Authorization:
 * Bearer <secret>` or as the `X-Sync-Secret` header. We deliberately reuse the
 * existing tunnel-updater secret so users don't have to manage another key.
 *
 * Body: raw binary `.xlsx` (octet-stream) OR JSON `{ "fileBase64": "..." }`.
 */
import type { Express, Request, Response } from "express";
import { importDashboardWorkbook } from "./dashboardImport";
import { getDb } from "./db";
import { syncState } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB hard cap

function readSecret(req: Request): string {
  const auth = req.headers.authorization ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const x = req.headers["x-sync-secret"];
  if (typeof x === "string") return x.trim();
  return "";
}

async function readRawBody(req: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BYTES) {
        req.destroy();
        reject(new Error("Workbook exceeds 25 MB limit"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function registerExcelSyncEndpoint(app: Express) {
  // Lightweight status endpoint — lets the dashboard show "Last sync 5s ago" without
  // re-uploading the workbook. Public (read-only) so any browser tab can ping it.
  app.get("/api/dashboard/sync-status", async (_req: Request, res: Response) => {
    try {
      const db = await getDb();
      if (!db) {
        res.json({ ok: true, lastSyncAt: null, fileHash: null, fileName: null });
        return;
      }
      const [row] = await db
        .select()
        .from(syncState)
        .where(eq(syncState.source, "dashboard"))
        .limit(1);
      if (!row) {
        res.json({ ok: true, lastSyncAt: null, fileHash: null, fileName: null });
        return;
      }
      let summary: unknown = null;
      try {
        summary = row.summaryJson ? JSON.parse(row.summaryJson) : null;
      } catch {
        summary = null;
      }
      res.json({
        ok: true,
        lastSyncAt: row.lastSyncAt,
        fileHash: row.fileHash,
        fileName: row.fileName,
        summary,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post("/api/dashboard/sync-excel", async (req: Request, res: Response) => {
    const t0 = Date.now();
    try {
      const expected = process.env.TUNNEL_UPDATER_SECRET;
      if (!expected) {
        res.status(501).json({
          ok: false,
          error:
            "TUNNEL_UPDATER_SECRET is not configured on the server. Ask the workspace owner to set it.",
        });
        return;
      }
      const provided = readSecret(req);
      if (!provided || provided !== expected) {
        res.status(401).json({ ok: false, error: "Invalid or missing sync secret" });
        return;
      }

      // Accept either raw binary or JSON {fileBase64}
      let buffer: Buffer | null = null;
      const contentType = (req.headers["content-type"] ?? "").toLowerCase();
      if (contentType.includes("application/json")) {
        const body = (req.body ?? {}) as { fileBase64?: unknown };
        if (typeof body.fileBase64 === "string" && body.fileBase64.length > 0) {
          buffer = Buffer.from(body.fileBase64, "base64");
        } else {
          res
            .status(400)
            .json({ ok: false, error: "JSON body must include 'fileBase64'" });
          return;
        }
      } else {
        // Raw octet-stream / xlsx
        buffer = await readRawBody(req);
      }

      if (!buffer || buffer.length < 100) {
        res.status(400).json({ ok: false, error: "Empty or invalid workbook" });
        return;
      }

      const fileName =
        (typeof req.headers["x-file-name"] === "string"
          ? (req.headers["x-file-name"] as string)
          : undefined) || undefined;
      const summary = await importDashboardWorkbook(buffer, { fileName });
      const elapsedMs = Date.now() - t0;
      console.log(
        `[excelSync] ${summary.cached ? "cache-hit" : "rebuilt"} workbook in ${elapsedMs}ms — clients=${summary.clients} transactions=${summary.transactions} operatingCostRows=${summary.operatingCostsRows}`
      );
      res.json({
        ok: true,
        elapsedMs,
        summary,
        receivedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[excelSync] Failed:", msg);
      res.status(500).json({ ok: false, error: msg });
    }
  });
}
