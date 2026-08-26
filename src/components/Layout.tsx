import { NavLink, useLocation, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Users,
  Receipt,
  Wallet,
  Landmark,
  Truck,
  Hammer,
  Wrench,
  ShoppingBag,
  TrendingUp,
  ShoppingCart,
  BarChart3,
  Menu,
  ClipboardList,
  BookOpen,
  AlertCircle,
  BellRing,
  Store,
  X,
  LogOut,
  Calculator,
  Briefcase,
  FileText,
  LayoutGrid,
  UserCog,
  Scale,
  Keyboard,
  ChevronRight,
  Zap,
} from "lucide-react";
import { useEffect, useState, useRef, type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/lib/auth";
import { useTenantAPI } from "@/lib/api";
import { type Order, type Repair, type Invoice, type Product } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useGlobalKeyboard, useActiveShortcuts } from "@/hooks/useGlobalKeyboard";
import { KeyboardShortcutsDialog } from "@/components/KeyboardShortcutsDialog";
import { CommandPaletteDialog } from "@/components/CommandPaletteDialog";
import { HeaderGoldRatesDialog } from "@/components/HeaderGoldRatesDialog";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const adminGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "nav.groupOverview",
    items: [
      { to: "/dashboard",     label: "nav.dashboard",     icon: LayoutDashboard },
      { to: "/notifications", label: "nav.notifications", icon: BellRing },
      { to: "/calculator",    label: "nav.calculator",    icon: Calculator },
    ],
  },
  {
    title: "nav.groupSales",
    items: [
      { to: "/billing", label: "nav.billing", icon: ShoppingCart },
      { to: "/sales",   label: "nav.sales",   icon: Receipt },
      { to: "/orders",  label: "nav.orders",  icon: ShoppingBag },
    ],
  },
  {
    title: "nav.groupInventory",
    items: [
      { to: "/catalog",     label: "nav.catalog",    icon: LayoutGrid },
      { to: "/inventory",   label: "nav.products",   icon: Package },
      { to: "/gold-rates",  label: "nav.goldRates",  icon: TrendingUp },
    ],
  },
  {
    title: "nav.groupPeople",
    items: [
      { to: "/customers",  label: "nav.customers",   icon: Users },
      { to: "/employees",  label: "nav.employees",   icon: Briefcase },
      { to: "/suppliers",  label: "nav.suppliers",   icon: Truck },
      { to: "/profile",    label: "nav.shopProfile", icon: UserCog },
      { to: "/karigars",   label: "nav.karigars",    icon: Hammer },
    ],
  },
  {
    title: "nav.groupOperations",
    items: [
      { to: "/repairs",       label: "nav.repairs",      icon: Wrench },
      { to: "/karigar-tasks", label: "nav.karigarTasks", icon: ClipboardList },
    ],
  },
  {
    title: "nav.groupFinance",
    items: [
      { to: "/purchases",        label: "nav.purchases",      icon: ShoppingBag },
      { to: "/expenses",         label: "nav.expenses",       icon: Wallet },
      { to: "/dues",             label: "nav.customerDues",   icon: AlertCircle },
      { to: "/girvi",            label: "nav.girvi",          icon: Landmark },
      { to: "/forwarded-shops",  label: "nav.forwardedShops", icon: Store },
      { to: "/reports",          label: "nav.reports",        icon: BarChart3 },
      { to: "/ledger",           label: "nav.dailyLedger",    icon: BookOpen },
      { to: "/balance-sheet",    label: "nav.balanceSheet",   icon: Scale },
    ],
  },
];

