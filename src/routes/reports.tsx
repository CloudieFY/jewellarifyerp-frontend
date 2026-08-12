import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr, type Invoice, type Purchase, type Supplier, type Expense } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useTenantAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  TrendingUp,
  Wallet,
  AlertTriangle,
  PieChart as PieChartIcon,
  Receipt,
  ShoppingBag,
  Search,
  Coins,
  FileSpreadsheet
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Select as CustomSelect, SelectContent as SC, SelectItem as SI, SelectTrigger as ST, SelectValue as SV } from "@/components/ui/select";

export default function ReportsPage() {
  const { tenantSession } = useAuth();
  const isOperator = tenantSession?.user?.role === "operator";
  const api = useTenantAPI();

  // Queries
  const { data: allInvoices = [], isLoading: isLoadingInvoices } = useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: api.invoices.getAll
  });

  const { data: allPurchases = [], isLoading: isLoadingPurchases } = useQuery<Purchase[]>({
    queryKey: ["purchases"],
    queryFn: api.purchases.getAll
  });

  const invoices = useMemo(() => allInvoices.filter(i => isOperator ? i.type !== "GST" : i.type === "GST"), [allInvoices, isOperator]);
  const purchases = useMemo(() => allPurchases.filter(p => isOperator ? (p as any).type !== "GST" && (!p.gstPct || p.gstPct === 0) : (p as any).type === "GST" || p.gstPct > 0), [allPurchases, isOperator]);

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: api.expenses.getAll
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: api.suppliers.getAll
  });

  const { data: salesReturns = [] } = useQuery<any[]>({
    queryKey: ["salesReturns"],
    queryFn: api.salesReturns.getAll
  });

  // Date State
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [startDate, setStartDate] = useState<string>(firstDayOfMonth.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(today.toISOString().slice(0, 10));
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Filters for Sales Report
  const [salesSearch, setSalesSearch] = useState("");
  const salesTypeFilter = "ALL";
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<string>("ALL");
  const [salesPage, setSalesPage] = useState(1);

  // Filters for Purchase Report
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const purchaseTypeFilter = "ALL";
  const [purchasePaymentFilter, setPurchasePaymentFilter] = useState<string>("ALL");
  const [purchaseMetalFilter, setPurchaseMetalFilter] = useState<string>("ALL");
  const [purchasePage, setPurchasePage] = useState(1);

  // Date Quick Selectors
  const setQuickRange = (type: "today" | "yesterday" | "thisMonth" | "lastMonth" | "thisYear") => {
    const now = new Date();
    if (type === "today") {
      const iso = now.toISOString().slice(0, 10);
      setStartDate(iso);
      setEndDate(iso);
    } else if (type === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const iso = y.toISOString().slice(0, 10);
      setStartDate(iso);
      setEndDate(iso);
    } else if (type === "thisMonth") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const end = now.toISOString().slice(0, 10);
      setStartDate(start);
      setEndDate(end);
    } else if (type === "lastMonth") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      setStartDate(start);
      setEndDate(end);
    } else if (type === "thisYear") {
      const start = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      const end = now.toISOString().slice(0, 10);
      setStartDate(start);
      setEndDate(end);
    }
  };

  // ----------------------------------------------------
  // FILTERED DATASETS BY DATE RANGE
  // ----------------------------------------------------
  const rangeInvoices = useMemo(() => {
    if (!startDate || !endDate) return [];
    return invoices.filter((i) => {
      if (!i.createdAt) return false;
      const d = i.createdAt.slice(0, 10);
      return d >= startDate && d <= endDate;
    });
  }, [invoices, startDate, endDate]);

  const rangePurchases = useMemo(() => {
    if (!startDate || !endDate) return [];
    return purchases.filter((p) => {
      if (!p.date) return false;
      const d = p.date.slice(0, 10);
      return d >= startDate && d <= endDate;
    });
  }, [purchases, startDate, endDate]);

  const rangeExpenses = useMemo(() => {
    if (!startDate || !endDate) return [];
    return expenses.filter((e) => {
      if (!e.date) return false;
      const d = e.date.slice(0, 10);
      return d >= startDate && d <= endDate;
    });
  }, [expenses, startDate, endDate]);

  // ----------------------------------------------------
  // SALES REPORT SPECIFIC CALCULATIONS & FILTERING
  // ----------------------------------------------------
  const filteredSales = useMemo(() => {
    return rangeInvoices.filter((inv) => {
      // Type Filter based on Tab
      if (activeTab === "sales" && inv.type !== "GST") return false;
      if (activeTab === "estimate-sales" && inv.type === "GST") return false;

      // Override UI Type Filter (we hide it from UI anyway)
      if (salesTypeFilter !== "ALL" && inv.type !== salesTypeFilter) return false;
      // Payment Mode Filter
      if (salesPaymentFilter !== "ALL" && inv.paymentMode !== salesPaymentFilter) return false;
      // Search query
      if (salesSearch) {
        const q = salesSearch.toLowerCase();
        const num = (inv.number || "").toLowerCase();
        const name = (inv.customerName || "").toLowerCase();
        const mob = (inv.customerMobile || "").toLowerCase();
        const addr = (inv.customerAddress || "").toLowerCase();
        if (!num.includes(q) && !name.includes(q) && !mob.includes(q) && !addr.includes(q)) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [rangeInvoices, salesTypeFilter, salesPaymentFilter, salesSearch, activeTab]);

  const rangeSalesReturns = useMemo(() => {
    if (!startDate || !endDate) return [];
    return salesReturns.filter((r: any) => {
      const dateStr = r.createdAt || r.date;
      if (!dateStr) return false;
      const d = String(dateStr).slice(0, 10);
      return d >= startDate && d <= endDate;
    });
  }, [salesReturns, startDate, endDate]);

  const returnedInvoiceIds = useMemo(
    () => new Set((salesReturns || []).map((r: any) => r.invoiceId)),
    [salesReturns]
  );

  const salesStats = useMemo(() => {
    let count = filteredSales.length;
    let totalGrossSales = 0;
    let totalDiscount = 0;
    let totalOldGold = 0;
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalTax = 0;
    let grandTotal = 0;
    let totalPaid = 0;
    let totalBalanceDue = 0;

    let totalGoldNetWeightGrams = 0;
    let totalSilverNetWeightGrams = 0;
    let totalDiamondWeightCt = 0;

    let returnedCount = 0;
    let returnedTotalAmount = 0;
    let returnedTaxable = 0;
    let returnedGoldWeight = 0;
    let returnedSilverWeight = 0;
    let returnedDiamondWeight = 0;

    filteredSales.forEach((inv) => {
      const isRet = (inv as any).isReturned || returnedInvoiceIds.has(inv._id || inv.id || "");
      const taxable = inv.subtotal - (inv.discount || 0) - (inv.oldGoldAmount || 0);

      let invGoldWt = 0;
      let invSilverWt = 0;
      let invDiamondWt = 0;

      inv.items?.forEach((item) => {
        const nameUpper = (item.name || "").toUpperCase();
        const purityUpper = (item.purity || "").toUpperCase();
        const netWt = item.netWeight * (item.qty || 1);

        if (nameUpper.includes("SILVER") || purityUpper.includes("925") || purityUpper.includes("SILVER")) {
          invSilverWt += netWt;
        } else if (nameUpper.includes("DIAMOND") || purityUpper.includes("CTS") || purityUpper.includes("CARAT")) {
          invDiamondWt += netWt;
        } else {
          invGoldWt += netWt;
        }
      });

      if (isRet) {
        returnedCount++;
        returnedTotalAmount += inv.total;
        returnedTaxable += taxable;
        returnedGoldWeight += invGoldWt;
        returnedSilverWeight += invSilverWt;
        returnedDiamondWeight += invDiamondWt;
      } else {
        totalGrossSales += inv.subtotal;
        totalDiscount += inv.discount || 0;
        totalOldGold += inv.oldGoldAmount || 0;
        totalTaxable += taxable;
        totalTax += inv.gstAmount || 0;

        // GST Split
        totalCgst += (inv.gstAmount || 0) / 2;
        totalSgst += (inv.gstAmount || 0) / 2;

        grandTotal += inv.total;
        totalPaid += inv.amountPaid || (inv.balanceDue === 0 ? inv.total : inv.total - (inv.balanceDue || 0));
        totalBalanceDue += inv.balanceDue || 0;

        totalGoldNetWeightGrams += invGoldWt;
        totalSilverNetWeightGrams += invSilverWt;
        totalDiamondWeightCt += invDiamondWt;
      }
    });

    const totalSalesReturnsRefund = rangeSalesReturns.reduce((s, r: any) => s + (r.totalRefund || 0), 0);
    const finalReturnedAmount = Math.max(returnedTotalAmount, totalSalesReturnsRefund);

    return {
      count,
      activeCount: count - returnedCount,
      returnedCount,
      totalGrossSales,
      totalDiscount,
      totalOldGold,
      totalTaxable,
      totalCgst,
      totalSgst,
      totalIgst,
      totalTax,
      grandTotal,
      netGrandTotal: grandTotal,
      totalPaid,
      netTotalPaid: totalPaid,
      totalSalesReturnsRefund: finalReturnedAmount,
      totalBalanceDue,
      totalGoldNetWeightGrams,
      totalSilverNetWeightGrams,
      totalDiamondWeightCt,
      returnedTotalAmount: finalReturnedAmount,
    };
  }, [filteredSales, returnedInvoiceIds, rangeSalesReturns]);


  // ----------------------------------------------------
  // PURCHASE REPORT SPECIFIC CALCULATIONS & FILTERING
  // ----------------------------------------------------
  const filteredPurchases = useMemo(() => {
    return rangePurchases.filter((p) => {
      const pType = (p as any).type || (p.gstPct > 0 ? "GST" : "NON-GST");
      if (activeTab === "purchases" && pType !== "GST") return false;
      if (activeTab === "estimate-purchases" && pType === "GST") return false;

      if (purchaseTypeFilter !== "ALL" && pType !== purchaseTypeFilter) return false;
      if (purchasePaymentFilter !== "ALL" && p.paymentMode !== purchasePaymentFilter) return false;
      if (purchaseMetalFilter !== "ALL" && p.metal !== purchaseMetalFilter) return false;

      if (purchaseSearch) {
        const q = purchaseSearch.toLowerCase();
        const bill = (p.billNo || "").toLowerCase();
        const sup = (p.supplierName || "").toLowerCase();
        const note = (p.note || "").toLowerCase();
        if (!bill.includes(q) && !sup.includes(q) && !note.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [rangePurchases, purchaseTypeFilter, purchasePaymentFilter, purchaseMetalFilter, purchaseSearch, activeTab]);

  const purchaseStats = useMemo(() => {
    let count = 0;
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalTax = 0;
    let grandTotal = 0;
    let goldWeightGrams = 0;
    let silverWeightGrams = 0;
    let creditOutstandingAdded = 0;
    let totalPurchaseReturns = 0;

    filteredPurchases.forEach((p) => {
      const isReturnedOrCancelled = (p as any).isReturned || (p as any).status === "Cancelled" || (p as any).status === "Returned";
      if (isReturnedOrCancelled) {
        totalPurchaseReturns += p.total || 0;
        return;
      }

      count++;
      const base = p.weight * p.ratePerGram + (p.makingCharge || 0);
      const taxAmt = (base * (p.gstPct || 0)) / 100;
      totalTaxable += base;
      totalTax += taxAmt;
      totalCgst += taxAmt / 2;
      totalSgst += taxAmt / 2;
      grandTotal += p.total;

      if (p.metal === "Gold") goldWeightGrams += p.weight || 0;
      else if (p.metal === "Silver") silverWeightGrams += p.weight || 0;

      if (p.paymentMode === "Credit") creditOutstandingAdded += p.total;
    });

    return {
      count,
      totalTaxable,
      totalCgst,
      totalSgst,
      totalTax,
      grandTotal,
      goldWeightGrams,
      silverWeightGrams,
      creditOutstandingAdded,
      totalPurchaseReturns,
    };
  }, [filteredPurchases]);


  const overviewStats = useMemo(() => {
    const estReturns = rangeSalesReturns
      .filter((r: any) => {
        const linkedInv = allInvoices.find(inv => inv._id === r.invoiceId || inv.id === r.invoiceId);
        return linkedInv ? linkedInv.type !== "GST" : true;
      })
      .reduce((s, r: any) => s + (r.totalRefund || 0), 0);

    const gstReturns = rangeSalesReturns
      .filter((r: any) => {
        const linkedInv = allInvoices.find(inv => inv._id === r.invoiceId || inv.id === r.invoiceId);
        return linkedInv ? linkedInv.type === "GST" : false;
      })
      .reduce((s, r: any) => s + (r.totalRefund || 0), 0);

    const rawGstSales = rangeInvoices
      .filter(i => i.type === "GST" && !((i as any).isReturned || returnedInvoiceIds.has(i._id || i.id)))
      .reduce((sum, i) => sum + i.total, 0);

    const rawEstSales = rangeInvoices
      .filter(i => i.type !== "GST" && !((i as any).isReturned || returnedInvoiceIds.has(i._id || i.id)))
      .reduce((sum, i) => sum + i.total, 0);

    const gstSales = Math.max(0, rawGstSales - gstReturns);
    const estSales = Math.max(0, rawEstSales - estReturns);
    const totalSalesIncome = gstSales + estSales;

    const gstPurchases = rangePurchases.filter(p => ((p as any).type === "GST" || p.gstPct > 0) && !((p as any).isReturned || (p as any).status === "Cancelled" || (p as any).status === "Returned")).reduce((sum, p) => sum + p.total, 0);
    const estPurchases = rangePurchases.filter(p => ((p as any).type !== "GST" && (!p.gstPct || p.gstPct === 0)) && !((p as any).isReturned || (p as any).status === "Cancelled" || (p as any).status === "Returned")).reduce((sum, p) => sum + p.total, 0);
    const totalPurchaseCost = gstPurchases + estPurchases;

    const totalExpenseCost = rangeExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalSupplierDue = suppliers.reduce((sum, s) => sum + (s.outstanding || 0), 0);

    const gstNetProfit = gstSales - gstPurchases - totalExpenseCost;
    const estNetProfit = estSales - estPurchases - totalExpenseCost;
    const netRevenue = totalSalesIncome - totalPurchaseCost - totalExpenseCost;

    return {
      totalSalesIncome, gstSales, estSales,
      totalPurchaseCost, gstPurchases, estPurchases,
      totalExpenseCost,
      totalSupplierDue,
      netRevenue, gstNetProfit, estNetProfit,
      salesCount: rangeInvoices.length,
      purchasesCount: rangePurchases.length,
      expensesCount: rangeExpenses.length,
    };
  }, [rangeInvoices, rangePurchases, rangeExpenses, suppliers, rangeSalesReturns, returnedInvoiceIds, allInvoices]);

  // 15 Days Trend Data
  const trendData = useMemo(() => {
    const arr = [];
    const end = new Date(endDate);
    for (let i = 14; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      const dateLabel = `${d.getDate()}/${d.getMonth() + 1}`;

      const dayReturns = salesReturns.filter((r: any) => (r.createdAt || r.date) && String(r.createdAt || r.date).slice(0, 10) === dStr);

      const gstRetRefund = dayReturns
        .filter((r: any) => {
          const linkedInv = allInvoices.find(inv => inv._id === r.invoiceId || inv.id === r.invoiceId);
          return linkedInv ? linkedInv.type === "GST" : false;
        })
        .reduce((s, x: any) => s + (x.totalRefund || 0), 0);

      const estRetRefund = dayReturns
        .filter((r: any) => {
          const linkedInv = allInvoices.find(inv => inv._id === r.invoiceId || inv.id === r.invoiceId);
          return linkedInv ? linkedInv.type !== "GST" : true;
        })
        .reduce((s, x: any) => s + (x.totalRefund || 0), 0);

      const rawIncGst = allInvoices
        .filter((inv) => inv.createdAt && inv.createdAt.slice(0, 10) === dStr && inv.type === "GST" && !((inv as any).isReturned || returnedInvoiceIds.has(inv._id || inv.id)))
        .reduce((s, x) => s + x.total, 0);

      const rawIncEst = allInvoices
        .filter((inv) => inv.createdAt && inv.createdAt.slice(0, 10) === dStr && inv.type !== "GST" && !((inv as any).isReturned || returnedInvoiceIds.has(inv._id || inv.id)))
        .reduce((s, x) => s + x.total, 0);

      const incGst = Math.max(0, rawIncGst - gstRetRefund);
      const incEst = Math.max(0, rawIncEst - estRetRefund);
      const inc = incGst + incEst;

      const exp = expenses
        .filter((e) => e.date && e.date.slice(0, 10) === dStr)
        .reduce((s, x) => s + x.amount, 0);

      const purGst = allPurchases
        .filter((p) => p.date && p.date.slice(0, 10) === dStr && ((p as any).type === "GST" || p.gstPct > 0) && !((p as any).isReturned || (p as any).status === "Cancelled" || (p as any).status === "Returned"))
        .reduce((s, x) => s + x.total, 0);

      const purEst = allPurchases
        .filter((p) => p.date && p.date.slice(0, 10) === dStr && ((p as any).type !== "GST" && (!p.gstPct || p.gstPct === 0)) && !((p as any).isReturned || (p as any).status === "Cancelled" || (p as any).status === "Returned"))
        .reduce((s, x) => s + x.total, 0);

      const pur = purGst + purEst;

      arr.push({ date: dateLabel, inc, incGst, incEst, exp, pur, purGst, purEst });
    }
    return arr;
  }, [endDate, allInvoices, expenses, allPurchases, salesReturns, returnedInvoiceIds]);


  // Pie chart expenses
  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    rangeExpenses.forEach((e) => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rangeExpenses]);

  const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#f43f5e", "#a855f7", "#ec4899", "#64748b"];

  const formatYAxis = (tickItem: number) => {
    if (tickItem >= 100000) return `₹${(tickItem / 100000).toFixed(1)}L`;
    if (tickItem >= 1000) return `₹${(tickItem / 1000).toFixed(1)}k`;
    return `₹${tickItem}`;
  };

  // ----------------------------------------------------
  // EXPORT HANDLERS
  // ----------------------------------------------------
  const exportFullSalesReport = async () => {
    const XLSX = await import("xlsx");
    const periodLabel = `${startDate}_to_${endDate}`;

    const summaryRows = [
      ["FULL SALES REPORT"],
      [`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`],
      [],
      ["Metric", "Value"],
      ["Total Invoices", salesStats.count],
      ["Gross Sales Amount (Rs)", Number(salesStats.totalGrossSales.toFixed(2))],
      ["Total Discount Offered (Rs)", Number(salesStats.totalDiscount.toFixed(2))],
      ["Total Old Gold Trade-in (Rs)", Number(salesStats.totalOldGold.toFixed(2))],
      ["Net Taxable Value (Rs)", Number(salesStats.totalTaxable.toFixed(2))],
      ["CGST (Rs)", Number(salesStats.totalCgst.toFixed(2))],
      ["SGST (Rs)", Number(salesStats.totalSgst.toFixed(2))],
      ["Total GST Tax (Rs)", Number(salesStats.totalTax.toFixed(2))],
      ["Grand Total Sales (Rs)", Number(salesStats.grandTotal.toFixed(2))],
      ["Total Paid / Collected (Rs)", Number(salesStats.totalPaid.toFixed(2))],
      ["Total Balance Due (Rs)", Number(salesStats.totalBalanceDue.toFixed(2))],
      [],
      ["Total Gold Sold (g)", Number(salesStats.totalGoldNetWeightGrams.toFixed(3))],
      ["Total Silver Sold (g)", Number(salesStats.totalSilverNetWeightGrams.toFixed(3))],
      ["Total Diamond Sold (Ct)", Number(salesStats.totalDiamondWeightCt.toFixed(3))],
    ];

    const salesHeader = [
      "Invoice No",
      "Type",
      "Date",
      "Customer Name",
      "Mobile",
      "Address",
      "Payment Mode",
      "Items Count",
      "Subtotal (Rs)",
      "Discount (Rs)",
      "Old Gold (Rs)",
      "Taxable Value (Rs)",
      "CGST (Rs)",
      "SGST (Rs)",
      "Total GST (Rs)",
      "Total Amount (Rs)",
      "Amount Paid (Rs)",
      "Balance Due (Rs)",
    ];

    const salesDataRows = filteredSales.map((inv) => {
      const taxable = inv.subtotal - (inv.discount || 0) - (inv.oldGoldAmount || 0);
      return [
        inv.number,
        inv.type,
        formatDate(inv.createdAt),
        inv.customerName,
        inv.customerMobile || "",
        inv.customerAddress || "",
        inv.paymentMode,
        inv.items?.length || 0,
        Number(inv.subtotal.toFixed(2)),
        Number((inv.discount || 0).toFixed(2)),
        Number((inv.oldGoldAmount || 0).toFixed(2)),
        Number(taxable.toFixed(2)),
        Number(((inv.gstAmount || 0) / 2).toFixed(2)),
        Number(((inv.gstAmount || 0) / 2).toFixed(2)),
        Number((inv.gstAmount || 0).toFixed(2)),
        Number(inv.total.toFixed(2)),
        Number((inv.amountPaid || (inv.total - (inv.balanceDue || 0))).toFixed(2)),
        Number((inv.balanceDue || 0).toFixed(2)),
      ];
    });

    const itemizedHeader = [
      "Invoice No",
      "Date",
      "Customer Name",
      "Item Name",
      "Purity",
      "Qty",
      "Net Weight (g)",
      "Rate/g (Rs)",
      "Making Charge (Rs)",
      "Stone Charge (Rs)",
      "HMC (Rs)",
      "GST %",
    ];

    const itemizedRows: any[] = [];
    filteredSales.forEach((inv) => {
      inv.items?.forEach((it) => {
        itemizedRows.push([
          inv.number,
          formatDate(inv.createdAt),
          inv.customerName,
          it.name,
          it.purity || "",
          it.qty,
          it.netWeight,
          it.ratePerGram,
          it.makingCharge,
          it.stoneCharge,
          it.hmc || 0,
          it.gstPct,
        ]);
      });
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Sales Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([salesHeader, ...salesDataRows]), "Invoices Ledger");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([itemizedHeader, ...itemizedRows]), "Itemized Details");

    XLSX.writeFile(wb, `Sales_Report_${periodLabel}.xlsx`);
  };

  const exportFullPurchaseReport = async () => {
    const XLSX = await import("xlsx");
    const periodLabel = `${startDate}_to_${endDate}`;

    const summaryRows = [
      ["FULL PURCHASE REPORT"],
      [`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`],
      [],
      ["Metric", "Value"],
      ["Total Purchase Bills", purchaseStats.count],
      ["Taxable Base Value (Rs)", Number(purchaseStats.totalTaxable.toFixed(2))],
      ["Input CGST (Rs)", Number(purchaseStats.totalCgst.toFixed(2))],
      ["Input SGST (Rs)", Number(purchaseStats.totalSgst.toFixed(2))],
      ["Total Input Tax (Rs)", Number(purchaseStats.totalTax.toFixed(2))],
      ["Grand Total Purchases (Rs)", Number(purchaseStats.grandTotal.toFixed(2))],
      ["Total Gold Weight Purchased (g)", Number(purchaseStats.goldWeightGrams.toFixed(3))],
      ["Total Silver Weight Purchased (g)", Number(purchaseStats.silverWeightGrams.toFixed(3))],
      ["Credit Balance Added to Suppliers (Rs)", Number(purchaseStats.creditOutstandingAdded.toFixed(2))],
    ];

    const purchaseHeader = [
      "Bill No",
      "Bill Type",
      "Date",
      "Supplier Name",
      "Metal",
      "Purity",
      "Weight (g)",
      "Rate/g (Rs)",
      "Making Charge (Rs)",
      "Taxable Value (Rs)",
      "GST %",
      "Input CGST (Rs)",
      "Input SGST (Rs)",
      "Total Input Tax (Rs)",
      "Total Bill Amount (Rs)",
      "Payment Mode",
      "Note",
    ];

    const purchaseDataRows = filteredPurchases.map((p) => {
      const pType = (p as any).type || (p.gstPct > 0 ? "GST" : "NON-GST");
      const base = p.weight * p.ratePerGram + (p.makingCharge || 0);
      const taxAmt = (base * (p.gstPct || 0)) / 100;
      return [
        p.billNo,
        pType,
        formatDate(p.date),
        p.supplierName,
        p.metal,
        p.purity || "",
        p.weight,
        p.ratePerGram,
        p.makingCharge || 0,
        Number(base.toFixed(2)),
        p.gstPct || 0,
        Number((taxAmt / 2).toFixed(2)),
        Number((taxAmt / 2).toFixed(2)),
        Number(taxAmt.toFixed(2)),
        Number(p.total.toFixed(2)),
        p.paymentMode,
        p.note || "",
      ];
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Purchase Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([purchaseHeader, ...purchaseDataRows]), "Purchase Bills");

    XLSX.writeFile(wb, `Purchase_Report_${periodLabel}.xlsx`);
  };

  // Pagination Helper
  const salesTotalPages = Math.ceil(filteredSales.length / 10) || 1;
  const salesPaginated = filteredSales.slice((salesPage - 1) * 10, salesPage * 10);

  const purchaseTotalPages = Math.ceil(filteredPurchases.length / 10) || 1;
  const purchasePaginated = filteredPurchases.slice((purchasePage - 1) * 10, purchasePage * 10);

  return (
    <Layout>
      {/* PAGE HEADER */}
      <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-display font-bold tracking-tight">Business Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Complete financial intelligence, full sales & purchase ledgers, and expense analysis.
          </p>
        </div>

        {/* Global Date Controls */}
        <div className="flex flex-wrap items-end gap-3 w-full lg:w-auto bg-card p-3 rounded-xl border shadow-sm">
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">From Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-36 text-xs bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">To Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-36 text-xs bg-background"
            />
          </div>

          <CustomSelect onValueChange={(val: any) => setQuickRange(val)}>
            <ST className="h-9 text-xs px-3 bg-muted/40 w-32">
              <SV placeholder="Quick Range" />
            </ST>
            <SC>
              <SI value="today">Today</SI>
              <SI value="yesterday">Yesterday</SI>
              <SI value="thisMonth">This Month</SI>
              <SI value="lastMonth">Last Month</SI>
              <SI value="thisYear">This Year</SI>
            </SC>
          </CustomSelect>
        </div>
      </header>

      {/* MAIN NAVIGATION TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-1 sm:grid-cols-3 max-w-3xl w-full bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="overview" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-2">
            <PieChartIcon className="w-4 h-4" /> Overview Dashboard
          </TabsTrigger>
          {!isOperator && (
            <TabsTrigger value="sales" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" /> GST Sales
            </TabsTrigger>
          )}
          {isOperator && (
            <TabsTrigger value="estimate-sales" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-orange-600" /> Estimate Sales
            </TabsTrigger>
          )}
          {!isOperator && (
            <TabsTrigger value="purchases" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-600" /> GST Purchases
            </TabsTrigger>
          )}
          {isOperator && (
            <TabsTrigger value="estimate-purchases" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-gray-600" /> Est Purchases
            </TabsTrigger>
          )}
        </TabsList>

        {/* ======================================================== */}
        {/* TAB 1: OVERVIEW DASHBOARD */}
        {/* ======================================================== */}
        <TabsContent value="overview" className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border shadow-sm hover:shadow-md transition-all">
              <CardContent className="pt-5 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{isOperator ? "Estimate Sales Income" : "GST Sales Income"}</div>
                    <div className="text-2xl font-display font-bold mt-1 text-emerald-600">
                      {inr(isOperator ? overviewStats.estSales : overviewStats.gstSales)}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm hover:shadow-md transition-all">
              <CardContent className="pt-5 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{isOperator ? "Estimate Purchases Cost" : "GST Purchases Cost"}</div>
                    <div className="text-2xl font-display font-bold mt-1 text-blue-600">
                      {inr(isOperator ? overviewStats.estPurchases : overviewStats.gstPurchases)}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 grid place-items-center shrink-0">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm hover:shadow-md transition-all">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Expenses</div>
                    <div className="text-2xl font-display font-bold mt-1 text-rose-600">
                      {inr(overviewStats.totalExpenseCost)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{overviewStats.expensesCount} Vouchers</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 grid place-items-center">
                    <Wallet className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm hover:shadow-md transition-all">
              <CardContent className="pt-5 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{isOperator ? "Estimate Net Margin" : "GST Net Margin"}</div>
                    <div className={`text-2xl font-display font-bold mt-1 ${(isOperator ? (overviewStats.estSales - overviewStats.estPurchases - overviewStats.totalExpenseCost) : overviewStats.gstNetProfit) >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}>
                      {inr(isOperator ? (overviewStats.estSales - overviewStats.estPurchases - overviewStats.totalExpenseCost) : overviewStats.gstNetProfit)}
                    </div>
                  </div>
                  <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${(isOperator ? (overviewStats.estSales - overviewStats.estPurchases - overviewStats.totalExpenseCost) : overviewStats.gstNetProfit) >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    }`}>
                    <Coins className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" /> Income, Purchases & Expenses (15 Days Trend)
                </CardTitle>
                <CardDescription>Daily movement for the selected period.</CardDescription>
              </CardHeader>
              <CardContent className="h-72 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorPur" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={formatYAxis} />
                    <RechartsTooltip formatter={(val: number) => [inr(val), undefined]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey={isOperator ? "incEst" : "inc"} name="Income" stroke="#10b981" strokeWidth={2.5} fill="url(#colorInc)" />
                    <Area type="monotone" dataKey={isOperator ? "purEst" : "pur"} name="Purchase" stroke="#3b82f6" strokeWidth={2.5} fill="url(#colorPur)" />
                    <Area type="monotone" dataKey="exp" name="Expense" stroke="#f43f5e" strokeWidth={2.5} fill="url(#colorExp)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-purple-600" /> Expense Breakdown
                </CardTitle>
                <CardDescription>Category distribution in date range.</CardDescription>
              </CardHeader>
              <CardContent className="h-72 pt-4">
                {pieData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    No expenses recorded in this period.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                        {pieData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(val: number) => [inr(val), "Amount"]} />
                      <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Supplier Dues Summary */}
          <Card className="shadow-sm border-amber-200">
            <CardHeader className="bg-amber-50/50 pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2 text-amber-900">
                <AlertTriangle className="w-5 h-5 text-amber-600" /> Outstanding Supplier Dues ({suppliers.filter((s) => (s.outstanding || 0) > 0).length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/40 text-muted-foreground text-xs uppercase">
                    <tr>
                      <th className="py-2.5 px-4">Supplier Name</th>
                      <th>Mobile</th>
                      <th>Category</th>
                      <th className="text-right px-4">Outstanding Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers
                      .filter((s) => (s.outstanding || 0) > 0)
                      .slice(0, 5)
                      .map((s) => (
                        <tr key={s._id || s.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-2.5 px-4 font-medium">{s.name}</td>
                          <td>{s.mobile}</td>
                          <td>{s.category || "-"}</td>
                          <td className="text-right px-4 font-semibold text-amber-600">{inr(s.outstanding || 0)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 2: FULL SALES REPORT */}
        {/* ======================================================== */}
        <TabsContent value="sales" className="space-y-6">
          {/* Sales Filter Bar */}
          <Card className="shadow-sm bg-muted/20 border">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Search Invoice #, Customer, Phone..."
                      value={salesSearch}
                      onChange={(e) => setSalesSearch(e.target.value)}
                      className="pl-9 h-9 text-xs bg-background"
                    />
                  </div>



                  {/* Payment Mode Filter */}
                  <CustomSelect value={salesPaymentFilter} onValueChange={setSalesPaymentFilter}>
                    <ST className="h-9 text-xs px-3 bg-background w-32">
                      <SV placeholder="Payment Mode" />
                    </ST>
                    <SC>
                      <SI value="ALL">All Modes</SI>
                      <SI value="Cash">Cash</SI>
                      <SI value="UPI">UPI</SI>
                      <SI value="Card">Card</SI>
                      <SI value="EMI">EMI</SI>
                    </SC>
                  </CustomSelect>
                </div>

                <Button onClick={exportFullSalesReport} className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Sales Excel
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sales Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Invoices</div>
              <div className="text-xl font-bold font-display mt-0.5">
                {salesStats.count} {salesStats.returnedCount > 0 ? <span className="text-xs font-semibold text-rose-600">({salesStats.activeCount} Active)</span> : null}
              </div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Taxable Value</div>
              <div className="text-xl font-bold font-display mt-0.5 text-blue-600">{inr(salesStats.totalTaxable)}</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Total GST Tax</div>
              <div className="text-xl font-bold font-display mt-0.5 text-amber-600">{inr(salesStats.totalTax)}</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Net Sales</div>
              <div className="text-xl font-bold font-display mt-0.5 text-emerald-600">{inr(salesStats.grandTotal)}</div>
            </div>
            {salesStats.returnedTotalAmount > 0 && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 p-3 rounded-lg">
                <div className="text-[11px] text-rose-700 dark:text-rose-300 uppercase font-semibold">Sales Returns</div>
                <div className="text-xl font-bold font-display mt-0.5 text-rose-600">-{inr(salesStats.returnedTotalAmount)}</div>
              </div>
            )}
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Gold Sold</div>
              <div className="text-xl font-bold font-display mt-0.5 text-amber-700">{salesStats.totalGoldNetWeightGrams.toFixed(2)} g</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Silver Sold</div>
              <div className="text-xl font-bold font-display mt-0.5 text-slate-600">{salesStats.totalSilverNetWeightGrams.toFixed(2)} g</div>
            </div>
          </div>

          {/* Detailed Sales Data Table */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" /> Itemized Sales Ledger
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingInvoices ? (
                <p className="text-center text-muted-foreground py-12">Loading sales invoices...</p>
              ) : filteredSales.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No sales invoices match the selected criteria.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                      <tr>
                        <th className="py-3 px-4">Invoice #</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th className="text-right">Taxable Val</th>
                        <th className="text-right">GST Tax</th>
                        <th className="text-right">Total Amount</th>
                        <th className="text-right px-4">Paid / Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesPaginated.map((inv) => {
                        const isReturned = (inv as any).isReturned || returnedInvoiceIds.has(inv._id || inv.id || "");
                        const taxable = inv.subtotal - (inv.discount || 0) - (inv.oldGoldAmount || 0);
                        const isPaid = (inv.balanceDue || 0) <= 0;
                        return (
                          <tr key={inv._id || inv.id} className={`border-b last:border-0 hover:bg-muted/20 ${isReturned ? "bg-rose-50/40 dark:bg-rose-950/20" : ""}`}>
                            <td className="py-3 px-4 font-semibold text-foreground">
                              <div>{inv.number}</div>
                              {isReturned && (
                                <span className="text-[9px] font-extrabold text-rose-600 bg-rose-100 dark:bg-rose-900/50 px-1.5 py-0.5 rounded border border-rose-200 inline-block mt-0.5">
                                  ↩ RETURNED
                                </span>
                              )}
                            </td>
                            <td>
                              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${inv.type === "GST" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-700"}`}>
                                {inv.type === "NON-GST" ? "Estimate Order" : inv.type}
                              </span>
                            </td>
                            <td>{formatDate(inv.createdAt)}</td>
                            <td>
                              <div className="font-medium">{inv.customerName}</div>
                              <div className="text-xs text-muted-foreground">{inv.customerMobile}</div>
                            </td>
                            <td>{inv.items?.length || 0} pcs</td>
                            <td className="text-right font-medium">
                              {isReturned ? (
                                <div>
                                  <span className="line-through text-muted-foreground text-xs block">{inr(taxable)}</span>
                                  <span className="text-rose-600 font-bold">₹0.00</span>
                                </div>
                              ) : (
                                inr(taxable)
                              )}
                            </td>
                            <td className="text-right text-amber-600 font-medium">
                              {isReturned ? (
                                <div>
                                  <span className="line-through text-muted-foreground text-xs block">{inr(inv.gstAmount || 0)}</span>
                                  <span className="text-rose-600 font-bold">₹0.00</span>
                                </div>
                              ) : (
                                inr(inv.gstAmount || 0)
                              )}
                            </td>
                            <td className="text-right font-bold text-emerald-600">
                              {isReturned ? (
                                <div>
                                  <span className="line-through text-muted-foreground text-xs font-normal block">{inr(inv.total)}</span>
                                  <span className="text-rose-600 font-bold">₹0.00</span>
                                </div>
                              ) : (
                                inr(inv.total)
                              )}
                            </td>
                            <td className="text-right px-4">
                              {isReturned ? (
                                <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                                  ↩ RETURNED
                                </span>
                              ) : isPaid ? (
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded">Paid</span>
                              ) : (
                                <span className="bg-rose-100 text-rose-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                                  Due: {inr(inv.balanceDue || 0)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>


                  {/* Pagination */}
                  {salesTotalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <div className="text-xs text-muted-foreground">
                        Showing {(salesPage - 1) * 10 + 1} to {Math.min(salesPage * 10, filteredSales.length)} of {filteredSales.length} entries
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setSalesPage((p) => Math.max(1, p - 1))} disabled={salesPage === 1}>
                          Prev
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setSalesPage((p) => Math.min(salesTotalPages, p + 1))} disabled={salesPage === salesTotalPages}>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 3: FULL PURCHASE REPORT */}
        {/* ======================================================== */}

        <TabsContent value="estimate-sales" className="space-y-6">
          {/* Sales Filter Bar */}
          <Card className="shadow-sm bg-muted/20 border">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Search Invoice #, Customer, Phone..."
                      value={salesSearch}
                      onChange={(e) => setSalesSearch(e.target.value)}
                      className="pl-9 h-9 text-xs bg-background"
                    />
                  </div>



                  {/* Payment Mode Filter */}
                  <CustomSelect value={salesPaymentFilter} onValueChange={setSalesPaymentFilter}>
                    <ST className="h-9 text-xs px-3 bg-background w-32">
                      <SV placeholder="Payment Mode" />
                    </ST>
                    <SC>
                      <SI value="ALL">All Modes</SI>
                      <SI value="Cash">Cash</SI>
                      <SI value="UPI">UPI</SI>
                      <SI value="Card">Card</SI>
                      <SI value="EMI">EMI</SI>
                    </SC>
                  </CustomSelect>
                </div>

                <Button onClick={exportFullSalesReport} className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Sales Excel
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sales Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Invoices</div>
              <div className="text-xl font-bold font-display mt-0.5">{salesStats.count}</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Taxable Value</div>
              <div className="text-xl font-bold font-display mt-0.5 text-blue-600">{inr(salesStats.totalTaxable)}</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Total Discount</div>
              <div className="text-xl font-bold font-display mt-0.5 text-amber-600">{inr(salesStats.totalDiscount)}</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Gross Sales</div>
              <div className="text-xl font-bold font-display mt-0.5 text-emerald-600">{inr(salesStats.grandTotal)}</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Gold Sold</div>
              <div className="text-xl font-bold font-display mt-0.5 text-amber-700">{salesStats.totalGoldNetWeightGrams.toFixed(2)} g</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Silver Sold</div>
              <div className="text-xl font-bold font-display mt-0.5 text-slate-600">{salesStats.totalSilverNetWeightGrams.toFixed(2)} g</div>
            </div>
          </div>

          {/* Detailed Sales Data Table */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" /> Estimate Book Ledger
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingInvoices ? (
                <p className="text-center text-muted-foreground py-12">Loading sales invoices...</p>
              ) : filteredSales.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No sales invoices match the selected criteria.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                      <tr>
                        <th className="py-3 px-4">Invoice #</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th className="text-right">Estimated Subtotal</th>
                        <th className="text-right">Total Amount</th>
                        <th className="text-right px-4">Paid / Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesPaginated.map((inv) => {
                        const taxable = inv.subtotal - (inv.discount || 0) - (inv.oldGoldAmount || 0);
                        const isPaid = (inv.balanceDue || 0) <= 0;
                        return (
                          <tr key={inv._id || inv.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="py-3 px-4 font-semibold text-foreground">{inv.number}</td>
                            <td>
                              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${inv.type === "GST" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-700"}`}>
                                {"Estimate Order"}
                              </span>
                            </td>
                            <td>{formatDate(inv.createdAt)}</td>
                            <td>
                              <div className="font-medium">{inv.customerName}</div>
                              <div className="text-xs text-muted-foreground">{inv.customerMobile}</div>
                            </td>
                            <td>{inv.items?.length || 0} pcs</td>
                            <td className="text-right font-medium">{inr(taxable)}</td>
                            <td className="text-right font-bold text-emerald-600">{inr(inv.total)}</td>
                            <td className="text-right px-4">
                              {isPaid ? (
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded">Paid</span>
                              ) : (
                                <span className="bg-rose-100 text-rose-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                                  Due: {inr(inv.balanceDue || 0)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {salesTotalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <div className="text-xs text-muted-foreground">
                        Showing {(salesPage - 1) * 10 + 1} to {Math.min(salesPage * 10, filteredSales.length)} of {filteredSales.length} entries
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setSalesPage((p) => Math.max(1, p - 1))} disabled={salesPage === 1}>
                          Prev
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setSalesPage((p) => Math.min(salesTotalPages, p + 1))} disabled={salesPage === salesTotalPages}>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 3: FULL PURCHASE REPORT */}
        {/* ======================================================== */}

        <TabsContent value="purchases" className="space-y-6">
          {/* Purchase Filter Bar */}
          <Card className="shadow-sm bg-muted/20 border">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Search Bill #, Supplier..."
                      value={purchaseSearch}
                      onChange={(e) => setPurchaseSearch(e.target.value)}
                      className="pl-9 h-9 text-xs bg-background"
                    />
                  </div>



                  {/* Payment Mode Filter */}
                  <CustomSelect value={purchasePaymentFilter} onValueChange={setPurchasePaymentFilter}>
                    <ST className="h-9 text-xs px-3 bg-background w-32">
                      <SV placeholder="Payment Mode" />
                    </ST>
                    <SC>
                      <SI value="ALL">All Modes</SI>
                      <SI value="Cash">Cash</SI>
                      <SI value="UPI">UPI</SI>
                      <SI value="Card">Card</SI>
                      <SI value="Bank">Bank</SI>
                      <SI value="Credit">Credit</SI>
                    </SC>
                  </CustomSelect>

                  {/* Metal Filter */}
                  <CustomSelect value={purchaseMetalFilter} onValueChange={setPurchaseMetalFilter}>
                    <ST className="h-9 text-xs px-3 bg-background w-32">
                      <SV placeholder="Metal" />
                    </ST>
                    <SC>
                      <SI value="ALL">All Metals</SI>
                      <SI value="Gold">Gold</SI>
                      <SI value="Silver">Silver</SI>
                      <SI value="Diamond">Diamond</SI>
                    </SC>
                  </CustomSelect>
                </div>

                <Button onClick={exportFullPurchaseReport} className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Purchase Excel
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Purchase Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Purchase Bills</div>
              <div className="text-xl font-bold font-display mt-0.5">{purchaseStats.count}</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Taxable Base</div>
              <div className="text-xl font-bold font-display mt-0.5 text-blue-600">{inr(purchaseStats.totalTaxable)}</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Input GST Tax</div>
              <div className="text-xl font-bold font-display mt-0.5 text-amber-600">{inr(purchaseStats.totalTax)}</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Grand Total</div>
              <div className="text-xl font-bold font-display mt-0.5 text-rose-600">{inr(purchaseStats.grandTotal)}</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Gold Purchased</div>
              <div className="text-xl font-bold font-display mt-0.5 text-amber-700">{purchaseStats.goldWeightGrams.toFixed(2)} g</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Silver Purchased</div>
              <div className="text-xl font-bold font-display mt-0.5 text-slate-600">{purchaseStats.silverWeightGrams.toFixed(2)} g</div>
            </div>
          </div>

          {/* Purchase Data Table */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-blue-600" /> Itemized Purchase Bills Ledger
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingPurchases ? (
                <p className="text-center text-muted-foreground py-12">Loading purchase bills...</p>
              ) : filteredPurchases.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No purchase bills match the selected criteria.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                      <tr>
                        <th className="py-3 px-4">Bill #</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Supplier</th>
                        <th>Metal & Purity</th>
                        <th>Weight</th>
                        <th className="text-right">Taxable Val</th>
                        <th className="text-right">Input Tax</th>
                        <th className="text-right px-4">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchasePaginated.map((p) => {
                        const pType = (p as any).type || (p.gstPct > 0 ? "GST" : "NON-GST");
                        const base = p.weight * p.ratePerGram + (p.makingCharge || 0);
                        const taxAmt = (base * (p.gstPct || 0)) / 100;
                        return (
                          <tr key={p._id || p.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="py-3 px-4 font-semibold text-foreground">{p.billNo}</td>
                            <td>
                              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${pType === "GST" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-700"}`}>
                                {pType === "NON-GST" ? "Estimate Order" : pType}
                              </span>
                            </td>
                            <td>{formatDate(p.date)}</td>
                            <td className="font-medium">{p.supplierName}</td>
                            <td>
                              {p.metal} {p.purity && `(${p.purity})`}
                            </td>
                            <td className="font-medium">{p.weight} g</td>
                            <td className="text-right font-medium">{inr(base)}</td>
                            <td className="text-right text-amber-600 font-medium">{inr(taxAmt)}</td>
                            <td className="text-right px-4 font-bold text-rose-600">{inr(p.total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {purchaseTotalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <div className="text-xs text-muted-foreground">
                        Showing {(purchasePage - 1) * 10 + 1} to {Math.min(purchasePage * 10, filteredPurchases.length)} of {filteredPurchases.length} entries
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setPurchasePage((p) => Math.max(1, p - 1))} disabled={purchasePage === 1}>
                          Prev
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setPurchasePage((p) => Math.min(purchaseTotalPages, p + 1))} disabled={purchasePage === purchaseTotalPages}>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="estimate-purchases" className="space-y-6">
          {/* Purchase Filter Bar */}
          <Card className="shadow-sm bg-muted/20 border">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Search Bill #, Supplier..."
                      value={purchaseSearch}
                      onChange={(e) => setPurchaseSearch(e.target.value)}
                      className="pl-9 h-9 text-xs bg-background"
                    />
                  </div>



                  {/* Payment Mode Filter */}
                  <CustomSelect value={purchasePaymentFilter} onValueChange={setPurchasePaymentFilter}>
                    <ST className="h-9 text-xs px-3 bg-background w-32">
                      <SV placeholder="Payment Mode" />
                    </ST>
                    <SC>
                      <SI value="ALL">All Modes</SI>
                      <SI value="Cash">Cash</SI>
                      <SI value="UPI">UPI</SI>
                      <SI value="Card">Card</SI>
                      <SI value="Bank">Bank</SI>
                      <SI value="Credit">Credit</SI>
                    </SC>
                  </CustomSelect>

                  {/* Metal Filter */}
                  <CustomSelect value={purchaseMetalFilter} onValueChange={setPurchaseMetalFilter}>
                    <ST className="h-9 text-xs px-3 bg-background w-32">
                      <SV placeholder="Metal" />
                    </ST>
                    <SC>
                      <SI value="ALL">All Metals</SI>
                      <SI value="Gold">Gold</SI>
                      <SI value="Silver">Silver</SI>
                      <SI value="Diamond">Diamond</SI>
                    </SC>
                  </CustomSelect>
                </div>

                <Button onClick={exportFullPurchaseReport} className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Purchase Excel
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Purchase Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Purchase Bills</div>
              <div className="text-xl font-bold font-display mt-0.5">{purchaseStats.count}</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Base Value</div>
              <div className="text-xl font-bold font-display mt-0.5 text-blue-600">{inr(purchaseStats.totalTaxable)}</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Credit Added</div>
              <div className="text-xl font-bold font-display mt-0.5 text-amber-600">{inr(purchaseStats.creditOutstandingAdded)}</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Grand Total</div>
              <div className="text-xl font-bold font-display mt-0.5 text-rose-600">{inr(purchaseStats.grandTotal)}</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Gold Purchased</div>
              <div className="text-xl font-bold font-display mt-0.5 text-amber-700">{purchaseStats.goldWeightGrams.toFixed(2)} g</div>
            </div>
            <div className="bg-card border p-3 rounded-lg">
              <div className="text-[11px] text-muted-foreground uppercase font-semibold">Silver Purchased</div>
              <div className="text-xl font-bold font-display mt-0.5 text-slate-600">{purchaseStats.silverWeightGrams.toFixed(2)} g</div>
            </div>
          </div>

          {/* Purchase Data Table */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-blue-600" /> Estimate Purchase Ledger
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingPurchases ? (
                <p className="text-center text-muted-foreground py-12">Loading purchase bills...</p>
              ) : filteredPurchases.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">No purchase bills match the selected criteria.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                      <tr>
                        <th className="py-3 px-4">Bill #</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Supplier</th>
                        <th>Metal & Purity</th>
                        <th>Weight</th>
                        <th className="text-right">Base Value</th>
                        <th className="text-right px-4">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchasePaginated.map((p) => {
                        const pType = (p as any).type || (p.gstPct > 0 ? "GST" : "NON-GST");
                        const base = p.weight * p.ratePerGram + (p.makingCharge || 0);
                        return (
                          <tr key={p._id || p.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="py-3 px-4 font-semibold text-foreground">{p.billNo}</td>
                            <td>
                              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${pType === "GST" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-700"}`}>
                                {"Estimate Order"}
                              </span>
                            </td>
                            <td>{formatDate(p.date)}</td>
                            <td className="font-medium">{p.supplierName}</td>
                            <td>
                              {p.metal} {p.purity && `(${p.purity})`}
                            </td>
                            <td className="font-medium">{p.weight} g</td>
                            <td className="text-right font-medium">{inr(base)}</td>
                            <td className="text-right px-4 font-bold text-rose-600">{inr(p.total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {purchaseTotalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <div className="text-xs text-muted-foreground">
                        Showing {(purchasePage - 1) * 10 + 1} to {Math.min(purchasePage * 10, filteredPurchases.length)} of {filteredPurchases.length} entries
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setPurchasePage((p) => Math.max(1, p - 1))} disabled={purchasePage === 1}>
                          Prev
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setPurchasePage((p) => Math.min(purchaseTotalPages, p + 1))} disabled={purchasePage === purchaseTotalPages}>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}