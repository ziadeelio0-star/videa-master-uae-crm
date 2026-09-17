import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  PanelLeft,
  Receipt,
  Coins,
  Settings as SettingsIcon,
  Users,
  Wallet,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import CommandPalette from "./CommandPalette";

const COMPANY_NAME = "Videa Master Pro Tools Trading LLC";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Users, label: "Clients", path: "/clients" },
  { icon: Wallet, label: "Receivables", path: "/receivables" },
  { icon: Receipt, label: "Transactions", path: "/transactions" },
  { icon: FileText, label: "Invoices", path: "/invoices" },
  { icon: History, label: "Stock History", path: "/stock-history" },
  { icon: Coins, label: "Operating Cost", path: "/operating-cost" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: MapIcon, label: "Map", path: "/map" },
  { icon: SettingsIcon, label: "Settings", path: "/settings" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="min-h-screen flex">
        {/* Left brand column */}
        <div className="hidden lg:flex flex-col justify-between w-1/2 bg-sidebar text-sidebar-foreground p-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
               style={{
                 backgroundImage:
                   "repeating-linear-gradient(0deg, transparent 0 22px, rgba(255,255,255,0.5) 22px 23px)",
               }}
          />
          <div className="relative z-10 flex flex-col gap-10">
            {/* Full 3SSS logo — transparent PNG on dark panel */}
            <div className="flex items-center">
              <img
                src="/manus-storage/videa-3sss-fulllogo_1c41c034.png"
                alt="3S Safe Simple Strong"
                className="h-24 w-auto object-contain drop-shadow-lg"
              />
            </div>
            <div>
              <p className="text-xs tracking-[0.35em] text-sidebar-foreground/60 uppercase mb-4">
                Internal Management System
              </p>
              <h1 className="font-display text-5xl leading-[1.05] tracking-tight">
                {COMPANY_NAME}
              </h1>
              <span className="vm-rule mt-8 bg-primary" />
              <p className="mt-6 text-lg text-sidebar-foreground/80 max-w-lg italic">
                "At Videa Master Pro, we don't just supply tools — we engineer precision."
              </p>
            </div>
          </div>
          <p className="relative z-10 text-xs text-sidebar-foreground/50 tracking-widest uppercase">
            Safe · Simple · Strong
          </p>
        </div>

        {/* Right sign-in panel */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="flex lg:hidden items-center gap-3 mb-10">
              <img
                src="/manus-storage/videa-3sss-fulllogo_1c41c034.png"
                alt="3S Safe Simple Strong"
                className="h-10 w-auto object-contain"
              />
              <span className="font-display text-xl">Videa Master Pro</span>
            </div>
            <p className="text-xs tracking-[0.3em] text-muted-foreground uppercase">Welcome back</p>
            <h2 className="font-display text-4xl mt-3 mb-2">Sign in to continue</h2>
            <p className="text-muted-foreground mb-8">
              This workspace is restricted to {COMPANY_NAME} team members and approved
              administrators only.
            </p>
            <Button
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
              size="lg"
              className="w-full h-12 text-base shadow-lg hover:shadow-xl transition-all"
            >
              Sign in with Manus
            </Button>
            <p className="mt-10 text-xs text-muted-foreground">
              © {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="h-16 w-16 mx-auto mb-6 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <span className="font-display text-2xl text-primary">3S</span>
          </div>
          <h1 className="font-display text-3xl mb-3">Access restricted</h1>
          <p className="text-muted-foreground mb-6">
            Your account does not have access to the {COMPANY_NAME} internal system. Please
            contact the administrator if you believe this is a mistake.
          </p>
          <Button variant="outline" onClick={() => window.location.assign("/")}>
            Return home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const activeMenuItem =
    menuItems.find((item) => item.path === location) ??
    menuItems.find((item) => item.path !== "/" && location.startsWith(item.path));

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-auto py-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2 px-2 w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/70" />
              </button>
              {!isCollapsed && (
                <div
                  className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden"
                  title={COMPANY_NAME}
                >
                  <div className="h-9 w-9 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                    <span className="font-display text-[15px] leading-none text-primary">3S</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-[13px] leading-tight text-sidebar-foreground truncate">
                      Videa Master Pro
                    </p>
                    <p className="text-[9px] tracking-[0.18em] uppercase text-sidebar-foreground/55 mt-0.5 truncate">
                      Tools Trading LLC
                    </p>
                  </div>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 pt-3">
            <div className="px-5 mb-2 text-[10px] tracking-[0.25em] uppercase text-sidebar-foreground/45 group-data-[collapsible=icon]:hidden">
              Workspace
            </div>
            <SidebarMenu className="px-2 py-1">
              {menuItems.map((item) => {
                const isActive =
                  location === item.path ||
                  (item.path !== "/" && location.startsWith(item.path));
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-sidebar-border space-y-3">
            {/* 3·S — product brand co-credit */}
            <div className="flex items-center gap-2 px-1 group-data-[collapsible=icon]:justify-center">
              <div className="flex-shrink-0 h-9 w-9 rounded-md bg-primary/15 border border-primary/30 grid place-items-center">
                <span className="font-display text-[13px] leading-none text-primary">3S</span>
              </div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="text-[11px] font-display leading-tight text-sidebar-foreground/90">
                  3·S Cutting Tools
                </p>
                <p className="text-[9px] tracking-[0.18em] uppercase text-sidebar-foreground/55 mt-0.5">
                  Safe · Simple · Strong
                </p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-sidebar-accent/60 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
                  <Avatar className="h-9 w-9 border border-sidebar-border shrink-0">
                    <AvatarFallback className="text-xs font-semibold bg-primary/15 text-primary">
                      {user?.name?.charAt(0).toUpperCase() ?? "V"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">{user?.name || "-"}</p>
                    <p className="text-xs text-sidebar-foreground/60 truncate mt-1.5">
                      {user?.email || "Administrator"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="font-display tracking-tight text-foreground">
                {activeMenuItem?.label ?? "Videa Master Pro"}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1">{children}</main>
        <CommandPalette />
      </SidebarInset>
    </>
  );
}
