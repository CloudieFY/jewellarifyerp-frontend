import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { inr, type Expense } from "@/lib/storage";
import { formatDate, triggerPrint } from "@/lib/utils";
import { useTenantAPI } from "@/lib/api";
import { useMemo, useState } from "react";
import { useFormKeyboardNav } from "@/lib/useFormKeyboardNav";
import {
  Plus,
  Trash2,
  Printer,
  Wallet,
  ArrowDownRight,
  Layers,
  Tag,
  Search,
  FileText,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { ShopHeader } from "@/components/InvoiceBranding";

// Categorized Expense Master
export const DIRECT_EXPENSE_CATEGORIES = [
  "Freight & Carriage Inward",
  "Hallmarking & BIS HUID",
  "Melting & Testing Charges",
  "Refining Charges",
  "Custom Duty & Import Clearance",
  "Karigar Labour Charges",
  "Stock Packaging & Barcode Tags",
];

export const INDIRECT_EXPENSE_CATEGORIES = [
  "Showroom Rent",
  "Staff Salary & Commission",
  "Electricity & Utilities",
  "Tea & Customer Hospitality",
  "Marketing & Promotion",
  "Security & Guard Charges",
  "Bank & POS Machine Charges",
  "Software & SaaS Fees",
  "Office Stationery & Courier",
  "Misc Overheads",
];

export default function ExpensesPage() {
  const api = useTenantAPI();
  const queryClient = useQueryClient();

  const useApiMutation = (mutationFn: (...args: any[]) => Promise<any>, queryKey: string[]) => {
    return useMutation({
      mutationFn,
      onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });
  };

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: api.expenses.getAll,
  });
  const createMutation = useApiMutation((data: Expense) => api.expenses.create(data), ["expenses"]);
  const deleteMutation = useApiMutation((id: string) => api.expenses.remove(id), ["expenses"]);

  const [open, setOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<Expense | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState(1);

  const [form, setForm] = useState<Omit<Expense, "id" | "_id">>({
    date: new Date().toISOString().slice(0, 10),
    expenseType: "Indirect",
    category: "Showroom Rent",
    description: "",
    amount: 0,
    paymentMode: "Cash",
    payeeName: "",
    voucherNo: `EXP-${Date.now().toString().slice(-6)}`,
  });

  const now = new Date();
  const todayStr = now.toDateString();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;

  // Summary Metrics
  const todayTotal = useMemo(
    () =>
      expenses
        .filter((e) => new Date(e.date).toDateString() === todayStr)
        .reduce((s, e) => s + (e.amount || 0), 0),
    [expenses, todayStr]
  );

  const monthTotal = useMemo(
    () =>
      expenses
        .filter((e) => {
          const d = new Date(e.date);
          return `${d.getFullYear()}-${d.getMonth()}` === monthKey;
        })
        .reduce((s, e) => s + (e.amount || 0), 0),
    [expenses, monthKey]
  );

  const directExpensesTotal = useMemo(
    () =>
      expenses
        .filter((e) => e.expenseType === "Direct" || DIRECT_EXPENSE_CATEGORIES.includes(e.category))
        .reduce((s, e) => s + (e.amount || 0), 0),
    [expenses]
  );

  const indirectExpensesTotal = useMemo(
    () =>
      expenses
        .filter((e) => e.expenseType !== "Direct" && !DIRECT_EXPENSE_CATEGORIES.includes(e.category))
        .reduce((s, e) => s + (e.amount || 0), 0),
    [expenses]
  );

  // Filtered expenses list
  const filteredExpenses = useMemo(() => {
    let list = expenses;

    if (typeFilter !== "All") {
      if (typeFilter === "Direct") {
        list = list.filter((e) => e.expenseType === "Direct" || DIRECT_EXPENSE_CATEGORIES.includes(e.category));
      } else {
        list = list.filter((e) => e.expenseType !== "Direct" && !DIRECT_EXPENSE_CATEGORIES.includes(e.category));
      }
    }

    if (categoryFilter !== "All") {
      list = list.filter((e) => e.category === categoryFilter);
    }

    if (dateFilter) {
      const targetDateStr = new Date(dateFilter).toDateString();
      list = list.filter((e) => new Date(e.date).toDateString() === targetDateStr);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          (e.description || "").toLowerCase().includes(q) ||
          (e.category || "").toLowerCase().includes(q) ||
          (e.payeeName || "").toLowerCase().includes(q) ||
          (e.voucherNo || "").toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, typeFilter, categoryFilter, dateFilter, searchQuery]);

  const totalPages = Math.ceil(filteredExpenses.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filteredExpenses.slice((currentPage - 1) * 10, currentPage * 10);

  // Handle Category selection auto-detecting Direct vs Indirect
  const handleCategoryChange = (cat: string) => {
    const isDirect = DIRECT_EXPENSE_CATEGORIES.includes(cat);
    setForm((prev) => ({
      ...prev,
      category: cat,
      expenseType: isDirect ? "Direct" : "Indirect",
    }));
  };

  async function add() {
    if (!form.amount || !form.description) {
      toast.error("Please enter both description and amount.");
      return;
    }
    try {
      await createMutation.mutateAsync(form as any);
      toast.success("Expense voucher created!");
      setOpen(false);
      setForm({
        date: new Date().toISOString().slice(0, 10),
        expenseType: "Indirect",
        category: "Showroom Rent",
        description: "",
        amount: 0,
        paymentMode: "Cash",
        payeeName: "",
        voucherNo: `EXP-${Date.now().toString().slice(-6)}`,
      });
    } catch (error: any) {
      toast.error(error?.message || "Failed to create expense voucher.");
    }
  }

  const handleKeyNav = useFormKeyboardNav(add);

  async function remove(id: string) {
    if (window.confirm("Are you sure you want to delete this expense voucher?")) {
      await deleteMutation.mutateAsync(id);
      toast.success("Expense voucher deleted.");
    }
  }

  const exportExpensesToExcel = () => {
    if (filteredExpenses.length === 0) {
      toast.error("No expense vouchers to export!");
      return;
    }
    const data = filteredExpenses.map((e, index) => ({
      "S.No": index + 1,
      "Voucher Date": formatDate(e.date),
      "Voucher No": e.voucherNo || `EXP-${(e.id || "").slice(-6)}`,
      Type: e.expenseType || (DIRECT_EXPENSE_CATEGORIES.includes(e.category) ? "Direct" : "Indirect"),
      Category: e.category,
      Description: e.description,
      "Paid To (Payee)": e.payeeName || "N/A",
      "Payment Mode": e.paymentMode || "Cash",
      "Amount Paid (₹)": e.amount,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses Ledger");
    XLSX.writeFile(workbook, `Expenses_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Expenses ledger exported successfully!");
  };

  return (
    <Layout>
      {/* Dynamic CSS for printable expense voucher */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-expense-voucher, #printable-expense-voucher * {
            visibility: visible !important;
          }
          #printable-expense-voucher {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 20px !important;
          }
        }
      `}</style>

      <div className="print:hidden">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
              Expense Management &amp; Vouchers
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              Track Direct Expenses (Stock/Labour) &amp; Indirect Showroom Overheads.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
            <Button
              variant="outline"
              onClick={exportExpensesToExcel}
              className="h-10 text-xs gap-2 border-slate-300 w-full sm:w-auto"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export Excel
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-new-button="true" size="lg" className="w-full sm:w-auto bg-primary text-white font-semibold h-10 text-xs">
                  <Plus className="w-4 h-4 mr-2" /> Add Expense Voucher
                </Button>
              </DialogTrigger>
              <DialogContent
                className="w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6"
                onInteractOutside={(e) => e.preventDefault()}
                onKeyDown={handleKeyNav}
              >
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold font-display flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-primary" /> Create Expense Voucher
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Voucher No</Label>
                      <Input
                        value={form.voucherNo || ""}
                        onChange={(e) => setForm({ ...form, voucherNo: e.target.value })}
                        className="h-9 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Voucher Date</Label>
                      <Input
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        className="h-9 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Expense Type (Direct vs Indirect) Toggle */}
                  <div>
                    <Label className="text-xs font-semibold">Expense Classification Type</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, expenseType: "Direct", category: DIRECT_EXPENSE_CATEGORIES[0] })
                        }
                        className={`p-2.5 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-1 text-center ${
                          form.expenseType === "Direct"
                            ? "bg-amber-50 text-amber-900 border-amber-400 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <span>Direct Expense (प्रत्यक्ष)</span>
                        <span className="text-[10px] font-normal text-muted-foreground">
                          Freight, Hallmarking, Labour, Refining
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, expenseType: "Indirect", category: INDIRECT_EXPENSE_CATEGORIES[0] })
                        }
                        className={`p-2.5 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-1 text-center ${
                          form.expenseType === "Indirect"
                            ? "bg-purple-50 text-purple-900 border-purple-400 dark:bg-purple-950/40 dark:text-purple-300"
                            : "bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <span>Indirect Expense (अप्रत्यक्ष)</span>
                        <span className="text-[10px] font-normal text-muted-foreground">
                          Rent, Salary, Utilities, Marketing
                        </span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Expense Category</Label>
                    <Select value={form.category} onValueChange={handleCategoryChange}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="text-[10px] font-bold text-amber-700 uppercase px-2 py-1 bg-amber-50">
                          Direct Expenses (Stock/Labour)
                        </div>
                        {DIRECT_EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}

                        <div className="text-[10px] font-bold text-purple-700 uppercase px-2 py-1 bg-purple-50 mt-1">
                          Indirect Expenses (Showroom Overheads)
                        </div>
                        {INDIRECT_EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Payee / Paid To (Vendor/Staff)</Label>
                      <Input
                        value={form.payeeName || ""}
                        onChange={(e) => setForm({ ...form, payeeName: e.target.value })}
                        placeholder="e.g. Ramesh Hallmarking / Landlord"
                        className="h-9 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Payment Mode</Label>
                      <Select
                        value={form.paymentMode}
                        onValueChange={(v) => setForm({ ...form, paymentMode: v as Expense["paymentMode"] })}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="UPI">UPI / QR</SelectItem>
                          <SelectItem value="Card">Credit/Debit Card</SelectItem>
                          <SelectItem value="Bank">Bank Transfer / NEFT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Description / Purpose *</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="e.g. HUID Hallmarking for 25 Gold Rings"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Amount Paid (₹) *</Label>
                    <Input
                      type="number"
                      value={form.amount || ""}
                      onChange={(e) => setForm({ ...form, amount: +e.target.value })}
                      placeholder="0.00"
                      className="h-10 text-base font-bold font-mono"
                    />
                  </div>

                  <Button className="w-full bg-primary text-white font-bold h-10 mt-2 text-xs" onClick={add}>
                    Save Expense Voucher
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {/* KPI STATS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card className="border shadow-xs bg-card">
            <CardContent className="p-4 sm:pt-5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Today's Expenses
                </div>
                <div className="text-2xl font-bold font-mono text-foreground mt-1">{inr(todayTotal)}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Outflows Today</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 grid place-items-center shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-xs bg-card">
            <CardContent className="p-4 sm:pt-5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Direct Expenses (Cost)
                </div>
                <div className="text-2xl font-bold font-mono text-amber-600 mt-1">{inr(directExpensesTotal)}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Hallmarking, Labour, Freight</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 grid place-items-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-xs bg-card">
            <CardContent className="p-4 sm:pt-5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Indirect Expenses (P&amp;L)
                </div>
                <div className="text-2xl font-bold font-mono text-purple-600 mt-1">{inr(indirectExpensesTotal)}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Rent, Salary, Overheads</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 grid place-items-center shrink-0">
                <Tag className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-xs bg-card">
            <CardContent className="p-4 sm:pt-5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  This Month Expenses
                </div>
                <div className="text-2xl font-bold font-mono text-rose-600 mt-1">{inr(monthTotal)}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Total Outflows This Month</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 grid place-items-center shrink-0">
                <ArrowDownRight className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* EXPENSE TABLE & FILTER CONTAINER */}
        <Card className="shadow-xs border overflow-hidden bg-white">
          <CardHeader className="bg-muted/20 border-b pb-3 pt-4 flex flex-col gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold font-display flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Expense Vouchers &amp; Ledger Outflows
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Consolidated list of direct &amp; indirect expense payment vouchers.
              </CardDescription>
            </div>

            {/* RESPONSIVE FILTER GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 w-full pt-1">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search payee, desc..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8 h-9 text-xs bg-background w-full"
                />
              </div>

              <Select
                value={typeFilter}
                onValueChange={(val) => {
                  setTypeFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs w-full bg-background">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Types</SelectItem>
                  <SelectItem value="Direct">Direct Expenses</SelectItem>
                  <SelectItem value="Indirect">Indirect Expenses</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={categoryFilter}
                onValueChange={(val) => {
                  setCategoryFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-xs w-full bg-background">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Categories</SelectItem>
                  <div className="text-[10px] font-bold text-amber-700 uppercase px-2 py-1 bg-amber-50">Direct</div>
                  {DIRECT_EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <div className="text-[10px] font-bold text-purple-700 uppercase px-2 py-1 bg-purple-50 mt-1">
                    Indirect
                  </div>
                  {INDIRECT_EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1.5 w-full">
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 text-xs bg-background flex-1"
                />
                {dateFilter && (
                  <Button variant="ghost" size="sm" onClick={() => setDateFilter("")} className="h-9 text-xs px-2">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-xs text-muted-foreground py-8 text-center">Loading expenses...</p>
            ) : filteredExpenses.length === 0 ? (
              <p className="text-xs text-muted-foreground py-12 text-center">
                No expense vouchers match the selected filter.
              </p>
            ) : (
              <>
                {/* MOBILE CARDS VIEW (Visible on screens < md) */}
                <div className="block md:hidden divide-y divide-border">
                  {paginated.map((e) => {
                    const isDirect = e.expenseType === "Direct" || DIRECT_EXPENSE_CATEGORIES.includes(e.category);
                    return (
                      <div key={(e as any)._id || e.id} className="p-4 space-y-2 hover:bg-slate-50/60">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-mono font-bold text-xs text-foreground">
                            {e.voucherNo || `EXP-${(e.id || "").slice(-6)}`}
                          </div>
                          <span className="text-[11px] text-muted-foreground">{formatDate(e.date)}</span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            className={`text-[10px] font-semibold py-0.5 px-2 ${
                              isDirect
                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                : "bg-purple-100 text-purple-800 border-purple-300"
                            }`}
                          >
                            {isDirect ? "Direct Expense" : "Indirect Expense"}
                          </Badge>
                          <span className="text-xs font-semibold text-slate-800">{e.category}</span>
                        </div>

                        <div className="text-xs text-slate-700">
                          <div className="font-medium">{e.description}</div>
                          {e.payeeName && <div className="text-muted-foreground text-[11px]">Paid To: {e.payeeName}</div>}
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {e.paymentMode || "Cash"}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-rose-600 text-sm">{inr(e.amount)}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title="Print Expense Voucher"
                                onClick={() => {
                                  setSelectedVoucher(e);
                                  setTimeout(() => triggerPrint(), 150);
                                }}
                              >
                                <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                onClick={() => remove((e as any)._id || e.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP TABLE VIEW (Visible on screens >= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 border-b">
                      <tr>
                        <th className="py-3 px-4 text-left">Voucher / Date</th>
                        <th className="py-3 px-4 text-left">Type &amp; Category</th>
                        <th className="py-3 px-4 text-left">Description &amp; Payee</th>
                        <th className="py-3 px-4 text-left">Mode</th>
                        <th className="py-3 px-4 text-right">Amount Paid</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginated.map((e) => {
                        const isDirect = e.expenseType === "Direct" || DIRECT_EXPENSE_CATEGORIES.includes(e.category);
                        return (
                          <tr key={(e as any)._id || e.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-mono font-bold text-xs text-foreground">
                                {e.voucherNo || `EXP-${(e.id || "").slice(-6)}`}
                              </div>
                              <div className="text-xs text-muted-foreground">{formatDate(e.date)}</div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                className={`text-[10px] font-semibold py-0.5 px-2 ${
                                  isDirect
                                    ? "bg-amber-100 text-amber-800 border-amber-300"
                                    : "bg-purple-100 text-purple-800 border-purple-300"
                                }`}
                              >
                                {isDirect ? "Direct Expense" : "Indirect Expense"}
                              </Badge>
                              <div className="text-xs font-medium text-foreground mt-0.5">{e.category}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-foreground text-xs">{e.description}</div>
                              {e.payeeName && <div className="text-xs text-muted-foreground">Paid To: {e.payeeName}</div>}
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className="text-xs font-mono">
                                {e.paymentMode || "Cash"}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 text-sm">
                              {inr(e.amount)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Print Expense Voucher"
                                  onClick={() => {
                                    setSelectedVoucher(e);
                                    setTimeout(() => triggerPrint(), 150);
                                  }}
                                >
                                  <Printer className="w-4 h-4 text-muted-foreground" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                  onClick={() => remove((e as any)._id || e.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
                    <div className="text-xs text-muted-foreground">
                      Showing {(currentPage - 1) * 10 + 1} to{" "}
                      {Math.min(currentPage * 10, filteredExpenses.length)} of {filteredExpenses.length} entries
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8 text-xs"
                      >
                        Prev
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 text-xs"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ISOLATED PRINTABLE EXPENSE VOUCHER */}
      {selectedVoucher && (
        <div id="printable-expense-voucher" className="print-section hidden print:block text-slate-900 bg-white p-6">
          <ShopHeader documentLabel="Expense Payment Voucher" compact />

          <div className="border-2 border-slate-900 rounded-lg p-6 my-4 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <div className="text-xs text-slate-500 font-bold uppercase">Voucher Number</div>
                <div className="text-lg font-mono font-bold text-slate-900">
                  {selectedVoucher.voucherNo || `EXP-${((selectedVoucher as any)._id || selectedVoucher.id || "").slice(-6)}`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 font-bold uppercase">Date of Payment</div>
                <div className="text-sm font-mono font-semibold">{formatDate(selectedVoucher.date)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-bold text-slate-600 uppercase">Expense Classification:</span>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {selectedVoucher.expenseType ||
                    (DIRECT_EXPENSE_CATEGORIES.includes(selectedVoucher.category)
                      ? "Direct Expense (Trading)"
                      : "Indirect Expense (P&L)")}
                </div>
              </div>
              <div>
                <span className="font-bold text-slate-600 uppercase">Category:</span>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">{selectedVoucher.category}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs border-t pt-3">
              <div>
                <span className="font-bold text-slate-600 uppercase">Paid To (Payee Name):</span>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">
                  {selectedVoucher.payeeName || "Self / Cash Account"}
                </div>
              </div>
              <div>
                <span className="font-bold text-slate-600 uppercase">Payment Mode:</span>
                <div className="text-sm font-mono font-semibold text-slate-900 mt-0.5">
                  {selectedVoucher.paymentMode || "Cash"}
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <span className="font-bold text-slate-600 uppercase text-xs">Particulars / Description:</span>
              <div className="text-sm font-medium text-slate-900 mt-1 bg-slate-50 p-2.5 rounded border border-slate-200">
                {selectedVoucher.description}
              </div>
            </div>

            <div className="border-t-2 border-slate-900 pt-3 flex justify-between items-center text-slate-900">
              <span className="text-base font-bold uppercase">Total Amount Paid:</span>
              <span className="text-2xl font-bold font-mono text-emerald-800">{inr(selectedVoucher.amount)}</span>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-12 text-center text-xs font-bold uppercase tracking-wider">
            <div className="border-t border-slate-600 pt-2">Receiver / Payee Signature</div>
            <div className="border-t border-slate-600 pt-2">Authorized Signatory / Cashier</div>
          </div>
        </div>
      )}
    </Layout>
  );
}
