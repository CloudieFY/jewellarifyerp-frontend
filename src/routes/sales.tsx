import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { InvoiceModal } from "@/routes/billing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr, calcItem, type Invoice, isInvoiceGst } from "@/lib/storage";
import { useAuth } from "@/lib/auth";
import { formatDate, useDebounce, triggerPrint, cn } from "@/lib/utils";
import { Receipt, Trash2, Printer, Eye, Award, DollarSign, Search, FileText, Plus, RotateCcw, X } from "lucide-react";
import { useTenantAPI } from "@/lib/api";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InvoiceTerms, ShopHeader } from "@/components/InvoiceBranding";

export default function SalesPage() {
  const { tenantSession } = useAuth();
  const authUser = tenantSession?.user;
  const api = useTenantAPI();
  const queryClient = useQueryClient();

  const { data: allInvoices = [], isLoading } = useQuery<Invoice[]>({ queryKey: ["invoices"], queryFn: api.invoices.getAll });
  const { data: salesReturns = [], isLoading: isLoadingReturns } = useQuery<any[]>({ queryKey: ["salesReturns"], queryFn: api.salesReturns.getAll });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.invoices.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      // Linked sales returns are also deleted server-side; refresh the list
      queryClient.invalidateQueries({ queryKey: ["salesReturns"] });
    }
  });

  const createReturnMutation = useMutation({
    mutationFn: (data: any) => api.salesReturns.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salesReturns"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    }
  });

  const deleteReturnMutation = useMutation({
    mutationFn: (id: string) => api.salesReturns.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salesReturns"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    }
  });


  const isOperator = authUser?.role === "operator";

  const invoices = useMemo(() => {
    return allInvoices.filter((i) => (isOperator ? !isInvoiceGst(i) : isInvoiceGst(i)));
  }, [allInvoices, isOperator]);

  const [activeMainTab, setActiveMainTab] = useState("invoices");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [filterType, setFilterType] = useState<"ALL" | "PAID" | "DUE">("ALL");
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const returnedInvoiceIds = useMemo(() => new Set(salesReturns.map((r: any) => r.invoiceId)), [salesReturns]);
  const [selectedReturn, setSelectedReturn] = useState<any | null>(null);

  /* ------------------------------------------------------------------ */
  /* Sales Return Dialog State & Logic                                  */
  /* ------------------------------------------------------------------ */
  const [openReturnDialog, setOpenReturnDialog] = useState(false);
  const [selectedInvoiceForReturn, setSelectedInvoiceForReturn] = useState<Invoice | null>(null);
  const [returnItemsState, setReturnItemsState] = useState<Array<{
    productId: string;
    name: string;
    purity?: string;
    origNetWeight: number;
    origGrossWeight: number;
    origStoneWeight: number;
    origQty: number;
    origLineTotal: number;
    netWeight: number;
    grossWeight: number;
    stoneWeight: number;
    ratePerGram: number;
    makingCharge: number;
    gstPct: number;
    qty: number;
    huid?: string;
    returnAmount: number;
    selected: boolean;
  }>>([]);
  const [refundMode, setRefundMode] = useState<"Cash" | "UPI" | "Card" | "Adjust Dues" | "Store Credit">("Cash");
  const [returnReason, setReturnReason] = useState("");
  const [returnNotes, setReturnNotes] = useState("");

  const handleOpenReturnDialog = () => {
    setSelectedInvoiceForReturn(null);
    setReturnItemsState([]);
    setRefundMode("Cash");
    setReturnReason("Defective / Mind Change");
    setReturnNotes("");
    setOpenReturnDialog(true);
  };

  const handleSelectInvoiceForReturn = (invoiceId: string) => {
    const inv = allInvoices.find(i => (i._id || i.id) === invoiceId);
    if (!inv) return;
    setSelectedInvoiceForReturn(inv);

    const isGstInvoice = inv.type === "GST";

    // 1. Calculate raw line totals per item via calcItem
    const rawLineTotals = (inv.items || []).map((it: any) => calcItem(it, isGstInvoice).line);
    const rawSubtotal = rawLineTotals.reduce((s: number, v: number) => s + v, 0);

    // 2. Use inv.total (which includes round-off + discount) as the truth.
    //    Distribute it proportionally across items.
    const invTotal = inv.total || 0;

    setReturnItemsState((inv.items || []).map((it: any, itemIdx: number) => {
      const origQty = it.qty || 1;
      const origNetWeight = it.netWeight || 0;
      const origStoneWeight = (it as any).stoneWeight || 0;
      const origGrossWeight = (it as any).grossWeight || (origNetWeight + origStoneWeight);

      // Proportional share of actual invoice total (covers discount + round-off)
      const share = rawSubtotal > 0 ? rawLineTotals[itemIdx] / rawSubtotal : (1 / (inv.items || []).length);
      const origLineTotal = Math.round(invTotal * share * 100) / 100;

      return {
        productId: it.productId,
        name: it.name,
        purity: it.purity || '22K',
        origNetWeight,
        origGrossWeight,
        origStoneWeight,
        origQty,
        origLineTotal,
        netWeight: origNetWeight,
        grossWeight: origGrossWeight,
        stoneWeight: origStoneWeight,
        ratePerGram: it.ratePerGram || 0,
        makingCharge: it.makingCharge || 0,
        gstPct: it.gstPct !== undefined ? it.gstPct : (isGstInvoice ? 3 : 0),
        qty: origQty,
        huid: it.huid || '',
        returnAmount: origLineTotal,
        selected: true,
      };
    }));
  };

  const calculateReturnTotals = useMemo(() => {
    const selectedItems = returnItemsState.filter(i => i.selected);
    const subtotal = selectedItems.reduce((sum, item) => sum + Number(item.returnAmount || 0), 0);
    const isGstInvoice = selectedInvoiceForReturn?.type === "GST";
    const gstAmount = isGstInvoice
      ? selectedItems.reduce((sum, item) => sum + (Number(item.returnAmount || 0) * (item.gstPct || 3) / 100), 0)
      : 0;

    // Cap total refund to invoice total, and floor to avoid floating-point over-payment
    let totalRefund = Math.floor((subtotal + gstAmount) * 100) / 100;
    if (selectedInvoiceForReturn && typeof selectedInvoiceForReturn.total === 'number' && selectedInvoiceForReturn.total > 0) {
      totalRefund = Math.min(selectedInvoiceForReturn.total, totalRefund);
    }
    return { subtotal, gstAmount, totalRefund, count: selectedItems.length };
  }, [returnItemsState, selectedInvoiceForReturn]);

  const handleSaveSalesReturn = async () => {
    if (!selectedInvoiceForReturn) {
      toast.error("Please select an invoice to return against.");
      return;
    }
    const selectedItems = returnItemsState.filter(i => i.selected);
    if (selectedItems.length === 0) {
      toast.error("Select at least one item to return.");
      return;
    }

    const payload = {
      invoiceId: selectedInvoiceForReturn._id || selectedInvoiceForReturn.id,
      invoiceNumber: selectedInvoiceForReturn.number,
      customerId: selectedInvoiceForReturn.customerId,
      customerName: selectedInvoiceForReturn.customerName,
      customerMobile: selectedInvoiceForReturn.customerMobile,
      items: selectedItems.map(it => ({
        productId: it.productId,
        name: it.name,
        purity: it.purity,
        netWeight: Number(it.netWeight),
        grossWeight: Number(it.grossWeight || it.netWeight),
        stoneWeight: Number(it.stoneWeight || 0),
        ratePerGram: Number(it.ratePerGram),
        makingCharge: Number(it.makingCharge),
        gstPct: Number(it.gstPct),
        qty: Number(it.qty),
        huid: it.huid,
        returnAmount: Number(it.returnAmount),
      })),
      subtotal: calculateReturnTotals.subtotal,
      gstAmount: calculateReturnTotals.gstAmount,
      totalRefund: calculateReturnTotals.totalRefund,
      refundMode,
      reason: returnReason,
      notes: returnNotes,
    };

    try {
      await createReturnMutation.mutateAsync(payload);
      setOpenReturnDialog(false);
      toast.success("Sales Return processed successfully! Inventory stock has been restored.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to process sales return.");
    }
  };



  // Filtered Invoices
  const filtered = useMemo(() => {
    return invoices.filter(i => {
      const searchLower = debouncedQ.toLowerCase().trim();
      const matchText = !searchLower ||
        i.number.toLowerCase().includes(searchLower) ||
        i.customerName.toLowerCase().includes(searchLower) ||
        i.customerMobile.includes(searchLower) ||
        (i.customerAddress || "").toLowerCase().includes(searchLower) ||
        i.items.some((it: any) =>
          (it.name || "").toLowerCase().includes(searchLower) ||
          (it.huid || "").toLowerCase().includes(searchLower) ||
          (it.purity || "").toLowerCase().includes(searchLower)
        );

      const matchStatus =
        filterType === "ALL" ||
        (filterType === "PAID" && (i.balanceDue || 0) <= 0) ||
        (filterType === "DUE" && (i.balanceDue || 0) > 0);

      return matchText && matchStatus;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [invoices, debouncedQ, filterType]);

  // Aggregated Sales Statistics
  const totalReturnsValuation = useMemo(() => salesReturns.reduce((s, r: any) => s + (r.totalRefund || 0), 0), [salesReturns]);
  const totalSalesValuation = useMemo(() => Math.max(0, filtered.reduce((s, i) => s + (i.total || 0), 0) - totalReturnsValuation), [filtered, totalReturnsValuation]);


  const totalNetGoldWeightSold = useMemo(() => {
    return filtered.reduce((totalWt, inv) => {
      const invWt = (inv.items || []).reduce((itemWt, it) => itemWt + ((it.netWeight || 0) * (it.qty || 1)), 0);
      return totalWt + invWt;
    }, 0);
  }, [filtered]);

  const totalGstTaxCollected = useMemo(() => filtered.reduce((s, i) => s + (i.gstAmount || 0), 0), [filtered]);

  const removeInvoice = async (invoice: Invoice) => {
    if (window.confirm(`Are you sure you want to delete Invoice ${invoice.number}? This will also add the sold items back to your inventory.`)) {
      try {
        // Stock restoration is handled atomically by the backend DELETE /invoices/:id transaction.
        // deleteMutation already invalidates ["invoices", "inventory"] so the UI will refresh.
        await deleteMutation.mutateAsync(invoice._id || invoice.id || "");
        toast.success("Invoice deleted and stock restored to inventory.");
      } catch (e) {
        toast.error("Failed to delete invoice.");
      }
    }
  };

  const totalPages = Math.ceil(filtered.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginatedInvoices = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <Layout>
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Jewellery Sales Register</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isOperator ? "Estimate Order & Billing History" : "Tax Invoices, Metal Weights Sold & Revenue Ledger"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="lg" onClick={handleOpenReturnDialog} className="border-rose-300 text-rose-700 hover:bg-rose-50">
            <RotateCcw className="w-4 h-4 mr-2" /> Issue Sales Return
          </Button>
          <Link to="/billing">
            <Button data-new-button="true" size="lg" className="bg-primary text-white hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Issue New Invoice
            </Button>
          </Link>
        </div>
      </header>

      {/* METRICS DASHBOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border shadow-sm">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase">Total Sales Revenue</div>
              <div className="text-2xl font-bold font-display text-emerald-600 mt-1">{inr(totalSalesValuation)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{filtered.length} Invoices Issued</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase">Total Gold Sold</div>
              <div className="text-2xl font-bold font-display text-amber-600 mt-1">{totalNetGoldWeightSold.toFixed(2)} g</div>
              <div className="text-xs text-muted-foreground mt-0.5">Pure Metal Equivalent</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 grid place-items-center">
              <Award className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase">Sales Returns</div>
              <div className="text-2xl font-bold font-display text-rose-600 mt-1">
                {inr(salesReturns.reduce((sum, r) => sum + (r.totalRefund || 0), 0))}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{salesReturns.length} Return Vouchers</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 grid place-items-center">
              <RotateCcw className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase">{isOperator ? "Average Order Value" : "GST Tax Collected"}</div>
              <div className="text-2xl font-bold font-display text-purple-600 mt-1">
                {isOperator ? inr(filtered.length ? totalSalesValuation / filtered.length : 0) : inr(totalGstTaxCollected)}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{isOperator ? "Per Customer Bill" : "3% GST Collection"}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 grid place-items-center">
              <FileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 w-full max-w-md h-auto bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="invoices" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5">
            <Receipt className="w-4 h-4" /> Sales Invoices ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="returns" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5">
            <RotateCcw className="w-4 h-4" /> Sales Returns ({salesReturns.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-6">
          {/* SEARCH & FILTERS BAR */}
          <Card className="shadow-xs border border-border/60 bg-card">
            <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
              {/* Search Bar */}
              <div className="relative w-full sm:max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search Invoice #, Customer, Mobile, HUID, Item..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-10 pr-10 h-10 text-xs sm:text-sm rounded-xl border-border bg-background focus-visible:ring-2 focus-visible:ring-primary/20 transition-all shadow-xs"
                />
                {q ? (
                  <button
                    onClick={() => setQ("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="hidden sm:inline-flex items-center absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] font-mono text-muted-foreground/60 bg-muted border border-border/50">
                    /
                  </span>
                )}
              </div>

              {/* Segmented Filter Pills */}
              <div className="flex flex-wrap items-center gap-2">

                {/* Status Filter Segmented Control */}
                <div className="inline-flex items-center p-1 bg-muted/60 dark:bg-muted/30 rounded-xl gap-1 border border-border/40">
                  <button
                    type="button"
                    onClick={() => setFilterType("ALL")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                      filterType === "ALL"
                        ? "bg-background text-foreground shadow-xs border border-border/40 font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                    )}
                  >
                    All
                    <span className={cn(
                      "px-1.5 py-0.2 text-[10px] font-mono rounded-full",
                      filterType === "ALL" ? "bg-muted text-foreground" : "bg-muted/70 text-muted-foreground"
                    )}>
                      {invoices.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterType("PAID")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                      filterType === "PAID"
                        ? "bg-emerald-600 text-white shadow-xs font-bold dark:bg-emerald-700"
                        : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    )}
                  >
                    Fully Paid
                    <span className={cn(
                      "px-1.5 py-0.2 text-[10px] font-mono rounded-full",
                      filterType === "PAID"
                        ? "bg-white/20 text-white"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    )}>
                      {invoices.filter(i => (i.balanceDue || 0) <= 0).length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterType("DUE")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                      filterType === "DUE"
                        ? "bg-rose-600 text-white shadow-xs font-bold dark:bg-rose-700"
                        : "text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    )}
                  >
                    Balance Due
                    <span className={cn(
                      "px-1.5 py-0.2 text-[10px] font-mono rounded-full",
                      filterType === "DUE"
                        ? "bg-white/20 text-white"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                    )}>
                      {invoices.filter(i => (i.balanceDue || 0) > 0).length}
                    </span>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DETAILED SALES TABLE */}
          <Card className="shadow-sm border overflow-hidden flex flex-col">
            <CardHeader className="bg-muted/20 border-b pb-3 pt-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold font-display flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                Sales Register & Invoice Ledger
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                Showing {filtered.length} Invoices
              </Badge>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-12 text-center text-muted-foreground text-sm">Loading sales register...</div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Receipt className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">No sales invoices match your search.</p>
                </div>
              ) : (
                <div>
                  <div className="hidden md:block overflow-x-auto w-full">
                    <table className="w-full text-sm text-left border-collapse min-w-[950px]">
                      <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b">
                        <tr>
                          <th className="py-3 px-4">Invoice # / Date</th>
                          <th className="py-3 px-4">Customer Details</th>
                          <th className="py-3 px-4">Jewellery Items Sold</th>
                          <th className="py-3 px-4 text-center">Net Metal Wt</th>
                          <th className="py-3 px-4">Type</th>
                          <th className="py-3 px-4">Payment</th>
                          <th className="py-3 px-4 text-right">Invoice Total</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4 text-right pr-6">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedInvoices.map((i) => {
                          const invoiceNetWt = (i.items || []).reduce((sum, it) => sum + (it.netWeight || 0), 0);
                          return (
                            <tr key={i._id || i.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="py-3 px-4 font-medium text-foreground whitespace-nowrap">
                                <div className="font-mono font-bold text-primary">{i.number}</div>
                                <div className="text-xs text-muted-foreground">{formatDate(i.createdAt)}</div>
                              </td>

                              <td className="py-3 px-4">
                                <div className="font-semibold text-foreground">{i.customerName}</div>
                                <div className="text-xs text-muted-foreground font-mono">{i.customerMobile}</div>
                              </td>

                              <td className="py-3 px-4 max-w-xs">
                                <div className="space-y-1">
                                  {(i.items || []).map((it: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-1.5 text-xs">
                                      <span className="font-medium text-foreground truncate">{it.name}</span>
                                      <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono text-amber-700 bg-amber-50 shrink-0">
                                        {it.netWeight || 0}g
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </td>

                              <td className="py-3 px-4 text-center font-bold text-amber-700 whitespace-nowrap">
                                {invoiceNetWt.toFixed(2)} g
                              </td>

                              <td className="py-3 px-4 whitespace-nowrap">
                                <Badge className={i.type === "GST" ? "bg-indigo-100 text-indigo-800 border-indigo-200" : "bg-emerald-100 text-emerald-800 border-emerald-200"}>
                                  {i.type === "GST" ? "GST Invoice" : "Estimate"}
                                </Badge>
                              </td>

                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="font-medium text-foreground">{i.paymentMode}</div>
                                {i.oldGoldAmount ? <div className="text-[11px] text-amber-700">Old Gold: {inr(i.oldGoldAmount)}</div> : null}
                              </td>

                              <td className="py-3 px-4 text-right font-bold text-emerald-600 whitespace-nowrap">
                                {inr(i.total)}
                              </td>

                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <div className="flex flex-col items-center gap-1">
                                  {(i.balanceDue || 0) <= 0 ? (
                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Paid</Badge>
                                  ) : (
                                    <Badge variant="destructive">Due: {inr(i.balanceDue || 0)}</Badge>
                                  )}
                                  {returnedInvoiceIds.has(i._id || i.id) && (
                                    <Badge className="bg-orange-100 text-orange-800 border border-orange-300 text-[10px]">↩ Returned</Badge>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-4 text-right whitespace-nowrap pr-4">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                                    title="View & Print Invoice"
                                    onClick={() => setSelectedInvoice(i)}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  {!returnedInvoiceIds.has(i._id || i.id) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                      title="Issue Sales Return for this Invoice"
                                      onClick={() => {
                                        handleOpenReturnDialog();
                                        handleSelectInvoiceForReturn(i._id || i.id);
                                      }}
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {!returnedInvoiceIds.has(i._id || i.id) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0 text-slate-500 hover:text-rose-600"
                                      title="Delete Invoice & Restore Stock"
                                      onClick={() => removeInvoice(i)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards View */}
                  <div className="md:hidden space-y-3 p-3">
                    {paginatedInvoices.map((i) => {
                      const invoiceNetWt = (i.items || []).reduce((sum, it) => sum + (it.netWeight || 0), 0);
                      const isDue = (i.balanceDue || 0) > 0;
                      const isReturned = returnedInvoiceIds.has(i._id || i.id);

                      return (
                        <div
                          key={i._id || i.id}
                          className={cn(
                            "p-4 rounded-2xl border bg-card shadow-xs transition-all space-y-3 relative overflow-hidden",
                            isReturned
                              ? "border-amber-300/70 bg-amber-50/20 dark:bg-amber-950/10"
                              : isDue
                              ? "border-rose-200/80 dark:border-rose-900/40 bg-rose-50/10 dark:bg-rose-950/5"
                              : "border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/10 dark:bg-emerald-950/5"
                          )}
                        >
                          {/* Left Accent Bar */}
                          <div
                            className={cn(
                              "absolute left-0 top-0 bottom-0 w-1.5",
                              isReturned ? "bg-amber-500" : isDue ? "bg-rose-500" : "bg-emerald-500"
                            )}
                          />

                          {/* Top Row: Inv #, Type & Amount/Status */}
                          <div className="flex items-start justify-between gap-2 pl-1">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                  {i.number}
                                </span>
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal text-muted-foreground border-border">
                                  {i.type === "GST" ? "GST" : "Estimate"}
                                </Badge>
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-1">
                                {formatDate(i.createdAt)}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="font-extrabold text-base font-display text-foreground">
                                {inr(i.total)}
                              </div>
                              <div className="mt-1">
                                {isReturned ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                                    ↩ Returned
                                  </span>
                                ) : isDue ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200">
                                    Due {inr(i.balanceDue || 0)}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                                    ✓ Paid
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Customer & Net Wt */}
                          <div className="pl-1 pt-1 border-t border-border/40 flex items-center justify-between gap-2">
                            <div>
                              <div className="font-bold text-sm text-foreground">{i.customerName}</div>
                              <div className="text-xs text-muted-foreground font-mono">{i.customerMobile}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Gold Weight</div>
                              <div className="text-xs font-bold text-amber-700 dark:text-amber-400 font-mono">{invoiceNetWt.toFixed(2)} g</div>
                            </div>
                          </div>

                          {/* Items Preview */}
                          <div className="p-2.5 rounded-xl bg-muted/40 dark:bg-muted/20 space-y-1">
                            {(i.items || []).map((it: any, idx: number) => (
                              <div key={idx} className="text-xs flex items-center justify-between gap-2">
                                <span className="font-medium text-foreground truncate">{it.name} ({it.purity || '22K'})</span>
                                <span className="font-mono text-amber-700 dark:text-amber-400 shrink-0">{it.netWeight || 0}g</span>
                              </div>
                            ))}
                          </div>

                          {/* Footer Actions */}
                          <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                            <span className="text-[11px] text-muted-foreground">
                              Mode: <strong className="text-foreground font-semibold">{i.paymentMode}</strong>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs px-2.5 gap-1 border-border hover:bg-accent"
                                onClick={() => setSelectedInvoice(i)}
                              >
                                <Eye className="w-3.5 h-3.5 text-primary" /> View
                              </Button>
                              {!isReturned && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs px-2.5 gap-1 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/50"
                                  onClick={() => {
                                    handleOpenReturnDialog();
                                    handleSelectInvoiceForReturn(i._id || i.id);
                                  }}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" /> Return
                                </Button>
                              )}
                              {!isReturned && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                  title="Delete Invoice"
                                  onClick={() => removeInvoice(i)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                      <div className="text-xs text-muted-foreground">
                        Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, filtered.length)} of {filtered.length} entries
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                        <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB: SALES RETURNS                                                   */}
        {/* ==================================================================== */}
        <TabsContent value="returns" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-display font-semibold">Sales Return Credit Vouchers</h2>
              <p className="text-xs text-muted-foreground">Process customer returned jewellery, issue credit notes &amp; automatically restore inventory stock.</p>
            </div>
            <Button size="lg" onClick={handleOpenReturnDialog} className="bg-rose-600 text-white hover:bg-rose-700">
              <Plus className="w-4 h-4 mr-2" /> Issue Sales Return
            </Button>
          </div>

          <Card className="shadow-sm border">
            <CardContent className="p-0">
              {isLoadingReturns ? (
                <div className="py-12 text-center text-muted-foreground text-sm">Loading sales returns...</div>
              ) : salesReturns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <RotateCcw className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">No sales returns recorded yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-sm text-left border-collapse min-w-[850px]">
                    <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b">
                      <tr>
                        <th className="py-3 px-4">Return # / Date</th>
                        <th className="py-3 px-4">Original Invoice</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Returned Items</th>
                        <th className="py-3 px-4">Refund Mode</th>
                        <th className="py-3 px-4 text-right">Total Refund</th>
                        <th className="py-3 px-4 text-right pr-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesReturns.map((r: any) => (
                        <tr key={r._id || r.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-medium text-foreground whitespace-nowrap">
                            <div className="font-mono font-bold text-rose-600">{r.returnNo}</div>
                            <div className="text-xs text-muted-foreground">{formatDate(r.createdAt || r.date)}</div>
                          </td>

                          <td className="py-3 px-4 font-mono text-primary font-semibold">
                            {r.invoiceNumber || "Direct Return"}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground">{r.customerName}</div>
                            <div className="text-xs text-muted-foreground">{r.customerMobile}</div>
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <div className="space-y-1">
                              {(r.items || []).map((it: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-1.5 text-xs">
                                  <span className="font-medium text-foreground">{it.name}</span>
                                  <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono text-amber-700 bg-amber-50">
                                    {it.netWeight}g
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <Badge className="bg-rose-100 text-rose-800 border-rose-200">
                              {r.refundMode}
                            </Badge>
                          </td>

                          <td className="py-3 px-4 text-right font-bold text-rose-600 whitespace-nowrap">
                            -{inr(r.totalRefund)}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap pr-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                                title="View Credit Note"
                                onClick={() => setSelectedReturn(r)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700"
                                title="Delete Sales Return"
                                disabled={deleteReturnMutation.isPending}
                                onClick={async () => {
                                  if (window.confirm(`Delete Sales Return ${r.returnNo}? This will remove the record only — inventory already restored when it was created.`)) {
                                    try {
                                      await deleteReturnMutation.mutateAsync(r._id || r.id);
                                      toast.success(`${r.returnNo} deleted successfully.`);
                                    } catch {
                                      toast.error("Failed to delete sales return.");
                                    }
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CREATE SALES RETURN DIALOG */}
      <Dialog open={openReturnDialog} onOpenChange={setOpenReturnDialog}>
        <DialogContent className="fixed inset-0 z-[100] w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 top-0 left-0 rounded-none border-0 p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 flex flex-col overflow-y-auto shadow-none">
          <DialogHeader>
            <DialogTitle className="text-lg font-display flex items-center gap-2 text-rose-700">
              <RotateCcw className="w-5 h-5" /> Issue Sales Return (Credit Note)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* 1. Select Invoice */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Original Invoice *</Label>
              <Select value={selectedInvoiceForReturn?._id || selectedInvoiceForReturn?.id || ""} onValueChange={handleSelectInvoiceForReturn}>
                <SelectTrigger><SelectValue placeholder="Choose an invoice..." /></SelectTrigger>
                <SelectContent className="max-h-56">
                  {allInvoices.map((i) => (
                    <SelectItem key={i._id || i.id} value={(i._id || i.id) as string}>
                      {i.number} · {i.customerName} ({i.customerMobile}) · Total: {inr(i.total)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Items List */}
            {selectedInvoiceForReturn && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Items to Return</p>
                <div className="border rounded-lg overflow-hidden divide-y">
                  {returnItemsState.map((item, idx) => (
                    <div key={idx} className="p-3 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setReturnItemsState(arr => arr.map((it, i) => i === idx ? { ...it, selected: val } : it));
                          }}
                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 h-4 w-4"
                        />
                        <div>
                          <div className="font-bold text-foreground">{item.name} ({item.purity})</div>
                          <div className="text-muted-foreground font-mono space-x-2">
                            <span>Gross: {item.origGrossWeight}g</span>
                            {item.origStoneWeight > 0 && <span className="text-rose-500">Less: {item.origStoneWeight}g</span>}
                            <span>Net: {item.origNetWeight}g</span>
                            <span>· {inr(item.origLineTotal)}</span>
                          </div>
                        </div>
                      </div>

                      {item.selected && (
                        <div className="flex items-center gap-3 ml-6 sm:ml-0 flex-wrap">
                          {item.origQty > 1 && (
                            <div>
                              <span className="text-[10px] text-muted-foreground block font-medium">Returned Qty</span>
                              <Input
                                type="number"
                                min={1}
                                max={item.origQty}
                                value={item.qty}
                                onChange={(e) => {
                                  const q = Math.max(1, Number(e.target.value) || 1);
                                  setReturnItemsState(arr => arr.map((it, i) => {
                                    if (i !== idx) return it;
                                    const ratio = it.origQty > 0 ? Math.min(1, q / it.origQty) : 1;
                                    const calcAmt = Math.round(it.origLineTotal * ratio * 100) / 100;
                                    const calcNetWt = Math.round(it.origNetWeight * ratio * 1000) / 1000;
                                    const calcGrossWt = Math.round(it.origGrossWeight * ratio * 1000) / 1000;
                                    const calcStoneWt = Math.round(it.origStoneWeight * ratio * 1000) / 1000;
                                    return { ...it, qty: q, netWeight: calcNetWt, grossWeight: calcGrossWt, stoneWeight: calcStoneWt, returnAmount: calcAmt };
                                  }));
                                }}
                                className="w-16 h-7 text-xs font-mono"
                              />
                            </div>
                          )}
                          <div>
                            <span className="text-[10px] text-muted-foreground block font-medium">Returned Wt (g)</span>
                            <Input
                              type="number"
                              step="any"
                              value={item.netWeight}
                              onChange={(e) => {
                                const wt = Math.max(0, Number(e.target.value) || 0);
                                setReturnItemsState(arr => arr.map((it, i) => {
                                  if (i !== idx) return it;
                                  let ratio = 1;
                                  if (it.origNetWeight > 0) {
                                    ratio = Math.min(1, Math.max(0, wt / it.origNetWeight));
                                  } else if (it.origQty > 0) {
                                    ratio = Math.min(1, Math.max(0, it.qty / it.origQty));
                                  }
                                  const calcAmt = Math.round(it.origLineTotal * ratio * 100) / 100;
                                  const gwRatio = it.origNetWeight > 0 ? (wt / it.origNetWeight) : 1;
                                  const calcGrossWt = Math.round(it.origGrossWeight * gwRatio * 1000) / 1000;
                                  const calcStoneWt = Math.round(it.origStoneWeight * gwRatio * 1000) / 1000;
                                  return { ...it, netWeight: wt, grossWeight: calcGrossWt, stoneWeight: calcStoneWt, returnAmount: calcAmt };
                                }));
                              }}
                              className="w-24 h-7 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block font-medium">Return Amount (₹)</span>
                            <Input
                              type="number"
                              step="any"
                              value={item.returnAmount}
                              onChange={(e) => {
                                const amt = Number(e.target.value) || 0;
                                setReturnItemsState(arr => arr.map((it, i) => i === idx ? { ...it, returnAmount: amt } : it));
                              }}
                              className="w-28 h-7 text-xs font-mono font-bold text-rose-600"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* 3. Refund Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <Label className="text-xs font-semibold">Refund Mode *</Label>
                    <select
                      value={refundMode}
                      onChange={(e) => setRefundMode(e.target.value as any)}
                      className="w-full h-9 border rounded-md px-3 bg-background text-xs font-medium"
                    >
                      <option value="Cash">Cash Refund</option>
                      <option value="UPI">UPI / Online Transfer</option>
                      <option value="Card">Card Refund</option>
                      <option value="Adjust Dues">Adjust Against Invoice Dues</option>
                      <option value="Store Credit">Store Credit / Advance</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Return Reason</Label>
                    <Input
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="e.g. Size Issue, Quality Concern, Exchange..."
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Additional Notes</Label>
                  <Textarea
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="Internal remarks..."
                    className="text-xs min-h-[60px]"
                  />
                </div>

                {/* 4. Live Calculation Box */}
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex justify-between items-center text-rose-950">
                  <div>
                    <div className="text-xs font-bold uppercase">Total Refund Amount</div>
                    <div className="text-[11px] text-rose-700">{calculateReturnTotals.count} items selected for return</div>
                  </div>
                  <div className="text-xl font-bold font-display text-rose-700">
                    {inr(calculateReturnTotals.totalRefund)}
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handleSaveSalesReturn}
              disabled={createReturnMutation.isPending || !selectedInvoiceForReturn || calculateReturnTotals.count === 0}
              className="w-full bg-rose-600 text-white hover:bg-rose-700"
            >
              {createReturnMutation.isPending ? "Processing Return..." : "Confirm & Process Sales Return"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* VIEW & PRINT INVOICE MODAL */}
      {selectedInvoice && (
        <InvoiceModal
          inv={selectedInvoice}
          isReturned={returnedInvoiceIds.has((selectedInvoice as any)._id || (selectedInvoice as any).id)}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      {/* VIEW & PRINT SALES RETURN CREDIT NOTE MODAL */}
      {selectedReturn && (
        <CreditNoteViewModal salesReturn={selectedReturn} onClose={() => setSelectedReturn(null)} />
      )}
    </Layout>
  );
}

function CreditNoteViewModal({ salesReturn, onClose }: { salesReturn: any; onClose: () => void }) {
  return (
    <div className="print-section fixed inset-0 z-100 bg-black/50 flex justify-center items-start p-2 sm:p-4 print:static print:block print:bg-white print:p-0 print:overflow-visible print:h-auto overflow-y-auto pointer-events-auto">
      <div className="bg-white w-full max-w-3xl rounded-lg shadow-xl print:shadow-none print:max-w-none text-slate-900 my-auto relative flex flex-col max-h-[95vh] print:my-0 print:max-h-none print:block">
        <style>{`@media print { @page { margin: 4mm; } body { zoom: 0.9; } }`}</style>
        <div className="p-6 sm:p-10 print:p-2 border-2 border-transparent print:border-none m-2 print:m-0 bg-white overflow-y-auto flex-1 print:overflow-visible relative">

          {/* SALES RETURN Watermark Overlay */}
          <div
            className="pointer-events-none select-none absolute inset-0 flex items-center justify-center z-10 print:flex overflow-hidden"
            style={{ transform: 'rotate(-30deg)' }}
          >
            <span
              style={{
                fontSize: '5rem',
                fontWeight: 900,
                color: 'rgba(225, 29, 72, 0.12)',
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
                border: '6px solid rgba(225, 29, 72, 0.12)',
                padding: '0.25em 0.6em',
                borderRadius: '0.2em',
                lineHeight: 1,
                userSelect: 'none',
              }}
            >
              SALES RETURN
            </span>
          </div>

          <ShopHeader documentLabel="SALES RETURN CREDIT NOTE" compact />

          {/* Customer & Meta Details */}
          <div className="flex justify-between items-start mb-6 text-sm">
            <div>
              <div className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-1">Customer Details:</div>
              <div className="font-bold text-lg">{salesReturn.customerName}</div>
              <div className="text-slate-700">{salesReturn.customerMobile}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-display font-bold mb-2 text-rose-700">
                CREDIT NOTE
              </div>
              <table className="ml-auto text-left text-slate-700 text-xs">
                <tbody>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Return No:</td><td className="font-semibold text-slate-900">{salesReturn.returnNo}</td></tr>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Against Invoice:</td><td className="font-semibold text-slate-900">{salesReturn.invoiceNumber || "N/A"}</td></tr>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Date:</td><td className="font-semibold text-slate-900">{formatDate(salesReturn.createdAt || salesReturn.date)}</td></tr>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Refund Mode:</td><td className="font-semibold text-slate-900">{salesReturn.refundMode}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Returned Items Table */}
          <div className="overflow-x-auto w-full mb-6">
            <table className="w-full text-xs border-collapse border border-slate-300">
              <thead className="bg-rose-50 text-rose-900 uppercase">
                <tr>
                  <th className="border border-slate-300 py-2 px-3 text-center w-10">#</th>
                  <th className="border border-slate-300 py-2 px-3 text-left">Returned Item</th>
                  <th className="border border-slate-300 py-2 px-3 text-center">Purity</th>
                  <th className="border border-slate-300 py-2 px-3 text-center">Returned Wt</th>
                  <th className="border border-slate-300 py-2 px-3 text-right">Rate/g</th>
                  <th className="border border-slate-300 py-2 px-3 text-right">Total Refund</th>
                </tr>
              </thead>
              <tbody>
                {(salesReturn.items || []).map((it: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-300">
                    <td className="border border-slate-300 py-2 px-3 text-center text-slate-600">{idx + 1}</td>
                    <td className="border border-slate-300 py-2 px-3 font-semibold">
                      {it.name} {it.huid ? <span className="ml-1 text-[10px] font-mono text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">HUID: {it.huid}</span> : ''}
                    </td>
                    <td className="border border-slate-300 py-2 px-3 text-center">{it.purity || '22K'}</td>
                    <td className="border border-slate-300 py-2 px-3 text-center font-bold text-amber-800">{it.netWeight} g</td>
                    <td className="border border-slate-300 py-2 px-3 text-right">{inr(it.ratePerGram)}</td>
                    <td className="border border-slate-300 py-2 px-3 text-right font-bold text-rose-700">{inr(it.returnAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Reason & Totals */}
          <div className="flex flex-col sm:flex-row justify-between items-start text-xs gap-6 mb-6">
            <div className="w-full sm:w-1/2">
              {salesReturn.reason && (
                <div className="p-3 border rounded bg-slate-50">
                  <div className="font-bold text-slate-700 uppercase mb-1">Return Reason</div>
                  <div className="text-slate-800 font-medium">{salesReturn.reason}</div>
                  {salesReturn.notes && <div className="text-slate-600 text-[11px] mt-1">{salesReturn.notes}</div>}
                </div>
              )}
            </div>

            <div className="w-full sm:w-1/2 max-w-sm ml-auto space-y-1.5 border-t-2 border-slate-300 pt-2">
              <div className="flex justify-between text-slate-700">
                <span>Subtotal Refund:</span>
                <span className="font-semibold">{inr(salesReturn.subtotal || salesReturn.totalRefund)}</span>
              </div>
              {salesReturn.gstAmount ? (
                <div className="flex justify-between text-slate-700">
                  <span>GST Credit:</span>
                  <span className="font-semibold">{inr(salesReturn.gstAmount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-slate-300 pt-1.5 font-bold text-sm text-slate-900">
                <span>Total Credit Refund:</span>
                <span className="text-rose-700">{inr(salesReturn.totalRefund)}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-600">
            <InvoiceTerms compact />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="shrink-0 bg-slate-100 p-4 border-t border-slate-200 rounded-b-lg flex justify-end gap-3 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={triggerPrint} className="bg-rose-600 text-white hover:bg-rose-700">
            <Printer className="w-4 h-4 mr-2" /> Print Credit Note
          </Button>
        </div>
      </div>
    </div>
  );
}


