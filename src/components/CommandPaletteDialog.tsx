import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { getCustomShortcuts, type Shortcut } from "@/hooks/useGlobalKeyboard";
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Users,
  Package,
  Wallet,
  BookOpen,
  BarChart3,
  Wrench,
  ShoppingBag,
  AlertCircle,
  LayoutGrid,
  Truck,
  Briefcase,
  Hammer,
  ClipboardList,
  Landmark,
  Store,
  TrendingUp,
  Calculator,
  FileText,
  BellRing,
  UserCog,
  Scale,
  PlusCircle,
  Keyboard,
  Search,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenHelp?: () => void;
}

function label(s: Shortcut): string {
  const parts: string[] = [];
  if (s.ctrl) parts.push("Ctrl");
  if (s.alt) parts.push("Alt");
  if (s.shift) parts.push("Shift");
  parts.push(s.key);
  return parts.join(" + ");
}

/** Build "route -> real shortcut" and "id -> real shortcut" lookups from the live table. */
function buildKeyLookups() {
  const byRoute = new Map<string, string>();
  const byId = new Map<string, string>();
  for (const s of getCustomShortcuts()) {
    byId.set(s.id, label(s));
    if (s.actionType === "route" && s.actionRoute) {
      const base = s.actionRoute.split("?")[0];
      if (!byRoute.has(base)) byRoute.set(base, label(s));
    }
  }
  return {
    route: (r: string) => byRoute.get(r.split("?")[0]) ?? null,
    id: (i: string) => byId.get(i) ?? null,
  };
}