/* ─────────────────────────────────────────────────────────────── */
/*  Sidebar body                                                   */
/* ─────────────────────────────────────────────────────────────── */
function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { tenantSession } = useAuth();
  const navContainerRef = useRef<HTMLDivElement>(null);
  const isKarigar  = tenantSession?.user?.role === "karigar";
  const isOperator = tenantSession?.user?.role === "operator";
  const shopName   = tenantSession?.shop?.shopName || "JewelShop";
  const logoUrl    = tenantSession?.shop?.logoUrl;
  const initials   = shopName.slice(0, 2).toUpperCase();

  // Restore sidebar scroll position across route changes
  useEffect(() => {
    const savedPos = sessionStorage.getItem("sidebar_nav_scroll_pos");
    if (savedPos && navContainerRef.current) {
      navContainerRef.current.scrollTop = Number(savedPos);
    }
  }, []);

  const handleNavScroll = (e: React.UIEvent<HTMLDivElement>) => {
    sessionStorage.setItem("sidebar_nav_scroll_pos", String(e.currentTarget.scrollTop));
  };

  const groups = isKarigar
    ? [{ title: "nav.groupMyWorkspace", items: [{ to: "/karigar-tasks", label: "nav.myTasks", icon: ClipboardList }] }]
    : adminGroups.map((group) => {
        if (group.title === "nav.groupFinance" && !isOperator) {
          return { ...group, items: [...group.items, { to: "/gst-report", label: "nav.gstReport", icon: FileText as any }] };
        }
        return group;
      });

  return (
    <>
      {/* ── Brand ── */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={shopName}
              className="w-9 h-9 rounded-lg object-contain bg-white p-0.5 border border-border shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight truncate">{shopName}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{t("nav.tagline")}</div>
          </div>
        </div>

        {onNavigate && (
          <button
            onClick={onNavigate}
            className="lg:hidden p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground"
            aria-label={t("nav.closeMenu")}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Nav ── */}
      <div
        ref={navContainerRef}
        onScroll={handleNavScroll}
        className="flex-1 overflow-y-auto scrollbar-none"
      >
        <nav className="px-3 py-3 space-y-4">
          {groups.map((g) => (
            <div key={g.title}>
              {/* Group label */}
              <div className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                {t(g.title)}
              </div>

              <div className="space-y-0.5">
                {g.items.map((n) => {
                  const Icon = n.icon;
                  return (
                    <NavLink
                      key={n.to}
                      to={n.to === "/" ? "/dashboard" : n.to}
                      end={n.to === "/"}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className={cn("w-4 h-4 shrink-0", isActive ? "opacity-100" : "opacity-60 group-hover:opacity-100")} />
                          <span className="flex-1 truncate">{t(n.label)}</span>
                          {isActive && <ChevronRight className="w-3 h-3 opacity-50 shrink-0" />}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* ── Logout ── */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <button
          onClick={() => {
            localStorage.removeItem("ajms.auth");
            localStorage.removeItem("jewelshop.tenantSession");
            window.location.reload();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-rose-500 hover:text-rose-600 hover:bg-rose-500/8 transition-all"
        >
          <LogOut className="w-4 h-4" />
          {t("nav.logout")}
        </button>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/*  Layout                                                         */
/* ─────────────────────────────────────────────────────────────── */
export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { tenantSession } = useAuth();
  const [open, setOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const activeShortcuts = useActiveShortcuts();

  const shopName = tenantSession?.shop?.shopName || "";
  const userRole = tenantSession?.user?.role || "";

  // Helper to click primary Add/New/Create button on page and focus first field
  const triggerNewRecordButton = () => {
    // 1. If a dialog is already open, focus its first input
    const existingDialog = document.querySelector('[role="dialog"]');
    if (existingDialog) {
      const firstInput = existingDialog.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input:not([type='hidden']), select, textarea");
      firstInput?.focus();
      return true;
    }

    const mainArea = document.querySelector("main");
    if (!mainArea) return false;

    // 2. Check for explicit data-new-button="true" inside main content area
    const explicitBtn = mainArea.querySelector<HTMLButtonElement>('button[data-new-button="true"]');
    if (explicitBtn && !explicitBtn.disabled) {
      explicitBtn.click();
      setTimeout(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const firstInput = dialog?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input:not([type='hidden']), select, textarea");
        firstInput?.focus();
      }, 100);
      return true;
    }

    // 3. Fallback: Search visible buttons inside main content area ONLY
    const buttons = Array.from(mainArea.querySelectorAll<HTMLButtonElement>("button"));
    const btn = buttons.find((b) => {
      const isVisible = !b.disabled && b.offsetParent !== null;
      if (!isVisible) return false;

      const txt = (b.innerText || "").toLowerCase();
      const aria = (b.getAttribute("aria-label") || "").toLowerCase();
      const title = (b.getAttribute("title") || "").toLowerCase();
      const combined = `${txt} ${aria} ${title}`;

      return (
        combined.includes("add") ||
        combined.includes("new") ||
        combined.includes("create") ||
        combined.includes("nayan") ||
        combined.includes("banao") ||
        combined.includes("jodo") ||
        combined.includes("issue") ||
        combined.includes("record") ||
        combined.includes("entry") ||
        combined.includes("loan") ||
        combined.includes("bill") ||
        combined.includes("invoice") ||
        combined.includes("voucher") ||
        combined.includes("purchase") ||
        combined.includes("product") ||
        combined.includes("item") ||
        combined.includes("repair") ||
        combined.includes("order") ||
        combined.includes("customer") ||
        combined.includes("girvi") ||
        combined.includes("supplier") ||
        combined.includes("employee") ||
        combined.includes("karigar") ||
        combined.includes("due") ||
        combined.includes("advance") ||
        combined.includes("rate") ||
        combined.includes("shop") ||
        combined.includes("task") ||
        combined.includes("payment") ||
        combined.includes("receive") ||
        combined.includes("spend") ||
        combined.includes("expense")
      );
    });

    if (btn) {
      btn.click();
      setTimeout(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const firstInput = dialog?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input:not([type='hidden']), select, textarea");
        firstInput?.focus();
      }, 120);
      return true;
    }

    // 4. If no modal button found (e.g. Billing POS screen), focus first visible text input inside main area
    const pageInput = mainArea.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      "input:not([type='hidden']), select, textarea"
    );
    if (pageInput) {
      pageInput.focus();
      return true;
    }

    return false;
  };

  // Global keyboard shortcuts
  useGlobalKeyboard({
    onToggleHelp: () => setShowShortcuts((v) => !v),
    onToggleCommandPalette: () => setShowCommandPalette((v) => !v),
    onFocusSearch: () => {
      const el = document.querySelector<HTMLInputElement>(
        'input[type="search"], input[placeholder*="earch"], input[placeholder*="ilter"], input[data-search]'
      );
      el?.focus();
      el?.select();
    },
    onNewRecord: triggerNewRecordButton,
  });

  const tenantApi = useTenantAPI();
  const { data: products = [] } = useApi<Product[]>(["inventory"], () => tenantApi.inventory.getAll());
  const { data: invoices = [] } = useApi<Invoice[]>(["invoices"],  () => tenantApi.invoices.getAll());
  const { data: repairs  = [] } = useApi<Repair[]> (["repairs"],   () => tenantApi.repairs.getAll());
  const { data: orders   = [] } = useApi<Order[]>  (["orders"],    () => tenantApi.orders.getAll());

  const totalNotifications = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (
      orders.filter((o) => o.status === "Ready").length +
      repairs.filter((r) => r.status === "Ready").length +
      orders.filter((o) => o.dueDate && o.dueDate <= today && !["Delivered", "Cancelled"].includes(o.status)).length +
      repairs.filter((r) => r.deliveryDate && r.deliveryDate <= today && r.status !== "Delivered").length +
      invoices.filter((i) => (i.balanceDue || 0) > 0).length +
      products.filter((p) => p.stock <= 2).length
    );
  }, [orders, repairs, invoices, products]);

  useEffect(() => {
    setOpen(false);
    const vp = document.querySelector<HTMLElement>("main [data-radix-scroll-area-viewport]");
    if (vp) vp.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [pathname]);

  // Single-Click Quick Launch Bar definitions — clean standard routes
  const quickBarActions: { id: string; label: string; icon: any; route: string }[] = [
    { id: "new_bill", label: "New Bill", icon: ShoppingCart, route: "/billing" },
    { id: "daily_ledger", label: "Daily Ledger", icon: BookOpen, route: "/ledger" },
    { id: "purchases", label: "Purchases", icon: ShoppingBag, route: "/purchases" },
    { id: "sales", label: "Sales", icon: Receipt, route: "/sales" },
    { id: "customers", label: "Customers", icon: Users, route: "/customers" },
    { id: "expenses", label: "Expenses", icon: Wallet, route: "/expenses" },
    { id: "reports", label: "Reports", icon: BarChart3, route: "/reports" },
    { id: "girvi", label: "Girvi", icon: Landmark, route: "/girvi" },
    { id: "repairs", label: "Repairs", icon: Wrench, route: "/repairs" },
    { id: "orders", label: "Orders", icon: ShoppingBag, route: "/orders" },
  ];

  const getShortcutKeyDisplay = (id: string) => {
    const s = activeShortcuts.find((item) => item.id === id);
    if (!s) return "";
    const parts = [];
    if (s.ctrl) parts.push("Ctrl");
    if (s.alt) parts.push("Alt");
    if (s.shift) parts.push("Shift");
    parts.push(s.key);
    return parts.join("+");
  };

  return (
    <div className="h-dvh flex overflow-hidden bg-background print:h-auto print:overflow-visible">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex w-52 xl:w-56 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col h-full print:hidden">
        <SidebarBody />
      </aside>

      {/* ── Mobile Drawer ── */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 max-w-[85vw] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col shadow-2xl h-full">
            <SidebarBody onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col h-full print:h-auto">

        {/* ── Top Header ── */}
        <header className="shrink-0 sticky top-0 z-30 h-13 flex items-center justify-between px-3 sm:px-4 border-b border-border bg-background/95 backdrop-blur-sm print:hidden gap-2">

          {/* Left — mobile hamburger + page breadcrumb */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden -ml-1 h-8 w-8"
              onClick={() => setOpen(true)}
            >
              <Menu className="w-4 h-4" />
              <span className="sr-only">{t("nav.openMenu")}</span>
            </Button>

            {/* Desktop: show shop name as subtle breadcrumb */}
            <span className="hidden lg:block text-xs text-muted-foreground font-medium truncate max-w-[140px] xl:max-w-[180px]">
              {shopName}
            </span>
          </div>

          {/* Right — actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <HeaderGoldRatesDialog />

            <LanguageSwitcher />
            <ThemeToggle />

            {/* Keyboard shortcuts */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Keyboard shortcuts / Edit keys (F1)"
              onClick={() => setShowShortcuts(true)}
            >
              <Keyboard className="w-4 h-4" />
            </Button>

            {/* Role badge */}
            {userRole && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {userRole}
              </span>
            )}

            {/* Notifications */}
            <Link to="/notifications">
              <Button variant="ghost" size="icon" className="h-8 w-8 relative">
                <BellRing className="w-4 h-4" />
                {totalNotifications > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 border border-background" />
                )}
              </Button>
            </Link>
          </div>
        </header>

        {/* ── Single-Click Quick Action Toolbar ── */}
        <div className="shrink-0 bg-muted/40 border-b border-border px-2.5 py-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs print:hidden">
          <span className="text-[11px] font-bold text-muted-foreground/80 tracking-wide shrink-0 mr-0.5 flex items-center gap-1 select-none">
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
            <span className="hidden sm:inline">Single Click Forms:</span>
          </span>

          {quickBarActions.map((act) => {
            const Icon = act.icon;
            const keyDisp = getShortcutKeyDisplay(act.id);
            const isActive = pathname === act.route.split("?")[0];
            const handleQuickClick = () => {
              const targetPath = act.route.split("?")[0];
              navigate(targetPath);
            };
            return (
              <button
                key={act.id}
                onClick={handleQuickClick}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all shrink-0 shadow-2xs group cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary font-semibold"
                    : "bg-background border-border/80 text-foreground hover:border-primary/50 hover:bg-primary/5"
                )}
                title={`Click to open ${act.label} Page (${keyDisp})`}
              >
                <Icon className={cn("w-3 h-3 shrink-0", isActive ? "text-primary-foreground" : "text-primary group-hover:scale-110 transition-transform")} />
                <span>{act.label}</span>
                {keyDisp && (
                  <kbd className={cn(
                    "inline-flex items-center px-1 py-0.2 rounded text-[9px] font-mono font-bold transition-colors",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:text-primary group-hover:bg-primary/10"
                  )}>
                    {keyDisp}
                  </kbd>
                )}
              </button>
            );
          })}

          <button
            onClick={() => setShowShortcuts(true)}
            className="ml-auto text-[11px] text-primary hover:text-primary/80 hover:underline shrink-0 font-medium px-1 flex items-center gap-1 cursor-pointer"
            title="Edit / Update shortcut keys"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Update Keys</span>
          </button>
        </div>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-hidden print:h-auto print:overflow-visible">
          <ScrollArea className="h-full print:h-auto print:overflow-visible">
            <div className="w-full max-w-full min-w-0 mx-auto px-4 sm:px-6 md:px-8 py-3 sm:py-5 print:max-w-none print:p-0 overflow-x-hidden">
              {children}
            </div>
          </ScrollArea>
        </main>
      </div>

      {/* ── Command Palette dialog ── */}
      <CommandPaletteDialog
        open={showCommandPalette}
        onOpenChange={setShowCommandPalette}
        onOpenHelp={() => setShowShortcuts(true)}
      />

      {/* ── Keyboard shortcuts dialog ── */}
      <KeyboardShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}
