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
  RotateCcw,
  Building2,
  Coins,
  Scale,
  CreditCard,
  Search,
} from "lucide-react";
import { DIRECT_EXPENSE_CATEGORIES } from "@/routes/expenses";
import { ShopHeader } from "@/components/InvoiceBranding";
import { toast } from "sonner";

export default function LedgerPage() {
  const { tenantSession } = useAuth();
  const authUser = tenantSession?.user;

  // View Mode: Supports all MMI Jewellery Ledger types
  const [viewMode, setViewMode] = useState<
    "daily" | "monthly" | "customer" | "supplier" | "karigar" | "bank_cash" | "fine_metal" | "girvi"
  >("daily");

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [filterType, setFilterType] = useState<string>("All");

  // Party Selection Filters for MMI Party Ledgers
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("all");
  const [selectedKarigarId, setSelectedKarigarId] = useState<string>("all");
  const [partySearch, setPartySearch] = useState<string>("");

  const targetDateStr = useMemo(() => new Date(selectedDate).toDateString(), [selectedDate]);

  const api = useTenantAPI();
  const { data: allInvoices = [], isLoading: loadingInvoices } = useApi<Invoice[]>(["invoices"], () => api.invoices.getAll());
  const { data: expenses = [], isLoading: loadingExpenses } = useApi<Expense[]>(["expenses"], () => api.expenses.getAll());
  const { data: orders = [], isLoading: loadingOrders } = useApi<Order[]>(["orders"], () => api.orders.getAll());
  const { data: repairs = [], isLoading: loadingRepairs } = useApi<Repair[]>(["repairs"], () => api.repairs.getAll());
  const { data: customers = [], isLoading: loadingCustomers } = useApi<Customer[]>(["customers"], () => api.customers.getAll());
  const { data: purchases = [], isLoading: loadingPurchases } = useApi<any[]>(["purchases"], () => api.purchases.getAll());
  const { data: suppliers = [], isLoading: loadingSuppliers } = useApi<any[]>(["suppliers"], () => api.suppliers.getAll());
  const { data: employees = [], isLoading: loadingEmployees } = useApi<any[]>(["employees"], () => api.employees.getAll());
  const { data: girviList = [], isLoading: loadingGirvi } = useApi<any[]>(["girvi"], () => api.girvi.getAll());
  const { data: advances = [], isLoading: loadingAdvances } = useApi<any[]>(["advances"], () => api.advances.getAll());
  const { data: karigars = [], isLoading: loadingKarigars } = useApi<any[]>(["karigars"], () => api.karigars.getAll());
  const { data: salesReturns = [] } = useApi<any[]>(["salesReturns"], () => api.salesReturns.getAll());

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

  const isLoading = loadingInvoices || loadingExpenses || loadingOrders || loadingRepairs || loadingCustomers || loadingPurchases || loadingSuppliers || loadingEmployees || loadingGirvi || loadingAdvances || loadingKarigars;

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

    salesReturns.forEach((r: any) => {
      const d = r.createdAt || r.date;
      if (d && new Date(d).toDateString() === targetDateStr) {
        arr.push({
          id: r.id || r._id,
          date: d,
          time: d,
          type: 'Sales Return',
          subCategory: 'Customer Refund',
          icon: RotateCcw,
          desc: `Sales Return: ${r.returnNo || 'RET'} - ${r.customerName || 'Customer'} (Bill #${r.invoiceNumber || ''})`,
          in: 0,
          out: r.totalRefund || 0,
          mode: r.refundMode || 'Cash',
        });
      }
    });

    rolePurchases.forEach((p: any) => {
      if (new Date(p.date).toDateString() === targetDateStr) {
        const isReturnedOrCancelled = p.isReturned || p.status === "Cancelled" || p.status === "Returned";
        if (isReturnedOrCancelled) {
          arr.push({
            id: p.id || p._id,
            date: p.date,
            time: p.date,
            type: 'Purchase Return',
            subCategory: 'Supplier Return',
            icon: RotateCcw,
            desc: `Purchase Return/Cancelled: ${p.billNo} - ${p.supplierName}`,
            in: p.paymentMode === 'Credit' ? 0 : (p.total || 0),
            out: 0,
            mode: p.paymentMode || 'Cash',
          });
        } else {
          arr.push({
            id: p.id || p._id,
            date: p.date,
            time: p.date,
            type: 'Purchase',
            subCategory: 'Bullion Stock',
            icon: ShoppingBag,
            desc: `Purchase: ${p.billNo} - ${p.supplierName}`,
            in: 0,
            out: p.paymentMode === 'Credit' ? 0 : p.total,
            mode: p.paymentMode,
          });
        }
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

    salesReturns.forEach((r: any) => {
      const d = r.createdAt || r.date;
      if (!d) return;
      const isoDate = new Date(d).toISOString().slice(0, 10);
      if (isoDate.startsWith(targetMonth)) {
        arr.push({
          id: r.id || r._id,
          date: isoDate,
          time: d,
          type: 'Sales Return',
          subCategory: 'Customer Refund',
          icon: RotateCcw,
          desc: `Sales Return: ${r.returnNo || 'RET'} - ${r.customerName || 'Customer'} (Bill #${r.invoiceNumber || ''})`,
          in: 0,
          out: r.totalRefund || 0,
          mode: r.refundMode || 'Cash',
        });
      }
    });

    rolePurchases.forEach((p: any) => {
      if (!p.date) return;
      const isoDate = new Date(p.date).toISOString().slice(0, 10);
      if (isoDate.startsWith(targetMonth)) {
        const isReturnedOrCancelled = p.isReturned || p.status === "Cancelled" || p.status === "Returned";
        if (isReturnedOrCancelled) {
          arr.push({
            id: p.id || p._id,
            date: isoDate,
            time: p.date,
            type: 'Purchase Return',
            subCategory: 'Supplier Return',
            icon: RotateCcw,
            desc: `Purchase Return/Cancelled: ${p.billNo} - ${p.supplierName}`,
            in: p.paymentMode === 'Credit' ? 0 : (p.total || 0),
            out: 0,
            mode: p.paymentMode || 'Cash',
          });
        } else {
          arr.push({
            id: p.id || p._id,
            date: isoDate,
            time: p.date,
            type: 'Purchase',
            subCategory: 'Bullion Stock',
            icon: ShoppingBag,
            desc: `Purchase: ${p.billNo} - ${p.supplierName}`,
            in: 0,
            out: p.paymentMode === 'Credit' ? 0 : p.total,
            mode: p.paymentMode,
          });
        }
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

  // --------------------------------------------------------------------------
  // MMI CUSTOMER PARTY LEDGER COMPUTATIONS (Grahak Khata)
  // --------------------------------------------------------------------------
  const filteredCustomersList = useMemo(() => {
    if (!partySearch) return customers;
    const q = partySearch.toLowerCase();
    return customers.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.phone || c.mobile || "").includes(q)
    );
  }, [customers, partySearch]);

  const customerLedgerData = useMemo(() => {
    if (selectedCustomerId === "all") {
      // Summary of all customers
      return customers.map((c: any) => {
        const custInvoices = invoices.filter((i) => i.customerName === c.name || (i as any).phone === c.phone || (i as any).customerPhone === c.phone);
        const custReturns = salesReturns.filter((r: any) => r.customerName === c.name);
        const custAdvances = advances.filter((a: any) => a.customerName === c.name || a.name === c.name);

        const totalSales = custInvoices.reduce((s, i) => s + (i.total || 0), 0);
        const totalPaid = custInvoices.reduce((s, i) => s + ((i.total || 0) - (i.balanceDue || 0)), 0);
        const totalRefunds = custReturns.reduce((s: any, r: any) => s + (r.totalRefund || 0), 0);
        const totalAdv = custAdvances.reduce((s: any, a: any) => s + (a.amount || 0), 0);

        const netBalance = c.balance || (totalSales - totalPaid - totalAdv + totalRefunds);

        // Fine Weight
        let goldWeightGrams = 0;
        let silverWeightGrams = 0;
        custInvoices.forEach((inv) => {
          (inv.items || []).forEach((item: any) => {
            const wt = Number(item.netWt || item.netWeight || item.weight || 0);
            if ((item.metal || "").toLowerCase().includes("silver") || (item.purity || "").toLowerCase().includes("silver")) {
              silverWeightGrams += wt;
            } else {
              goldWeightGrams += wt;
            }
          });
        });

        return {
          id: c.id || c._id,
          name: c.name,
          phone: c.phone || c.mobile || "—",
          city: c.city || c.address || "—",
          totalSales,
          totalPaid,
          netBalance,
          goldWeightGrams,
          silverWeightGrams,
          lastDate: custInvoices[0]?.createdAt || c.createdAt || new Date(),
        };
      });
    }

    // Specific Customer Statement
    const selectedCust = customers.find((c: any) => (c.id || c._id) === selectedCustomerId);
    if (!selectedCust) return [];

    const name = selectedCust.name;
    const phone = selectedCust.phone || selectedCust.mobile;

    const statement: any[] = [];

    invoices
      .filter((i) => i.customerName === name || (i as any).phone === phone || (i as any).customerPhone === phone)
      .forEach((inv) => {
        statement.push({
          date: inv.createdAt,
          voucherNo: inv.number,
          type: "Sales Invoice",
          desc: `Bill #${inv.number} — Items: ${(inv.items || []).map((it: any) => it.name).join(", ")}`,
          debit: inv.total, // Customer owes money
          credit: (inv.total || 0) - (inv.balanceDue || 0), // Payment received
          netWt: (inv.items || []).reduce((s: number, it: any) => s + Number(it.netWt || it.netWeight || 0), 0),
          mode: inv.paymentMode || "Cash",
        });
      });

    salesReturns
      .filter((r: any) => r.customerName === name)
      .forEach((ret: any) => {
        statement.push({
          date: ret.createdAt || ret.date,
          voucherNo: ret.returnNo || "RET",
          type: "Sales Return",
          desc: `Sales Return (Bill #${ret.invoiceNumber || ""})`,
          debit: 0,
          credit: ret.totalRefund || 0,
          netWt: 0,
          mode: ret.refundMode || "Cash",
        });
      });

    advances
      .filter((a: any) => a.customerName === name || a.name === name)
      .forEach((adv: any) => {
        statement.push({
          date: adv.date || adv.createdAt,
          voucherNo: adv.receiptNo || "ADV",
          type: "Customer Advance",
          desc: `Advance Received: ${adv.note || adv.remarks || ""}`,
          debit: 0,
          credit: adv.amount || 0,
          netWt: 0,
          mode: adv.paymentMode || adv.mode || "Cash",
        });
      });

    return statement.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedCustomerId, customers, invoices, salesReturns, advances]);

  // --------------------------------------------------------------------------
  // MMI SUPPLIER / DEALER LEDGER COMPUTATIONS (Kharidar Khata)
  // --------------------------------------------------------------------------
  const supplierLedgerData = useMemo(() => {
    if (selectedSupplierId === "all") {
      return suppliers.map((sup: any) => {
        const supPurchases = rolePurchases.filter((p) => p.supplierName === sup.name);
        const totalPurchased = supPurchases.reduce((s, p) => s + (p.total || 0), 0);
        const totalPaid = supPurchases.filter((p) => p.paymentMode !== "Credit").reduce((s, p) => s + (p.total || 0), 0);
        const netBalance = totalPurchased - totalPaid;

        return {
          id: sup.id || sup._id,
          name: sup.name,
          phone: sup.phone || sup.mobile || "—",
          company: sup.companyName || sup.gstNo || "—",
          totalPurchased,
          totalPaid,
          netBalance,
          lastDate: supPurchases[0]?.date || sup.createdAt || new Date(),
        };
      });
    }

    const selectedSup = suppliers.find((s: any) => (s.id || s._id) === selectedSupplierId);
    if (!selectedSup) return [];

    const statement: any[] = [];
    rolePurchases
      .filter((p) => p.supplierName === selectedSup.name)
      .forEach((pur) => {
        statement.push({
          date: pur.date,
          billNo: pur.billNo,
          type: pur.isReturned ? "Purchase Return" : "Purchase Bill",
          desc: `Purchase Bill #${pur.billNo} — ${pur.itemsDescription || "Stock purchase"}`,
          credit: pur.total, // We owe supplier
          debit: pur.paymentMode !== "Credit" ? pur.total : 0, // Paid to supplier
          fineGoldGrams: pur.fineGoldWeight || 0,
          fineSilverGrams: pur.fineSilverWeight || 0,
          mode: pur.paymentMode || "Cash",
        });
      });

    return statement.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedSupplierId, suppliers, rolePurchases]);

  // --------------------------------------------------------------------------
  // MMI KARIGAR ARTISAN LEDGER COMPUTATIONS (Karigar Khata)
  // --------------------------------------------------------------------------
  const karigarLedgerData = useMemo(() => {
    if (selectedKarigarId === "all") {
      return karigars.map((kar: any) => {
        const issuedGold = Number(kar.fineGoldIssued || kar.issuedGoldGrams || 0);
        const receivedGold = Number(kar.fineGoldReceived || kar.receivedGoldGrams || 0);
        const netGoldBalance = issuedGold - receivedGold;

        const totalLabor = Number(kar.laborCharges || kar.jobWorkAmount || 0);
        const paidLabor = Number(kar.laborPaid || 0);
        const netLaborDue = totalLabor - paidLabor;

        return {
          id: kar.id || kar._id,
          name: kar.name || kar.karigarName,
          phone: kar.phone || kar.mobile || "—",
          specialization: kar.specialization || kar.skill || "Artisan",
          issuedGold,
          receivedGold,
          netGoldBalance,
          totalLabor,
          paidLabor,
          netLaborDue,
        };
      });
    }

    const selectedKar = karigars.find((k: any) => (k.id || k._id) === selectedKarigarId);
    if (!selectedKar) return [];

    return [
      {
        date: selectedKar.createdAt || selectedKar.date || new Date(),
        task: selectedKar.taskDescription || selectedKar.item || "Job Work Assignment",
        issuedGold: Number(selectedKar.fineGoldIssued || selectedKar.issuedGoldGrams || 0),
        receivedGold: Number(selectedKar.fineGoldReceived || selectedKar.receivedGoldGrams || 0),
        wastage: Number(selectedKar.wastageGrams || 0),
        laborCharges: Number(selectedKar.laborCharges || selectedKar.jobWorkAmount || 0),
        status: selectedKar.status || "Completed",
      },
    ];
  }, [selectedKarigarId, karigars]);

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

      <div className="print:hidden space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40 text-xs font-mono">
                ✨ MMI Jewellery Ledger Suite
              </Badge>
            </div>
            <h1 className="text-3xl font-display font-black tracking-tight text-slate-900 dark:text-slate-100">
              {viewMode === "daily" && "Daily Daybook & Rokad Register"}
              {viewMode === "monthly" && "Monthly Cashflow Ledger"}
              {viewMode === "customer" && "Customer Party Ledger (Grahak Khata)"}
              {viewMode === "supplier" && "Supplier / Dealer Ledger (Kharidar Khata)"}
              {viewMode === "karigar" && "Karigar Artisan Work Ledger"}
              {viewMode === "bank_cash" && "Bank & Cash Book"}
              {viewMode === "fine_metal" && "Fine Metal Weight Ledger (Gold/Silver g)"}
              {viewMode === "girvi" && "Girvi Loan Ledger (Pawn Khata)"}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Comprehensive Indian Jewellery ERP Khata accounting suite — track Cash ₹, Fine Metal Weight (g), Deposits & Withdrawals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {viewMode === "daily" && (
              <div className="space-y-1 w-full sm:w-auto">
                <Label className="text-xs font-semibold">Select Date</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full sm:w-44 bg-background h-9 text-xs font-mono"
                />
              </div>
            )}

            {viewMode === "monthly" && (
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
              <Button onClick={triggerPrint} className="h-9 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                <Printer className="w-4 h-4 mr-1.5" /> Print / PDF
              </Button>
            </div>
          </div>
        </header>

        {/* MMI LEDGER MODE SWITCHER NAVIGATION BAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card border border-amber-500/20 rounded-2xl p-2 shadow-sm">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none min-w-max w-full sm:w-auto">
            <button
              onClick={() => setViewMode("daily")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "daily"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-slate-700 dark:text-slate-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/40"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Daily Daybook
            </button>

            <button
              onClick={() => setViewMode("monthly")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "monthly"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-slate-700 dark:text-slate-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/40"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Monthly Ledger
            </button>

            <button
              onClick={() => setViewMode("customer")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "customer"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-slate-700 dark:text-slate-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/40"
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Customer Khata
            </button>

            <button
              onClick={() => setViewMode("supplier")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "supplier"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-slate-700 dark:text-slate-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/40"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" /> Dealer Khata
            </button>

            <button
              onClick={() => setViewMode("karigar")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "karigar"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-slate-700 dark:text-slate-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/40"
              }`}
            >
              <Hammer className="w-3.5 h-3.5" /> Karigar Khata
            </button>

            <button
              onClick={() => setViewMode("bank_cash")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "bank_cash"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-slate-700 dark:text-slate-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/40"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" /> Bank/Cash
            </button>

            <button
              onClick={() => setViewMode("fine_metal")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "fine_metal"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-slate-700 dark:text-slate-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/40"
              }`}
            >
              <Scale className="w-3.5 h-3.5" /> Fine Weight (g)
            </button>

            <button
              onClick={() => setViewMode("girvi")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "girvi"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-slate-700 dark:text-slate-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/40"
              }`}
            >
              <Landmark className="w-3.5 h-3.5" /> Girvi Loan
            </button>
          </div>

          {/* Transaction Filter Buttons Bar */}
          {(viewMode === "daily" || viewMode === "monthly") && (
            <div className="flex items-center gap-1 bg-background border rounded-lg p-1 text-[11px] shrink-0">
              <Filter className="w-3 h-3 text-muted-foreground ml-1" />
              <button
                onClick={() => setFilterType("All")}
                className={`px-2 py-0.5 rounded transition-colors ${filterType === "All" ? "bg-amber-600 text-white font-bold" : "text-muted-foreground hover:text-foreground"}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType("Inflow")}
                className={`px-2 py-0.5 rounded transition-colors ${filterType === "Inflow" ? "bg-emerald-600 text-white font-bold" : "text-muted-foreground hover:text-foreground"}`}
              >
                Inflows
              </button>
              <button
                onClick={() => setFilterType("Outflow")}
                className={`px-2 py-0.5 rounded transition-colors ${filterType === "Outflow" ? "bg-rose-600 text-white font-bold" : "text-muted-foreground hover:text-foreground"}`}
              >
                Outflows
              </button>
            </div>
          )}
        </div>

        {/* VIEW 1: DAILY DAYBOOK */}
        {viewMode === "daily" && (
          <>
            {/* Daily KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
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
        )}

        {/* VIEW 2: MONTHLY CASHFLOW LEDGER */}
        {viewMode === "monthly" && (
          <>
            {/* Monthly KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
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

            {/* Monthly Day-by-Day Trajectory Table */}
            <Card className="shadow-sm border">
              <CardHeader className="border-b bg-muted/20 py-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" /> Day-by-Day Monthly Trajectory ({selectedMonth})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[600px]">
                    <thead className="text-left font-bold uppercase tracking-wider text-muted-foreground border-b bg-muted/30">
                      <tr>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 text-center">Transactions</th>
                        <th className="py-2.5 text-right text-emerald-600">Total In (+)</th>
                        <th className="py-2.5 text-right text-rose-600">Total Out (-)</th>
                        <th className="py-2.5 px-4 text-right">Day Net Cashflow</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {monthlyDailySummary.map((day) => {
                        const net = day.totalIn - day.totalOut;
                        return (
                          <tr key={day.date} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2 px-4 font-bold">{formatDate(day.date)}</td>
                            <td className="py-2 text-center">
                              <Badge variant="outline" className="text-[10px]">{day.count} entries</Badge>
                            </td>
                            <td className="py-2 text-right font-bold text-emerald-600">{inr(day.totalIn)}</td>
                            <td className="py-2 text-right font-bold text-rose-600">{inr(day.totalOut)}</td>
                            <td className={`py-2 px-4 text-right font-bold ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
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

            {/* Monthly Table */}
            <Card className="shadow-sm border">
              <CardHeader className="border-b bg-muted/20 py-4">
                <CardTitle className="text-base font-bold font-display flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-600" /> All Monthly Ledger Entries ({selectedMonth})
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

        {/* VIEW 3: MMI CUSTOMER PARTY LEDGER (GRAHAK KHATA) */}
        {viewMode === "customer" && (
          <div className="space-y-4">
            {/* Customer Search & Select Bar */}
            <Card className="border p-4 bg-muted/10">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Users className="w-5 h-5 text-amber-600" />
                  <div>
                    <h3 className="font-bold text-sm">Select Customer Party Khata</h3>
                    <p className="text-xs text-muted-foreground">View individual customer sales, payments, advances & metal balances</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search customer name or phone..."
                      value={partySearch}
                      onChange={(e) => setPartySearch(e.target.value)}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="h-9 px-3 text-xs font-bold rounded-md border border-input bg-background w-full sm:w-48"
                  >
                    <option value="all">-- All Customers ({customers.length}) --</option>
                    {filteredCustomersList.map((c: any) => (
                      <option key={c.id || c._id} value={c.id || c._id}>
                        {c.name} ({c.phone || c.mobile || "—"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>

            {/* Customer Table View */}
            {selectedCustomerId === "all" ? (
              <Card className="border shadow-sm">
                <CardHeader className="py-3 border-b bg-muted/20">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span>Customer Ledger Balances Summary</span>
                    <Badge variant="outline">{customers.length} Total Customers</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 uppercase font-bold text-muted-foreground border-b text-left">
                      <tr>
                        <th className="p-3">Customer Name</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3 text-right">Total Purchases</th>
                        <th className="p-3 text-right text-emerald-600">Total Paid</th>
                        <th className="p-3 text-right text-rose-600">Cash Due Balance</th>
                        <th className="p-3 text-right text-amber-600">Gold (g)</th>
                        <th className="p-3 text-right text-slate-600">Silver (g)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {customerLedgerData.map((c: any) => (
                        <tr key={c.id} className="hover:bg-muted/30">
                          <td className="p-3 font-sans font-bold text-slate-900 dark:text-slate-100">{c.name}</td>
                          <td className="p-3">{c.phone}</td>
                          <td className="p-3 text-right font-bold">{inr(c.totalSales)}</td>
                          <td className="p-3 text-right font-bold text-emerald-600">{inr(c.totalPaid)}</td>
                          <td className={`p-3 text-right font-bold ${c.netBalance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                            {inr(c.netBalance)}
                          </td>
                          <td className="p-3 text-right font-bold text-amber-600">{c.goldWeightGrams ? `${c.goldWeightGrams.toFixed(2)}g` : "—"}</td>
                          <td className="p-3 text-right font-bold text-slate-600">{c.silverWeightGrams ? `${c.silverWeightGrams.toFixed(2)}g` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ) : (
              <Card className="border shadow-sm">
                <CardHeader className="py-3 border-b bg-muted/20">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span>Customer Particulars Statement ({customers.find((c: any) => (c.id || c._id) === selectedCustomerId)?.name})</span>
                    <Badge className="bg-amber-600">{customerLedgerData.length} Statement Rows</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 uppercase font-bold text-muted-foreground border-b text-left">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Voucher #</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Particulars & Items</th>
                        <th className="p-3">Mode</th>
                        <th className="p-3 text-right text-rose-600">Debit (Udhar ₹)</th>
                        <th className="p-3 text-right text-emerald-600">Credit (Jama ₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {customerLedgerData.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/30">
                          <td className="p-3 font-sans">{formatDate(row.date)}</td>
                          <td className="p-3 font-bold">{row.voucherNo}</td>
                          <td className="p-3 font-sans">{row.type}</td>
                          <td className="p-3 font-sans">{row.desc}</td>
                          <td className="p-3">{row.mode}</td>
                          <td className="p-3 text-right font-bold text-rose-600">{row.debit ? inr(row.debit) : "—"}</td>
                          <td className="p-3 text-right font-bold text-emerald-600">{row.credit ? inr(row.credit) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* VIEW 4: SUPPLIER / DEALER LEDGER (KHARIDAR KHATA) */}
        {viewMode === "supplier" && (
          <div className="space-y-4">
            <Card className="border p-4 bg-muted/10">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-amber-600" />
                  <div>
                    <h3 className="font-bold text-sm">Supplier & Bullion Dealer Khata</h3>
                    <p className="text-xs text-muted-foreground">Track bullion purchases, dealer payments & fine metal balances</p>
                  </div>
                </div>

                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="h-9 px-3 text-xs font-bold rounded-md border border-input bg-background w-full sm:w-64"
                >
                  <option value="all">-- All Suppliers ({suppliers.length}) --</option>
                  {suppliers.map((s: any) => (
                    <option key={s.id || s._id} value={s.id || s._id}>
                      {s.name} ({s.companyName || s.phone || "Dealer"})
                    </option>
                  ))}
                </select>
              </div>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="py-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Supplier Purchase Ledger Summary</span>
                  <Badge variant="outline">{supplierLedgerData.length} Records</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 uppercase font-bold text-muted-foreground border-b text-left">
                    <tr>
                      <th className="p-3">{selectedSupplierId === "all" ? "Supplier Name" : "Date"}</th>
                      <th className="p-3">{selectedSupplierId === "all" ? "Company / GST" : "Bill #"}</th>
                      <th className="p-3">{selectedSupplierId === "all" ? "Phone" : "Type"}</th>
                      <th className="p-3 text-right">{selectedSupplierId === "all" ? "Total Purchases" : "Credit (We Owe)"}</th>
                      <th className="p-3 text-right text-emerald-600">{selectedSupplierId === "all" ? "Total Paid" : "Debit (Paid)"}</th>
                      <th className="p-3 text-right text-amber-600">{selectedSupplierId === "all" ? "Net Payable Balance" : "Payment Mode"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono">
                    {supplierLedgerData.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="p-3 font-sans font-bold">{selectedSupplierId === "all" ? row.name : formatDate(row.date)}</td>
                        <td className="p-3">{selectedSupplierId === "all" ? row.company : row.billNo}</td>
                        <td className="p-3 font-sans">{selectedSupplierId === "all" ? row.phone : row.type}</td>
                        <td className="p-3 text-right font-bold">{inr(selectedSupplierId === "all" ? row.totalPurchased : row.credit)}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">{inr(selectedSupplierId === "all" ? row.totalPaid : row.debit)}</td>
                        <td className="p-3 text-right font-bold text-amber-600">
                          {selectedSupplierId === "all" ? inr(row.netBalance) : row.mode}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* VIEW 5: KARIGAR ARTISAN WORK LEDGER */}
        {viewMode === "karigar" && (
          <div className="space-y-4">
            <Card className="border p-4 bg-muted/10">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Hammer className="w-5 h-5 text-amber-600" />
                  <div>
                    <h3 className="font-bold text-sm">Karigar Job Work & Metal Issue Khata</h3>
                    <p className="text-xs text-muted-foreground">Monitor gold/silver issued to artisans, wastage, and labor crafting charges</p>
                  </div>
                </div>

                <select
                  value={selectedKarigarId}
                  onChange={(e) => setSelectedKarigarId(e.target.value)}
                  className="h-9 px-3 text-xs font-bold rounded-md border border-input bg-background w-full sm:w-64"
                >
                  <option value="all">-- All Karigars ({karigars.length}) --</option>
                  {karigars.map((k: any) => (
                    <option key={k.id || k._id} value={k.id || k._id}>
                      {k.name || k.karigarName} ({k.specialization || "Artisan"})
                    </option>
                  ))}
                </select>
              </div>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="py-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Karigar Fine Metal & Labor Ledger Summary</span>
                  <Badge variant="outline">{karigarLedgerData.length} Karigars</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 uppercase font-bold text-muted-foreground border-b text-left">
                    <tr>
                      <th className="p-3">{selectedKarigarId === "all" ? "Karigar Name" : "Date"}</th>
                      <th className="p-3">{selectedKarigarId === "all" ? "Specialization" : "Task / Item"}</th>
                      <th className="p-3 text-right text-rose-600">{selectedKarigarId === "all" ? "Gold Issued (g)" : "Issued Gold"}</th>
                      <th className="p-3 text-right text-emerald-600">{selectedKarigarId === "all" ? "Gold Received (g)" : "Received Gold"}</th>
                      <th className="p-3 text-right text-amber-600">{selectedKarigarId === "all" ? "Net Gold Bal with Karigar" : "Wastage (g)"}</th>
                      <th className="p-3 text-right">{selectedKarigarId === "all" ? "Labor Due (₹)" : "Labor Charges"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono">
                    {karigarLedgerData.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="p-3 font-sans font-bold">{selectedKarigarId === "all" ? row.name : formatDate(row.date)}</td>
                        <td className="p-3 font-sans">{selectedKarigarId === "all" ? row.specialization : row.task}</td>
                        <td className="p-3 text-right font-bold text-rose-600">{row.issuedGold ? `${row.issuedGold.toFixed(3)}g` : "0g"}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">{row.receivedGold ? `${row.receivedGold.toFixed(3)}g` : "0g"}</td>
                        <td className="p-3 text-right font-bold text-amber-600">
                          {selectedKarigarId === "all" ? `${(row.netGoldBalance || 0).toFixed(3)}g` : `${(row.wastage || 0).toFixed(3)}g`}
                        </td>
                        <td className="p-3 text-right font-bold">{inr(selectedKarigarId === "all" ? row.netLaborDue : row.laborCharges)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* VIEW 6: BANK & CASH BOOK LEDGER */}
        {viewMode === "bank_cash" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Total Cash Receipts (Jama)</span>
                    <div className="text-3xl font-black font-mono mt-1 text-emerald-600">
                      {inr(allDailyEntries.filter((e) => e.mode === "Cash").reduce((s, e) => s + e.in, 0))}
                    </div>
                  </div>
                  <Coins className="w-8 h-8 text-emerald-500/40" />
                </CardContent>
              </Card>

              <Card className="border bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-slate-900">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Total Bank / Online UPI Receipts</span>
                    <div className="text-3xl font-black font-mono mt-1 text-blue-600">
                      {inr(allDailyEntries.filter((e) => e.mode !== "Cash" && e.mode !== "—").reduce((s, e) => s + e.in, 0))}
                    </div>
                  </div>
                  <CreditCard className="w-8 h-8 text-blue-500/40" />
                </CardContent>
              </Card>
            </div>

            <Card className="border shadow-sm">
              <CardHeader className="py-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Bank & Cash Movement Journal</span>
                  <Badge variant="outline">{allDailyEntries.length} Today's Entries</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 uppercase font-bold text-muted-foreground border-b text-left">
                    <tr>
                      <th className="p-3">Time</th>
                      <th className="p-3">Payment Mode</th>
                      <th className="p-3">Particulars / Source</th>
                      <th className="p-3 text-right text-emerald-600">Cash In (₹)</th>
                      <th className="p-3 text-right text-rose-600">Cash Out (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono">
                    {allDailyEntries.map((e: any, idx: number) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="p-3 font-sans">{formatDate(e.date || e.time)}</td>
                        <td className="p-3"><Badge variant="outline">{e.mode}</Badge></td>
                        <td className="p-3 font-sans">{e.desc}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">{e.in ? inr(e.in) : "—"}</td>
                        <td className="p-3 text-right font-bold text-rose-600">{e.out ? inr(e.out) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* VIEW 7: FINE METAL WEIGHT LEDGER */}
        {viewMode === "fine_metal" && (
          <div className="space-y-4">
            <Card className="border p-4 bg-muted/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Scale className="w-5 h-5 text-amber-600" />
                  <div>
                    <h3 className="font-bold text-sm">Fine Metal Weight Flow Ledger (Gold & Silver Grams)</h3>
                    <p className="text-xs text-muted-foreground">Consolidated physical fine weight audit across sales, bullion purchases & karigar metal transfers</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="py-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Fine Metal Weight Audit Log</span>
                  <Badge className="bg-amber-600 font-mono">Physical Stock Log</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 uppercase font-bold text-muted-foreground border-b text-left">
                    <tr>
                      <th className="p-3">Voucher / Bill #</th>
                      <th className="p-3">Party Name</th>
                      <th className="p-3">Transaction Type</th>
                      <th className="p-3 text-right text-amber-600">Gold Net Wt (g)</th>
                      <th className="p-3 text-right text-slate-600">Silver Net Wt (g)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono">
                    {invoices.slice(0, 15).map((inv: any, idx: number) => {
                      let gWt = 0;
                      let sWt = 0;
                      (inv.items || []).forEach((it: any) => {
                        const wt = Number(it.netWt || it.netWeight || it.weight || 0);
                        if ((it.metal || "").toLowerCase().includes("silver")) sWt += wt;
                        else gWt += wt;
                      });

                      return (
                        <tr key={idx} className="hover:bg-muted/30">
                          <td className="p-3 font-bold">{inv.number}</td>
                          <td className="p-3 font-sans font-bold">{inv.customerName}</td>
                          <td className="p-3 font-sans">Sales Invoice</td>
                          <td className="p-3 text-right font-bold text-amber-600">{gWt ? `${gWt.toFixed(3)}g` : "—"}</td>
                          <td className="p-3 text-right font-bold text-slate-600">{sWt ? `${sWt.toFixed(3)}g` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* VIEW 8: GIRVI LOAN KHATA */}
        {viewMode === "girvi" && (
          <div className="space-y-4">
            <Card className="border p-4 bg-muted/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Landmark className="w-5 h-5 text-amber-600" />
                  <div>
                    <h3 className="font-bold text-sm">Girvi Loan & Pawn Asset Khata</h3>
                    <p className="text-xs text-muted-foreground">Gold/Silver mortgage loans disbursed, interest income, pledged ornament weights & status</p>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono">{girviList.length} Active Girvi Tickets</Badge>
              </div>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="py-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-bold">Girvi Pawn Register Log</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 uppercase font-bold text-muted-foreground border-b text-left">
                    <tr>
                      <th className="p-3">Ticket #</th>
                      <th className="p-3">Pledger / Customer</th>
                      <th className="p-3">Issue Date</th>
                      <th className="p-3 text-right text-rose-600">Loan Principal (₹)</th>
                      <th className="p-3 text-right text-amber-600">Pledged Net Wt (g)</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono">
                    {girviList.map((g: any, idx: number) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="p-3 font-bold">#{g.ticketNo || g.number || idx + 1}</td>
                        <td className="p-3 font-sans font-bold">{g.customerName || g.pledgerName || "Customer"}</td>
                        <td className="p-3 font-sans">{formatDate(g.date || g.createdAt || new Date())}</td>
                        <td className="p-3 text-right font-bold text-rose-600">{inr(g.loanAmount || g.principalAmount || 0)}</td>
                        <td className="p-3 text-right font-bold text-amber-600">{g.netWeight ? `${g.netWeight}g` : "—"}</td>
                        <td className="p-3 text-center">
                          <Badge className={g.status === "Released" ? "bg-emerald-600" : "bg-amber-600"}>
                            {g.status || "Active"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {girviList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground font-sans">
                          No Girvi pawn loan entries recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ISOLATED PRINTABLE LEDGER STATEMENT */}
      <div id="printable-ledger-statement" className="print-section hidden print:block text-slate-900 bg-white p-6">
        <ShopHeader
          documentLabel={
            viewMode === "supplier"
              ? "Supplier Ledger Statement"
              : viewMode === "customer"
              ? "Customer Ledger Statement"
              : viewMode === "karigar"
              ? "Karigar Work Ledger Statement"
              : viewMode === "daily"
              ? "Daily Daybook Statement"
              : "Ledger Statement"
          }
          compact
        />

        <div className="text-center my-3 border-b border-slate-300 pb-3">
          <h2 className="text-base font-bold uppercase tracking-wider">
            {viewMode === "supplier"
              ? "Supplier Account Ledger Statement"
              : viewMode === "customer"
              ? "Customer Account Ledger Statement"
              : viewMode === "karigar"
              ? "Karigar Work Ledger Statement"
              : viewMode === "daily"
              ? `Daybook Ledger Statement (${formatDate(selectedDate)})`
              : `Monthly Cashflow Statement (${selectedMonth})`}
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