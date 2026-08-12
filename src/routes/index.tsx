import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { inr } from "@/lib/storage";
import { useAuth } from "@/lib/auth";
import {
  Package,
  Receipt,
  TrendingUp,
  Star,
  UserCheck,
  CalendarRange,
  Wallet,
  AlertTriangle,
  Wrench,
  ShoppingBag,
  CheckCircle,
  Clock,
  BellRing,
  ShoppingCart,
  Landmark,
  Award,
  Users,
  ChevronRight,
  Sparkles,
  Layers,
  CircleDollarSign,
  Boxes,
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTenantAPI } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { translateEnum, invoiceTypeMap, paymentMethodMap } from "@/translations/mappings";

const LOYAL_THRESHOLD = 3;
const defaultRates: any = { updatedAt: new Date().toISOString(), gold24: 7850, gold22: 7200, gold20: 6540, gold18: 5890, silver: 98 };

export default function Dashboard() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tenantSession } = useAuth();
  const authUser = tenantSession?.user;
  const shopName = tenantSession?.shop?.shopName || "Jewellery Shop";
  const api = useTenantAPI();

  const { data: products = [] } = useQuery({ queryKey: ["inventory"], queryFn: api.inventory.getAll });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: api.customers.getAll });
  const { data: allInvoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: api.invoices.getAll });
  const { data: salesReturns = [] } = useQuery({ queryKey: ["salesReturns"], queryFn: api.salesReturns.getAll });
  const { data: expenses = [] } = useQuery({ queryKey: ["expenses"], queryFn: api.expenses.getAll });
  const { data: repairs = [] } = useQuery({ queryKey: ["repairs"], queryFn: api.repairs.getAll });
  const { data: purchases = [] } = useQuery({ queryKey: ["purchases"], queryFn: api.purchases.getAll });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: api.suppliers.getAll });
  const { data: ratesList = [] } = useQuery({ queryKey: ["goldRates"], queryFn: api.goldRates.getAll });
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: api.orders.getAll });
  const { data: girviItems = [] } = useQuery({ queryKey: ["girvi"], queryFn: api.girvi.getAll });

  const isOperator = authUser?.role === "operator";
  const invoices = useMemo(() => allInvoices.filter(i => isOperator ? i.type !== "GST" : i.type === "GST"), [allInvoices, isOperator]);
  const rolePurchases = useMemo(() => purchases.filter(p => isOperator ? !(p.type === "GST" || p.gstPct > 0) : (p.type === "GST" || p.gstPct > 0)), [purchases, isOperator]);

  const returnedInvoiceIds = useMemo(
    () => new Set(salesReturns.map((r: any) => r.invoiceId)),
    [salesReturns]
  );


  const rates = ratesList[0] || defaultRates;

  const displayRates = {
    gold24: rates.gold24 ?? defaultRates.gold24,
    gold22: rates.gold22 ?? defaultRates.gold22,
    gold20: rates.gold20 ?? defaultRates.gold20,
    gold18: rates.gold18 ?? defaultRates.gold18,
    silver: rates.silver ?? defaultRates.silver,
    updatedAt: rates.updatedAt ?? defaultRates.updatedAt,
  };

  const now = new Date();
  const today = now.toDateString();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const inMonth = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}` === monthKey; };

  const todayInvoices = invoices.filter((i) => new Date(i.createdAt).toDateString() === today);
  const monthInvoices = invoices.filter((i) => inMonth(i.createdAt));

  const todayReturns = salesReturns
    .filter((r: any) => new Date(r.createdAt || r.date).toDateString() === today)
    .reduce((s: number, r: any) => s + (r.totalRefund || 0), 0);
  const monthReturns = salesReturns
    .filter((r: any) => inMonth(r.createdAt || r.date))
    .reduce((s: number, r: any) => s + (r.totalRefund || 0), 0);
  const totalReturns = salesReturns.reduce((s: number, r: any) => s + (r.totalRefund || 0), 0);

  const todaySales = Math.max(0, todayInvoices.reduce((s, i) => s + i.total, 0) - todayReturns);
  const totalSell = Math.max(0, invoices.reduce((s, i) => s + i.total, 0) - totalReturns);
  const monthRevenue = Math.max(0, monthInvoices.reduce((s, i) => s + i.total, 0) - monthReturns);


  const todayExpense = expenses.filter((e) => new Date(e.date).toDateString() === today).reduce((s, e) => s + (e.amount || 0), 0);
  const monthExpense = expenses.filter((e) => inMonth(e.date)).reduce((s, e) => s + (e.amount || 0), 0);

  const supplierDuesTotal = suppliers.reduce((s, sup) => s + (sup.outstanding || 0), 0);
  const customerDuesTotal = invoices.reduce((s, i) => s + (i.balanceDue || 0), 0);
  const purchaseAmount = rolePurchases.reduce((s, p) => s + p.total, 0);
  const todayCustomers = new Set(todayInvoices.map((i) => i.customerId || i.customerMobile || i.customerName)).size;

  const counts = new Map<string, number>();
  invoices.forEach((i) => { if (i.customerId) counts.set(i.customerId, (counts.get(i.customerId) || 0) + 1); });
  const loyalCustomers = customers.filter((c) => (counts.get(c._id || c.id) || 0) >= LOYAL_THRESHOLD).length;
  const normalCustomers = customers.length - loyalCustomers;

  const activeProducts = useMemo(() => products.filter((p: any) => Math.max(0, p.stock || 0) > 0), [products]);

  const stockValue = useMemo(() => {
    return products.reduce((s: number, p: any) => {
      const q = Math.max(0, p.stock || 0);
      if (q <= 0) return s;
      const unitVal = p.costPrice || p.sellingPrice || 0;
      return s + (unitVal * q);
    }, 0);
  }, [products]);


  const goldGrams = useMemo(() => {
    return products
      .filter((p: any) => {
        const q = Math.max(0, p.stock || 0);
        if (q <= 0) return false;
        const metal = (p.metal || p.metalType || p.category || "").toString().toUpperCase();
        return metal.includes("GOLD") || metal === "GOLD";
      })
      .reduce((s: number, p: any) => s + (Number(p.netWeight) || 0), 0);
  }, [products]);

  const silverGrams = useMemo(() => {
    return products
      .filter((p: any) => {
        const q = Math.max(0, p.stock || 0);
        if (q <= 0) return false;
        const metal = (p.metal || p.metalType || p.category || "").toString().toUpperCase();
        return metal.includes("SILVER") || metal === "SILVER";
      })
      .reduce((s: number, p: any) => s + (Number(p.netWeight) || 0), 0);
  }, [products]);


  const girviPrincipalTotal = girviItems.filter((g) => g.status === "ACTIVE" || g.status === "Pledged").reduce((s, g) => s + (g.principal || 0), 0);



  // 7-day sales trend
  const days: { label: string; Sales: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const lbl = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    const total = invoices.filter(inv => new Date(inv.createdAt).toDateString() === d.toDateString()).reduce((s, x) => s + x.total, 0);
    days.push({ label: lbl, Sales: total });
  }

  // 6-month trend
  const sixMonthsData = useMemo(() => {
    const arr = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mKey = `${d.getFullYear()}-${d.getMonth()}`;
      const rev = invoices.filter(inv => { const id = new Date(inv.createdAt); return `${id.getFullYear()}-${id.getMonth()}` === mKey; }).reduce((s, x) => s + x.total, 0);
      const exp = expenses.filter(e => { const ed = new Date(e.date); return `${ed.getFullYear()}-${ed.getMonth()}` === mKey; }).reduce((s, x) => s + (x.amount || 0), 0);
      arr.push({ name: d.toLocaleString('default', { month: 'short' }), Revenue: rev, Expense: exp });
    }
    return arr;
  }, [invoices, expenses]);

  const formatYAxis = (tickItem: number) => {
    if (tickItem >= 100000) return `₹${(tickItem / 100000).toFixed(1)}L`;
    if (tickItem >= 1000) return `₹${(tickItem / 1000).toFixed(1)}k`;
    return `₹${tickItem}`;
  };

  const lowStock = products.filter(p => p.stock <= 2).length;
  const pendingRepairs = repairs.filter(r => r.status !== "Delivered").length;
  const pendingOrders = orders.filter(o => o.status !== "Delivered" && o.status !== "Cancelled").length;

  const todayIso = new Date().toISOString().slice(0, 10);
  const readyOrders = orders.filter(o => o.status === "Ready").length;
  const readyRepairs = repairs.filter(r => r.status === "Ready").length;
  const dueOrders = orders.filter(o => o.dueDate && o.dueDate <= todayIso && !["Delivered", "Cancelled"].includes(o.status)).length;
  const dueRepairs = repairs.filter(r => r.deliveryDate && r.deliveryDate <= todayIso && r.status !== "Delivered").length;
  const unpaidInvoices = invoices.filter(i => (i.balanceDue || 0) > 0).length;

  // Comprehensive 20+ Module Stat Cards List
  const allModuleStats = [
    { label: t("dashboard.stat.totalSell"), value: inr(totalSell), icon: TrendingUp, sub: `${invoices.length} total sales invoices`, to: "/sales", color: "emerald" },
    { label: t("dashboard.stat.totalMoneyToday"), value: inr(todaySales), icon: Wallet, sub: `${todayInvoices.length} invoices today`, to: "/sales", color: "emerald" },
    { label: t("dashboard.stat.monthlyRevenue"), value: inr(monthRevenue), icon: CalendarRange, sub: `${monthInvoices.length} invoices this month`, to: "/sales", color: "emerald" },
    { label: "Today's Net Profit", value: inr(todaySales - todayExpense), icon: CircleDollarSign, sub: `Expense: ${inr(todayExpense)}`, to: "/ledger", color: "emerald" },
    { label: "Monthly Net Profit", value: inr(monthRevenue - monthExpense), icon: TrendingUp, sub: `Expense: ${inr(monthExpense)}`, to: "/ledger", color: "emerald" },

    { label: t("dashboard.stat.totalGold"), value: `${goldGrams.toFixed(2)} g`, icon: Award, sub: "Pure Gold stock in hand", to: "/inventory", color: "amber" },
    { label: t("dashboard.stat.totalSilver"), value: `${silverGrams.toFixed(2)} g`, icon: Package, sub: "Silver stock in hand", to: "/inventory", color: "amber" },
    { label: t("dashboard.stat.stockValue"), value: inr(stockValue), icon: Boxes, sub: `${products.length} catalog items`, to: "/inventory", color: "amber" },
    { label: t("dashboard.stat.inventoryItems"), value: activeProducts.length, icon: Package, sub: `${lowStock} low stock items`, to: "/inventory", color: "amber" },


    { label: "Girvi Loan Receivables", value: inr(girviPrincipalTotal), icon: Landmark, sub: `${girviItems.length} pledged items`, to: "/girvi", color: "blue" },
    { label: "Customer Dues Receivable", value: inr(customerDuesTotal), icon: AlertTriangle, sub: `${unpaidInvoices} unpaid invoices`, to: "/dues", color: "rose" },
    { label: t("dashboard.stat.totalDue"), value: inr(supplierDuesTotal), icon: AlertTriangle, sub: `${suppliers.length} suppliers payable`, to: "/suppliers", color: "rose" },
    { label: t("dashboard.stat.purchaseAmount"), value: inr(purchaseAmount), icon: ShoppingBag, sub: `${rolePurchases.length} stock purchases`, to: "/purchases", color: "blue" },

    { label: t("dashboard.stat.todaysCustomers"), value: todayCustomers, icon: UserCheck, sub: `${customers.length} total customer base`, to: "/customers", color: "purple" },
    { label: t("dashboard.stat.loyalCustomers"), value: loyalCustomers, icon: Star, sub: `${LOYAL_THRESHOLD}+ previous purchases`, to: "/customers", color: "purple" },
    { label: t("dashboard.stat.normalCustomers"), value: normalCustomers, icon: Users, sub: "Standard retail buyers", to: "/customers", color: "purple" },
    { label: t("dashboard.stat.activeOrders"), value: pendingOrders, icon: ShoppingBag, sub: `${readyOrders} ready for delivery`, to: "/orders", color: "blue" },
    { label: t("dashboard.stat.pendingRepairs"), value: pendingRepairs, icon: Wrench, sub: `${readyRepairs} ready for delivery`, to: "/repairs", color: "blue" },
  ];

  const recent = [...invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const [dateString, setDateString] = useState("");
  useEffect(() => {
    const d = new Date();
    setDateString(`${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`);
  }, []);

  return (
    <Layout>
      {/* EXECUTIVE HERO BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 text-white p-6 sm:p-8 shadow-xl mb-6 border border-amber-700/50">
        <div className="absolute -right-12 -bottom-12 opacity-15 pointer-events-none">
          <Sparkles className="w-80 h-80 text-amber-300" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-500/30 text-amber-200 border-amber-400/40 text-xs uppercase font-mono tracking-widest px-2.5 py-0.5">
                Jewellery ERP Enterprise
              </Badge>
              <span className="text-xs text-amber-200/80 font-mono">Date: {dateString}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-amber-50 mt-2">
              {shopName} — Jewellery ERP Dashboard
            </h1>
            <p className="text-amber-200/90 text-sm mt-1 max-w-xl">
              Live Jewellery Showroom Intelligence: Manage POS Billing, Bullion Reserves, Girvi Loans, Karigars & Daybook Ledgers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Link to="/billing">
              <Button size="lg" className="bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold shadow-lg">
                <ShoppingCart className="w-4 h-4 mr-2" /> New POS Billing
              </Button>
            </Link>
            <Link to="/inventory">
              <Button size="lg" variant="outline" className="bg-amber-900/50 hover:bg-amber-800/80 text-amber-100 border-amber-500/50 font-semibold">
                <Package className="w-4 h-4 mr-2" /> Add Item
              </Button>
            </Link>
            <Link to="/girvi">
              <Button size="lg" variant="outline" className="bg-amber-900/50 hover:bg-amber-800/80 text-amber-100 border-amber-500/50 font-semibold">
                <Landmark className="w-4 h-4 mr-2" /> New Girvi Loan
              </Button>
            </Link>
          </div>
        </div>

        {/* LIVE BULLION MARKET TICKER */}
        <div className="mt-6 pt-5 border-t border-amber-700/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-amber-100">
          <div className="bg-amber-950/50 backdrop-blur rounded-xl p-3 border border-amber-600/40 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">Gold 24K Rate</div>
              <div className="text-lg font-bold font-mono text-white mt-0.5">{inr(displayRates.gold24)}<span className="text-xs font-normal opacity-80">/g</span></div>
            </div>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>

          <div className="bg-amber-950/50 backdrop-blur rounded-xl p-3 border border-amber-600/40 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">Gold 22K Rate</div>
              <div className="text-lg font-bold font-mono text-white mt-0.5">{inr(displayRates.gold22)}<span className="text-xs font-normal opacity-80">/g</span></div>
            </div>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>

          <div className="bg-amber-950/50 backdrop-blur rounded-xl p-3 border border-amber-600/40 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">Gold 18K Rate</div>
              <div className="text-lg font-bold font-mono text-white mt-0.5">{inr(displayRates.gold18)}<span className="text-xs font-normal opacity-80">/g</span></div>
            </div>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>

          <div className="bg-amber-950/50 backdrop-blur rounded-xl p-3 border border-amber-600/40 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">Silver Rate</div>
              <div className="text-lg font-bold font-mono text-white mt-0.5">{inr(displayRates.silver)}<span className="text-xs font-normal opacity-80">/g</span></div>
            </div>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* ALL PAGE MODULE STATS IN GRID DIVS */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold font-display flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600" /> Showroom Key Performance Indicator Divs
          </h2>
          <span className="text-xs text-muted-foreground font-mono">18 Modules Connected</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {allModuleStats.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.label} to={s.to} className="block">
                <Card className="border shadow-xs hover:shadow-md transition-all bg-card hover:border-amber-500/40 h-full">
                  <CardContent className="p-3.5 flex flex-col justify-between h-full">
                    <div className="flex items-start justify-between gap-1">
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase leading-tight">{s.label}</div>
                      <div className="w-7 h-7 rounded-lg bg-accent/60 text-accent-foreground grid place-items-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-primary" />
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="text-lg font-bold font-display text-foreground">{s.value}</div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">{s.sub}</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="shadow-sm border">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" /> {t("dashboard.salesTrend")} (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={formatYAxis} />
                <RechartsTooltip formatter={(value: number) => [inr(value), t("dashboard.stat.todaysSales")]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="Sales" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base font-bold flex items-center gap-2">
              <Wallet className="w-5 h-5 text-rose-600" /> {t("dashboard.revenueVsExpenses")} (Last 6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sixMonthsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={formatYAxis} />
                <RechartsTooltip formatter={(value: number) => [inr(value), undefined]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{ fill: 'transparent' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} formatter={(value) => value === "Revenue" ? t("dashboard.stat.monthlyRevenue") : value === "Expense" ? t("dashboard.expense") : value} />
                <Bar dataKey="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* LOWER SECTION: RECENT SALES & ALERTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-muted/20">
            <CardTitle className="font-display text-base font-bold flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" /> {t("dashboard.recentSales")}
            </CardTitle>
            <Link to="/sales">
              <Button variant="ghost" size="sm" className="text-xs">
                View All <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">{t("dashboard.noInvoicesYet")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 border-b">
                    <tr>
                      <th className="py-3 px-4">{t("dashboard.table.invoice")}</th>
                      <th className="py-3">{t("dashboard.table.customer")}</th>
                      <th className="py-3">{t("dashboard.table.type")}</th>
                      <th className="py-3">{t("dashboard.table.mode")}</th>
                      <th className="py-3 px-4 text-right">{t("dashboard.table.total")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recent.map((i) => {
                      const isReturned = returnedInvoiceIds.has(i._id || i.id) || (i as any).isReturned;
                      return (
                        <tr key={i._id || i.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-xs text-foreground">{i.number}</td>
                          <td className="py-3 text-xs font-medium">{i.customerName || "—"}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant="outline" className="text-[10px]">
                                {translateEnum(invoiceTypeMap, i.type, language)}
                              </Badge>
                              {isReturned ? (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 text-[10px]">
                                  RETURNED
                                </Badge>
                              ) : (i.balanceDue || 0) > 0 ? (
                                <Badge className="bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 text-[10px]">
                                  DUE
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]">
                                  PAID
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 text-xs text-muted-foreground">
                            {translateEnum(paymentMethodMap, i.paymentMode, language)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                            {inr(i.total)}
                          </td>
                        </tr>
                      );
                    })}

                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* OPERATIONS REMINDERS & ALERTS */}
        <Card className="shadow-sm border">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-muted/20">
            <CardTitle className="font-display text-base font-bold flex items-center gap-2">
              <BellRing className="w-5 h-5 text-amber-600" /> {t("dashboard.remindersAlerts")}
            </CardTitle>
            <Link to="/notifications">
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                {t("dashboard.viewAll")}
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {readyOrders > 0 && <AlertRow icon={CheckCircle} label={t("dashboard.ordersReadyForDelivery")} value={readyOrders} to="/orders" className="text-green-700 bg-green-50 border-green-200 font-medium" />}
            {readyRepairs > 0 && <AlertRow icon={CheckCircle} label={t("dashboard.repairsReadyForDelivery")} value={readyRepairs} to="/repairs" className="text-green-700 bg-green-50 border-green-200 font-medium" />}
            {dueOrders > 0 && <AlertRow icon={Clock} label={t("dashboard.dueTodayOverdueOrders")} value={dueOrders} to="/orders" className="text-rose-700 bg-rose-50 border-rose-200 font-medium" />}
            {dueRepairs > 0 && <AlertRow icon={Clock} label={t("dashboard.dueTodayOverdueRepairs")} value={dueRepairs} to="/repairs" className="text-rose-700 bg-rose-50 border-rose-200 font-medium" />}
            {unpaidInvoices > 0 && <AlertRow icon={Wallet} label={t("dashboard.unpaidCustomerDues")} value={unpaidInvoices} to="/dues" className="text-amber-700 bg-amber-50 border-amber-200 font-medium" />}
            <AlertRow icon={Package} label={t("dashboard.lowStockItems")} value={lowStock} to="/inventory" />
            <AlertRow icon={ShoppingBag} label={t("dashboard.activeOrders")} value={pendingOrders} to="/orders" />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function AlertRow({ icon: Icon, label, value, to, className }: { icon: typeof Package; label: string; value: number; to: string; className?: string }) {
  return (
    <Link to={to} className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${className || 'hover:bg-accent border-border'}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${className ? 'opacity-80' : 'text-muted-foreground'}`} />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <span className="font-mono font-bold text-sm">{value}</span>
    </Link>
  );
}
