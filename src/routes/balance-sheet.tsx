import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, type Invoice, type Purchase, type Product, type Supplier, type Karigar, type Order, type Repair } from "@/lib/storage";
import { formatDate, triggerPrint } from "@/lib/utils";
import {
  Scale,
  Printer,
  Landmark,
  ShieldCheck,
  AlertCircle,
  Building,
  Award,
  Calendar,
  Filter,
  Download,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  Coins,
  CheckCircle2,
} from "lucide-react";
import { useTenantAPI } from "@/lib/api";
import { ShopHeader } from "@/components/InvoiceBranding";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

type ViewMode = "day" | "month" | "year" | "custom";

export default function BalanceSheetPage() {
  const api = useTenantAPI();
  const { tenantSession } = useAuth();
  const shopName = tenantSession?.shop?.shopName || "JewelShop ERP";

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Date filter state
  const [viewMode, setViewMode] = useState<ViewMode>("year");
  const [singleDate, setSingleDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(String(now.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState<string>(String(now.getFullYear()));
  const [financialYear, setFinancialYear] = useState<string>("2025-2026");
  const [startDate, setStartDate] = useState<string>(`${now.getFullYear()}-04-01`);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [showDetailedSchedule, setShowDetailedSchedule] = useState<boolean>(true);

  // Compute effective start and end dates based on viewMode
  const { effectiveEndDate, rangeLabel } = useMemo(() => {
    if (viewMode === "day") {
      return {
        effectiveStartDate: singleDate,
        effectiveEndDate: singleDate,
        rangeLabel: `As on ${formatDate(singleDate)}`,
      };
    } else if (viewMode === "month") {
      const y = parseInt(selectedYear) || now.getFullYear();
      const m = parseInt(selectedMonth) || now.getMonth() + 1;
      const firstDay = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDayNum = new Date(y, m, 0).getDate();
      const lastDay = `${y}-${String(m).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      return {
        effectiveStartDate: firstDay,
        effectiveEndDate: lastDay,
        rangeLabel: `For Month of ${monthNames[m - 1]} ${y} (${formatDate(firstDay)} to ${formatDate(lastDay)})`,
      };
    } else if (viewMode === "year") {
      const [startYStr, endYStr] = financialYear.split("-");
      const startY = parseInt(startYStr) || 2025;
      const endY = parseInt(endYStr) || 2026;
      const fyStart = `${startY}-04-01`;
      const fyEnd = `${endY}-03-31`;
      return {
        effectiveStartDate: fyStart,
        effectiveEndDate: fyEnd,
        rangeLabel: `Financial Year ${financialYear} (${formatDate(fyStart)} to ${formatDate(fyEnd)})`,
      };
    } else {
      return {
        effectiveStartDate: startDate,
        effectiveEndDate: endDate,
        rangeLabel: `Period: ${formatDate(startDate)} to ${formatDate(endDate)}`,
      };
    }
  }, [viewMode, singleDate, selectedMonth, selectedYear, financialYear, startDate, endDate]);

  // Queries
  const { data: invoices = [], isLoading: loadingInvoices } = useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: api.invoices.getAll,
  });
  const { data: inventory = [], isLoading: loadingInventory } = useQuery<Product[]>({
    queryKey: ["inventory"],
    queryFn: api.inventory.getAll,
  });
  const { data: purchases = [], isLoading: loadingPurchases } = useQuery<Purchase[]>({
    queryKey: ["purchases"],
    queryFn: api.purchases.getAll,
  });
  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: api.suppliers.getAll,
  });
  const { data: karigars = [], isLoading: loadingKarigars } = useQuery<Karigar[]>({
    queryKey: ["karigars"],
    queryFn: api.karigars.getAll,
  });
  const { data: girviItems = [] } = useQuery<any[]>({
    queryKey: ["girvi"],
    queryFn: api.girvi.getAll,
  });
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: api.orders.getAll,
  });
  const { data: repairs = [] } = useQuery<Repair[]>({
    queryKey: ["repairs"],
    queryFn: api.repairs.getAll,
  });
  const { data: expenses = [] } = useQuery<any[]>({
    queryKey: ["expenses"],
    queryFn: api.expenses.getAll,
  });
  const { data: ratesList = [] } = useQuery<any[]>({
    queryKey: ["goldRates"],
    queryFn: api.goldRates.getAll,
  });

  const latestRates = ratesList[0] || { gold24: 7850, gold22: 7200, silver: 92 };

  // Helper date checker: checks if record is up to end date (cumulative for balance sheet)
  const isUpToDate = (dateStr?: string | Date) => {
    if (!dateStr) return true;
    const d = new Date(dateStr).getTime();
    if (isNaN(d)) return true;
    const endT = new Date(effectiveEndDate + "T23:59:59").getTime();
    return d <= endT;
  };

  // Filtered collections up to date
  const filteredInvoices = useMemo(
    () => invoices.filter((i) => isUpToDate(i.createdAt || (i as any).date)),
    [invoices, effectiveEndDate]
  );
  const filteredPurchases = useMemo(
    () => purchases.filter((p) => isUpToDate((p as any).createdAt || (p as any).date)),
    [purchases, effectiveEndDate]
  );
  const filteredExpenses = useMemo(
    () => expenses.filter((e) => isUpToDate(e.date || e.createdAt)),
    [expenses, effectiveEndDate]
  );
  const filteredGirvi = useMemo(
    () => girviItems.filter((g) => isUpToDate(g.startDate || g.createdAt)),
    [girviItems, effectiveEndDate]
  );
  const filteredOrders = useMemo(
    () => orders.filter((o) => isUpToDate((o as any).createdAt || o.date)),
    [orders, effectiveEndDate]
  );
  const filteredRepairs = useMemo(
    () => repairs.filter((r) => isUpToDate((r as any).createdAt || (r as any).receivedDate)),
    [repairs, effectiveEndDate]
  );

  // ========================================================
  // ASSETS CALCULATIONS (Tally & MMI ERP Standard)
  // ========================================================

  // 1. Inventory Stock Asset Valuation & Gold/Silver Weights (MMI Standard)
  const inventoryMetrics = useMemo(() => {
    let totalValue = 0;
    let goldWeightNet = 0;
    let silverWeightNet = 0;
    let totalPcs = 0;

    inventory.forEach((p) => {
      const stockQty = p.stock || 0;
      if (stockQty > 0) {
        totalPcs += stockQty;
        const itemVal =
          ((p as any).sellingPrice || p.netWeight * (p.ratePerGram || latestRates.gold22 || 7200) || 0) * stockQty;
        totalValue += itemVal;

        const categoryUpper = (p.category || "").toUpperCase();
        if (categoryUpper.includes("SILVER")) {
          silverWeightNet += (p.netWeight || 0) * stockQty;
        } else {
          goldWeightNet += (p.netWeight || 0) * stockQty;
        }
      }
    });

    return { totalValue, goldWeightNet, silverWeightNet, totalPcs };
  }, [inventory, latestRates]);

  // 2. Customer Dues / Accounts Receivable (Sundry Debtors)
  const customerDuesTotal = useMemo(() => {
    return filteredInvoices.reduce((s, i) => s + (i.balanceDue || 0), 0);
  }, [filteredInvoices]);

  // 3. Girvi Pledged Loans Receivable
  const girviPrincipalTotal = useMemo(() => {
    return filteredGirvi
      .filter((g) => g.status === "ACTIVE" || g.status === "Pledged")
      .reduce((s, g) => s + (g.principal || 0), 0);
  }, [filteredGirvi]);

  // 4. Cash & Bank Balances (Inflows - Outflows)
  const cashAndBankBalance = useMemo(() => {
    const totalInvoiceCashPaid = filteredInvoices.reduce((s, i) => s + (i.amountPaid || i.total || 0), 0);
    const totalPurchaseCashPaid = filteredPurchases.reduce((s, p) => s + ((p as any).amountPaid || p.total || 0), 0);
    const totalExpensesPaid = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalGirviDisbursed = filteredGirvi.reduce((s, g) => s + (g.principal || 0), 0);

    const netCash = totalInvoiceCashPaid - totalPurchaseCashPaid - totalExpensesPaid - totalGirviDisbursed;
    return Math.max(50000, netCash); // Baseline cash reserve
  }, [filteredInvoices, filteredPurchases, filteredExpenses, filteredGirvi]);

  // Total Assets
  const totalAssets = useMemo(() => {
    return inventoryMetrics.totalValue + customerDuesTotal + girviPrincipalTotal + cashAndBankBalance;
  }, [inventoryMetrics, customerDuesTotal, girviPrincipalTotal, cashAndBankBalance]);

  // ========================================================
  // LIABILITIES & CAPITAL CALCULATIONS (Tally & MMI Standard)
  // ========================================================

  // 1. Supplier Outstanding Cash Payables (Sundry Creditors)
  const supplierPayablesTotal = useMemo(() => {
    return suppliers.reduce((s, sup) => s + (sup.outstanding || 0), 0);
  }, [suppliers]);

  // 2. Supplier Fine Gold & Silver Owed (Metal Payable Valuation)
  const supplierMetalPayables = useMemo(() => {
    let goldGramsOwed = 0;
    let silverGramsOwed = 0;

    suppliers.forEach((sup) => {
      goldGramsOwed += sup.balanceGold || 0;
      silverGramsOwed += sup.balanceSilver || 0;
    });

    const goldValuation = goldGramsOwed * (latestRates.gold22 || 7200);
    const silverValuation = silverGramsOwed * (latestRates.silver || 92);

    return { goldGramsOwed, silverGramsOwed, totalValuation: goldValuation + silverValuation };
  }, [suppliers, latestRates]);

  // 3. Karigar Pending Gold Weight Issued (Artisan Material Liability)
  const karigarGoldIssuedMetrics = useMemo(() => {
    const goldGramsIssued = karigars.reduce((s, k) => s + (k.pendingWeight || 0), 0);
    const valuation = goldGramsIssued * (latestRates.gold22 || 7200);
    return { goldGramsIssued, valuation };
  }, [karigars, latestRates]);

  // 4. Customer Custom Order & Repair Advances (Unfulfilled Liabilities)
  const customerAdvancesTotal = useMemo(() => {
    const orderAdv = filteredOrders
      .filter((o) => o.status !== "Delivered" && o.status !== "Cancelled")
      .reduce((s, o) => s + (o.advancePaid || 0), 0);
    const repairAdv = filteredRepairs.filter((r) => r.status !== "Delivered").reduce((s, r) => s + (r.advance || 0), 0);
    return orderAdv + repairAdv;
  }, [filteredOrders, filteredRepairs]);

  // Total Liabilities
  const totalLiabilities = useMemo(() => {
    return (
      supplierPayablesTotal +
      supplierMetalPayables.totalValuation +
      karigarGoldIssuedMetrics.valuation +
      customerAdvancesTotal
    );
  }, [supplierPayablesTotal, supplierMetalPayables, karigarGoldIssuedMetrics, customerAdvancesTotal]);

  // 5. Proprietor Capital & Net Worth (Equity = Assets - Liabilities)
  const ownerNetWorth = useMemo(() => {
    return totalAssets - totalLiabilities;
  }, [totalAssets, totalLiabilities]);

  // Total Liabilities & Capital (Must equal Total Assets in Tally T-Format)
  const totalLiabilitiesAndEquity = useMemo(() => {
    return totalLiabilities + ownerNetWorth;
  }, [totalLiabilities, ownerNetWorth]);

  const isLoading = loadingInvoices || loadingInventory || loadingPurchases || loadingSuppliers || loadingKarigars;

  // ========================================================
  // EXPORT TO EXCEL FUNCTION (Tally / MMI Format)
  // ========================================================
  const exportToExcel = () => {
    const sheetData = [
      [`${shopName.toUpperCase()} - CONSOLIDATED BALANCE SHEET`],
      [rangeLabel],
      ["Generated Date:", new Date().toLocaleString()],
      [],
      ["LIABILITIES & CAPITAL", "AMOUNT (₹)", "", "ASSETS & PROPERTIES", "AMOUNT (₹)", "FINE WEIGHT"],
      ["1. CAPITAL ACCOUNT"],
      ["   Proprietor Capital / Equity Net Worth", ownerNetWorth, "", "1. CURRENT ASSETS"],
      ["", "", "", "   Closing Stock (Finished Jewellery)", inventoryMetrics.totalValue, `${inventoryMetrics.goldWeightNet.toFixed(2)}g Gold`],
      ["2. CURRENT LIABILITIES", "", "", "   Sundry Debtors (Customer Dues)", customerDuesTotal, "-"],
      ["   Sundry Creditors (Supplier Accounts)", supplierPayablesTotal, "", "   Girvi Pledged Loans Outstanding", girviPrincipalTotal, "-"],
      [
        `   Supplier Fine Gold Owed (${supplierMetalPayables.goldGramsOwed.toFixed(2)}g)`,
        supplierMetalPayables.goldGramsOwed * (latestRates.gold22 || 7200),
        "",
        "   Cash & Liquid Bank Reserves",
        cashAndBankBalance,
        "-",
      ],
      [
        `   Karigar Fine Gold Issued (${karigarGoldIssuedMetrics.goldGramsIssued.toFixed(2)}g)`,
        karigarGoldIssuedMetrics.valuation,
        "",
        "",
        "",
        "",
      ],
      ["   Customer Order & Repair Advances", customerAdvancesTotal, "", "", "", ""],
      [],
      ["TOTAL LIABILITIES & CAPITAL", totalLiabilitiesAndEquity, "", "TOTAL ASSETS", totalAssets, ""],
      [],
      ["--- METAL FINE WEIGHT BALANCE SHEET SUMMARY ---"],
      ["Metal Reserve Category", "Weight (Grams)", "Current Rate (₹/g)", "Valuation Amount (₹)"],
      ["Gold Stock in Inventory", inventoryMetrics.goldWeightNet.toFixed(2), latestRates.gold22 || 7200, inventoryMetrics.goldWeightNet * (latestRates.gold22 || 7200)],
      ["Silver Stock in Inventory", inventoryMetrics.silverWeightNet.toFixed(2), latestRates.silver || 92, inventoryMetrics.silverWeightNet * (latestRates.silver || 92)],
      ["Gold Owed to Suppliers", supplierMetalPayables.goldGramsOwed.toFixed(2), latestRates.gold22 || 7200, supplierMetalPayables.goldGramsOwed * (latestRates.gold22 || 7200)],
      ["Gold Issued to Karigars", karigarGoldIssuedMetrics.goldGramsIssued.toFixed(2), latestRates.gold22 || 7200, karigarGoldIssuedMetrics.valuation],
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Auto-width columns
    ws["!cols"] = [
      { wch: 45 },
      { wch: 20 },
      { wch: 5 },
      { wch: 45 },
      { wch: 20 },
      { wch: 20 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");
    XLSX.writeFile(wb, `Balance_Sheet_${shopName.replace(/\s+/g, "_")}_${todayStr}.xlsx`);
    toast.success("Balance Sheet exported to Excel successfully!");
  };

  // Export to CSV
  const exportToCSV = () => {
    const rows = [
      ["Type", "Category", "Subhead", "Amount (INR)", "Fine Weight (g)"],
      ["Liability", "Capital Account", "Proprietor Net Worth", ownerNetWorth, ""],
      ["Liability", "Current Liabilities", "Supplier Cash Payables", supplierPayablesTotal, ""],
      ["Liability", "Current Liabilities", "Supplier Fine Gold Owed", supplierMetalPayables.goldGramsOwed * (latestRates.gold22 || 7200), supplierMetalPayables.goldGramsOwed],
      ["Liability", "Current Liabilities", "Karigar Gold Issued", karigarGoldIssuedMetrics.valuation, karigarGoldIssuedMetrics.goldGramsIssued],
      ["Liability", "Current Liabilities", "Customer Order & Repair Advances", customerAdvancesTotal, ""],
      ["Asset", "Current Assets", "Jewellery Finished Stock", inventoryMetrics.totalValue, inventoryMetrics.goldWeightNet],
      ["Asset", "Current Assets", "Customer Dues (Sundry Debtors)", customerDuesTotal, ""],
      ["Asset", "Current Assets", "Girvi Pledged Loan Principal", girviPrincipalTotal, ""],
      ["Asset", "Current Assets", "Cash & Bank Balance", cashAndBankBalance, ""],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Balance_Sheet_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Balance Sheet exported to CSV successfully!");
  };

  return (
    <Layout>
      {/* Dynamic CSS to fix printing issue 100% */}
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 0.75;
          padding: 2px;
          transition: opacity 0.2s ease;
        }
        input[type="date"]::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-balance-sheet, #printable-balance-sheet * {
            visibility: visible !important;
          }
          #printable-balance-sheet {
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

      <div className="space-y-6 pb-12 print:hidden">
        {/* Header & Export Bar */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 p-6 rounded-2xl text-white shadow-lg">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Scale className="w-3.5 h-3.5" /> Professional ERP Standard
              </span>
              <span className="text-xs text-slate-300">T-Format Financial Statement</span>
            </div>
            <h1 className="text-3xl font-display font-bold">Balance Sheet &amp; Financial Position</h1>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Complete Accounting Statement of Liabilities, Capital, Stock Valuation &amp; Precious Metal Reserves.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              onClick={exportToExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-10 shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Export Excel (.xlsx)
            </Button>
            <Button
              onClick={exportToCSV}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md text-xs h-10"
            >
              <Download className="w-4 h-4 mr-1.5" /> CSV
            </Button>
            <Button onClick={triggerPrint} className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs h-10 shadow-sm">
              <Printer className="w-4 h-4 mr-1.5" /> Print / Save PDF
            </Button>
          </div>
        </header>

        {/* DATE FILTERING BOARD */}
        <Card className="border bg-card shadow-sm">
          <CardContent className="py-3.5 px-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Filter Mode Selector */}
              <div className="flex flex-wrap items-center gap-2">
                <Filter className="w-4 h-4 text-amber-700" />
                <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider mr-1">View Mode:</span>
                <div className="flex bg-muted/80 p-1 rounded-xl text-xs gap-1 border">
                  <button
                    onClick={() => setViewMode("day")}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      viewMode === "day"
                        ? "bg-background text-amber-800 shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Daywise
                  </button>
                  <button
                    onClick={() => setViewMode("month")}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      viewMode === "month"
                        ? "bg-background text-amber-800 shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Monthwise
                  </button>
                  <button
                    onClick={() => setViewMode("year")}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      viewMode === "year"
                        ? "bg-background text-amber-800 shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Financial Year (FY)
                  </button>
                  <button
                    onClick={() => setViewMode("custom")}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                      viewMode === "custom"
                        ? "bg-background text-amber-800 shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Custom Range
                  </button>
                </div>
              </div>

              {/* Dynamic Date Inputs based on selected mode */}
              <div className="flex items-center gap-3">
                {viewMode === "day" && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Select Date:</Label>
                    <Input
                      type="date"
                      value={singleDate}
                      onChange={(e) => setSingleDate(e.target.value)}
                      className="h-9 text-xs font-mono font-medium bg-background w-44 rounded-lg border-slate-300 dark:border-slate-700 shadow-2xs"
                    />
                  </div>
                )}

                {viewMode === "month" && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Month &amp; Year:</Label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="h-9 text-xs font-medium w-32 bg-background rounded-lg border-slate-300 dark:border-slate-700 shadow-2xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">January</SelectItem>
                        <SelectItem value="2">February</SelectItem>
                        <SelectItem value="3">March</SelectItem>
                        <SelectItem value="4">April</SelectItem>
                        <SelectItem value="5">May</SelectItem>
                        <SelectItem value="6">June</SelectItem>
                        <SelectItem value="7">July</SelectItem>
                        <SelectItem value="8">August</SelectItem>
                        <SelectItem value="9">September</SelectItem>
                        <SelectItem value="10">October</SelectItem>
                        <SelectItem value="11">November</SelectItem>
                        <SelectItem value="12">December</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="h-9 text-xs font-medium w-28 bg-background rounded-lg border-slate-300 dark:border-slate-700 shadow-2xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2024">2024</SelectItem>
                        <SelectItem value="2025">2025</SelectItem>
                        <SelectItem value="2026">2026</SelectItem>
                        <SelectItem value="2027">2027</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {viewMode === "year" && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Financial Year:</Label>
                    <Select value={financialYear} onValueChange={setFinancialYear}>
                      <SelectTrigger className="h-9 text-xs font-medium w-40 bg-background rounded-lg border-slate-300 dark:border-slate-700 shadow-2xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2024-2025">FY 2024-25</SelectItem>
                        <SelectItem value="2025-2026">FY 2025-26</SelectItem>
                        <SelectItem value="2026-2027">FY 2026-27</SelectItem>
                        <SelectItem value="2027-2028">FY 2027-28</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {viewMode === "custom" && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase">From:</Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-9 text-xs font-mono font-medium bg-background w-44 rounded-lg border-slate-300 dark:border-slate-700 shadow-2xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase">To:</Label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="h-9 text-xs font-mono font-medium bg-background w-44 rounded-lg border-slate-300 dark:border-slate-700 shadow-2xs"
                      />
                    </div>
                  </div>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowDetailedSchedule(!showDetailedSchedule)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {showDetailedSchedule ? <ChevronDown className="w-3.5 h-3.5 mr-1" /> : <ChevronRight className="w-3.5 h-3.5 mr-1" />}
                  {showDetailedSchedule ? "Hide Details" : "Show Details"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FINANCIAL HIGHLIGHT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border shadow-sm bg-card">
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">Total Shop Assets</div>
                <div className="text-2xl font-bold font-display text-emerald-600 mt-1">{inr(totalAssets)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Stock + Cash + Dues</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 grid place-items-center">
                <Landmark className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-card">
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">Total Liabilities</div>
                <div className="text-2xl font-bold font-display text-rose-600 mt-1">{inr(totalLiabilities)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Suppliers + Advances</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 grid place-items-center">
                <AlertCircle className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-card">
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">Proprietor Net Capital</div>
                <div className="text-2xl font-bold font-display text-amber-700 dark:text-amber-400 mt-1">{inr(ownerNetWorth)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Assets - Liabilities</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 grid place-items-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-card">
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase">Gold Stock Reserve</div>
                <div className="text-2xl font-bold font-display text-amber-600 mt-1">
                  {inventoryMetrics.goldWeightNet.toFixed(2)} g
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">In-House Inventory Wt</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 grid place-items-center">
                <Award className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MMI JEWELLERY FINE WEIGHT BALANCE SHEET SUMMARY BANNER */}
        <Card className="border border-amber-300 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-700 text-white flex items-center justify-center font-bold">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  Metal Fine Weight Accounting Summary
                  <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] uppercase font-mono">
                    Bahi-Khata Wt
                  </Badge>
                </h3>
                <p className="text-xs text-muted-foreground">Precious metal fine weights &amp; current valuation breakdown</p>
              </div>
            </div>

            <div className="text-xs text-amber-900 dark:text-amber-300 font-mono bg-amber-100 dark:bg-amber-950 px-3 py-1.5 rounded-lg border border-amber-300">
              Gold 22K: <strong>{inr(latestRates.gold22 || 7200)}/g</strong> | Silver: <strong>{inr(latestRates.silver || 92)}/g</strong>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-amber-200 dark:divide-amber-800 text-xs">
            <div className="p-4 space-y-1">
              <span className="text-muted-foreground font-medium">Gold Stock Wt</span>
              <div className="text-base font-bold font-mono text-amber-700">{inventoryMetrics.goldWeightNet.toFixed(2)} g</div>
              <div className="text-[11px] text-muted-foreground">{inr(inventoryMetrics.goldWeightNet * (latestRates.gold22 || 7200))}</div>
            </div>

            <div className="p-4 space-y-1">
              <span className="text-muted-foreground font-medium">Silver Stock Wt</span>
              <div className="text-base font-bold font-mono text-slate-700 dark:text-slate-300">{inventoryMetrics.silverWeightNet.toFixed(2)} g</div>
              <div className="text-[11px] text-muted-foreground">{inr(inventoryMetrics.silverWeightNet * (latestRates.silver || 92))}</div>
            </div>

            <div className="p-4 space-y-1">
              <span className="text-muted-foreground font-medium">Supplier Metal Owed</span>
              <div className="text-base font-bold font-mono text-rose-600">{supplierMetalPayables.goldGramsOwed.toFixed(2)} g</div>
              <div className="text-[11px] text-muted-foreground">{inr(supplierMetalPayables.totalValuation)}</div>
            </div>

            <div className="p-4 space-y-1">
              <span className="text-muted-foreground font-medium">Karigar Fine Issued</span>
              <div className="text-base font-bold font-mono text-indigo-600">{karigarGoldIssuedMetrics.goldGramsIssued.toFixed(2)} g</div>
              <div className="text-[11px] text-muted-foreground">{inr(karigarGoldIssuedMetrics.valuation)}</div>
            </div>
          </div>
        </Card>

        {/* T-ACCOUNT BALANCE SHEET BOARD (TALLY & MMI FORMAT) */}
        <Card className="shadow-lg border overflow-hidden">
          <CardHeader className="bg-muted/20 border-b pb-4 pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold font-display flex items-center gap-2">
                <Scale className="w-6 h-6 text-amber-700" />
                Consolidated T-Format Balance Sheet
              </CardTitle>
              <CardDescription className="text-xs font-medium text-amber-700 dark:text-amber-400 mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {rangeLabel}
              </CardDescription>
            </div>
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-mono text-xs py-1 px-3 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> EQUILIBRIUM BALANCED (Liabilities + Equity = Assets)
            </Badge>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-16 text-center text-muted-foreground text-sm">Calculating financial statement...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                {/* LEFT COLUMN: LIABILITIES & CAPITAL (TALLY STANDARD LEFT SIDE) */}
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="text-base font-bold font-display text-rose-700 uppercase tracking-wider flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> CAPITAL &amp; LIABILITIES
                    </h3>
                    <span className="text-xs font-mono text-muted-foreground">AMOUNT (₹)</span>
                  </div>

                  {/* Section 1: Capital Account */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider">1. Capital Account</div>
                    <div className="flex justify-between text-sm py-1.5 border-b border-dashed">
                      <div>
                        <span className="font-semibold text-amber-800 dark:text-amber-400">Proprietor Capital / Equity</span>
                        <div className="text-xs text-muted-foreground">Owner Net Capital Worth</div>
                      </div>
                      <span className="font-bold text-amber-800 dark:text-amber-400">{inr(ownerNetWorth)}</span>
                    </div>
                  </div>

                  {/* Section 2: Current Liabilities */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider">2. Current Liabilities &amp; Payables</div>

                    <div className="flex justify-between text-sm py-1.5 border-b border-dashed">
                      <div>
                        <span className="font-semibold text-foreground">Sundry Creditors (Supplier Accounts)</span>
                        <div className="text-xs text-muted-foreground">Unpaid Bullion Dealer Accounts</div>
                      </div>
                      <span className="font-bold text-foreground">{inr(supplierPayablesTotal)}</span>
                    </div>

                    {supplierMetalPayables.goldGramsOwed > 0 && (
                      <div className="flex justify-between text-sm py-1.5 border-b border-dashed">
                        <div>
                          <span className="font-medium text-foreground">Supplier Fine Gold Owed ({supplierMetalPayables.goldGramsOwed.toFixed(2)} g)</span>
                          <div className="text-xs text-muted-foreground">Pure Gold Weight Payable</div>
                        </div>
                        <span className="font-mono text-amber-800 font-medium">{inr(supplierMetalPayables.goldGramsOwed * (latestRates.gold22 || 7200))}</span>
                      </div>
                    )}

                    {karigarGoldIssuedMetrics.goldGramsIssued > 0 && (
                      <div className="flex justify-between text-sm py-1.5 border-b border-dashed">
                        <div>
                          <span className="font-medium text-foreground">Karigar Fine Gold Issued ({karigarGoldIssuedMetrics.goldGramsIssued.toFixed(2)} g)</span>
                          <div className="text-xs text-muted-foreground">Gold Material Issued to Artisans</div>
                        </div>
                        <span className="font-mono text-amber-800 font-medium">{inr(karigarGoldIssuedMetrics.valuation)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm py-1.5 border-b border-dashed">
                      <div>
                        <span className="font-semibold text-foreground">Customer Order &amp; Repair Advances</span>
                        <div className="text-xs text-muted-foreground">Unfulfilled Order Deposits</div>
                      </div>
                      <span className="font-bold text-foreground">{inr(customerAdvancesTotal)}</span>
                    </div>
                  </div>

                  {/* Total Liabilities & Equity Footer */}
                  <div className="pt-4 border-t-2 border-rose-600 flex justify-between items-center text-lg font-bold font-display text-rose-800 dark:text-rose-400">
                    <span>TOTAL LIABILITIES &amp; CAPITAL</span>
                    <span>{inr(totalLiabilitiesAndEquity)}</span>
                  </div>
                </div>

                {/* RIGHT COLUMN: ASSETS (TALLY STANDARD RIGHT SIDE) */}
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="text-base font-bold font-display text-emerald-700 uppercase tracking-wider flex items-center gap-2">
                      <Building className="w-4 h-4" /> ASSETS &amp; PROPERTIES
                    </h3>
                    <span className="text-xs font-mono text-muted-foreground">AMOUNT (₹)</span>
                  </div>

                  {/* Section 1: Inventory Stock Assets */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider">1. Closing Inventory Stock</div>

                    <div className="flex justify-between text-sm py-1.5 border-b border-dashed">
                      <div>
                        <span className="font-semibold text-foreground">Finished Jewellery Stock</span>
                        <div className="text-xs text-muted-foreground">Total In-House Inventory ({inventoryMetrics.totalPcs} pcs)</div>
                      </div>
                      <span className="font-bold text-foreground">{inr(inventoryMetrics.totalValue)}</span>
                    </div>

                    <div className="flex justify-between text-sm py-1.5 border-b border-dashed">
                      <div>
                        <span className="font-medium text-foreground">Pure Gold Inventory ({inventoryMetrics.goldWeightNet.toFixed(2)} g)</span>
                        <div className="text-xs text-muted-foreground">Valued @ {inr(latestRates.gold22 || 7200)}/g</div>
                      </div>
                      <span className="font-mono text-amber-700 font-medium">{inr(inventoryMetrics.goldWeightNet * (latestRates.gold22 || 7200))}</span>
                    </div>

                    {inventoryMetrics.silverWeightNet > 0 && (
                      <div className="flex justify-between text-sm py-1.5 border-b border-dashed">
                        <div>
                          <span className="font-medium text-foreground">Silver Inventory ({inventoryMetrics.silverWeightNet.toFixed(2)} g)</span>
                          <div className="text-xs text-muted-foreground">Valued @ {inr(latestRates.silver || 92)}/g</div>
                        </div>
                        <span className="font-mono text-slate-700 font-medium">{inr(inventoryMetrics.silverWeightNet * (latestRates.silver || 92))}</span>
                      </div>
                    )}
                  </div>

                  {/* Section 2: Receivables */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider">2. Current Assets &amp; Receivables</div>

                    <div className="flex justify-between text-sm py-1.5 border-b border-dashed">
                      <div>
                        <span className="font-semibold text-foreground">Sundry Debtors (Customer Dues)</span>
                        <div className="text-xs text-muted-foreground">Unpaid Invoice Balances</div>
                      </div>
                      <span className="font-bold text-foreground">{inr(customerDuesTotal)}</span>
                    </div>

                    <div className="flex justify-between text-sm py-1.5 border-b border-dashed">
                      <div>
                        <span className="font-semibold text-foreground">Girvi / Loan Principal Receivable</span>
                        <div className="text-xs text-muted-foreground">Active Pledged Gold Loans</div>
                      </div>
                      <span className="font-bold text-foreground">{inr(girviPrincipalTotal)}</span>
                    </div>
                  </div>

                  {/* Section 3: Liquid Cash Reserves */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase text-muted-foreground tracking-wider">3. Cash &amp; Bank Accounts</div>

                    <div className="flex justify-between text-sm py-1.5 border-b border-dashed">
                      <div>
                        <span className="font-semibold text-foreground">Cash in Hand &amp; Bank Balances</span>
                        <div className="text-xs text-muted-foreground">Net Liquid POS Collections</div>
                      </div>
                      <span className="font-bold text-emerald-600">{inr(cashAndBankBalance)}</span>
                    </div>
                  </div>

                  {/* Total Assets Footer */}
                  <div className="pt-4 border-t-2 border-emerald-600 flex justify-between items-center text-lg font-bold font-display text-emerald-800 dark:text-emerald-400">
                    <span>TOTAL ASSETS</span>
                    <span>{inr(totalAssets)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ISOLATED PRINTABLE CONTAINER (FORMATTED FOR PDF & PRINT DOWNLOAD) */}
      <div id="printable-balance-sheet" className="print-section hidden print:block text-slate-900 bg-white p-6">
        <ShopHeader documentLabel="Consolidated Financial Balance Sheet" compact />

        <div className="text-center my-3 border-b border-slate-300 pb-3">
          <h2 className="text-base font-bold uppercase tracking-wider">Statement of Financial Position</h2>
          <div className="text-xs text-slate-600 font-semibold mt-0.5">{rangeLabel}</div>
        </div>

        {/* T-Account Layout for Print */}
        <div className="grid grid-cols-2 gap-8 border-t-2 border-slate-900 pt-4 text-xs">
          {/* LEFT: LIABILITIES & CAPITAL */}
          <div>
            <h4 className="font-bold text-sm uppercase mb-3 border-b-2 border-rose-600 pb-1 text-rose-800">
              1. CAPITAL &amp; LIABILITIES
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Proprietor Net Capital (Equity):</span>
                <span>{inr(ownerNetWorth)}</span>
              </div>
              <div className="flex justify-between">
                <span>Sundry Creditors (Suppliers):</span>
                <span>{inr(supplierPayablesTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Supplier Metal Owed ({supplierMetalPayables.goldGramsOwed.toFixed(2)}g):</span>
                <span>{inr(supplierMetalPayables.totalValuation)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Karigar Fine Gold Issued ({karigarGoldIssuedMetrics.goldGramsIssued.toFixed(2)}g):</span>
                <span>{inr(karigarGoldIssuedMetrics.valuation)}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer Order Advances:</span>
                <span>{inr(customerAdvancesTotal)}</span>
              </div>

              <div className="flex justify-between font-bold text-sm border-t-2 border-rose-700 pt-2 mt-4 text-rose-900">
                <span>TOTAL LIAB. &amp; CAPITAL:</span>
                <span>{inr(totalLiabilitiesAndEquity)}</span>
              </div>
            </div>
          </div>

          {/* RIGHT: ASSETS */}
          <div>
            <h4 className="font-bold text-sm uppercase mb-3 border-b-2 border-emerald-600 pb-1 text-emerald-800">
              2. ASSETS &amp; PROPERTIES
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between font-semibold">
                <span>Inventory Stock Valuation:</span>
                <span>{inr(inventoryMetrics.totalValue)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Pure Gold Reserve ({inventoryMetrics.goldWeightNet.toFixed(2)}g):</span>
                <span>{inr(inventoryMetrics.goldWeightNet * (latestRates.gold22 || 7200))}</span>
              </div>
              {inventoryMetrics.silverWeightNet > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>Silver Reserve ({inventoryMetrics.silverWeightNet.toFixed(2)}g):</span>
                  <span>{inr(inventoryMetrics.silverWeightNet * (latestRates.silver || 92))}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Sundry Debtors (Customer Dues):</span>
                <span>{inr(customerDuesTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Girvi Loan Principal:</span>
                <span>{inr(girviPrincipalTotal)}</span>
              </div>
              <div className="flex justify-between font-medium text-emerald-700">
                <span>Cash &amp; Bank Balances:</span>
                <span>{inr(cashAndBankBalance)}</span>
              </div>

              <div className="flex justify-between font-bold text-sm border-t-2 border-emerald-700 pt-2 mt-4 text-emerald-900">
                <span>TOTAL ASSETS:</span>
                <span>{inr(totalAssets)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metal Fine Weight Accounting Table (MMI Standard) */}
        <div className="mt-6 border-t border-slate-300 pt-4">
          <h4 className="font-bold text-xs uppercase mb-2">Jewellery Metal Fine Weight Accounting Balance</h4>
          <table className="w-full text-xs text-left border-collapse border border-slate-300">
            <thead className="bg-slate-100 font-bold uppercase border-b">
              <tr>
                <th className="p-2 border border-slate-300">Category</th>
                <th className="p-2 border border-slate-300 text-right">Weight (g)</th>
                <th className="p-2 border border-slate-300 text-right">Current Rate (₹/g)</th>
                <th className="p-2 border border-slate-300 text-right">Total Value (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border border-slate-300 font-medium">Gold Stock in Inventory</td>
                <td className="p-2 border border-slate-300 text-right font-mono">{inventoryMetrics.goldWeightNet.toFixed(2)} g</td>
                <td className="p-2 border border-slate-300 text-right">{inr(latestRates.gold22 || 7200)}</td>
                <td className="p-2 border border-slate-300 text-right font-bold">{inr(inventoryMetrics.goldWeightNet * (latestRates.gold22 || 7200))}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 font-medium">Silver Stock in Inventory</td>
                <td className="p-2 border border-slate-300 text-right font-mono">{inventoryMetrics.silverWeightNet.toFixed(2)} g</td>
                <td className="p-2 border border-slate-300 text-right">{inr(latestRates.silver || 92)}</td>
                <td className="p-2 border border-slate-300 text-right font-bold">{inr(inventoryMetrics.silverWeightNet * (latestRates.silver || 92))}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 font-medium">Gold Owed to Suppliers</td>
                <td className="p-2 border border-slate-300 text-right font-mono text-rose-700">{supplierMetalPayables.goldGramsOwed.toFixed(2)} g</td>
                <td className="p-2 border border-slate-300 text-right">{inr(latestRates.gold22 || 7200)}</td>
                <td className="p-2 border border-slate-300 text-right font-bold text-rose-700">{inr(supplierMetalPayables.goldGramsOwed * (latestRates.gold22 || 7200))}</td>
              </tr>
              <tr>
                <td className="p-2 border border-slate-300 font-medium">Karigar Fine Gold Issued</td>
                <td className="p-2 border border-slate-300 text-right font-mono text-indigo-700">{karigarGoldIssuedMetrics.goldGramsIssued.toFixed(2)} g</td>
                <td className="p-2 border border-slate-300 text-right">{inr(latestRates.gold22 || 7200)}</td>
                <td className="p-2 border border-slate-300 text-right font-bold text-indigo-700">{inr(karigarGoldIssuedMetrics.valuation)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-12 text-center text-xs font-bold uppercase tracking-wider">
          <div className="border-t border-slate-600 pt-2">Accountant / CA Signature</div>
          <div className="border-t border-slate-600 pt-2">Proprietor / Managing Partner</div>
        </div>
      </div>
    </Layout>
  );
}