export function CommandPaletteDialog({ open, onOpenChange, onOpenHelp }: Props) {
  const navigate = useNavigate();
  const keys = buildKeyLookups();

  const handleSelect = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const RK = ({ route }: { route: string }) => {
    const k = keys.route(route);
    return k ? <CommandShortcut>{k}</CommandShortcut> : null;
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command, page, ledger, or form name..." />
      <CommandList className="max-h-[380px]">
        <CommandEmpty>No matching page, ledger, or form found.</CommandEmpty>

        {/* ── Pages & Navigation ── */}
        <CommandGroup heading="Pages & Navigation">
          <CommandItem onSelect={() => handleSelect("/dashboard")}>
            <LayoutDashboard className="mr-2 h-4 w-4 text-primary" />
            <span>Dashboard</span>
            <RK route="/dashboard" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/billing")}>
            <ShoppingCart className="mr-2 h-4 w-4 text-primary" />
            <span>Billing / POS</span>
            <RK route="/billing" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/sales")}>
            <Receipt className="mr-2 h-4 w-4 text-primary" />
            <span>Sales (Invoices)</span>
            <RK route="/sales" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/customers")}>
            <Users className="mr-2 h-4 w-4 text-primary" />
            <span>Customers</span>
            <RK route="/customers" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/inventory")}>
            <Package className="mr-2 h-4 w-4 text-primary" />
            <span>Inventory / Stock</span>
            <RK route="/inventory" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/expenses")}>
            <Wallet className="mr-2 h-4 w-4 text-primary" />
            <span>Expenses</span>
            <RK route="/expenses" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/ledger")}>
            <BookOpen className="mr-2 h-4 w-4 text-primary" />
            <span>Daily Ledger</span>
            <RK route="/ledger" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/reports")}>
            <BarChart3 className="mr-2 h-4 w-4 text-primary" />
            <span>Reports</span>
            <RK route="/reports" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/repairs")}>
            <Wrench className="mr-2 h-4 w-4 text-primary" />
            <span>Repairs</span>
            <RK route="/repairs" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/orders")}>
            <ShoppingBag className="mr-2 h-4 w-4 text-primary" />
            <span>Orders</span>
            <RK route="/orders" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/dues")}>
            <AlertCircle className="mr-2 h-4 w-4 text-primary" />
            <span>Customer Dues</span>
            <RK route="/dues" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/catalog")}>
            <LayoutGrid className="mr-2 h-4 w-4 text-primary" />
            <span>Catalog</span>
            <RK route="/catalog" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/suppliers")}>
            <Truck className="mr-2 h-4 w-4 text-primary" />
            <span>Suppliers</span>
            <RK route="/suppliers" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/employees")}>
            <Briefcase className="mr-2 h-4 w-4 text-primary" />
            <span>Employees</span>
            <RK route="/employees" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/karigars")}>
            <Hammer className="mr-2 h-4 w-4 text-primary" />
            <span>Karigars</span>
            <RK route="/karigars" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/karigar-tasks")}>
            <ClipboardList className="mr-2 h-4 w-4 text-primary" />
            <span>Karigar Tasks</span>
            <RK route="/karigar-tasks" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/girvi")}>
            <Landmark className="mr-2 h-4 w-4 text-primary" />
            <span>Girvi Loans</span>
            <RK route="/girvi" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/forwarded-shops")}>
            <Store className="mr-2 h-4 w-4 text-primary" />
            <span>Forwarded Shops</span>
            <RK route="/forwarded-shops" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/purchases")}>
            <ShoppingBag className="mr-2 h-4 w-4 text-primary" />
            <span>Purchases</span>
            <RK route="/purchases" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/gold-rates")}>
            <TrendingUp className="mr-2 h-4 w-4 text-primary" />
            <span>Gold Rates</span>
            <RK route="/gold-rates" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/calculator")}>
            <Calculator className="mr-2 h-4 w-4 text-primary" />
            <span>Calculator</span>
            <RK route="/calculator" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/gst-report")}>
            <FileText className="mr-2 h-4 w-4 text-primary" />
            <span>GST Report</span>
            <RK route="/gst-report" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/notifications")}>
            <BellRing className="mr-2 h-4 w-4 text-primary" />
            <span>Notifications</span>
            <RK route="/notifications" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/profile")}>
            <UserCog className="mr-2 h-4 w-4 text-primary" />
            <span>Shop Profile &amp; Settings</span>
            <RK route="/profile" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/balance-sheet")}>
            <Scale className="mr-2 h-4 w-4 text-primary" />
            <span>Balance Sheet</span>
            <RK route="/balance-sheet" />
          </CommandItem>
        </CommandGroup>

        {/* ── Ledgers & Financial Statements ── */}
        <CommandGroup heading="Ledgers & Financial Reports">
          <CommandItem onSelect={() => handleSelect("/ledger")}>
            <BookOpen className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Daily Ledger Book</span>
            <RK route="/ledger" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/dues")}>
            <AlertCircle className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Customer Dues Ledger</span>
            <RK route="/dues" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/balance-sheet")}>
            <Scale className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Balance Sheet Statement</span>
            <RK route="/balance-sheet" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/gst-report")}>
            <FileText className="mr-2 h-4 w-4 text-emerald-500" />
            <span>GST Tax Ledger &amp; Report</span>
            <RK route="/gst-report" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/sales")}>
            <Receipt className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Sales Invoice Register</span>
            <RK route="/sales" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/purchases")}>
            <ShoppingBag className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Purchase Register</span>
            <RK route="/purchases" />
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/girvi")}>
            <Landmark className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Girvi Loan Ledger</span>
            <RK route="/girvi" />
          </CommandItem>
        </CommandGroup>

        {/* ── Forms & New Entry Dialogs ── */}
        <CommandGroup heading="Forms & New Entry Dialogs">
          <CommandItem onSelect={() => handleSelect("/billing?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>New Bill / POS Form</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/sales?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>Create Sale Invoice</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/purchases?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>Create Purchase Order</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/customers?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>Add New Customer Form</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/suppliers?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>Add New Supplier Form</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/inventory?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>Add Product / Stock Form</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/girvi?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>New Girvi Loan Form</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/repairs?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>New Repair Entry Form</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/orders?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>New Customer Order Form</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/expenses?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>Add Expense Entry Form</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/ledger?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>Add Daily Ledger Entry Form</span>
          </CommandItem>
        </CommandGroup>

        {/* ── Tools & Help ── */}
        <CommandGroup heading="Actions & Help">
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              onOpenHelp?.();
            }}
          >
            <Keyboard className="mr-2 h-4 w-4 text-amber-500" />
            <span>View All Keyboard Shortcuts</span>
            <CommandShortcut>{keys.id("help") ?? "F1"}</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              const el = document.querySelector<HTMLInputElement>(
                'input[type="search"], input[placeholder*="earch"], input[placeholder*="ilter"], input[data-search]'
              );
              el?.focus();
              el?.select();
            }}
          >
            <Search className="mr-2 h-4 w-4 text-amber-500" />
            <span>Focus Search Input</span>
            <CommandShortcut>{keys.id("focus_search") ?? "Alt + F"}</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
