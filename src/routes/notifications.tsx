import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { useApi } from "@/hooks/useApi";
import { useTenantAPI } from "@/lib/api";
import { inr, type Order, type Repair, type Invoice, type Product } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  Wallet,
  MessageCircle,
  AlertTriangle,
  BellRing,
  CheckCheck,
  ExternalLink,
  Search,
  ArrowUpRight,
  Sparkles,
  RefreshCcw,
  Calendar,
  PhoneCall,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";

function paginateCombined<A, B>(arrA: A[], arrB: B[], page: number, pageSize = 10) {
  const combined: Array<{ isA: boolean; item: A | B }> = [
    ...arrA.map((item) => ({ isA: true as const, item })),
    ...arrB.map((item) => ({ isA: false as const, item })),
  ];
  const totalPages = Math.ceil(combined.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const windowed = combined.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return {
    a: windowed.filter((w) => w.isA).map((w) => w.item as A),
    b: windowed.filter((w) => !w.isA).map((w) => w.item as B),
    totalPages,
    currentPage,
    total: combined.length,
  };
}

export default function NotificationsPage() {
  const { tenantSession } = useAuth();
  const api = useTenantAPI();
  const { data: products = [], isLoading: isLoadingP, refetch: refetchP } = useApi<Product[]>(["inventory"], () => api.inventory.getAll());
  const { data: invoices = [], isLoading: isLoadingI, refetch: refetchI } = useApi<Invoice[]>(["invoices"], () => api.invoices.getAll());
  const { data: repairs = [], isLoading: isLoadingR, refetch: refetchR } = useApi<Repair[]>(["repairs"], () => api.repairs.getAll());
  const { data: orders = [], isLoading: isLoadingO, refetch: refetchO } = useApi<Order[]>(["orders"], () => api.orders.getAll());

  const isLoading = isLoadingP || isLoadingI || isLoadingR || isLoadingO;

  const handleRefresh = () => {
    refetchP();
    refetchI();
    refetchR();
    refetchO();
    toast.success("Notifications refreshed!");
  };

  const isOperator = tenantSession?.user?.role === "operator";
  const visibleInvoices = useMemo(() => invoices.filter(i => isOperator ? i.type !== "GST" : i.type === "GST"), [invoices, isOperator]);

  const todayIso = new Date().toISOString().slice(0, 10);

  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const readyOrders = useMemo(() => orders.filter(o => o.status === "Ready"), [orders]);
  const readyRepairs = useMemo(() => repairs.filter(r => r.status === "Ready"), [repairs]);
  const dueOrders = useMemo(() => orders.filter(o => o.dueDate && o.dueDate <= todayIso && !["Delivered", "Cancelled"].includes(o.status)), [orders, todayIso]);
  const dueRepairs = useMemo(() => repairs.filter(r => r.deliveryDate && r.deliveryDate <= todayIso && r.status !== "Delivered"), [repairs, todayIso]);
  const unpaidInvoices = useMemo(() => visibleInvoices.filter(i => (i.balanceDue || 0) > 0), [visibleInvoices]);
  const lowStock = useMemo(() => products.filter(p => p.stock <= 2), [products]);

  const totalUnpaidAmount = useMemo(() => unpaidInvoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0), [unpaidInvoices]);

  const totalNotifications = readyOrders.length + readyRepairs.length + dueOrders.length + dueRepairs.length + unpaidInvoices.length + lowStock.length;

  // Search Filter
  const matchesSearch = (text: string) => !searchQuery.trim() || text.toLowerCase().includes(searchQuery.toLowerCase());

  const filteredReadyOrders = readyOrders.filter(o => matchesSearch(`${o.orderNo} ${o.customerName} ${o.customerMobile} ${o.itemDescription}`));
  const filteredReadyRepairs = readyRepairs.filter(r => matchesSearch(`${r.ticketNo} ${r.customerName} ${r.customerMobile} ${r.itemDescription}`));
  const filteredDueOrders = dueOrders.filter(o => matchesSearch(`${o.orderNo} ${o.customerName} ${o.customerMobile} ${o.itemDescription}`));
  const filteredDueRepairs = dueRepairs.filter(r => matchesSearch(`${r.ticketNo} ${r.customerName} ${r.customerMobile} ${r.itemDescription}`));
  const filteredInvoices = unpaidInvoices.filter(i => matchesSearch(`${i.number} ${i.customerName} ${i.customerMobile}`));
  const filteredLowStock = lowStock.filter(p => matchesSearch(`${p.name} ${p.category} ${p.subcategory}`));

  const displayReadyOrders = (activeTab === "All" || activeTab === "Ready for Delivery" || activeTab === "Orders") ? filteredReadyOrders : [];
  const displayReadyRepairs = (activeTab === "All" || activeTab === "Ready for Delivery") ? filteredReadyRepairs : [];
  const displayDueOrders = (activeTab === "All" || activeTab === "Overdue" || activeTab === "Orders") ? filteredDueOrders : [];
  const displayDueRepairs = (activeTab === "All" || activeTab === "Overdue") ? filteredDueRepairs : [];
  const displayInvoices = (activeTab === "All" || activeTab === "Pending Payments") ? filteredInvoices : [];
  const displayLowStock = (activeTab === "All" || activeTab === "Low Stock Alerts") ? filteredLowStock : [];

  const activeCount =
    displayReadyOrders.length +
    displayReadyRepairs.length +
    displayDueOrders.length +
    displayDueRepairs.length +
    displayInvoices.length +
    displayLowStock.length;

  const [readyPage, setReadyPage] = useState(1);
  const readyPag = paginateCombined(displayReadyOrders, displayReadyRepairs, readyPage);

  const [duePage, setDuePage] = useState(1);
  const duePag = paginateCombined(displayDueOrders, displayDueRepairs, duePage);

  const [invoicesPage, setInvoicesPage] = useState(1);
  const invoicesTotalPages = Math.ceil(displayInvoices.length / 10) || 1;
  const invoicesCurrentPage = Math.min(invoicesPage, invoicesTotalPages);
  const paginatedInvoices = displayInvoices.slice((invoicesCurrentPage - 1) * 10, invoicesCurrentPage * 10);

  const [lowStockPage, setLowStockPage] = useState(1);
  const lowStockTotalPages = Math.ceil(displayLowStock.length / 10) || 1;
  const lowStockCurrentPage = Math.min(lowStockPage, lowStockTotalPages);
  const paginatedLowStock = displayLowStock.slice((lowStockCurrentPage - 1) * 10, lowStockCurrentPage * 10);

  const shopIdentifier = useMemo(() => {
    return tenantSession?.shop?.slug || tenantSession?.shop?.shopName || "Your Shop";
  }, [tenantSession]);

  const sendWhatsApp = (phoneRaw: string | undefined, message: string) => {
    if (!phoneRaw) {
      toast.error("No phone number available for this customer.");
      return;
    }
    let phone = phoneRaw.replace(/\D/g, "");
    if (phone.length === 10) phone = "91" + phone;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
  };

  const tabsConfig = [
    { id: "All", label: "All Alerts", count: totalNotifications },
    { id: "Ready for Delivery", label: "Ready Items", count: readyOrders.length + readyRepairs.length, badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    { id: "Overdue", label: "Overdue / Due Today", count: dueOrders.length + dueRepairs.length, badgeColor: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
    { id: "Pending Payments", label: "Pending Dues", count: unpaidInvoices.length, badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    { id: "Low Stock Alerts", label: "Low Stock", count: lowStock.length, badgeColor: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  ];

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        {/* ========= PAGE HEADER BANNER ========= */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 p-6 sm:p-8 text-white shadow-xl">
          <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-300 border border-amber-500/30 backdrop-blur-md">
                  <BellRing className="w-3.5 h-3.5" /> Real-time Alert Center
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-300 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Action Required
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-white">
                Notifications &amp; Reminders
              </h1>
              <p className="text-sm text-slate-300 mt-1 max-w-xl">
                Stay updated with ready deliveries, pending customer dues, repair completions, and inventory restock alerts.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="outline"
                onClick={handleRefresh}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md font-medium text-xs h-10"
              >
                <RefreshCcw className="w-3.5 h-3.5 mr-2" /> Refresh Alerts
              </Button>
            </div>
          </div>

          {/* Quick Metrics Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4" /> Ready Items
              </div>
              <div className="text-xl font-bold text-white mt-1">
                {readyOrders.length + readyRepairs.length}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-medium">
                <Clock className="w-4 h-4" /> Overdue
              </div>
              <div className="text-xl font-bold text-white mt-1">
                {dueOrders.length + dueRepairs.length}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-medium">
                <Wallet className="w-4 h-4" /> Unpaid Dues
              </div>
              <div className="text-xl font-bold text-white mt-1">
                {inr(totalUnpaidAmount)}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{unpaidInvoices.length} Invoices</div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-medium">
                <AlertTriangle className="w-4 h-4" /> Low Stock
              </div>
              <div className="text-xl font-bold text-white mt-1">
                {lowStock.length}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">&le; 2 pcs</div>
            </div>
          </div>
        </div>

        {/* ========= FILTER TABS & SEARCH ========= */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-card border border-border p-3 rounded-xl shadow-sm">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            {tabsConfig.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setReadyPage(1); setDuePage(1); setInvoicesPage(1); setLowStockPage(1); }}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-amber-700 text-white shadow-md shadow-amber-700/20"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-muted text-foreground"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-background"
            />
          </div>
        </div>

        {/* ========= CONTENT SECTION ========= */}
        {isLoading ? (
          <div className="py-20 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-600 border-t-transparent mb-3" />
            <p className="text-sm text-muted-foreground">Loading active notifications &amp; alerts...</p>
          </div>
        ) : activeCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-card border border-dashed border-border rounded-2xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 rounded-full flex items-center justify-center mb-4 ring-8 ring-emerald-50 dark:ring-emerald-950/20">
              <CheckCheck className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">You're completely caught up!</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {totalNotifications === 0
                ? "No pending deliveries, overdue orders, unpaid invoices, or low stock warnings."
                : `No notifications matching the "${activeTab}" filter or search query.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            {/* ========= READY FOR DELIVERY CARD ========= */}
            {(displayReadyOrders.length > 0 || displayReadyRepairs.length > 0) && (
              <Card className="border-border shadow-sm overflow-hidden rounded-xl">
                <div className="bg-gradient-to-r from-emerald-50 via-emerald-50/50 to-transparent dark:from-emerald-950/30 dark:via-emerald-950/10 dark:to-transparent border-b border-emerald-200/60 dark:border-emerald-800/30 px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">Ready for Delivery</h3>
                      <p className="text-[11px] text-muted-foreground">Orders &amp; repairs completed and awaiting customer pickup</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-600 text-white font-mono">
                    {displayReadyOrders.length + displayReadyRepairs.length} Items
                  </Badge>
                </div>

                <div className="divide-y divide-border">
                  {readyPag.a.map((o) => (
                    <div key={o.id || (o as any)._id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 text-[10px] font-bold uppercase">
                            Order
                          </Badge>
                          <span className="font-bold text-foreground text-sm font-mono">{o.orderNo}</span>
                          <span className="text-xs text-muted-foreground">({formatDate(o.date)})</span>
                        </div>
                        <div className="font-semibold text-foreground text-sm">{o.customerName}</div>
                        {o.customerMobile && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                            <PhoneCall className="w-3 h-3 text-muted-foreground" /> {o.customerMobile}
                          </div>
                        )}
                        <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                          Item: <strong className="text-foreground">{o.itemDescription}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 shadow-sm"
                          onClick={() =>
                            sendWhatsApp(
                              o.customerMobile,
                              `*${shopIdentifier}*\n\nनमस्ते ${o.customerName},\n\nआपका कस्टम ऑर्डर (${o.orderNo}) - ${o.itemDescription} अब डिलीवरी के लिए तैयार है। ऑर्डर ${formatDate(o.date)} को दिया गया था।\n\nकृपया इसे लेने के लिए दुकान पर आएं।\n\nधन्यवाद!`
                            )
                          }
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
                        </Button>
                        <Link to="/orders">
                          <Button size="sm" variant="outline" className="h-8 text-xs">
                            View <ArrowUpRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}

                  {readyPag.b.map((r) => {
                    const balanceDue = (r.estimate || 0) - (r.advance || 0);
                    return (
                      <div key={r.id || (r as any)._id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 text-[10px] font-bold uppercase">
                              Repair
                            </Badge>
                            <span className="font-bold text-foreground text-sm font-mono">{r.ticketNo}</span>
                            <span className="text-xs text-muted-foreground">({formatDate(r.date)})</span>
                          </div>
                          <div className="font-semibold text-foreground text-sm">{r.customerName}</div>
                          {r.customerMobile && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                              <PhoneCall className="w-3 h-3 text-muted-foreground" /> {r.customerMobile}
                            </div>
                          )}
                          <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                            Repair Item: <strong className="text-foreground">{r.itemDescription}</strong>
                          </div>
                          {balanceDue > 0 && (
                            <div className="text-xs text-amber-700 font-semibold font-mono">
                              Due: {inr(balanceDue)}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 shadow-sm"
                            onClick={() =>
                              sendWhatsApp(
                                r.customerMobile,
                                `*${shopIdentifier}*\n\nनमस्ते ${r.customerName},\n\nआपका रिपेयर आइटम (${r.ticketNo}) - ${r.itemDescription} अब डिलीवरी के लिए तैयार है। आइटम ${formatDate(r.date)} को प्राप्त हुआ था। बकाया राशि ${inr(
                                  balanceDue
                                )} है।\n\nकृपया इसे लेने के लिए दुकान पर आएं।\n\nधन्यवाद!`
                              )
                            }
                          >
                            <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
                          </Button>
                          <Link to="/repairs">
                            <Button size="sm" variant="outline" className="h-8 text-xs">
                              View <ArrowUpRight className="w-3 h-3 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {readyPag.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-t border-border text-xs">
                    <span className="text-muted-foreground">
                      Page {readyPag.currentPage} of {readyPag.totalPages} ({readyPag.total} items)
                    </span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReadyPage((p) => Math.max(1, p - 1))} disabled={readyPag.currentPage === 1}>Prev</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setReadyPage((p) => Math.min(readyPag.totalPages, p + 1))} disabled={readyPag.currentPage === readyPag.totalPages}>Next</Button>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* ========= OVERDUE CARD ========= */}
            {(displayDueOrders.length > 0 || displayDueRepairs.length > 0) && (
              <Card className="border-border shadow-sm overflow-hidden rounded-xl">
                <div className="bg-gradient-to-r from-rose-50 via-rose-50/50 to-transparent dark:from-rose-950/30 dark:via-rose-950/10 dark:to-transparent border-b border-rose-200/60 dark:border-rose-800/30 px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-sm">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">Overdue &amp; Due Today</h3>
                      <p className="text-[11px] text-muted-foreground">Passed target delivery dates needing urgent status follow-up</p>
                    </div>
                  </div>
                  <Badge className="bg-rose-600 text-white font-mono">
                    {displayDueOrders.length + displayDueRepairs.length} Items
                  </Badge>
                </div>

                <div className="divide-y divide-border">
                  {duePag.a.map((o) => (
                    <div key={o.id || (o as any)._id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 text-[10px] font-bold uppercase">
                            Order
                          </Badge>
                          <span className="font-bold text-foreground text-sm font-mono">{o.orderNo}</span>
                        </div>
                        <div className="font-semibold text-foreground text-sm">{o.customerName}</div>
                        <div className="text-xs text-rose-600 font-bold flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Due Date: {o.dueDate ? formatDate(o.dueDate) : "—"}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                          Item: <strong className="text-foreground">{o.itemDescription}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 shadow-sm"
                          onClick={() =>
                            sendWhatsApp(
                              o.customerMobile,
                              `*${shopIdentifier}*\n\nनमस्ते ${o.customerName},\n\nयह आपके कस्टम ऑर्डर (${o.orderNo}) के संबंध में एक रिमाइंडर है। अपेक्षित देय तिथि ${o.dueDate ? formatDate(o.dueDate) : "—"} थी।\n\nअपडेट के लिए कृपया हमसे संपर्क करें या दुकान पर आएं।\n\nधन्यवाद!`
                            )
                          }
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
                        </Button>
                        <Link to="/orders">
                          <Button size="sm" variant="outline" className="h-8 text-xs">
                            View <ArrowUpRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}

                  {duePag.b.map((r) => (
                    <div key={r.id || (r as any)._id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 text-[10px] font-bold uppercase">
                            Repair
                          </Badge>
                          <span className="font-bold text-foreground text-sm font-mono">{r.ticketNo}</span>
                        </div>
                        <div className="font-semibold text-foreground text-sm">{r.customerName}</div>
                        <div className="text-xs text-rose-600 font-bold flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Target Date: {r.deliveryDate ? formatDate(r.deliveryDate) : "—"}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                          Repair Item: <strong className="text-foreground">{r.itemDescription}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 shadow-sm"
                          onClick={() =>
                            sendWhatsApp(
                              r.customerMobile,
                              `*${shopIdentifier}*\n\nनमस्ते ${r.customerName},\n\nयह आपके रिपेयर आइटम (${r.ticketNo}) के संबंध में एक रिमाइंडर है। अपेक्षित डिलीवरी तिथि ${r.deliveryDate ? formatDate(r.deliveryDate) : "—"} थी।\n\nअपडेट के लिए कृपया हमसे संपर्क करें या दुकान पर आएं।\n\nधन्यवाद!`
                            )
                          }
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
                        </Button>
                        <Link to="/repairs">
                          <Button size="sm" variant="outline" className="h-8 text-xs">
                            View <ArrowUpRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {duePag.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-t border-border text-xs">
                    <span className="text-muted-foreground">
                      Page {duePag.currentPage} of {duePag.totalPages} ({duePag.total} items)
                    </span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDuePage((p) => Math.max(1, p - 1))} disabled={duePag.currentPage === 1}>Prev</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDuePage((p) => Math.min(duePag.totalPages, p + 1))} disabled={duePag.currentPage === duePag.totalPages}>Next</Button>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* ========= PENDING PAYMENTS CARD ========= */}
            {displayInvoices.length > 0 && (
              <Card className="border-border shadow-sm overflow-hidden rounded-xl">
                <div className="bg-gradient-to-r from-amber-50 via-amber-50/50 to-transparent dark:from-amber-950/30 dark:via-amber-950/10 dark:to-transparent border-b border-amber-200/60 dark:border-amber-800/30 px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-sm">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">Pending Payments</h3>
                      <p className="text-[11px] text-muted-foreground">Customer balances &amp; unpaid bill reminders</p>
                    </div>
                  </div>
                  <Badge className="bg-amber-600 text-white font-mono">
                    {displayInvoices.length} Invoices
                  </Badge>
                </div>

                <div className="divide-y divide-border">
                  {paginatedInvoices.map((i) => (
                    <div key={i.id || (i as any)._id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-[10px] font-bold uppercase">
                            Invoice
                          </Badge>
                          <span className="font-bold text-foreground text-sm font-mono">{i.number}</span>
                          <span className="text-xs text-muted-foreground">({formatDate(i.createdAt)})</span>
                        </div>
                        <div className="font-semibold text-foreground text-sm">{i.customerName}</div>
                        {i.customerMobile && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                            <PhoneCall className="w-3 h-3 text-muted-foreground" /> {i.customerMobile}
                          </div>
                        )}
                        <div className="text-sm text-amber-700 font-bold font-mono">
                          Balance Due: {inr(i.balanceDue || 0)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 shadow-sm"
                          onClick={() =>
                            sendWhatsApp(
                              i.customerMobile,
                              `*${shopIdentifier}*\n\nनमस्ते ${i.customerName},\n\nयह आपके इनवॉइस नंबर: ${i.number} (दिनांक ${formatDate(
                                i.createdAt
                              )}) के लिए *${inr(i.balanceDue || 0)}* की बकाया राशि के संबंध में एक रिमाइंडर है।\n\nकृपया जल्द से जल्द बकाया राशि का भुगतान करें।\n\nधन्यवाद!`
                            )
                          }
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
                        </Button>
                        <Link to="/dues">
                          <Button size="sm" variant="outline" className="h-8 text-xs">
                            Collect <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {invoicesTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-t border-border text-xs">
                    <span className="text-muted-foreground">
                      Page {invoicesCurrentPage} of {invoicesTotalPages} ({displayInvoices.length} entries)
                    </span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setInvoicesPage((p) => Math.max(1, p - 1))} disabled={invoicesCurrentPage === 1}>Prev</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setInvoicesPage((p) => Math.min(invoicesTotalPages, p + 1))} disabled={invoicesCurrentPage === invoicesTotalPages}>Next</Button>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* ========= LOW STOCK ALERTS CARD ========= */}
            {displayLowStock.length > 0 && (
              <Card className="border-border shadow-sm overflow-hidden rounded-xl">
                <div className="bg-gradient-to-r from-indigo-50 via-indigo-50/50 to-transparent dark:from-indigo-950/30 dark:via-indigo-950/10 dark:to-transparent border-b border-indigo-200/60 dark:border-indigo-800/30 px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">Low Stock Inventory Alerts</h3>
                      <p className="text-[11px] text-muted-foreground">Items with 2 or fewer pieces in current stock</p>
                    </div>
                  </div>
                  <Badge className="bg-indigo-600 text-white font-mono">
                    {displayLowStock.length} Low Items
                  </Badge>
                </div>

                <div className="divide-y divide-border">
                  {paginatedLowStock.map((p) => (
                    <div key={p.id || (p as any)._id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-semibold text-foreground text-sm">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Category: <span className="font-medium text-foreground">{p.category}</span> {p.subcategory ? `• ${p.subcategory}` : ""}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Purity: {p.purity || "—"}</span>
                          {p.netWeight > 0 && <span className="text-muted-foreground">• Net Wt: {p.netWeight}g</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Available</div>
                          <Badge variant="outline" className="bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-300 font-mono font-bold">
                            {p.stock} Pcs Left
                          </Badge>
                        </div>

                        <Link to="/inventory">
                          <Button size="sm" variant="outline" className="h-8 text-xs border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950">
                            Restock <ArrowUpRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {lowStockTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-t border-border text-xs">
                    <span className="text-muted-foreground">
                      Page {lowStockCurrentPage} of {lowStockTotalPages} ({displayLowStock.length} items)
                    </span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLowStockPage((p) => Math.max(1, p - 1))} disabled={lowStockCurrentPage === 1}>Prev</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setLowStockPage((p) => Math.min(lowStockTotalPages, p + 1))} disabled={lowStockCurrentPage === lowStockTotalPages}>Next</Button>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
