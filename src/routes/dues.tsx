import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, type Invoice, type InvoicePayment } from "@/lib/storage";
import { formatDate, useDebounce } from "@/lib/utils";
import { useTenantAPI } from "@/lib/api";
import {
  Search,
  AlertCircle,
  MessageCircle,
  Phone,
  Eye,
  FileSpreadsheet,
  Printer,
  Clock,
  TrendingUp,
  CreditCard,
  X,
  CheckCircle2,
  DollarSign,
  Sparkles,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export default function DuesPage() {
  const { tenantSession } = useAuth();
  const api = useTenantAPI();
  const queryClient = useQueryClient();

  const { data: allInvoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: api.invoices.getAll,
  });

  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"all" | "overdue" | "high" | "partial">("all");
  const [page, setPage] = useState(1);

  // Modals state
  const [paymentModalInv, setPaymentModalInv] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState<"Cash" | "UPI" | "Card" | "EMI">("Cash");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");

  const [viewDetailInv, setViewDetailInv] = useState<Invoice | null>(null);

  const isOperator = tenantSession?.user?.role === "operator";
  const invoices = useMemo(
    () => allInvoices.filter((i) => (isOperator ? i.type !== "GST" : i.type === "GST")),
    [allInvoices, isOperator]
  );

  const getDaysOverdue = (dateString: string) => {
    const created = new Date(dateString).getTime();
    const now = new Date().getTime();
    const diffTime = Math.abs(now - created);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Base Dues Filter
  const allDueInvoices = useMemo(() => {
    return invoices.filter((i) => (i.balanceDue || 0) > 0);
  }, [invoices]);

  // Tab & Search Filtering
  const filteredDueInvoices = useMemo(() => {
    return allDueInvoices
      .filter((i) => {
        if (activeTab === "overdue") return getDaysOverdue(i.createdAt) >= 30;
        if (activeTab === "high") return (i.balanceDue || 0) >= 50000;
        if (activeTab === "partial") return (i.amountPaid || 0) > 0;
        return true;
      })
      .filter((i) => {
        if (!debouncedQ) return true;
        const query = debouncedQ.toLowerCase();
        return (
          i.customerName.toLowerCase().includes(query) ||
          i.customerMobile.includes(query) ||
          i.number.toLowerCase().includes(query) ||
          (i.customerAddress || "").toLowerCase().includes(query)
        );
      })
      .filter((i) => {
        if (!dateFrom && !dateTo) return true;
        const invDate = new Date(i.createdAt).toISOString().slice(0, 10);
        if (dateFrom && invDate < dateFrom) return false;
        if (dateTo && invDate > dateTo) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allDueInvoices, activeTab, debouncedQ, dateFrom, dateTo]);

  // Key KPI Metrics
  const totalOutstanding = useMemo(
    () => allDueInvoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0),
    [allDueInvoices]
  );
  const overdue30DaysCount = useMemo(
    () => allDueInvoices.filter((i) => getDaysOverdue(i.createdAt) >= 30).length,
    [allDueInvoices]
  );
  const overdue30DaysAmount = useMemo(
    () =>
      allDueInvoices
        .filter((i) => getDaysOverdue(i.createdAt) >= 30)
        .reduce((sum, i) => sum + (i.balanceDue || 0), 0),
    [allDueInvoices]
  );
  const totalBilledWithDues = useMemo(
    () => allDueInvoices.reduce((sum, i) => sum + (i.total || 0), 0),
    [allDueInvoices]
  );
  const totalRecoveredPart = useMemo(
    () => allDueInvoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0),
    [allDueInvoices]
  );

  // Pagination
  const pageSize = 10;
  const totalPages = Math.ceil(filteredDueInvoices.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginatedDues = filteredDueInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Update Invoice Mutation for recording payments
  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Invoice> }) => api.invoices.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const openCollectPaymentModal = (inv: Invoice) => {
    setPaymentModalInv(inv);
    setPayAmount((inv.balanceDue || 0).toString());
    setPayMode("Cash");
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNote("");
  };

  const handleCollectPayment = async () => {
    if (!paymentModalInv) return;
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid payment amount!");
      return;
    }
    if (amt > (paymentModalInv.balanceDue || 0)) {
      toast.error(`Payment amount cannot exceed remaining balance due (${inr(paymentModalInv.balanceDue || 0)})!`);
      return;
    }

    const existingPayments: InvoicePayment[] = paymentModalInv.payments || [];
    const newPayment: InvoicePayment = {
      id: `PAY-${Date.now()}`,
      amount: amt,
      date: payDate || new Date().toISOString().slice(0, 10),
      mode: payMode,
      note: payNote ? payNote.trim() : `Due collection via ${payMode}`,
    };

    const newPayments = [...existingPayments, newPayment];
    const newAmountPaid = (paymentModalInv.amountPaid || 0) + amt;
    const newBalanceDue = Math.max(0, paymentModalInv.total - newAmountPaid);

    try {
      await updateInvoiceMutation.mutateAsync({
        id: paymentModalInv._id || paymentModalInv.id!,
        data: {
          ...paymentModalInv,
          payments: newPayments,
          amountPaid: newAmountPaid,
          balanceDue: newBalanceDue,
        },
      });
      toast.success(`Payment of ${inr(amt)} recorded successfully!`);
      setPaymentModalInv(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to record payment.");
    }
  };

  const sendWhatsAppReminder = (inv: Invoice) => {
    let phone = inv.customerMobile.replace(/\D/g, "");
    if (phone.length === 10) phone = "91" + phone;

    const shopIdentifier = tenantSession?.shop?.shopName || tenantSession?.shop?.slug || "Jewellery Shop";
    const message = `*${shopIdentifier}*\n\nनमस्ते ${inv.customerName} जी,\n\nयह आपके इनवॉइस नंबर: *${inv.number}* (दिनांक ${formatDate(inv.createdAt)}) की बकाया राशि *${inr(inv.balanceDue || 0)}* के संबंध में रिमाइंडर है।\n\n📌 कुल बिल: ${inr(inv.total)}\n✅ जमा राशि: ${inr(inv.amountPaid || 0)}\n❗ शेष बकाया: *${inr(inv.balanceDue || 0)}*\n\nकृपया जल्द से जल्द भुगतान करें। धन्यवाद!`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const exportToExcel = () => {
    if (filteredDueInvoices.length === 0) {
      toast.error("No pending dues found to export!");
      return;
    }
    const data = filteredDueInvoices.map((inv, index) => ({
      "S.No": index + 1,
      "Invoice Date": formatDate(inv.createdAt),
      "Invoice No": inv.number,
      "Invoice Type": inv.type,
      "Customer Name": inv.customerName,
      "Mobile Number": inv.customerMobile,
      "Customer Address": inv.customerAddress || "N/A",
      "Total Bill": inv.total,
      "Amount Paid": inv.amountPaid || 0,
      "Balance Due": inv.balanceDue || 0,
      "Days Pending": getDaysOverdue(inv.createdAt),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pending Dues");
    XLSX.writeFile(workbook, `Customer_Dues_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Pending dues report exported successfully!");
  };

  return (
    <Layout>
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tracking-tight">
              Customer Dues Recovery Hub
            </h1>
            <Badge className="bg-rose-100 text-rose-800 border-rose-200 font-medium text-xs">
              {allDueInvoices.length} Pending Bills
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Track unpaid balances, record quick installment payments, and send instant WhatsApp payment reminders.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            onClick={exportToExcel}
            className="h-9 text-xs gap-2 border-slate-300 hover:bg-slate-100 w-full sm:w-auto"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="h-9 text-xs gap-2 border-slate-300 hover:bg-slate-100 hidden sm:inline-flex"
          >
            <Printer className="w-4 h-4 text-slate-600" /> Print Summary
          </Button>
        </div>
      </div>

      {/* KPI METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Card className="border border-rose-200 bg-rose-50/50 shadow-xs relative overflow-hidden">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
                Total Pending Dues
              </span>
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-rose-950 mt-1.5 font-mono truncate">
              {inr(totalOutstanding)}
            </div>
            <p className="text-[11px] text-rose-700 mt-1 font-medium">Across {allDueInvoices.length} customer invoices</p>
          </CardContent>
        </Card>

        <Card className="border border-amber-200 bg-amber-50/50 shadow-xs">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">
                Overdue &gt; 30 Days
              </span>
              <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-amber-950 mt-1.5 font-mono truncate">
              {inr(overdue30DaysAmount)}
            </div>
            <p className="text-[11px] text-amber-700 mt-1 font-medium">{overdue30DaysCount} high-priority overdue bills</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                Total Bill Value
              </span>
              <TrendingUp className="w-5 h-5 text-slate-500 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1.5 font-mono truncate">
              {inr(totalBilledWithDues)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Total invoiced amount</p>
          </CardContent>
        </Card>

        <Card className="border border-emerald-200 bg-emerald-50/40 shadow-xs">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
                Recovered Amount
              </span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-950 mt-1.5 font-mono truncate">
              {inr(totalRecoveredPart)}
            </div>
            <p className="text-[11px] text-emerald-700 mt-1 font-medium">Partial installments collected</p>
          </CardContent>
        </Card>
      </div>

      {/* FILTER TABS & SEARCH CONTROLS */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs space-y-3.5 mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-b pb-3">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
            <button
              onClick={() => {
                setActiveTab("all");
                setPage(1);
              }}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all text-center ${
                activeTab === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({allDueInvoices.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("overdue");
                setPage(1);
              }}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all text-center ${
                activeTab === "overdue" ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 hover:text-rose-600"
              }`}
            >
              Overdue &gt;30d ({overdue30DaysCount})
            </button>
            <button
              onClick={() => {
                setActiveTab("high");
                setPage(1);
              }}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all text-center ${
                activeTab === "high" ? "bg-amber-600 text-white shadow-xs" : "text-slate-600 hover:text-amber-700"
              }`}
            >
              High Value (&gt;₹50k)
            </button>
            <button
              onClick={() => {
                setActiveTab("partial");
                setPage(1);
              }}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all text-center ${
                activeTab === "partial" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-emerald-700"
              }`}
            >
              Partially Paid
            </button>
          </div>

          {(dateFrom || dateTo || q || activeTab !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setDateFrom("");
                setDateTo("");
                setActiveTab("all");
                setPage(1);
              }}
              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 self-end sm:self-auto"
            >
              <X className="w-3.5 h-3.5 mr-1" /> Reset Filters
            </Button>
          )}
        </div>

        {/* RESPONSIVE SEARCH & DATE INPUT GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="relative sm:col-span-6">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9 bg-slate-50 text-xs h-9 w-full"
              placeholder="Search customer name, mobile, invoice #, or address..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="sm:col-span-3 grid grid-cols-1 gap-1">
            <Label className="text-[11px] text-slate-500 font-semibold">From Date</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 text-xs h-9 w-full"
            />
          </div>

          <div className="sm:col-span-3 grid grid-cols-1 gap-1">
            <Label className="text-[11px] text-slate-500 font-semibold">To Date</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 text-xs h-9 w-full"
            />
          </div>
        </div>
      </div>

      {/* DUES CONTAINER */}
      <Card className="border border-slate-200 shadow-xs overflow-hidden bg-white">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              <Sparkles className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
              Loading customer dues ledger...
            </div>
          ) : filteredDueInvoices.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-80" />
              <p className="font-semibold text-slate-800 text-sm">No Pending Dues Found</p>
              <p className="text-xs text-slate-500 mt-1">All invoice accounts are fully cleared or match no filters.</p>
            </div>
          ) : (
            <>
              {/* MOBILE DUES CARDS (Visible on screens < md) */}
              <div className="block md:hidden divide-y divide-slate-200">
                {paginatedDues.map((inv) => {
                  const days = getDaysOverdue(inv.createdAt);
                  const isHighOverdue = days >= 30;
                  return (
                    <div key={inv._id || inv.id} className="p-3.5 space-y-2.5 hover:bg-amber-50/30">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 text-xs">{inv.number}</span>
                          <Badge variant="outline" className="text-[9px] px-1.5 bg-slate-50">
                            {inv.type}
                          </Badge>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">{formatDate(inv.createdAt)}</span>
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{inv.customerName}</div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            {inv.customerMobile}
                            {inv.customerMobile && (
                              <a
                                href={`tel:${inv.customerMobile}`}
                                className="text-emerald-700 font-bold ml-1 text-[11px] underline"
                              >
                                Call
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] text-slate-500 uppercase font-semibold">Balance Due</div>
                          <div className="font-mono font-bold text-rose-700 text-base">{inr(inv.balanceDue || 0)}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-md font-mono text-slate-700">
                        <div>
                          Total: <strong>{inr(inv.total)}</strong>
                        </div>
                        <div>
                          Paid: <strong className="text-emerald-700">{inr(inv.amountPaid || 0)}</strong>
                        </div>
                        <div>
                          {isHighOverdue ? (
                            <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[9px] py-0">
                              🚨 {days}d Overdue
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-slate-500">{days}d pending</span>
                          )}
                        </div>
                      </div>

                      {/* MOBILE ACTIONS TOOLBAR */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <Button
                          size="sm"
                          onClick={() => openCollectPaymentModal(inv)}
                          className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        >
                          <DollarSign className="w-3.5 h-3.5 mr-0.5" /> Settle
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendWhatsAppReminder(inv)}
                          className="h-8 text-xs px-2.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          title="WhatsApp Reminder"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewDetailInv(inv)}
                          className="h-8 text-xs px-2.5 border-slate-300 text-slate-700 hover:bg-slate-100"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE VIEW (Visible on screens >= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Date &amp; Age</th>
                      <th className="py-3 px-3">Invoice #</th>
                      <th className="py-3 px-3">Customer Details</th>
                      <th className="py-3 px-3 text-right">Total Bill</th>
                      <th className="py-3 px-3 text-right text-emerald-700">Paid</th>
                      <th className="py-3 px-4 text-right text-rose-700">Balance Due</th>
                      <th className="py-3 px-4 text-center">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80">
                    {paginatedDues.map((inv) => {
                      const days = getDaysOverdue(inv.createdAt);
                      const isHighOverdue = days >= 30;
                      return (
                        <tr key={inv._id || inv.id} className="hover:bg-amber-50/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900">{formatDate(inv.createdAt)}</div>
                            <div className="mt-0.5">
                              {isHighOverdue ? (
                                <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[10px] py-0">
                                  🚨 {days} Days Overdue
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-mono">{days} days pending</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-mono font-bold text-slate-800">{inv.number}</div>
                            <Badge variant="outline" className="text-[9px] px-1.5 mt-0.5 bg-slate-50">
                              {inv.type}
                            </Badge>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900 text-xs">{inv.customerName}</div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-mono mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {inv.customerMobile}
                            </div>
                            {inv.customerAddress && (
                              <div className="text-[10px] text-slate-500 truncate max-w-[180px] mt-0.5">
                                {inv.customerAddress}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right font-mono text-slate-800 font-medium">
                            {inr(inv.total)}
                          </td>

                          <td className="py-3 px-3 text-right font-mono text-emerald-700 font-semibold">
                            {inr(inv.amountPaid || 0)}
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-rose-700 font-bold text-sm">
                            {inr(inv.balanceDue || 0)}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => openCollectPaymentModal(inv)}
                                className="h-7 text-[11px] px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                              >
                                <DollarSign className="w-3.5 h-3.5 mr-0.5" /> Settle
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sendWhatsAppReminder(inv)}
                                className="h-7 text-[11px] px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                title="Send WhatsApp Reminder"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setViewDetailInv(inv)}
                                className="h-7 text-[11px] px-2 border-slate-300 text-slate-700 hover:bg-slate-100"
                                title="View Invoice Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>

                              {inv.customerMobile && (
                                <a
                                  href={`tel:${inv.customerMobile}`}
                                  className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                                  title="Call Customer"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                              )}
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
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
                  <div className="text-xs text-slate-500">
                    Showing <span className="font-semibold text-slate-800">{(currentPage - 1) * pageSize + 1}</span> to{" "}
                    <span className="font-semibold text-slate-800">
                      {Math.min(currentPage * pageSize, filteredDueInvoices.length)}
                    </span>{" "}
                    of <span className="font-semibold text-slate-800">{filteredDueInvoices.length}</span> entries
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 text-xs"
                    >
                      Previous
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

      {/* MODAL 1: RECORD DUE PAYMENT */}
      <Dialog open={!!paymentModalInv} onOpenChange={(open) => !open && setPaymentModalInv(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" /> Collect Customer Due Payment
            </DialogTitle>
          </DialogHeader>

          {paymentModalInv && (
            <div className="space-y-4 text-xs pt-1">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between text-slate-700">
                  <span>Customer:</span>
                  <strong className="text-slate-900">{paymentModalInv.customerName}</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Invoice Number:</span>
                  <span className="font-mono font-bold text-slate-900">{paymentModalInv.number}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Total Billed Amount:</span>
                  <span className="font-mono">{inr(paymentModalInv.total)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Already Paid:</span>
                  <span className="font-mono text-emerald-700 font-semibold">{inr(paymentModalInv.amountPaid || 0)}</span>
                </div>
                <div className="flex justify-between text-rose-700 pt-1 border-t border-slate-200">
                  <span className="font-bold">Remaining Balance Due:</span>
                  <strong className="font-mono text-sm">{inr(paymentModalInv.balanceDue || 0)}</strong>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-800">Amount Being Collected (₹)</Label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Enter payment amount..."
                  className="h-9 text-sm font-mono mt-1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-800">Payment Mode</Label>
                  <Select value={payMode} onValueChange={(val: any) => setPayMode(val)}>
                    <SelectTrigger className="h-9 text-xs mt-1 bg-white">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI / GPay / PhonePe</SelectItem>
                      <SelectItem value="Card">Credit / Debit Card</SelectItem>
                      <SelectItem value="EMI">Net Banking / EMI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-800">Payment Date</Label>
                  <Input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="h-9 text-xs mt-1 bg-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-800">Payment Note / Reference (Optional)</Label>
                <Input
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="e.g. Received via PhonePe transaction ID..."
                  className="h-9 text-xs mt-1 bg-white"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setPaymentModalInv(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCollectPayment}
              disabled={updateInvoiceMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
            >
              {updateInvoiceMutation.isPending ? "Saving..." : "Confirm & Save Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: INVOICE DETAILS & PAYMENT HISTORY */}
      <Dialog open={!!viewDetailInv} onOpenChange={(open) => !open && setViewDetailInv(null)}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <span>Invoice Details: {viewDetailInv?.number}</span>
              <Badge variant="outline" className="text-xs font-mono">
                {viewDetailInv?.type}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {viewDetailInv && (
            <div className="space-y-4 text-xs pt-1 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500">Customer:</span>
                  <div className="font-bold text-slate-900 text-sm">{viewDetailInv.customerName}</div>
                  <div className="font-mono text-slate-600">{viewDetailInv.customerMobile}</div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-slate-500">Date Billed:</span>
                  <div className="font-medium text-slate-800">{formatDate(viewDetailInv.createdAt)}</div>
                  <Badge className="bg-rose-100 text-rose-800 border-rose-200 mt-1">
                    Balance: {inr(viewDetailInv.balanceDue || 0)}
                  </Badge>
                </div>
              </div>

              {/* ITEM SUMMARY */}
              <div>
                <h4 className="font-bold text-slate-800 mb-1.5 uppercase text-[10px]">Invoiced Jewellery Items</h4>
                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-slate-100 text-slate-600 border-b">
                      <tr>
                        <th className="p-2 text-left">Item</th>
                        <th className="p-2 text-right">Net Wt</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewDetailInv.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-medium">{item.name}</td>
                          <td className="p-2 text-right font-mono">{item.netWeight}g</td>
                          <td className="p-2 text-right font-mono">{item.qty}</td>
                          <td className="p-2 text-right font-mono">{inr(item.total || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PAYMENT HISTORY LOGS */}
              <div>
                <h4 className="font-bold text-slate-800 mb-1.5 uppercase text-[10px]">Payment History Log</h4>
                {!viewDetailInv.payments || viewDetailInv.payments.length === 0 ? (
                  <p className="text-slate-500 text-xs italic bg-slate-50 p-3 rounded text-center">
                    No partial payments recorded yet. Full balance is outstanding.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {viewDetailInv.payments.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center bg-emerald-50/60 border border-emerald-200/80 p-2 rounded text-xs font-mono"
                      >
                        <div>
                          <span className="font-bold text-emerald-950">{inr(p.amount)}</span>
                          <span className="text-slate-500 text-[10px] ml-2">via {p.mode}</span>
                          {p.note && <div className="text-[10px] text-slate-600 font-sans">{p.note}</div>}
                        </div>
                        <div className="text-slate-500 text-[10px]">{p.date ? formatDate(p.date) : "N/A"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setViewDetailInv(null)}>
              Close
            </Button>
            {viewDetailInv && (viewDetailInv.balanceDue || 0) > 0 && (
              <Button
                size="sm"
                onClick={() => {
                  const target = viewDetailInv;
                  setViewDetailInv(null);
                  openCollectPaymentModal(target);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
              >
                Record Payment
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}