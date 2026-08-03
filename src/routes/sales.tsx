import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { inr, type Invoice } from "@/lib/storage";
import { useAuth } from "@/lib/auth";
import { formatDate, useDebounce, triggerPrint } from "@/lib/utils";
import { Receipt, Trash2, TrendingUp, Printer, Eye, Award, Scale, DollarSign, Search, FileText, Plus } from "lucide-react";
import { useTenantAPI } from "@/lib/api";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InvoiceTerms, ShopHeader } from "@/components/InvoiceBranding";

export default function SalesPage() {
  const { tenantSession } = useAuth();
  const authUser = tenantSession?.user;
  const api = useTenantAPI();
  const queryClient = useQueryClient();

  const { data: allInvoices = [], isLoading } = useQuery<Invoice[]>({ queryKey: ["invoices"], queryFn: api.invoices.getAll });


  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.invoices.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    }
  });

  const isOperator = authUser?.role === "operator";
  const invoices = useMemo(() => allInvoices.filter(i => isOperator ? i.type !== "GST" : i.type === "GST"), [allInvoices, isOperator]);

  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [filterType, setFilterType] = useState<"ALL" | "PAID" | "DUE">("ALL");
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

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
  const totalSalesValuation = useMemo(() => filtered.reduce((s, i) => s + (i.total || 0), 0), [filtered]);

  const totalNetGoldWeightSold = useMemo(() => {
    return filtered.reduce((totalWt, inv) => {
      const invWt = (inv.items || []).reduce((itemWt, it) => itemWt + ((it.netWeight || 0) * (it.qty || 1)), 0);
      return totalWt + invWt;
    }, 0);
  }, [filtered]);

  const totalOldGoldExchanged = useMemo(() => filtered.reduce((s, i) => s + (i.oldGoldAmount || 0), 0), [filtered]);
  const totalGstTaxCollected = useMemo(() => filtered.reduce((s, i) => s + (i.gstAmount || 0), 0), [filtered]);

  // 30 Days Sales Trend Data
  const last30Days = useMemo(() => {
    const arr = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toDateString();
      const dayTotal = filtered.filter(inv => new Date(inv.createdAt).toDateString() === dStr).reduce((s, x) => s + x.total, 0);
      arr.push({ date: `${d.getDate()}/${d.getMonth() + 1}`, Sales: dayTotal });
    }
    return arr;
  }, [filtered]);

  const formatYAxis = (tickItem: number) => {
    if (tickItem >= 100000) return `₹${(tickItem / 100000).toFixed(1)}L`;
    if (tickItem >= 1000) return `₹${(tickItem / 1000).toFixed(1)}k`;
    return `₹${tickItem}`;
  };

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
        <Link to="/billing">
          <Button size="lg" className="bg-primary text-white hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" /> Issue New Invoice
          </Button>
        </Link>
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
              <div className="text-xs font-medium text-muted-foreground uppercase">Old Gold Exchanged</div>
              <div className="text-2xl font-bold font-display text-blue-600 mt-1">{inr(totalOldGoldExchanged)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Scrap Metal Trade-in Credit</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 grid place-items-center">
              <Scale className="w-5 h-5" />
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

      {/* SALES TREND CHART */}
      <Card className="mb-6 shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> 30-Day Sales Trend Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={last30Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={formatYAxis} />
              <RechartsTooltip formatter={(value: number) => [inr(value), "Sales"]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Line type="monotone" dataKey="Sales" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* SEARCH & FILTERS BAR */}
      <Card className="mb-6 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search Invoice #, Customer, Mobile, HUID, Item..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={filterType === "ALL" ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setFilterType("ALL")}
              >
                All ({invoices.length})
              </Button>
              <Button
                size="sm"
                variant={filterType === "PAID" ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setFilterType("PAID")}
              >
                Fully Paid ({invoices.filter(i => (i.balanceDue || 0) <= 0).length})
              </Button>
              <Button
                size="sm"
                variant={filterType === "DUE" ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setFilterType("DUE")}
              >
                Balance Due ({invoices.filter(i => (i.balanceDue || 0) > 0).length})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DETAILED SALES TABLE */}
      <Card className="shadow-sm border overflow-hidden flex flex-col">
        <CardHeader className="bg-muted/20 border-b pb-3 pt-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold font-display flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            {isOperator ? "Estimate Order Sales History" : "Tax Invoices & Sales Register"}
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
                      {!isOperator && <th className="py-3 px-4">Type</th>}
                      <th className="py-3 px-4">Payment</th>
                      <th className="py-3 px-4 text-right">Invoice Total</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInvoices.map((i) => {
                      const invoiceNetWt = (i.items || []).reduce((sum, it) => sum + ((it.netWeight || 0) * (it.qty || 1)), 0);
                      return (
                        <tr key={i._id || i.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-medium text-foreground whitespace-nowrap">
                            <div className="font-mono font-bold text-primary">{i.number}</div>
                            <div className="text-xs text-muted-foreground">{formatDate(i.createdAt)}</div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground">{i.customerName}</div>
                            <div className="text-xs text-muted-foreground">{i.customerMobile}</div>
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <div className="space-y-1">
                              {(i.items || []).map((it: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-1.5 text-xs">
                                  <span className="font-medium text-foreground line-clamp-1">{it.name}</span>
                                  {it.purity && <Badge variant="secondary" className="text-[10px] py-0 px-1">{it.purity}</Badge>}
                                  {it.huid && <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono text-amber-700 bg-amber-50">{it.huid}</Badge>}
                                </div>
                              ))}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap font-bold text-amber-700">
                            {invoiceNetWt.toFixed(2)} g
                          </td>

                          {!isOperator && (
                            <td className="py-3 px-4 whitespace-nowrap">
                              <Badge className={i.type === "GST" ? "bg-indigo-100 text-indigo-800 border-indigo-200" : "bg-emerald-100 text-emerald-800 border-emerald-200"}>
                                {i.type === "GST" ? "GST Invoice" : "Estimate"}
                              </Badge>
                            </td>
                          )}

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-medium text-foreground">{i.paymentMode}</div>
                            {i.oldGoldAmount ? <div className="text-[11px] text-amber-700">Old Gold: {inr(i.oldGoldAmount)}</div> : null}
                          </td>

                          <td className="py-3 px-4 text-right font-bold text-emerald-600 whitespace-nowrap">
                            {inr(i.total)}
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {(i.balanceDue || 0) <= 0 ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Paid</Badge>
                            ) : (
                              <Badge variant="destructive">Due: {inr(i.balanceDue || 0)}</Badge>
                            )}
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
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600"
                                title="Delete Invoice & Restore Stock"
                                onClick={() => removeInvoice(i)}
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

              {/* Mobile Cards View */}
              <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
                {paginatedInvoices.map((i) => {
                  const invoiceNetWt = (i.items || []).reduce((sum, it) => sum + ((it.netWeight || 0) * (it.qty || 1)), 0);
                  return (
                    <div key={i._id || i.id} className="p-3.5 rounded-xl border border-border bg-card shadow-sm space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-xs font-bold text-primary">{i.number}</div>
                          <div className="font-semibold text-base text-foreground mt-0.5">{i.customerName}</div>
                          <div className="text-xs text-muted-foreground">{i.customerMobile}</div>
                        </div>
                        {(i.balanceDue || 0) <= 0 ? (
                          <Badge className="bg-emerald-100 text-emerald-800">Paid</Badge>
                        ) : (
                          <Badge variant="destructive">Due: {inr(i.balanceDue || 0)}</Badge>
                        )}
                      </div>

                      <div className="p-2.5 rounded-lg bg-muted/40 space-y-1">
                        {(i.items || []).map((it: any, idx: number) => (
                          <div key={idx} className="text-xs flex items-center justify-between">
                            <span className="font-medium text-foreground truncate">{it.name} ({it.purity || '22K'})</span>
                            <span className="font-mono text-amber-700">{it.netWeight || 0}g</span>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-lg bg-muted/30 text-center text-xs">
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase font-medium">Gold Wt</div>
                          <div className="font-bold text-amber-700 mt-0.5">{invoiceNetWt.toFixed(2)}g</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase font-medium">Mode</div>
                          <div className="font-semibold mt-0.5 text-foreground">{i.paymentMode}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase font-medium">Total</div>
                          <div className="font-bold text-emerald-600 mt-0.5">{inr(i.total)}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/60 text-xs">
                        <div className="text-[11px] text-muted-foreground">{formatDate(i.createdAt)}</div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setSelectedInvoice(i)}>
                            <Eye className="w-3.5 h-3.5 text-primary" /> View
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-500" onClick={() => removeInvoice(i)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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

      {/* VIEW & PRINT INVOICE MODAL */}
      {selectedInvoice && (
        <InvoiceViewModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
    </Layout>
  );
}

function InvoiceViewModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  return (
    <div className="print-section fixed inset-0 z-100 bg-black/50 flex justify-center items-start p-2 sm:p-4 print:static print:block print:bg-white print:p-0 print:overflow-visible print:h-auto overflow-y-auto pointer-events-auto">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-xl print:shadow-none print:max-w-none text-slate-900 my-auto relative flex flex-col max-h-[95vh] print:my-0 print:max-h-none print:block">
        <style>{`@media print { @page { margin: 4mm; } body { zoom: 0.9; } }`}</style>
        <div className="p-6 sm:p-10 print:p-2 border-2 border-transparent print:border-none m-2 print:m-0 bg-white overflow-y-auto flex-1 print:overflow-visible">

          <ShopHeader documentLabel={invoice.type === "GST" ? "Invoice" : "Estimate Sales Receipt"} compact />

          {/* Customer & Meta Details */}
          <div className="flex justify-between items-start mb-6 text-sm">
            <div>
              <div className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-1">Customer Details:</div>
              <div className="font-bold text-lg">{invoice.customerName}</div>
              <div className="text-slate-700">{invoice.customerMobile}</div>
              {invoice.customerAddress && <div className="text-slate-700 mt-0.5 max-w-xs">{invoice.customerAddress}</div>}
            </div>
            <div className="text-right">
              <div className="text-2xl font-display font-bold mb-2 text-slate-900">
                {invoice.type === "GST" ? "INVOICE" : "ESTIMATE RECEIPT"}
              </div>
              <table className="ml-auto text-left text-slate-700 text-xs">
                <tbody>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Invoice No:</td><td className="font-semibold text-slate-900">{invoice.number}</td></tr>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Date:</td><td className="font-semibold text-slate-900">{formatDate(invoice.createdAt)}</td></tr>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Payment Mode:</td><td className="font-semibold text-slate-900">{invoice.paymentMode}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto w-full mb-6">
            <table className="w-full text-xs border-collapse border border-slate-300">
              <thead className="bg-slate-100 text-slate-700 uppercase">
                <tr>
                  <th className="border border-slate-300 py-2 px-3 text-center w-10">#</th>
                  <th className="border border-slate-300 py-2 px-3 text-left">Item Description</th>
                  <th className="border border-slate-300 py-2 px-3 text-center">Purity</th>
                  <th className="border border-slate-300 py-2 px-3 text-center">Net Wt</th>
                  <th className="border border-slate-300 py-2 px-3 text-right">Rate/g</th>
                  <th className="border border-slate-300 py-2 px-3 text-right">Making</th>
                  <th className="border border-slate-300 py-2 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.items || []).map((it: any, idx: number) => {
                  const lineTotal = ((it.netWeight || 0) * (it.ratePerGram || 0)) + (it.makingCharge || 0) + (it.stoneCharge || 0);
                  return (
                    <tr key={idx} className="border-b border-slate-300">
                      <td className="border border-slate-300 py-2 px-3 text-center text-slate-600">{idx + 1}</td>
                      <td className="border border-slate-300 py-2 px-3 font-semibold">
                        {it.name} {it.huid ? <span className="ml-1.5 text-[10px] font-mono text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">HUID: {it.huid}</span> : ''}
                      </td>
                      <td className="border border-slate-300 py-2 px-3 text-center">{it.purity || '22K'}</td>
                      <td className="border border-slate-300 py-2 px-3 text-center font-bold text-amber-800">{it.netWeight} g</td>
                      <td className="border border-slate-300 py-2 px-3 text-right">{inr(it.ratePerGram)}</td>
                      <td className="border border-slate-300 py-2 px-3 text-right">{inr(it.makingCharge || 0)}</td>
                      <td className="border border-slate-300 py-2 px-3 text-right font-bold text-slate-900">{inr(lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Financial Totals */}
          <div className="flex flex-col sm:flex-row justify-between items-start text-xs gap-6 mb-6">
            <div className="w-full sm:w-1/2">
              {invoice.oldGoldAmount ? (
                <div className="p-3 border rounded bg-slate-50">
                  <div className="font-bold text-slate-700 uppercase mb-1">Old Gold Trade-in Credit</div>
                  <div className="text-sm font-bold text-amber-800">{inr(invoice.oldGoldAmount)}</div>
                </div>
              ) : null}
            </div>

            <div className="w-full sm:w-1/2 max-w-sm ml-auto space-y-1.5 border-t-2 border-slate-300 pt-2">
              <div className="flex justify-between text-slate-700">
                <span>Subtotal:</span>
                <span className="font-semibold">{inr(invoice.subtotal || invoice.total)}</span>
              </div>
              {invoice.discount ? (
                <div className="flex justify-between text-slate-700">
                  <span>Discount:</span>
                  <span className="font-semibold text-rose-600">- {inr(invoice.discount)}</span>
                </div>
              ) : null}
              {invoice.gstAmount ? (
                <div className="flex justify-between text-slate-700">
                  <span>GST Amount:</span>
                  <span className="font-semibold">{inr(invoice.gstAmount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-slate-300 pt-1.5 font-bold text-sm text-slate-900">
                <span>Grand Total:</span>
                <span className="text-emerald-700">{inr(invoice.total)}</span>
              </div>
              {invoice.balanceDue ? (
                <div className="flex justify-between text-rose-700 font-bold border-t border-rose-200 pt-1">
                  <span>Balance Due:</span>
                  <span>{inr(invoice.balanceDue)}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-600">
            <InvoiceTerms compact />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="shrink-0 bg-slate-100 p-4 border-t border-slate-200 rounded-b-lg flex justify-end gap-3 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={triggerPrint} className="bg-primary text-white">
            <Printer className="w-4 h-4 mr-2" /> Print Invoice
          </Button>
        </div>
      </div>
    </div>
  );
}
