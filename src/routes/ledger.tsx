import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/hooks/useApi";
import { useTenantAPI } from "@/lib/api";
import { inr, type Customer, type Expense, type Invoice, type Order, type Repair } from "@/lib/storage";
import { useAuth } from "@/lib/auth";
import { formatDate, triggerPrint } from "@/lib/utils";
import {
  BookOpen,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Wrench,
  ShoppingBag,
  Receipt,
  Wallet,
  Filter,
  Tag,
  Layers,
  Printer,
  FileSpreadsheet,
  Banknote,
  Landmark,
  Hammer,
  UserCheck,
} from "lucide-react";
import { DIRECT_EXPENSE_CATEGORIES } from "@/routes/expenses";
import { ShopHeader } from "@/components/InvoiceBranding";
import { toast } from "sonner";

export default function LedgerPage() {
  const { tenantSession } = useAuth();
  const authUser = tenantSession?.user;

  const [viewMode, setViewMode] = useState<"daily" | "monthly">("daily");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [filterType, setFilterType] = useState<string>("All");

  const targetDateStr = useMemo(() => new Date(selectedDate).toDateString(), [selectedDate]);

  const api = useTenantAPI();
  const { data: allInvoices = [], isLoading: loadingInvoices } = useApi<Invoice[]>(["invoices"], () => api.invoices.getAll());
  const { data: expenses = [], isLoading: loadingExpenses } = useApi<Expense[]>(["expenses"], () => api.expenses.getAll());
  const { data: orders = [], isLoading: loadingOrders } = useApi<Order[]>(["orders"], () => api.orders.getAll());
  const { data: repairs = [], isLoading: loadingRepairs } = useApi<Repair[]>(["repairs"], () => api.repairs.getAll());
  const { data: customers = [], isLoading: loadingCustomers } = useApi<Customer[]>(["customers"], () => api.customers.getAll());
  const { data: purchases = [], isLoading: loadingPurchases } = useApi<any[]>(["purchases"], () => api.purchases.getAll());
  const { data: employees = [], isLoading: loadingEmployees } = useApi<any[]>(["employees"], () => api.employees.getAll());
  const { data: girviList = [], isLoading: loadingGirvi } = useApi<any[]>(["girvi"], () => api.girvi.getAll());
  const { data: advances = [], isLoading: loadingAdvances } = useApi<any[]>(["advances"], () => api.advances.getAll());
  const { data: karigars = [], isLoading: loadingKarigars } = useApi<any[]>(["karigars"], () => api.karigars.getAll());

  const isOperator = authUser?.role === "operator";
  const invoices = useMemo(() => allInvoices.filter(i => isOperator ? i.type !== "GST" : i.type === "GST"), [allInvoices, isOperator]);
  const rolePurchases = useMemo(() => purchases.filter(p => isOperator ? !(p.type === "GST" || p.gstPct > 0) : (p.type === "GST" || p.gstPct > 0)), [purchases, isOperator]);

  // Flatten all salary payment records from employees
  const allSalaryPayments = useMemo(() => {
    const payments: any[] = [];
    employees.forEach((emp: any) => {
      (emp.payments || []).forEach((p: any) => {
        payments.push({ ...p, empId: emp.id || emp._id, empName: emp.name, empRole: emp.role });
      });
    });
    return payments;
  }, [employees]);

  const isLoading = loadingInvoices || loadingExpenses || loadingOrders || loadingRepairs || loadingCustomers || loadingPurchases || loadingEmployees || loadingGirvi || loadingAdvances || loadingKarigars;

  // Daily entries
  const allDailyEntries = useMemo(() => {
    const arr: any[] = [];

    invoices.forEach(i => {
      if (new Date(i.createdAt).toDateString() === targetDateStr) {
        arr.push({ id: i.id || (i as any)._id, date: i.createdAt, time: i.createdAt, type: 'Income', subCategory: 'Sales', icon: Receipt, desc: `Sale: ${i.number} - ${i.customerName}`, in: i.total, out: 0, mode: i.paymentMode });
      }
    });

    expenses.forEach(e => {
      if (new Date(e.date).toDateString() === targetDateStr) {
        const isDirect = e.expenseType === "Direct" || DIRECT_EXPENSE_CATEGORIES.includes(e.category);
        arr.push({
          id: e.id || (e as any)._id,
          date: e.date,
          time: e.date,
          type: isDirect ? 'Direct Expense' : 'Indirect Expense',
          subCategory: e.category,
          isDirect,
          icon: Wallet,
          desc: `${e.category} - ${e.description}${e.payeeName ? ` (Paid to: ${e.payeeName})` : ''}`,
          in: 0,
          out: e.amount,
          mode: e.paymentMode || 'Cash'
        });
      }
    });

    orders.forEach(o => {
      if (new Date(o.date).toDateString() === targetDateStr && (o.advancePaid || 0) > 0) {
        arr.push({ id: o.id || (o as any)._id, date: o.date, time: o.date, type: 'Order Advance', subCategory: 'Advance', icon: ShoppingBag, desc: `Order: ${o.orderNo} - ${o.customerName}`, in: o.advancePaid, out: 0, mode: '—' });
      }
    });

    repairs.forEach(r => {
      if (new Date(r.date || "").toDateString() === targetDateStr && (r.advance || 0) > 0) {
        arr.push({ id: r.id || (r as any)._id, date: r.date, time: r.date, type: 'Repair Advance', subCategory: 'Advance', icon: Wrench, desc: `Repair: ${r.ticketNo} - ${r.customerName}`, in: r.advance, out: 0, mode: '—' });
      }
    });

    rolePurchases.forEach(p => {
      if (new Date(p.date).toDateString() === targetDateStr) {
        arr.push({ id: p.id || (p as any)._id, date: p.date, time: p.date, type: 'Purchase', subCategory: 'Bullion Stock', icon: ShoppingBag, desc: `Purchase: ${p.billNo} - ${p.supplierName}`, in: 0, out: p.paymentMode === 'Credit' ? 0 : p.total, mode: p.paymentMode });
      }
    });

    customers.forEach(c => {
      if (c.createdAt && new Date(c.createdAt).toDateString() === targetDateStr) {
        const phone = (c as any).phone || c.mobile || "";
        arr.push({ id: c._id || phone, date: c.createdAt, time: c.createdAt, type: 'New Customer', subCategory: 'CRM', icon: Users, desc: `${c.name} (${phone})`, in: 0, out: 0, mode: '—' });
      }
    });

    // Salary payments made on this date
    allSalaryPayments.forEach((p: any) => {
      if (p.date && new Date(p.date).toDateString() === targetDateStr) {
        arr.push({ id: `salary-${p.empId}-${p.date}`, date: p.date, time: p.date, type: 'Salary Payment', subCategory: 'Staff', icon: UserCheck, desc: `Salary: ${p.empName} (${p.empRole}) — ${p.monthFor || ''}`, in: 0, out: p.amount, mode: p.mode || 'Cash' });
      }
    });

    // Girvi (Gold Loan) issued on this date
    girviList.forEach((g: any) => {
      const d = g.date || g.createdAt;
      if (d && new Date(d).toDateString() === targetDateStr) {
        arr.push({ id: g.id || g._id, date: d, time: d, type: 'Girvi Issued', subCategory: 'Gold Loan', icon: Landmark, desc: `Girvi #${g.ticketNo || g.number || ''} - ${g.customerName || g.pledgerName || ''}`, in: g.loanAmount || g.principalAmount || 0, out: 0, mode: 'Cash' });
      }
    });

    // Advances given/received on this date
    advances.forEach((a: any) => {
      const d = a.date || a.createdAt;
      if (d && new Date(d).toDateString() === targetDateStr) {
        const isReceived = a.type === 'received' || (a.amount > 0 && a.direction !== 'given');
        arr.push({ id: a.id || a._id, date: d, time: d, type: 'Advance', subCategory: isReceived ? 'Advance Received' : 'Advance Given', icon: Banknote, desc: `Advance: ${a.customerName || a.name || ''} — ${a.note || a.remarks || ''}`, in: isReceived ? (a.amount || 0) : 0, out: isReceived ? 0 : (a.amount || 0), mode: a.paymentMode || a.mode || 'Cash' });
      }
    });

    // Karigar job work charges on this date
    karigars.forEach((k: any) => {
      const d = k.createdAt || k.date;
      if (d && new Date(d).toDateString() === targetDateStr && (k.laborCharges || k.jobWorkAmount || 0) > 0) {
        arr.push({ id: k.id || k._id, date: d, time: d, type: 'Karigar Work', subCategory: 'Job Work', icon: Hammer, desc: `Karigar: ${k.name || k.karigarName || ''} — ${k.taskDescription || k.item || ''}`, in: 0, out: k.laborCharges || k.jobWorkAmount || 0, mode: 'Cash' });
      }
    });

    return arr.sort((a, b) => (a.desc || "").localeCompare(b.desc || ""));
  }, [invoices, expenses, orders, repairs, customers, rolePurchases, allSalaryPayments, girviList, advances, karigars, targetDateStr]);

  const dailyEntries = useMemo(() => {
    if (filterType === "All") return allDailyEntries;
    if (filterType === "Inflow") return allDailyEntries.filter((e) => e.in > 0);
    if (filterType === "Outflow") return allDailyEntries.filter((e) => e.out > 0);
    if (filterType === "Direct") return allDailyEntries.filter((e) => e.type === "Direct Expense");
    if (filterType === "Indirect") return allDailyEntries.filter((e) => e.type === "Indirect Expense");
    return allDailyEntries;
  }, [allDailyEntries, filterType]);

  const dailyTotalIn = allDailyEntries.reduce((s, e) => s + e.in, 0);
  const dailyTotalOut = allDailyEntries.reduce((s, e) => s + e.out, 0);
  const dailyNetBalance = dailyTotalIn - dailyTotalOut;

  const dailyDirectExpTotal = allDailyEntries.filter((e) => e.type === "Direct Expense").reduce((s, e) => s + e.out, 0);
  const dailyIndirectExpTotal = allDailyEntries.filter((e) => e.type === "Indirect Expense").reduce((s, e) => s + e.out, 0);

  // Monthly entries
  const allMonthlyEntries = useMemo(() => {
    const arr: any[] = [];
    const targetMonth = selectedMonth;

    invoices.forEach(i => {
      const isoDate = new Date(i.createdAt).toISOString().slice(0, 10);
      if (isoDate.startsWith(targetMonth)) {
        arr.push({ id: i.id || (i as any)._id, date: isoDate, time: i.createdAt, type: 'Income', subCategory: 'Sales', icon: Receipt, desc: `Sale: ${i.number} - ${i.customerName}`, in: i.total, out: 0, mode: i.paymentMode });
      }
    });

    expenses.forEach(e => {
      const isoDate = new Date(e.date).toISOString().slice(0, 10);
      if (isoDate.startsWith(targetMonth)) {
        const isDirect = e.expenseType === "Direct" || DIRECT_EXPENSE_CATEGORIES.includes(e.category);
        arr.push({
          id: e.id || (e as any)._id,
          date: isoDate,
          time: e.date,
          type: isDirect ? 'Direct Expense' : 'Indirect Expense',
          subCategory: e.category,
          isDirect,
          icon: Wallet,
          desc: `${e.category} - ${e.description}${e.payeeName ? ` (Paid to: ${e.payeeName})` : ''}`,
          in: 0,
          out: e.amount,
          mode: e.paymentMode || 'Cash'
        });
      }
    });

    orders.forEach(o => {
      const isoDate = new Date(o.date).toISOString().slice(0, 10);
      if (isoDate.startsWith(targetMonth) && (o.advancePaid || 0) > 0) {
        arr.push({ id: o.id || (o as any)._id, date: isoDate, time: o.date, type: 'Order Advance', subCategory: 'Advance', icon: ShoppingBag, desc: `Order: ${o.orderNo} - ${o.customerName}`, in: o.advancePaid, out: 0, mode: '—' });
      }
    });

    repairs.forEach(r => {
      if (!r.date) return;
      const isoDate = new Date(r.date).toISOString().slice(0, 10);
      if (isoDate.startsWith(targetMonth) && (r.advance || 0) > 0) {
        arr.push({ id: r.id || (r as any)._id, date: isoDate, time: r.date, type: 'Repair Advance', subCategory: 'Advance', icon: Wrench, desc: `Repair: ${r.ticketNo} - ${r.customerName}`, in: r.advance, out: 0, mode: '—' });
      }
    });

    rolePurchases.forEach(p => {
      const isoDate = new Date(p.date).toISOString().slice(0, 10);
      if (isoDate.startsWith(targetMonth)) {
        arr.push({ id: p.id || (p as any)._id, date: isoDate, time: p.date, type: 'Purchase', subCategory: 'Bullion Stock', icon: ShoppingBag, desc: `Purchase: ${p.billNo} - ${p.supplierName}`, in: 0, out: p.paymentMode === 'Credit' ? 0 : p.total, mode: p.paymentMode });
      }
    });

    customers.forEach(c => {
      if (!c.createdAt) return;
      const isoDate = new Date(c.createdAt).toISOString().slice(0, 10);
      if (isoDate.startsWith(targetMonth)) {
        const phone = (c as any).phone || c.mobile || "";
        arr.push({ id: c._id || phone, date: isoDate, time: c.createdAt, type: 'New Customer', subCategory: 'CRM', icon: Users, desc: `${c.name} (${phone})`, in: 0, out: 0, mode: '—' });
      }
    });

    // Salary payments in this month
    allSalaryPayments.forEach((p: any) => {
      if (!p.date) return;
      const isoDate = new Date(p.date).toISOString().slice(0, 10);
      if (isoDate.startsWith(targetMonth)) {
        arr.push({ id: `salary-${p.empId}-${p.date}`, date: isoDate, time: p.date, type: 'Salary Payment', subCategory: 'Staff', icon: UserCheck, desc: `Salary: ${p.empName} (${p.empRole}) — ${p.monthFor || ''}`, in: 0, out: p.amount, mode: p.mode || 'Cash' });
      }
    });

    // Girvi (Gold Loan) issued in this month
    girviList.forEach((g: any) => {
      const d = g.date || g.createdAt;
      if (!d) return;
      const isoDate = new Date(d).toISOString().slice(0, 10);
      if (isoDate.startsWith(targetMonth)) {
        arr.push({ id: g.id || g._id, date: isoDate, time: d, type: 'Girvi Issued', subCategory: 'Gold Loan', icon: Landmark, desc: `Girvi #${g.ticketNo || g.number || ''} - ${g.customerName || g.pledgerName || ''}`, in: g.loanAmount || g.principalAmount || 0, out: 0, mode: 'Cash' });
      }
    });

    // Advances in this month
    advances.forEach((a: any) => {
      const d = a.date || a.createdAt;
      if (!d) return;
      const isoDate = new Date(d).toISOString().slice(0, 10);
      if (isoDate.startsWith(targetMonth)) {
        const isReceived = a.type === 'received' || (a.amount > 0 && a.direction !== 'given');
        arr.push({ id: a.id || a._id, date: isoDate, time: d, type: 'Advance', subCategory: isReceived ? 'Advance Received' : 'Advance Given', icon: Banknote, desc: `Advance: ${a.customerName || a.name || ''} — ${a.note || a.remarks || ''}`, in: isReceived ? (a.amount || 0) : 0, out: isReceived ? 0 : (a.amount || 0), mode: a.paymentMode || a.mode || 'Cash' });
      }
    });

    // Karigar job work in this month
    karigars.forEach((k: any) => {
      const d = k.createdAt || k.date;
      if (!d) return;
      const isoDate = new Date(d).toISOString().slice(0, 10);
      if (isoDate.startsWith(targetMonth) && (k.laborCharges || k.jobWorkAmount || 0) > 0) {
        arr.push({ id: k.id || k._id, date: isoDate, time: d, type: 'Karigar Work', subCategory: 'Job Work', icon: Hammer, desc: `Karigar: ${k.name || k.karigarName || ''} — ${k.taskDescription || k.item || ''}`, in: 0, out: k.laborCharges || k.jobWorkAmount || 0, mode: 'Cash' });
      }
    });

    return arr.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [invoices, expenses, orders, repairs, customers, rolePurchases, allSalaryPayments, girviList, advances, karigars, selectedMonth]);

  const monthlyEntries = useMemo(() => {
    if (filterType === "All") return allMonthlyEntries;
    if (filterType === "Inflow") return allMonthlyEntries.filter((e) => e.in > 0);
    if (filterType === "Outflow") return allMonthlyEntries.filter((e) => e.out > 0);
    if (filterType === "Direct") return allMonthlyEntries.filter((e) => e.type === "Direct Expense");
    if (filterType === "Indirect") return allMonthlyEntries.filter((e) => e.type === "Indirect Expense");
    return allMonthlyEntries;
  }, [allMonthlyEntries, filterType]);

  const monthlyTotalIn = allMonthlyEntries.reduce((s, e) => s + e.in, 0);
  const monthlyTotalOut = allMonthlyEntries.reduce((s, e) => s + e.out, 0);
  const monthlyNetBalance = monthlyTotalIn - monthlyTotalOut;

  const monthlyDirectExpTotal = allMonthlyEntries.filter((e) => e.type === "Direct Expense").reduce((s, e) => s + e.out, 0);
  const monthlyIndirectExpTotal = allMonthlyEntries.filter((e) => e.type === "Indirect Expense").reduce((s, e) => s + e.out, 0);

  // Monthly Day-by-Day Aggregation
  const monthlyDailySummary = useMemo(() => {
    const map: Record<string, { date: string; totalIn: number; totalOut: number; count: number }> = {};

    monthlyEntries.forEach((e) => {
      if (!map[e.date]) {
        map[e.date] = { date: e.date, totalIn: 0, totalOut: 0, count: 0 };
      }
      map[e.date].totalIn += e.in;
      map[e.date].totalOut += e.out;
      map[e.date].count += 1;
    });

    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  }, [monthlyEntries]);

  // Export Ledger CSV
  const handleDownloadCSV = () => {
    const entriesToExport = viewMode === "daily" ? dailyEntries : monthlyEntries;
    if (entriesToExport.length === 0) {
      toast.error("No ledger entries available for the selected filter");
      return;
    }

    const headers = ["Date / Time", "Type", "Category", "Particulars / Description", "Payment Mode", "Inflow (INR)", "Outflow (INR)"];
    const rows = entriesToExport.map((e) => [
      `"${formatDate(e.date || e.time)}"`,
      `"${e.type}"`,
      `"${e.subCategory || ""}"`,
      `"${(e.desc || "").replace(/"/g, '""')}"`,
      `"${e.mode || "Cash"}"`,
      e.in || 0,
      e.out || 0,
    ]);

    const filename = viewMode === "daily"
      ? `Jewellery_Daily_Ledger_${selectedDate}.csv`
      : `Jewellery_Monthly_Ledger_${selectedMonth}.csv`;

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Successfully exported ${entriesToExport.length} entries to ${filename}`);
  };

  return (
    <Layout>
      {/* Dynamic CSS for printable ledger statement */}
      <style>{`
        @media print {
          body * {
            display: none !important;
            visibility: hidden !important;
          }
          body, #printable-ledger-statement, #printable-ledger-statement * {
            display: block !important;
            visibility: visible !important;
          }
          #printable-ledger-statement {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: auto !important;
            z-index: 999999 !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 24px !important;
            box-sizing: border-box !important;
          }
          #printable-ledger-statement table {
            display: table !important;
            width: 100% !important;
          }
          #printable-ledger-statement tr {
            display: table-row !important;
          }
          #printable-ledger-statement td, #printable-ledger-statement th {
            display: table-cell !important;
          }
          #printable-ledger-statement thead {
            display: table-header-group !important;
          }
          #printable-ledger-statement tfoot {
            display: table-footer-group !important;
          }
          #printable-ledger-statement div {
            display: block !important;
          }
        }
      `}</style>

      <div className="print:hidden">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold">{viewMode === "daily" ? "Daily Ledger & Daybook" : "Monthly Cashflow Ledger"}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {viewMode === "daily"
                ? "Consolidated view of all daily sales, purchases, direct/indirect expenses & advances."
                : "Comprehensive monthly cashflow, day-by-day trajectory & expense breakdown."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {viewMode === "daily" ? (
              <div className="space-y-1 w-full sm:w-auto">
                <Label className="text-xs font-semibold">Select Date</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full sm:w-44 bg-background h-9 text-xs font-mono"
                />
              </div>
            ) : (
              <div className="space-y-1 w-full sm:w-auto">
                <Label className="text-xs font-semibold">Select Month</Label>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full sm:w-44 bg-background h-9 text-xs font-mono"
                />
              </div>
            )}

            {/* Action Download Buttons */}
            <div className="flex items-center gap-2 mt-4 sm:mt-0">
              <Button onClick={handleDownloadCSV} variant="outline" className="h-9 text-xs font-semibold">
                <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" /> Export CSV
              </Button>
              <Button onClick={triggerPrint} className="h-9 text-xs bg-primary text-white font-semibold">
                <Printer className="w-4 h-4 mr-1.5" /> Print / PDF
              </Button>
            </div>
          </div>
        </header>

        {/* Mode Switcher Tabs & Transaction Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex bg-muted/80 p-1 rounded-xl border w-fit">
            <button
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                viewMode === "daily"
                  ? "bg-background shadow-xs text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setViewMode("daily")}
            >
              <Calendar className="w-4 h-4 text-emerald-600" /> Daily Daybook
            </button>
            <button
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 ${
                viewMode === "monthly"
                  ? "bg-background shadow-xs text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setViewMode("monthly")}
            >
              <BookOpen className="w-4 h-4 text-blue-600" /> Monthly Ledger
            </button>
          </div>

          {/* Transaction Type Filters */}
          <div className="flex items-center gap-1.5 bg-card border rounded-lg p-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-muted-foreground ml-1.5 mr-0.5" />
            <button
              onClick={() => setFilterType("All")}
              className={`px-2.5 py-1 rounded-md transition-colors ${filterType === "All" ? "bg-primary text-white font-bold" : "text-muted-foreground hover:text-foreground"}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType("Inflow")}
              className={`px-2.5 py-1 rounded-md transition-colors ${filterType === "Inflow" ? "bg-emerald-600 text-white font-bold" : "text-muted-foreground hover:text-foreground"}`}
            >
              Inflows
            </button>
            <button
              onClick={() => setFilterType("Outflow")}
              className={`px-2.5 py-1 rounded-md transition-colors ${filterType === "Outflow" ? "bg-rose-600 text-white font-bold" : "text-muted-foreground hover:text-foreground"}`}
            >
              Outflows
            </button>
            <button
              onClick={() => setFilterType("Direct")}
              className={`px-2.5 py-1 rounded-md transition-colors ${filterType === "Direct" ? "bg-amber-600 text-white font-bold" : "text-muted-foreground hover:text-foreground"}`}
            >
              Direct Exp
            </button>
            <button
              onClick={() => setFilterType("Indirect")}
              className={`px-2.5 py-1 rounded-md transition-colors ${filterType === "Indirect" ? "bg-purple-600 text-white font-bold" : "text-muted-foreground hover:text-foreground"}`}
            >
              Indirect Exp
            </button>
          </div>
        </div>

        {viewMode === "daily" ? (
          <>
            {/* Daily KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <Card className="border">
                <CardContent className="pt-5">
                  <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1 uppercase">
                    <ArrowDownLeft className="w-4 h-4 text-emerald-500" /> Total Inflows (+)
                  </div>
                  <div className="text-2xl font-bold font-display mt-1 text-emerald-600">{inr(dailyTotalIn)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Sales & Advances</div>
                </CardContent>
              </Card>

              <Card className="border">
                <CardContent className="pt-5">
                  <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1 uppercase">
                    <ArrowUpRight className="w-4 h-4 text-rose-500" /> Total Outflows (-)
                  </div>
                  <div className="text-2xl font-bold font-display mt-1 text-rose-600">{inr(dailyTotalOut)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Purchases & Expenses</div>
                </CardContent>
              </Card>

              <Card className="border">
                <CardContent className="pt-5">
                  <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1 uppercase">
                    <Layers className="w-4 h-4 text-amber-500" /> Direct Expenses
                  </div>
                  <div className="text-2xl font-bold font-display mt-1 text-amber-600">{inr(dailyDirectExpTotal)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Labour, Hallmarking, Freight</div>
                </CardContent>
              </Card>

              <Card className="border">
                <CardContent className="pt-5">
                  <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1 uppercase">
                    <Tag className="w-4 h-4 text-purple-500" /> Indirect Expenses
                  </div>
                  <div className="text-2xl font-bold font-display mt-1 text-purple-600">{inr(dailyIndirectExpTotal)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Rent, Salary, Utilities</div>
                </CardContent>
              </Card>

              <Card className="border">
                <CardContent className="pt-5">
                  <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1 uppercase">
                    <BookOpen className="w-4 h-4 text-primary" /> Net Cash Balance
                  </div>
                  <div className={`text-2xl font-bold font-display mt-1 ${dailyNetBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {inr(dailyNetBalance)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Inflows - Outflows</div>
                </CardContent>
              </Card>
            </div>

            {/* Daily Table */}
            <Card className="shadow-sm border">
              <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 py-4">
                <CardTitle className="text-base font-bold font-display flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-600" /> Daybook Entries ({formatDate(selectedDate)})
                </CardTitle>
                <Badge variant="outline" className="font-mono text-xs">
                  {dailyEntries.length} Records
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">Loading ledger data...</p>
                ) : dailyEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">No transactions recorded for this filter on selected date.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[700px]">
                      <thead className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground border-b bg-muted/30">
                        <tr>
                          <th className="py-3 px-4">Transaction Type</th>
                          <th className="py-3">Particulars & Description</th>
                          <th className="py-3">Payment Mode</th>
                          <th className="py-3 text-right text-emerald-600">Inflow (₹ +)</th>
                          <th className="py-3 px-4 text-right text-rose-600">Outflow (₹ -)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {dailyEntries.map((e, idx) => {
                          const Icon = e.icon;
                          return (
                            <tr key={`${e.id}-${idx}`} className="hover:bg-muted/30 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <Icon className="w-4 h-4 text-muted-foreground" />
                                  {e.type === "Direct Expense" ? (
                                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">Direct Expense</Badge>
                                  ) : e.type === "Indirect Expense" ? (
                                    <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[10px]">Indirect Expense</Badge>
                                  ) : (
                                    <span className="font-semibold text-xs text-foreground">{e.type}</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3">
                                <div className="font-medium text-xs text-foreground">{e.desc}</div>
                              </td>
                              <td className="py-3 text-muted-foreground">
                                <Badge variant="outline" className="text-xs font-mono">{e.mode}</Badge>
                              </td>
                              <td className="py-3 text-right font-mono font-bold text-emerald-600">{e.in > 0 ? inr(e.in) : "—"}</td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">{e.out > 0 ? inr(e.out) : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-border bg-muted/20 font-bold">
                        <tr>
                          <td colSpan={3} className="py-3 px-4 text-right text-xs uppercase tracking-wider">Day Total:</td>
                          <td className="py-3 text-right text-emerald-600 font-mono text-base">{inr(dailyTotalIn)}</td>
                          <td className="py-3 px-4 text-right text-rose-600 font-mono text-base">{inr(dailyTotalOut)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Monthly KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <Card className="border">
                <CardContent className="pt-5">
                  <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1 uppercase">
                    <ArrowDownLeft className="w-4 h-4 text-emerald-500" /> Monthly Income (+)
                  </div>
                  <div className="text-2xl font-bold font-display mt-1 text-emerald-600">{inr(monthlyTotalIn)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Total Inflows This Month</div>
                </CardContent>
              </Card>

              <Card className="border">
                <CardContent className="pt-5">
                  <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1 uppercase">
                    <ArrowUpRight className="w-4 h-4 text-rose-500" /> Monthly Outflows (-)
                  </div>
                  <div className="text-2xl font-bold font-display mt-1 text-rose-600">{inr(monthlyTotalOut)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Purchases & Expenses</div>
                </CardContent>
              </Card>

              <Card className="border">
                <CardContent className="pt-5">
                  <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1 uppercase">
                    <Layers className="w-4 h-4 text-amber-500" /> Direct Expenses
                  </div>
                  <div className="text-2xl font-bold font-display mt-1 text-amber-600">{inr(monthlyDirectExpTotal)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Labour, Hallmarking, Freight</div>
                </CardContent>
              </Card>

              <Card className="border">
                <CardContent className="pt-5">
                  <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1 uppercase">
                    <Tag className="w-4 h-4 text-purple-500" /> Indirect Expenses
                  </div>
                  <div className="text-2xl font-bold font-display mt-1 text-purple-600">{inr(monthlyIndirectExpTotal)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Rent, Salary, Overheads</div>
                </CardContent>
              </Card>

              <Card className="border">
                <CardContent className="pt-5">
                  <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1 uppercase">
                    <BookOpen className="w-4 h-4 text-primary" /> Net Monthly Cashflow
                  </div>
                  <div className={`text-2xl font-bold font-display mt-1 ${monthlyNetBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {inr(monthlyNetBalance)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Net Position</div>
                </CardContent>
              </Card>
            </div>

            {/* Day-by-Day Summary Table */}
            <Card className="shadow-sm border mb-6">
              <CardHeader className="border-b bg-muted/20 py-4">
                <CardTitle className="text-base font-bold font-display flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" /> Day-by-Day Monthly Trajectory ({selectedMonth})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground border-b bg-muted/30">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 text-center">Transactions</th>
                        <th className="py-3 text-right text-emerald-600">Total In (+)</th>
                        <th className="py-3 text-right text-rose-600">Total Out (-)</th>
                        <th className="py-3 px-4 text-right">Day Net Cashflow</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {monthlyDailySummary.map((day) => {
                        const net = day.totalIn - day.totalOut;
                        return (
                          <tr key={day.date} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-xs">{formatDate(day.date)}</td>
                            <td className="py-3 text-center">
                              <Badge variant="outline" className="text-xs">{day.count} entries</Badge>
                            </td>
                            <td className="py-3 text-right font-mono text-emerald-600 font-semibold">{inr(day.totalIn)}</td>
                            <td className="py-3 text-right font-mono text-rose-600 font-semibold">{inr(day.totalOut)}</td>
                            <td className={`py-3 px-4 text-right font-mono font-bold ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              {inr(net)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Full Monthly Entries Table */}
            <Card className="shadow-sm border">
              <CardHeader className="border-b bg-muted/20 py-4">
                <CardTitle className="text-base font-bold font-display flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-600" /> All Monthly Ledger Entries
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground border-b bg-muted/30">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3">Type</th>
                        <th className="py-3">Particulars</th>
                        <th className="py-3">Mode</th>
                        <th className="py-3 text-right text-emerald-600">In (+)</th>
                        <th className="py-3 px-4 text-right text-rose-600">Out (-)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {monthlyEntries.map((e, idx) => {
                        const Icon = e.icon;
                        return (
                          <tr key={`${e.id}-${idx}`} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 font-mono text-xs">{formatDate(e.date)}</td>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4 text-muted-foreground" />
                                {e.type === "Direct Expense" ? (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">Direct Expense</Badge>
                                ) : e.type === "Indirect Expense" ? (
                                  <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[10px]">Indirect Expense</Badge>
                                ) : (
                                  <span className="font-semibold text-xs text-foreground">{e.type}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 text-xs font-medium">{e.desc}</td>
                            <td className="py-3 text-muted-foreground">
                              <Badge variant="outline" className="text-xs font-mono">{e.mode}</Badge>
                            </td>
                            <td className="py-3 text-right font-mono font-bold text-emerald-600">{e.in > 0 ? inr(e.in) : "—"}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">{e.out > 0 ? inr(e.out) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ISOLATED PRINTABLE LEDGER STATEMENT */}
      <div id="printable-ledger-statement" className="print-section hidden print:block text-slate-900 bg-white p-6">
        <ShopHeader documentLabel={viewMode === "daily" ? "Daily Daybook Statement" : "Monthly Cashflow Statement"} compact />

        <div className="text-center my-3 border-b border-slate-300 pb-3">
          <h2 className="text-base font-bold uppercase tracking-wider">
            {viewMode === "daily" ? `Daybook Ledger Statement (${formatDate(selectedDate)})` : `Monthly Cashflow Statement (${selectedMonth})`}
          </h2>
          <div className="text-xs text-slate-600 font-semibold mt-0.5">Filter: {filterType} Transactions</div>
        </div>

        <table className="w-full text-xs border-collapse border border-slate-300 my-4">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-slate-700">
              <th className="py-2 px-3 text-left border-r">Date</th>
              <th className="py-2 px-3 text-left border-r">Type</th>
              <th className="py-2 px-3 text-left border-r">Particulars / Description</th>
              <th className="py-2 px-3 text-center border-r">Mode</th>
              <th className="py-2 px-3 text-right border-r text-emerald-800">Inflow (₹)</th>
              <th className="py-2 px-3 text-right text-rose-800">Outflow (₹)</th>
            </tr>
          </thead>
          <tbody>
            {(viewMode === "daily" ? dailyEntries : monthlyEntries).map((e, idx) => (
              <tr key={idx} className="border-b border-slate-200">
                <td className="py-2 px-3 border-r font-mono">{formatDate(e.date || e.time)}</td>
                <td className="py-2 px-3 border-r font-semibold">{e.type}</td>
                <td className="py-2 px-3 border-r">{e.desc}</td>
                <td className="py-2 px-3 border-r text-center font-mono">{e.mode || "Cash"}</td>
                <td className="py-2 px-3 border-r text-right font-mono font-semibold text-emerald-800">{e.in > 0 ? inr(e.in) : "—"}</td>
                <td className="py-2 px-3 text-right font-mono font-semibold text-rose-800">{e.out > 0 ? inr(e.out) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-900">
            <tr>
              <td colSpan={4} className="py-2.5 px-3 text-right uppercase">Total:</td>
              <td className="py-2.5 px-3 text-right font-mono text-emerald-900 text-sm">{inr(viewMode === "daily" ? dailyTotalIn : monthlyTotalIn)}</td>
              <td className="py-2.5 px-3 text-right font-mono text-rose-900 text-sm">{inr(viewMode === "daily" ? dailyTotalOut : monthlyTotalOut)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-12 grid grid-cols-2 gap-12 text-center text-xs font-bold uppercase tracking-wider">
          <div className="border-t border-slate-600 pt-2">Accountant / Cashier Signature</div>
          <div className="border-t border-slate-600 pt-2">Proprietor / Managing Director</div>
        </div>
      </div>
    </Layout>
  );
}