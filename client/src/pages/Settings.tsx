import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/format";
import {
  CheckCircle2,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import SectionHeader from "@/components/SectionHeader";

type ImportSummary = {
  clients: number;
  tools: number;
  transactions: number;
  invoices: number;
  totalRevenue: number;
  totalCOGS?: number;
  grossProfit?: number;
  balancesUpdated?: number;
  operatingCostsRows?: number;
  operatingCostsTotal?: number;
  inventoryCostsTotal?: number;
  warnings: string[];
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  );
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
  });
}

export default function Settings() {
  const utils = trpc.useUtils();
  const importMutation = trpc.dashboardSync.import.useMutation();
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    setResult(null);
    setFileName(file.name);
    try {
      const base64 = await readAsBase64(file);
      const summary = await importMutation.mutateAsync({
        fileBase64: base64,
        fileName: file.name,
      });
      setResult(summary as ImportSummary);
      await Promise.all([
        utils.clients.list.invalidate(),
        utils.transactions.list.invalidate(),
        utils.tools.listWithStats.invalidate(),
        utils.analytics.kpis.invalidate(),
        utils.analytics.monthlyRevenue.invalidate(),
        utils.analytics.topClients.invalidate(),
        // Stock History + Operating Cost feeds — must refresh too
        (utils as any).stockHistory?.searchClients?.invalidate?.(),
        (utils as any).stockHistory?.itemsByClient?.invalidate?.(),
        (utils as any).operatingCost?.summary?.invalidate?.(),
        (utils as any).operatingCost?.byMonth?.invalidate?.(),
        (utils as any).operatingCost?.byCategory?.invalidate?.(),
        (utils as any).operatingCost?.netProfit?.invalidate?.(),
        (utils as any).receivables?.summary?.invalidate?.(),
      ]);
      toast.success(
        `Imported ${summary.clients} clients, ${summary.transactions} transactions.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
    }
  }

  return (
    <DashboardLayout>
      <div className="container py-8 space-y-8 max-w-4xl">
        <SectionHeader
          eyebrow="Configuration"
          title="Settings & Sync"
          description="Import your Excel dashboard to sync all client, tool, and transaction data to the CRM. Each import replaces the database with the latest data from your Excel file."
        />

        {/* Dashboard import */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="font-display text-xl flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Import Excel Dashboard
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload your Videa-Master-DashboardFinale.xlsx file to sync all data
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
              <p className="font-medium text-blue-900 mb-2">How it works</p>
              <ul className="text-blue-800 text-xs space-y-1 list-disc list-inside">
                <li>Select your Excel dashboard file</li>
                <li>Click "Import" to upload and sync</li>
                <li>All clients, tools, and transactions will be updated</li>
                <li>Dashboard and all pages will refresh automatically</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excel-file">Select Excel File</Label>
              <div className="flex gap-2">
                <Input
                  id="excel-file"
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) handleFile(file);
                  }}
                  disabled={importMutation.isPending}
                  className="cursor-pointer"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Upload Videa-Master-DashboardFinale.xlsx
              </p>
            </div>

            {fileName && (
              <div className="rounded-lg border border-muted bg-muted/50 p-3 text-sm">
                <p className="text-muted-foreground">
                  {importMutation.isPending ? "Importing..." : "Imported:"} <span className="font-medium">{fileName}</span>
                </p>
              </div>
            )}

            {result && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm space-y-2">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Import successful
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <Stat label="Clients" value={result.clients} />
                  <Stat label="Tools" value={result.tools} />
                  <Stat label="Transactions" value={result.transactions} />
                  <Stat label="Invoices" value={result.invoices} />
                  <Stat label="Revenue" value={formatCurrency(result.totalRevenue)} />
                  {result.grossProfit !== undefined && (
                    <Stat label="Gross Profit" value={formatCurrency(result.grossProfit)} />
                  )}
                  {result.balancesUpdated !== undefined && (
                    <Stat label="Balances refreshed" value={result.balancesUpdated} />
                  )}
                  {result.operatingCostsRows !== undefined && (
                    <Stat label="Operating cost rows" value={result.operatingCostsRows} />
                  )}
                  {result.operatingCostsTotal !== undefined && (
                    <Stat label="Operating cost" value={formatCurrency(result.operatingCostsTotal)} />
                  )}
                  {result.inventoryCostsTotal !== undefined && (
                    <Stat label="Inventory cost (excluded)" value={formatCurrency(result.inventoryCostsTotal)} />
                  )}
                </div>
                {result.warnings.length > 0 && (
                  <ul className="list-disc list-inside text-xs text-amber-700 mt-2">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {importMutation.isError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {importMutation.error?.message ?? "Something went wrong."}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Always-on Auto Sync */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Always-on Auto-Sync</CardTitle>
            <p className="text-sm text-muted-foreground">
              Keep the CRM in lock-step with your Dashboard Excel without ever opening this page.
              The CRM exposes a secure endpoint that re-imports the entire workbook (clients, transactions,
              Item IDs, balances, operating costs) in one atomic refresh.
            </p>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
              <div className="font-medium">Endpoint</div>
              <code className="block bg-background border rounded px-2 py-1 text-xs break-all">
                POST &lt;your-CRM-base&gt;/api/dashboard/sync-excel
              </code>
              <div className="text-xs text-muted-foreground">
                Headers: <code>X-Sync-Secret: &lt;your TUNNEL_UPDATER_SECRET&gt;</code><br/>
                Body: raw .xlsx (Content-Type: application/octet-stream)
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">One-time Windows setup (PowerShell + Task Scheduler)</h4>
              <p className="text-muted-foreground mb-3">
                Save this as <code className="bg-muted px-1.5 py-0.5 rounded text-xs">C:\Videa\sync-dashboard.ps1</code>{" "}
                and schedule it every 5 minutes (or on file change) — every save of your Excel file
                will then refresh the CRM automatically.
              </p>
              <pre className="bg-zinc-950 text-zinc-100 rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">
{`$Excel  = "C:\\Path\\To\\Videa-Master-Dashboard.xlsx"
$Base   = "https://YOUR-CRM-DOMAIN"
$Secret = "PASTE_YOUR_TUNNEL_UPDATER_SECRET_HERE"

curl.exe -sS -X POST "$Base/api/dashboard/sync-excel" \`
  -H "X-Sync-Secret: $Secret" \`
  -H "Content-Type: application/octet-stream" \`
  --data-binary "@$Excel"`}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                The endpoint returns a JSON summary: <code>clients</code>, <code>transactions</code>,
                <code>operatingCostsTotal</code>, <code>balancesUpdated</code>, etc. — perfect for logging.
              </p>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Or just click the button</h4>
              <p className="text-muted-foreground">
                Prefer manual control? The Dashboard header has a{" "}
                <span className="font-medium text-foreground">Sync from latest Excel</span> button that
                does the same thing in one click — pick the file, watch the live counters update.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
