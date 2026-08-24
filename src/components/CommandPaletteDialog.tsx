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

export function CommandPaletteDialog({ open, onOpenChange, onOpenHelp }: Props) {
  const navigate = useNavigate();

  const handleSelect = (path: string) => {
    onOpenChange(false);
    navigate(path);
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
            <CommandShortcut>Alt + 1</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/billing")}>
            <ShoppingCart className="mr-2 h-4 w-4 text-primary" />
            <span>Billing / POS</span>
            <CommandShortcut>Alt + 2</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/sales")}>
            <Receipt className="mr-2 h-4 w-4 text-primary" />
            <span>Sales (Invoices)</span>
            <CommandShortcut>Alt + 3</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/customers")}>
            <Users className="mr-2 h-4 w-4 text-primary" />
            <span>Customers</span>
            <CommandShortcut>Alt + 4</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/inventory")}>
            <Package className="mr-2 h-4 w-4 text-primary" />
            <span>Inventory / Stock</span>
            <CommandShortcut>Alt + 5</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/expenses")}>
            <Wallet className="mr-2 h-4 w-4 text-primary" />
            <span>Expenses</span>
            <CommandShortcut>Alt + 6</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/ledger")}>
            <BookOpen className="mr-2 h-4 w-4 text-primary" />
            <span>Daily Ledger</span>
            <CommandShortcut>Alt + 7</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/reports")}>
            <BarChart3 className="mr-2 h-4 w-4 text-primary" />
            <span>Reports</span>
            <CommandShortcut>Alt + 8</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/repairs")}>
            <Wrench className="mr-2 h-4 w-4 text-primary" />
            <span>Repairs</span>
            <CommandShortcut>Alt + 9</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/orders")}>
            <ShoppingBag className="mr-2 h-4 w-4 text-primary" />
            <span>Orders</span>
            <CommandShortcut>Alt + 0</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/dues")}>
            <AlertCircle className="mr-2 h-4 w-4 text-primary" />
            <span>Customer Dues</span>
            <CommandShortcut>Alt + Shift + D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/catalog")}>
            <LayoutGrid className="mr-2 h-4 w-4 text-primary" />
            <span>Catalog</span>
            <CommandShortcut>Alt + Shift + C</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/suppliers")}>
            <Truck className="mr-2 h-4 w-4 text-primary" />
            <span>Suppliers</span>
            <CommandShortcut>Alt + Shift + S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/employees")}>
            <Briefcase className="mr-2 h-4 w-4 text-primary" />
            <span>Employees</span>
            <CommandShortcut>Alt + Shift + E</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/karigars")}>
            <Hammer className="mr-2 h-4 w-4 text-primary" />
            <span>Karigars</span>
            <CommandShortcut>Alt + Shift + K</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/karigar-tasks")}>
            <ClipboardList className="mr-2 h-4 w-4 text-primary" />
            <span>Karigar Tasks</span>
            <CommandShortcut>Alt + Shift + T</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/girvi")}>
            <Landmark className="mr-2 h-4 w-4 text-primary" />
            <span>Girvi Loans</span>
            <CommandShortcut>Alt + Shift + G</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/forwarded-shops")}>
            <Store className="mr-2 h-4 w-4 text-primary" />
            <span>Forwarded Shops</span>
            <CommandShortcut>Alt + Shift + F</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/purchases")}>
            <ShoppingBag className="mr-2 h-4 w-4 text-primary" />
            <span>Purchases</span>
            <CommandShortcut>Alt + Shift + P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/gold-rates")}>
            <TrendingUp className="mr-2 h-4 w-4 text-primary" />
            <span>Gold Rates</span>
            <CommandShortcut>Alt + Shift + R</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/calculator")}>
            <Calculator className="mr-2 h-4 w-4 text-primary" />
            <span>Calculator</span>
            <CommandShortcut>Alt + Shift + M</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/gst-report")}>
            <FileText className="mr-2 h-4 w-4 text-primary" />
            <span>GST Report</span>
            <CommandShortcut>Alt + Shift + X</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/notifications")}>
            <BellRing className="mr-2 h-4 w-4 text-primary" />
            <span>Notifications</span>
            <CommandShortcut>Alt + Shift + N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/profile")}>
            <UserCog className="mr-2 h-4 w-4 text-primary" />
            <span>Shop Profile & Settings</span>
            <CommandShortcut>Alt + Shift + U</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/balance-sheet")}>
            <Scale className="mr-2 h-4 w-4 text-primary" />
            <span>Balance Sheet</span>
            <CommandShortcut>Alt + Shift + B</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {/* ── Ledgers & Financial Statements ── */}
        <CommandGroup heading="Ledgers & Financial Reports">
          <CommandItem onSelect={() => handleSelect("/ledger")}>
            <BookOpen className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Daily Ledger Book</span>
            <CommandShortcut>Alt + 7</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/dues")}>
            <AlertCircle className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Customer Dues Ledger</span>
            <CommandShortcut>Alt + Shift + D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/balance-sheet")}>
            <Scale className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Balance Sheet Statement</span>
            <CommandShortcut>Alt + Shift + B</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/gst-report")}>
            <FileText className="mr-2 h-4 w-4 text-emerald-500" />
            <span>GST Tax Ledger & Report</span>
            <CommandShortcut>Alt + Shift + X</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/sales")}>
            <Receipt className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Sales Invoice Register</span>
            <CommandShortcut>Alt + 3</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/purchases")}>
            <ShoppingBag className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Purchase Register</span>
            <CommandShortcut>Alt + Shift + P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/girvi")}>
            <Landmark className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Girvi Loan Ledger</span>
            <CommandShortcut>Alt + Shift + G</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {/* ── Forms & New Entry Dialogs ── */}
        <CommandGroup heading="Forms & New Entry Dialogs">
          <CommandItem onSelect={() => handleSelect("/billing?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>New Bill / POS Form</span>
            <CommandShortcut>Ctrl + Alt + B</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/sales?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>Create Sale Invoice</span>
            <CommandShortcut>Ctrl + Alt + S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/purchases?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>Create Purchase Order</span>
            <CommandShortcut>Ctrl + Alt + P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/customers?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>Add New Customer Form</span>
            <CommandShortcut>Ctrl + Alt + C</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/suppliers?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>Add New Supplier Form</span>
            <CommandShortcut>Ctrl + Alt + S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/inventory?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>Add Product / Stock Form</span>
            <CommandShortcut>Ctrl + Alt + I</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/girvi?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>New Girvi Loan Form</span>
            <CommandShortcut>Ctrl + Alt + G</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/repairs?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>New Repair Entry Form</span>
            <CommandShortcut>Ctrl + Alt + R</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/orders?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>New Customer Order Form</span>
            <CommandShortcut>Ctrl + Alt + O</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/expenses?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>Add Expense Entry Form</span>
            <CommandShortcut>Ctrl + Alt + E</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/ledger?new=true")}>
            <PlusCircle className="mr-2 h-4 w-4 text-blue-500" />
            <span>Add Daily Ledger Entry Form</span>
            <CommandShortcut>Ctrl + Alt + L</CommandShortcut>
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
            <CommandShortcut>?</CommandShortcut>
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
            <CommandShortcut>F</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
