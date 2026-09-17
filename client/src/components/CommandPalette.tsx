import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Search,
  LayoutDashboard,
  Users,
  Wallet,
  Receipt,
  FileText,
  History,
  BarChart3,
  Map as MapIcon,
  Settings as SettingsIcon,
  CornerDownLeft,
  Building2,
  AlertTriangle,
  RefreshCw,
  Plus,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";

type Command = {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  group: "Navigation" | "Clients" | "Actions";
  onSelect: () => void;
  keywords?: string;
};

const PAGES: Array<Omit<Command, "onSelect"> & { path: string }> = [
  { id: "page-dashboard", label: "Dashboard", description: "Executive overview", icon: <LayoutDashboard className="w-4 h-4" />, group: "Navigation", path: "/" },
  { id: "page-clients", label: "Clients", description: "Client portfolio", icon: <Users className="w-4 h-4" />, group: "Navigation", path: "/clients" },
  { id: "page-receivables", label: "Receivables", description: "Outstanding balances", icon: <Wallet className="w-4 h-4" />, group: "Navigation", path: "/receivables" },
  { id: "page-transactions", label: "Transactions", description: "Accounting ledger", icon: <Receipt className="w-4 h-4" />, group: "Navigation", path: "/transactions" },
  { id: "page-invoices", label: "Invoices", description: "Per-invoice P&L explorer", icon: <FileText className="w-4 h-4" />, group: "Navigation", path: "/invoices", keywords: "invoice profit margin markup cogs" },
  { id: "page-stock-history", label: "Stock History", description: "Per-client purchase history & unit prices", icon: <History className="w-4 h-4" />, group: "Navigation", path: "/stock-history" },
  { id: "page-analytics", label: "Analytics", description: "Business intelligence", icon: <BarChart3 className="w-4 h-4" />, group: "Navigation", path: "/analytics" },
  { id: "page-map", label: "Map", description: "Client geography", icon: <MapIcon className="w-4 h-4" />, group: "Navigation", path: "/map" },
  { id: "page-settings", label: "Settings", description: "Configuration & sync", icon: <SettingsIcon className="w-4 h-4" />, group: "Navigation", path: "/settings" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [, navigate] = useLocation();

  const clients = trpc.clients.list.useQuery({}, { enabled: open });

  // Global hotkey: Cmd/Ctrl + K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const commands = useMemo<Command[]>(() => {
    const navCommands: Command[] = PAGES.map((p) => ({
      id: p.id,
      label: p.label,
      description: p.description,
      icon: p.icon,
      group: "Navigation",
      onSelect: () => {
        navigate(p.path);
        setOpen(false);
      },
    }));

    const clientCommands: Command[] = (clients.data ?? []).slice(0, 50).map((c) => ({
      id: `client-${c.id}`,
      label: c.companyName,
      description: c.contactPerson
        ? `${c.contactPerson} • ${formatCurrency(Number(c.outstandingBalance ?? 0))} outstanding`
        : `${formatCurrency(Number(c.outstandingBalance ?? 0))} outstanding`,
      icon: <Building2 className="w-4 h-4" />,
      group: "Clients",
      keywords: `${c.companyName} ${c.contactPerson ?? ""} ${c.industry ?? ""}`.toLowerCase(),
      onSelect: () => {
        navigate(`/clients/${c.id}`);
        setOpen(false);
      },
    }));

    const actionCommands: Command[] = [
      {
        id: "action-new-client",
        label: "Add new client",
        description: "Open the clients page to register a company",
        icon: <Plus className="w-4 h-4" />,
        group: "Actions",
        keywords: "create add company customer",
        onSelect: () => {
          navigate("/clients?new=1");
          setOpen(false);
        },
      },
      {
        id: "action-overdue",
        label: "Review overdue clients",
        description: "Filter receivables to 60+ days bucket",
        icon: <AlertTriangle className="w-4 h-4" />,
        group: "Actions",
        keywords: "overdue critical aging collection",
        onSelect: () => {
          navigate("/receivables?bucket=critical");
          setOpen(false);
        },
      },
      {
        id: "action-sync",
        label: "Open sync settings",
        description: "Trigger or schedule the Excel → CRM sync",
        icon: <RefreshCw className="w-4 h-4" />,
        group: "Actions",
        keywords: "sync schedule excel manager refresh",
        onSelect: () => {
          navigate("/settings");
          setOpen(false);
        },
      },
      {
        id: "action-stock-history",
        label: "Open Stock History",
        description: "Search a client's past purchases and unit prices",
        icon: <History className="w-4 h-4" />,
        group: "Actions",
        keywords: "stock history purchases unit price item search",
        onSelect: () => {
          navigate("/stock-history");
          setOpen(false);
        },
      },
    ];

    return [...navCommands, ...actionCommands, ...clientCommands];
  }, [clients.data, navigate]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter((c) => {
      const haystack = `${c.label} ${c.description ?? ""} ${c.keywords ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [commands, query]);

  // Group filtered results
  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>();
    filtered.forEach((c) => {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const flatList = filtered;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(flatList.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = flatList[activeIndex];
      if (cmd) cmd.onSelect();
    }
  };

  if (!open) return null;

  let runningIdx = -1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
      style={{ background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(4px)" }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 vm-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to a page or search clients…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400"
          />
          <kbd className="text-[10px] font-mono px-2 py-0.5 rounded border border-slate-200 text-slate-500 bg-slate-50">
            ESC
          </kbd>
        </div>

        <div className="max-h-[400px] overflow-y-auto py-2">
          {flatList.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              No matches for "{query}"
            </div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} className="mb-2">
                <p className="px-5 pt-2 pb-1 text-[10px] font-semibold tracking-wider uppercase text-slate-400">
                  {group}
                </p>
                {items.map((cmd) => {
                  runningIdx += 1;
                  const isActive = runningIdx === activeIndex;
                  return (
                    <button
                      key={cmd.id}
                      onMouseEnter={() => {
                        const idx = flatList.findIndex((c) => c.id === cmd.id);
                        if (idx !== -1) setActiveIndex(idx);
                      }}
                      onClick={() => cmd.onSelect()}
                      className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                        isActive ? "bg-primary/8" : "hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isActive ? "bg-primary/15 text-primary" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {cmd.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{cmd.label}</p>
                        {cmd.description && (
                          <p className="text-xs text-slate-500 truncate">{cmd.description}</p>
                        )}
                      </div>
                      {isActive && (
                        <CornerDownLeft className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-2.5 border-t border-slate-100 bg-slate-50/60 text-[11px] text-slate-500">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="font-mono px-1.5 py-0.5 rounded border border-slate-200 bg-white">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono px-1.5 py-0.5 rounded border border-slate-200 bg-white">↵</kbd>
              open
            </span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono px-1.5 py-0.5 rounded border border-slate-200 bg-white">⌘ K</kbd>
            toggle
          </span>
        </div>
      </div>
    </div>
  );
}
