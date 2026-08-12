import { useState, useMemo } from "react";
import { useFormKeyboardNav } from "@/lib/useFormKeyboardNav";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useLocalState, inr, type Purchase, type Supplier, type SupplierTransaction } from "@/lib/storage";
import { useDebounce } from "@/lib/utils";
import { useApiMutation } from "@/hooks/useApi";
import { useTenantAPI } from "@/lib/api";
import { Plus, Trash2, Pencil, Search, Loader2, BookOpen, Eye, Wallet, ShoppingBag, ClipboardList, AlertCircle, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#f43f5e", "#a855f7", "#ec4899", "#64748b"];

const formatDate = (date: string | Date) => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return isNaN(d.getTime()) ? "" : format(d, "dd/MM/yyyy");
};

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  "Pending Approval": "bg-amber-100 text-amber-700 border-amber-200",
  Approved: "bg-blue-100 text-blue-700 border-blue-200",
  Rejected: "bg-red-100 text-red-700 border-red-200",
  Received: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
};
function StatusBadge({ status }: { status?: string }) {
  const s = status || "Completed";
  return <Badge variant="outline" className={`text-[10px] font-semibold whitespace-nowrap ${STATUS_STYLES[s] || ""}`}>{s}</Badge>;
}

export default function SuppliersPage() {
  const api = useTenantAPI();

  const { data: list = [], isLoading, error } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: api.suppliers.getAll });
  const { data: purchases = [] } = useQuery<Purchase[]>({ queryKey: ["purchases"], queryFn: api.purchases.getAll });
  const createMutation = useApiMutation((data: Supplier) => api.suppliers.create(data), ["suppliers"]);
  const updateMutation = useApiMutation((data: { id: string; body: Supplier }) => api.suppliers.update(data.id, data.body), ["suppliers"]);
  const deleteMutation = useApiMutation((id: string) => api.suppliers.remove(id), ["suppliers"]);

  const [activeTab, setActiveTab] = useState("master");

  /* ---------------------------------------------------------------------- */
  /* Supplier Master                                                        */
  /* ---------------------------------------------------------------------- */
  const [open, setOpen] = useState(false);
  const empty: Supplier = { id: "", name: "", mobile: "", companyNo: "", email: "", category: "", gstNumber: "", address: "", note: "", balanceGold: 0, balanceSilver: 0, outstanding: 0, transactions: [] } as any;
  const [form, setForm] = useState<Supplier>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useLocalState<string[]>("ajms.supplierCategories", ["Wholesale", "Manufacturer", "Distributor"]);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCat, setNewCat] = useState("");

  const save = async () => {
    if (!form.name || !form.mobile || !(form as any).companyNo || !form.category || !(form as any).address || !form.note) {
      toast.error("Name, mobile, company no, category, address, and note are required");
      return;
    }
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: form });
        toast.success("Supplier updated successfully");
      } else {
        await createMutation.mutateAsync(form);
        toast.success("Supplier created successfully");
      }
      setForm(empty);
      setEditingId(null);
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save supplier");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Supplier deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete supplier");
    }
  };

  const handleKeyNav = useFormKeyboardNav(save);

  const addCategory = () => {
    const c = newCat.trim();
    if (!c) return;
    if (!categories.includes(c)) setCategories((p) => [...p, c]);
    setForm((d) => ({ ...d, category: c }));
    setNewCat("");
    setAddCatOpen(false);
  };

  const filtered = list.filter(s =>
    s.name.toLowerCase().includes(debouncedQ.toLowerCase()) ||
    s.mobile.includes(debouncedQ) ||
    (s as any).companyNo?.toLowerCase().includes(debouncedQ.toLowerCase())
  ).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const isLoading_UI = isLoading || createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const totalPages = Math.ceil(filtered.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  /* ---------------------------------------------------------------------- */
  /* Supplier Detail dialog (Ledger / Payments / Purchase History / Orders) */
  /* ---------------------------------------------------------------------- */
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const [detailTab, setDetailTab] = useState("ledger");
  const [goldPage, setGoldPage] = useState(1);
  const [silverPage, setSilverPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [ordersPage, setOrdersPage] = useState(1);
  const [txSearchQuery, setTxSearchQuery] = useState("");
  const debouncedTxSearchQuery = useDebounce(txSearchQuery, 300);
  const [txSearchDate, setTxSearchDate] = useState<string>("");
  const [txDateFocused, setTxDateFocused] = useState(false);
  const [txSearchDateFocused, setTxSearchDateFocused] = useState(false);
  const [txForm, setTxForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "Credit" as "Credit" | "Debit",
    metal: "Gold" as "Gold" | "Silver",
    purity: "22K",
    weight: 0,
    note: ""
  });
  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "Debit" as "Credit" | "Debit",
    amount: 0,
    paymentMode: "Cash",
    note: ""
  });

  const openDetail = (s: Supplier, tab: string = "ledger") => {
    setDetailSupplier(s);
    setDetailTab(tab);
    setGoldPage(1); setSilverPage(1); setPaymentPage(1); setHistoryPage(1); setOrdersPage(1);
    setTxSearchQuery(""); setTxSearchDate("");
  };

  const addTransaction = async () => {
    if (!detailSupplier) return;
    const newTx: SupplierTransaction = {
      id: Date.now().toString(),
      date: txForm.date,
      type: txForm.type,
      kind: "Weight",
      metal: txForm.metal,
      purity: txForm.purity,
      weight: Number(txForm.weight) || 0,
      note: txForm.note
    };

    const multiplier = newTx.type === "Credit" ? 1 : -1;
    let newBalanceGold = detailSupplier.balanceGold || 0;
    let newBalanceSilver = detailSupplier.balanceSilver || 0;

    if (newTx.metal === "Gold") newBalanceGold += (newTx.weight || 0) * multiplier;
    if (newTx.metal === "Silver") newBalanceSilver += (newTx.weight || 0) * multiplier;

    const updatedSupplier = {
      ...detailSupplier,
      balanceGold: newBalanceGold,
      balanceSilver: newBalanceSilver,
      transactions: [...(detailSupplier.transactions || []), newTx]
    };

    try {
      const saved = await updateMutation.mutateAsync({ id: detailSupplier._id || detailSupplier.id || "", body: updatedSupplier });
      setDetailSupplier(saved || updatedSupplier);
      setTxForm({ date: new Date().toISOString().slice(0, 10), type: "Credit", metal: "Gold", purity: "22K", weight: 0, note: "" });
      toast.success("Transaction added successfully!");
    } catch (e) {
      toast.error("Failed to add transaction");
    }
  };

  const deleteTransaction = async (txId: string) => {
    if (!detailSupplier) return;
    if (!window.confirm("Delete this transaction?")) return;

    const txToDelete = detailSupplier.transactions?.find(t => (t._id || t.id) === txId);
    if (!txToDelete) return;

    const multiplier = txToDelete.type === "Credit" ? -1 : 1; // Reverse the effect
    let newBalanceGold = detailSupplier.balanceGold || 0;
    let newBalanceSilver = detailSupplier.balanceSilver || 0;

    if (txToDelete.metal === "Gold") newBalanceGold += (txToDelete.weight || 0) * multiplier;
    if (txToDelete.metal === "Silver") newBalanceSilver += (txToDelete.weight || 0) * multiplier;

    const updatedSupplier = {
      ...detailSupplier,
      balanceGold: newBalanceGold,
      balanceSilver: newBalanceSilver,
      transactions: detailSupplier.transactions?.filter(t => (t._id || t.id) !== txId)
    };

    try {
      const saved = await updateMutation.mutateAsync({ id: detailSupplier._id || detailSupplier.id || "", body: updatedSupplier });
      setDetailSupplier(saved || updatedSupplier);
      toast.success("Transaction deleted");
    } catch (e) {
      toast.error("Failed to delete transaction");
    }
  };

  // Payments (₹) mini-ledger — same Credit/Debit sign convention as the weight ledger
  // and as purchases.tsx's applySupplierLedgerTx, but drives `outstanding` instead of weight.
  const addPayment = async () => {
    if (!detailSupplier) return;
    if (!paymentForm.amount) { toast.error("Enter a payment amount."); return; }
    const newTx: SupplierTransaction = {
      id: Date.now().toString(),
      date: paymentForm.date,
      type: paymentForm.type,
      kind: "Payment",
      amount: Number(paymentForm.amount) || 0,
      paymentMode: paymentForm.paymentMode,
      note: paymentForm.note
    };
    const sign = newTx.type === "Credit" ? 1 : -1;
    const newOutstanding = (detailSupplier.outstanding || 0) + sign * (newTx.amount || 0);
    const updatedSupplier = { ...detailSupplier, outstanding: newOutstanding, transactions: [...(detailSupplier.transactions || []), newTx] };
    try {
      const saved = await updateMutation.mutateAsync({ id: detailSupplier._id || detailSupplier.id || "", body: updatedSupplier });
      setDetailSupplier(saved || updatedSupplier);
      setPaymentForm({ date: new Date().toISOString().slice(0, 10), type: "Debit", amount: 0, paymentMode: "Cash", note: "" });
      toast.success("Payment recorded successfully!");
    } catch (e) {
      toast.error("Failed to record payment");
    }
  };

  const deletePayment = async (txId: string) => {
    if (!detailSupplier) return;
    if (!window.confirm("Delete this payment record?")) return;
    const txToDelete = detailSupplier.transactions?.find(t => (t._id || t.id) === txId);
    if (!txToDelete) return;
    const sign = txToDelete.type === "Credit" ? -1 : 1; // reverse
    const newOutstanding = (detailSupplier.outstanding || 0) + sign * (txToDelete.amount || 0);
    const updatedSupplier = { ...detailSupplier, outstanding: newOutstanding, transactions: detailSupplier.transactions?.filter(t => (t._id || t.id) !== txId) };
    try {
      const saved = await updateMutation.mutateAsync({ id: detailSupplier._id || detailSupplier.id || "", body: updatedSupplier });
      setDetailSupplier(saved || updatedSupplier);
      toast.success("Payment deleted");
    } catch (e) {
      toast.error("Failed to delete payment");
    }
  };

  const goldTx = useMemo(() => {
    if (!detailSupplier?.transactions) return [];
    let txs = detailSupplier.transactions.filter(t => t.kind !== "Payment" && t.metal === "Gold");
    if (debouncedTxSearchQuery) {
      const sq = debouncedTxSearchQuery.toLowerCase();
      txs = txs.filter(t =>
        t.type.toLowerCase().includes(sq) ||
        (t.note || "").toLowerCase().includes(sq) ||
        (t.purity || "").toLowerCase().includes(sq) ||
        formatDate(t.date).toLowerCase().includes(sq)
      );
    }
    if (txSearchDate) txs = txs.filter(t => t.date === txSearchDate);
    return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [detailSupplier, debouncedTxSearchQuery, txSearchDate]);

  const silverTx = useMemo(() => {
    if (!detailSupplier?.transactions) return [];
    let txs = detailSupplier.transactions.filter(t => t.kind !== "Payment" && t.metal === "Silver");
    if (debouncedTxSearchQuery) {
      const sq = debouncedTxSearchQuery.toLowerCase();
      txs = txs.filter(t =>
        t.type.toLowerCase().includes(sq) ||
        (t.note || "").toLowerCase().includes(sq) ||
        (t.purity || "").toLowerCase().includes(sq) ||
        formatDate(t.date).toLowerCase().includes(sq)
      );
    }
    if (txSearchDate) txs = txs.filter(t => t.date === txSearchDate);
    return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [detailSupplier, debouncedTxSearchQuery, txSearchDate]);

  const paymentTx = useMemo(() => {
    if (!detailSupplier?.transactions) return [];
    return detailSupplier.transactions.filter(t => t.kind === "Payment").sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [detailSupplier]);

  const totalGoldPages = Math.ceil(goldTx.length / 10) || 1;
  const currentGoldPage = Math.min(goldPage, totalGoldPages);
  const paginatedGoldTx = goldTx.slice((currentGoldPage - 1) * 10, currentGoldPage * 10);

  const totalSilverPages = Math.ceil(silverTx.length / 10) || 1;
  const currentSilverPage = Math.min(silverPage, totalSilverPages);
  const paginatedSilverTx = silverTx.slice((currentSilverPage - 1) * 10, currentSilverPage * 10);

  const totalPaymentPages = Math.ceil(paymentTx.length / 10) || 1;
  const currentPaymentPage = Math.min(paymentPage, totalPaymentPages);
  const paginatedPaymentTx = paymentTx.slice((currentPaymentPage - 1) * 10, currentPaymentPage * 10);

  const goldBreakdown = useMemo(() => {
    if (!detailSupplier) return {};
    const breakdown: Record<string, number> = {};
    let txSum = 0;
    (detailSupplier.transactions || []).filter(t => t.kind !== "Payment" && t.metal === "Gold").forEach(t => {
      const p = t.purity || "22K";
      const w = (t.weight || 0) * (t.type === "Credit" ? 1 : -1);
      breakdown[p] = (breakdown[p] || 0) + w;
      txSum += w;
    });
    const opening = (detailSupplier.balanceGold || 0) - txSum;
    if (Math.abs(opening) > 0.001) breakdown["Opening/Other"] = (breakdown["Opening/Other"] || 0) + opening;
    return breakdown;
  }, [detailSupplier]);

  const silverBreakdown = useMemo(() => {
    if (!detailSupplier) return {};
    const breakdown: Record<string, number> = {};
    let txSum = 0;
    (detailSupplier.transactions || []).filter(t => t.kind !== "Payment" && t.metal === "Silver").forEach(t => {
      const p = t.purity || "Silver";
      const w = (t.weight || 0) * (t.type === "Credit" ? 1 : -1);
      breakdown[p] = (breakdown[p] || 0) + w;
      txSum += w;
    });
    const opening = (detailSupplier.balanceSilver || 0) - txSum;
    if (Math.abs(opening) > 0.001) breakdown["Opening/Other"] = (breakdown["Opening/Other"] || 0) + opening;
    return breakdown;
  }, [detailSupplier]);

  // Purchase History & Orders — this supplier's docs from the shared Purchases collection
  const supplierId = detailSupplier ? (detailSupplier._id || detailSupplier.id) : "";
  const supplierPurchases = useMemo(() => purchases.filter((p: any) => p.supplierId === supplierId), [purchases, supplierId]);
  const historyList = useMemo(() => supplierPurchases
    .filter((p: any) => p.docType === "Entry" || !p.docType || p.docType === "Return")
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()), [supplierPurchases]);
  const ordersList = useMemo(() => supplierPurchases
    .filter((p: any) => p.docType === "Order")
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()), [supplierPurchases]);

  const totalHistoryPages = Math.ceil(historyList.length / 10) || 1;
  const currentHistoryPage = Math.min(historyPage, totalHistoryPages);
  const paginatedHistory = historyList.slice((currentHistoryPage - 1) * 10, currentHistoryPage * 10);

  const totalOrdersPages = Math.ceil(ordersList.length / 10) || 1;
  const currentOrdersPage = Math.min(ordersPage, totalOrdersPages);
  const paginatedDetailOrders = ordersList.slice((currentOrdersPage - 1) * 10, currentOrdersPage * 10);

  /* ---------------------------------------------------------------------- */
  /* Outstanding                                                            */
  /* ---------------------------------------------------------------------- */
  const suppliersWithDues = useMemo(() => list
    .filter((s: any) => (s.outstanding || 0) !== 0 || (s.balanceGold || 0) !== 0 || (s.balanceSilver || 0) !== 0)
    .sort((a: any, b: any) => (b.outstanding || 0) - (a.outstanding || 0)), [list]);
  const totalOutstanding = list.reduce((s: number, x: any) => s + (x.outstanding || 0), 0);
  const totalGoldDue = list.reduce((s: number, x: any) => s + (x.balanceGold || 0), 0);
  const totalSilverDue = list.reduce((s: number, x: any) => s + (x.balanceSilver || 0), 0);

  /* ---------------------------------------------------------------------- */
  /* Supplier Reports                                                       */
  /* ---------------------------------------------------------------------- */
  const purchaseEntries = useMemo(() => purchases.filter((p: any) => p.docType === "Entry" || !p.docType), [purchases]);
  const topSuppliersByValue = useMemo(() => {
    const map: Record<string, { name: string; value: number }> = {};
    purchaseEntries.forEach((p: any) => {
      const key = p.supplierId || p.supplierName || "Unknown";
      if (!map[key]) map[key] = { name: p.supplierName || "Unknown", value: 0 };
      map[key].value += p.total || 0;
    });
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [purchaseEntries]);
  const categoryPie = useMemo(() => {
    const map: Record<string, number> = {};
    list.forEach((s: any) => { const k = s.category || "Other"; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [list]);

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Suppliers</h1>
          <p className="text-muted-foreground mt-1">{list.length} on file.</p>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md h-auto bg-muted/60 p-1 rounded-xl gap-1">
          <TabsTrigger value="master" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5" />Master</TabsTrigger>
          <TabsTrigger value="outstanding" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />Outstanding</TabsTrigger>
          <TabsTrigger value="reports" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" />Reports</TabsTrigger>
        </TabsList>

        {/* ==================================================================== */}
        {/* TAB: SUPPLIER MASTER */}
        {/* ==================================================================== */}
        <TabsContent value="master" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
            <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-indigo-100 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-indigo-600/80 uppercase tracking-wider mb-1">Total Suppliers</div>
                <div className="text-2xl font-bold text-indigo-900">{list.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-100 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-amber-600/80 uppercase tracking-wider mb-1">Total Gold Due</div>
                <div className="text-2xl font-bold text-amber-900">{totalGoldDue.toFixed(3)}g</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100/50 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-slate-600/80 uppercase tracking-wider mb-1">Total Silver Due</div>
                <div className="text-2xl font-bold text-slate-800">{totalSilverDue.toFixed(3)}g</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-100 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-rose-600/80 uppercase tracking-wider mb-1">Total Outstanding</div>
                <div className="text-2xl font-bold text-rose-900">{inr(totalOutstanding)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col-reverse md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9 bg-background/50 focus:bg-background transition-colors shadow-sm" placeholder="Search by name, mobile or company no" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex justify-end w-full md:w-auto">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" onClick={() => { setForm(empty); setEditingId(null); }} disabled={isLoading_UI}>
                    <Plus className="w-4 h-4 mr-2" /> Add Supplier
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6" onInteractOutside={(e) => e.preventDefault()} onKeyDown={handleKeyNav}>
                  <DialogHeader>
                    <DialogTitle className="font-display text-2xl">{editingId ? "Edit" : "New"} supplier</DialogTitle>
                    <DialogDescription>Add or update supplier information</DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Supplier Name *" v={form.name} on={v => setForm({ ...form, name: v })} />
                    <Field label="Mobile No *" v={form.mobile} on={v => setForm({ ...form, mobile: v })} />
                    <Field label="Company No *" v={(form as any).companyNo} on={v => setForm({ ...form, companyNo: v } as any)} />
                    <Field label="Email (optional)" v={form.email || ""} on={v => setForm({ ...form, email: v })} />
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Category *</Label>
                      <div className="flex gap-2 items-center">
                        <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="outline" className="shrink-0" title="Add Category">
                              <Plus className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-h-[60vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
                            <DialogHeader>
                              <DialogTitle>Add Category</DialogTitle>
                              <DialogDescription>Add a new category label for your suppliers.</DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                              <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Category name" autoFocus />
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setAddCatOpen(false)}>Cancel</Button>
                              <Button onClick={addCategory}>Add</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                    <Field label="GST No (optional)" v={form.gstNumber || ""} on={v => setForm({ ...form, gstNumber: v })} />
                    <div className="col-span-2 grid grid-cols-2 gap-4 mt-2 p-3 bg-muted/30 rounded-md border border-border">
                      <div className="col-span-2 text-xs font-semibold text-primary uppercase tracking-wider -mb-1">Opening Balance (Weight)</div>
                      <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Gold Due (g)</Label><Input type="number" value={form.balanceGold === 0 ? "" : form.balanceGold} onChange={e => setForm({ ...form, balanceGold: Number(e.target.value) })} placeholder="0" /></div>
                      <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Silver Due (g)</Label><Input type="number" value={form.balanceSilver === 0 ? "" : form.balanceSilver} onChange={e => setForm({ ...form, balanceSilver: Number(e.target.value) })} placeholder="0" /></div>
                    </div>
                    <div className="col-span-2 space-y-3 mt-1">
                      <Field label="Address *" v={(form as any).address} on={v => setForm({ ...form, address: v } as any)} />
                      <Field label="Note *" v={form.note || ""} on={v => setForm({ ...form, note: v })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading_UI}>Cancel</Button>
                    <Button onClick={save} disabled={isLoading_UI || !form.name || !form.mobile || !(form as any).companyNo || !form.category || !(form as any).address || !form.note}>
                      {isLoading_UI ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {isLoading ? <p className="text-center text-muted-foreground py-12">Loading suppliers...</p> : error ? <p className="text-center text-red-500 py-12">Failed to load suppliers</p> : filtered.length === 0 ? <p className="text-center text-muted-foreground py-12">No suppliers yet.</p> : (
                <div>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-y-auto max-h-[600px] relative">
                    <table className="w-full text-sm min-w-[900px] border-collapse">
                      <thead className="text-left text-muted-foreground text-xs font-semibold sticky top-0 bg-muted/95 backdrop-blur-sm z-10 shadow-sm">
                        <tr>
                          <th className="p-3 pl-4 whitespace-nowrap">Supplier Name</th>
                          <th className="whitespace-nowrap">Mobile</th>
                          <th className="whitespace-nowrap">Company No</th>
                          <th className="whitespace-nowrap">Category</th>
                          <th className="text-right whitespace-nowrap">Gold Due (g)</th>
                          <th className="text-right whitespace-nowrap">Silver Due (g)</th>
                          <th className="text-right whitespace-nowrap">Outstanding</th>
                          <th className="text-right pr-4 whitespace-nowrap w-32">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {paginated.map(s => (
                          <tr key={s._id} className="group hover:bg-muted/40 transition-colors">
                            <td className="p-3 pl-4 font-medium text-foreground">{s.name}</td>
                            <td>{s.mobile}</td>
                            <td>{(s as any).companyNo}</td>
                            <td><span className="inline-flex items-center rounded-full border border-sidebar-border bg-sidebar px-2.5 py-0.5 text-xs font-semibold">{s.category}</span></td>
                            <td className="text-right font-medium text-amber-600">{(s.balanceGold || 0).toFixed(3)}g</td>
                            <td className="text-right font-medium text-slate-500">{(s.balanceSilver || 0).toFixed(3)}g</td>
                            <td className="text-right font-medium text-rose-600">{inr(s.outstanding || 0)}</td>
                            <td>
                              <div className="flex gap-1 justify-end pr-3">
                                <Button size="icon" variant="ghost" onClick={() => openDetail(s)} title="View Details">
                                  <Eye className="w-4 h-4 text-blue-600 hover:text-blue-700" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => { setForm(s); setEditingId(s._id || null); setOpen(true); }} disabled={isLoading_UI}><Pencil className="w-4 h-4 text-muted-foreground" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => remove(s._id || "")} disabled={isLoading_UI}><Trash2 className="w-4 h-4 text-rose-500" /></Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards View */}
                  <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
                    {paginated.map(s => (
                      <div key={s._id} className="p-3.5 rounded-xl border border-border bg-card shadow-sm space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-base text-foreground">{s.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{s.mobile} · {(s as any).companyNo}</div>
                          </div>
                          <span className="inline-flex items-center rounded-full border border-sidebar-border bg-muted/60 px-2.5 py-0.5 text-[10px] font-semibold">{s.category}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-lg bg-muted/40 text-xs">
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase">Gold Due</div>
                            <div className="font-semibold text-amber-600 mt-0.5">{(s.balanceGold || 0).toFixed(3)}g</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase">Silver Due</div>
                            <div className="font-semibold text-slate-600 mt-0.5">{(s.balanceSilver || 0).toFixed(3)}g</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-muted-foreground uppercase">Outstanding</div>
                            <div className="font-semibold text-rose-600 mt-0.5">{inr(s.outstanding || 0)}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/60">
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => openDetail(s)}>
                            <Eye className="w-3.5 h-3.5 text-blue-600" /> Details
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => { setForm(s); setEditingId(s._id || null); setOpen(true); }} disabled={isLoading_UI}>
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-500" onClick={() => remove(s._id || "")} disabled={isLoading_UI}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <div className="text-xs text-muted-foreground">Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, filtered.length)} of {filtered.length} entries</div>
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
        {/* TAB: OUTSTANDING */}
        {/* ==================================================================== */}
        <TabsContent value="outstanding" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="font-display flex items-center gap-2"><AlertCircle className="w-5 h-5" />Outstanding Balances</CardTitle></CardHeader>
            <CardContent className="p-0">
              {suppliersWithDues.length === 0 ? <p className="text-center text-muted-foreground py-12">No outstanding balances — all clear.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-175">
                    <thead className="text-left text-muted-foreground border-b bg-muted/20 text-xs uppercase">
                      <tr><th className="py-2.5 px-4">Supplier</th><th>Category</th><th className="text-right">Gold Due</th><th className="text-right">Silver Due</th><th className="text-right">Outstanding</th><th className="text-right pr-4">Action</th></tr>
                    </thead>
                    <tbody>
                      {suppliersWithDues.map((s: any) => (
                        <tr key={s._id || s.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-2 px-4 font-semibold">{s.name}</td>
                          <td className="text-xs text-muted-foreground">{s.category || "—"}</td>
                          <td className="text-right text-amber-600 font-medium">{(s.balanceGold || 0).toFixed(3)}g</td>
                          <td className="text-right text-slate-500 font-medium">{(s.balanceSilver || 0).toFixed(3)}g</td>
                          <td className="text-right font-bold text-rose-600">{inr(s.outstanding || 0)}</td>
                          <td className="text-right px-4">
                            <Button size="sm" variant="outline" onClick={() => openDetail(s, "payments")}><Wallet className="w-3.5 h-3.5 mr-1" />Record Payment</Button>
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

        {/* ==================================================================== */}
        {/* TAB: SUPPLIER REPORTS */}
        {/* ==================================================================== */}
        <TabsContent value="reports" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base font-display">Top Suppliers by Purchase Value</CardTitle></CardHeader>
              <CardContent className="h-72 pt-4">
                {topSuppliersByValue.length === 0 ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No purchase data yet.</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topSuppliersByValue} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <RechartsTooltip formatter={(val: number) => [inr(val), "Purchase Value"]} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base font-display">Suppliers by Category</CardTitle></CardHeader>
              <CardContent className="h-72 pt-4">
                {categoryPie.length === 0 ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data yet.</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                        {categoryPie.map((_entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(val: number) => [val, "Suppliers"]} />
                      <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ==================================================================== */}
      {/* Supplier Detail dialog                                               */}
      {/* ==================================================================== */}
      <Dialog open={!!detailSupplier} onOpenChange={(v) => { if (!v) setDetailSupplier(null); }}>
        <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6" aria-describedby={undefined} onInteractOutside={(e) => e.preventDefault()}>
          {detailSupplier && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-display flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-primary" /> {detailSupplier.name}
                </DialogTitle>
                <DialogDescription>Ledger, payments, purchase history &amp; orders for this supplier.</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-4 mb-4 mt-2">
                <Card className="bg-amber-50 border-amber-100 shadow-none">
                  <CardContent className="p-4">
                    <div className="text-sm text-amber-800 font-medium">Gold Due (g)</div>
                    <div className="text-2xl font-bold text-amber-600 mt-1">{(detailSupplier.balanceGold || 0).toFixed(3)} g</div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-100 border-slate-200 shadow-none">
                  <CardContent className="p-4">
                    <div className="text-sm text-slate-800 font-medium">Silver Due (g)</div>
                    <div className="text-2xl font-bold text-slate-600 mt-1">{(detailSupplier.balanceSilver || 0).toFixed(3)} g</div>
                  </CardContent>
                </Card>
                <Card className="bg-rose-50 border-rose-100 shadow-none">
                  <CardContent className="p-4">
                    <div className="text-sm text-rose-800 font-medium">Outstanding</div>
                    <div className="text-2xl font-bold text-rose-600 mt-1">{inr(detailSupplier.outstanding || 0)}</div>
                  </CardContent>
                </Card>
              </div>

              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto bg-muted/60 p-1 rounded-xl gap-1 mb-4">
                  <TabsTrigger value="ledger" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" />Ledger</TabsTrigger>
                  <TabsTrigger value="payments" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" />Payments</TabsTrigger>
                  <TabsTrigger value="history" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5" />Purchase History</TabsTrigger>
                  <TabsTrigger value="orders" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" />Orders</TabsTrigger>
                </TabsList>

                {/* -------------------------- Ledger (gold/silver weight) -------------------------- */}
                <TabsContent value="ledger" className="space-y-4">
                  {(Object.keys(goldBreakdown).length > 0 || Object.keys(silverBreakdown).length > 0) && (
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="bg-amber-50/60 rounded-lg p-2.5 space-y-0.5">
                        {Object.entries(goldBreakdown).filter(([_, w]) => Math.abs(w) > 0.001).map(([p, w]) => (
                          <div key={p} className="flex justify-between text-amber-700"><span>{p}:</span><span className="font-medium">{w.toFixed(3)} g</span></div>
                        ))}
                      </div>
                      <div className="bg-slate-100/60 rounded-lg p-2.5 space-y-0.5">
                        {Object.entries(silverBreakdown).filter(([_, w]) => Math.abs(w) > 0.001).map(([p, w]) => (
                          <div key={p} className="flex justify-between text-slate-600"><span>{p}:</span><span className="font-medium">{w.toFixed(3)} g</span></div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <h3 className="font-semibold mb-3">Add Transaction</h3>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Type</Label>
                        <Select value={txForm.type} onValueChange={(v: any) => setTxForm({ ...txForm, type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Credit">Credit (+ We Owe)</SelectItem>
                            <SelectItem value="Debit">Debit (- We Paid)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Metal</Label>
                        <Select value={txForm.metal} onValueChange={(v: any) => setTxForm({ ...txForm, metal: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Gold">Gold</SelectItem>
                            <SelectItem value="Silver">Silver</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Purity</Label>
                        <Input value={txForm.purity} onChange={e => setTxForm({ ...txForm, purity: e.target.value })} placeholder="e.g. 22K" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Weight (g)</Label>
                        <Input type="number" value={txForm.weight || ""} onChange={e => setTxForm({ ...txForm, weight: Number(e.target.value) })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Date</Label>
                        {(() => {
                          let displayValue = txForm.date;
                          if (!txDateFocused && txForm.date) {
                            const parts = txForm.date.split('-');
                            if (parts.length === 3) displayValue = `${parts[2]}/${parts[1]}/${parts[0]}`;
                          }
                          return (
                            <Input
                              type={txDateFocused ? "date" : "text"}
                              placeholder="DD/MM/YYYY"
                              value={displayValue}
                              onChange={e => setTxForm({ ...txForm, date: e.target.value })}
                              onFocus={() => setTxDateFocused(true)}
                              onBlur={() => setTxDateFocused(false)}
                              className="w-full bg-background shadow-sm h-9"
                            />
                          );
                        })()}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Note</Label>
                        <Input value={txForm.note} onChange={e => setTxForm({ ...txForm, note: e.target.value })} placeholder="Remarks..." />
                      </div>
                      <div className="col-span-2 md:col-span-6 flex justify-end mt-2">
                        <Button onClick={addTransaction} disabled={updateMutation.isPending || !txForm.weight}>
                          Add Transaction
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="font-semibold text-base flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Transaction History</h3>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {(() => {
                        let displayValue = txSearchDate;
                        if (!txSearchDateFocused && txSearchDate) {
                          const parts = txSearchDate.split('-');
                          if (parts.length === 3) displayValue = `${parts[2]}/${parts[1]}/${parts[0]}`;
                        }
                        return (
                          <Input
                            type={txSearchDateFocused ? "date" : "text"}
                            placeholder="DD/MM/YYYY"
                            value={displayValue}
                            onChange={e => { setTxSearchDate(e.target.value); setGoldPage(1); setSilverPage(1); }}
                            onFocus={() => setTxSearchDateFocused(true)}
                            onBlur={() => setTxSearchDateFocused(false)}
                            className="w-full sm:w-40 bg-background h-9"
                          />
                        );
                      })()}
                      {txSearchDate && (
                        <Button variant="ghost" size="sm" onClick={() => { setTxSearchDate(""); setGoldPage(1); setSilverPage(1); }} className="h-9">Clear</Button>
                      )}
                      <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search type, note..."
                          value={txSearchQuery}
                          onChange={e => { setTxSearchQuery(e.target.value); setGoldPage(1); setSilverPage(1); }}
                          className="pl-9 h-9 bg-background text-sm shadow-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Gold Table */}
                    <Card className="shadow-sm border-amber-200/50 overflow-hidden flex flex-col bg-white">
                      <CardHeader className="bg-amber-50/50 py-3 border-b border-amber-100">
                        <CardTitle className="text-base font-semibold text-amber-700 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500"></div> Gold Ledger
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 flex-1 flex flex-col">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-amber-50/30 text-left border-b border-amber-100/50 text-amber-900/70 text-xs uppercase">
                              <tr>
                                <th className="py-2.5 px-3 font-semibold">Date</th>
                                <th className="py-2.5 px-3 font-semibold">Details</th>
                                <th className="py-2.5 px-3 text-right font-semibold">Weight</th>
                                <th className="py-2.5 px-3 w-10"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-100/30">
                              {paginatedGoldTx.length === 0 ? (
                                <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">No Gold transactions.</td></tr>
                              ) : (
                                paginatedGoldTx.map((tx, i) => (
                                  <tr key={tx._id || tx.id || i} className="hover:bg-amber-50/20 transition-colors group">
                                    <td className="p-3 align-top whitespace-nowrap">
                                      <div className="font-medium text-slate-800">{formatDate(tx.date)}</div>
                                      <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${tx.type === 'Credit' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>{tx.type}</span>
                                    </td>
                                    <td className="p-3 align-top">
                                      <div className="font-medium text-slate-800">{tx.purity || "—"}</div>
                                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-2 max-w-40" title={tx.note}>{tx.note || "No remarks"}</div>
                                    </td>
                                    <td className="p-3 text-right align-top">
                                      <div className={`font-bold ${tx.type === 'Credit' ? 'text-green-600' : 'text-rose-600'}`}>
                                        {tx.type === 'Credit' ? '+' : '-'}{(tx.weight || 0) > 0 ? `${tx.weight}g` : "0g"}
                                      </div>
                                    </td>
                                    <td className="p-3 text-right align-top opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => deleteTransaction(tx.id || tx._id || "")} title="Delete Transaction">
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        {totalGoldPages > 1 && (
                          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10 mt-auto">
                            <div className="text-xs text-muted-foreground">Page {currentGoldPage} of {totalGoldPages}</div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-7 text-xs bg-background" onClick={() => setGoldPage(p => Math.max(1, p - 1))} disabled={currentGoldPage === 1}>Prev</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs bg-background" onClick={() => setGoldPage(p => Math.min(totalGoldPages, p + 1))} disabled={currentGoldPage === totalGoldPages}>Next</Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Silver Table */}
                    <Card className="shadow-sm border-slate-200/50 overflow-hidden flex flex-col bg-white">
                      <CardHeader className="bg-slate-50/50 py-3 border-b border-slate-200">
                        <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-slate-400"></div> Silver Ledger
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 flex-1 flex flex-col">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50/50 text-left border-b border-slate-200/70 text-slate-600 text-xs uppercase">
                              <tr>
                                <th className="py-2.5 px-3 font-semibold">Date</th>
                                <th className="py-2.5 px-3 font-semibold">Details</th>
                                <th className="py-2.5 px-3 text-right font-semibold">Weight</th>
                                <th className="py-2.5 px-3 w-10"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {paginatedSilverTx.length === 0 ? (
                                <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">No Silver transactions.</td></tr>
                              ) : (
                                paginatedSilverTx.map((tx, i) => (
                                  <tr key={tx._id || tx.id || i} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-3 align-top whitespace-nowrap">
                                      <div className="font-medium text-slate-800">{formatDate(tx.date)}</div>
                                      <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${tx.type === 'Credit' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>{tx.type}</span>
                                    </td>
                                    <td className="p-3 align-top">
                                      <div className="font-medium text-slate-800">{tx.purity || "—"}</div>
                                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-2 max-w-40" title={tx.note}>{tx.note || "No remarks"}</div>
                                    </td>
                                    <td className="p-3 text-right align-top">
                                      <div className={`font-bold ${tx.type === 'Credit' ? 'text-green-600' : 'text-rose-600'}`}>
                                        {tx.type === 'Credit' ? '+' : '-'}{(tx.weight || 0) > 0 ? `${tx.weight}g` : "0g"}
                                      </div>
                                    </td>
                                    <td className="p-3 text-right align-top opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => deleteTransaction(tx.id || tx._id || "")} title="Delete Transaction">
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        {totalSilverPages > 1 && (
                          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10 mt-auto">
                            <div className="text-xs text-muted-foreground">Page {currentSilverPage} of {totalSilverPages}</div>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-7 text-xs bg-background" onClick={() => setSilverPage(p => Math.max(1, p - 1))} disabled={currentSilverPage === 1}>Prev</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs bg-background" onClick={() => setSilverPage(p => Math.min(totalSilverPages, p + 1))} disabled={currentSilverPage === totalSilverPages}>Next</Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* -------------------------- Payments (₹) -------------------------- */}
                <TabsContent value="payments" className="space-y-4">
                  <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <h3 className="font-semibold mb-3">Record Payment / Adjustment</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Type</Label>
                        <Select value={paymentForm.type} onValueChange={(v: any) => setPaymentForm({ ...paymentForm, type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Debit">Debit (Payment Made)</SelectItem>
                            <SelectItem value="Credit">Credit (Amount Owed)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Amount ₹</Label>
                        <Input type="number" value={paymentForm.amount || ""} onChange={e => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Payment Mode</Label>
                        <select className="w-full h-10 border rounded-md px-3 bg-background text-sm" value={paymentForm.paymentMode} onChange={e => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}>
                          {["Cash", "UPI", "Card", "Bank", "Cheque"].map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Date</Label>
                        <Input type="date" value={paymentForm.date} onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })} className="w-full bg-background shadow-sm h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Note</Label>
                        <Input value={paymentForm.note} onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })} placeholder="Remarks..." />
                      </div>
                      <div className="col-span-2 md:col-span-5 flex justify-end mt-2">
                        <Button onClick={addPayment} disabled={updateMutation.isPending || !paymentForm.amount}>Record Payment</Button>
                      </div>
                    </div>
                  </div>

                  <Card className="shadow-sm overflow-hidden">
                    <CardHeader className="py-3 border-b"><CardTitle className="text-base font-semibold">Payment History</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/30 text-left border-b">
                            <tr>
                              <th className="p-3">Date</th><th className="p-3">Type</th><th className="p-3">Mode</th><th className="p-3">Note</th>
                              <th className="p-3 text-right">Amount</th><th className="p-3"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedPaymentTx.length === 0 ? (
                              <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No payments recorded yet.</td></tr>
                            ) : (
                              paginatedPaymentTx.map((tx, i) => (
                                <tr key={tx._id || tx.id || i} className="border-b last:border-0 hover:bg-muted/20">
                                  <td className="p-3 whitespace-nowrap">{formatDate(tx.date)}</td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${tx.type === 'Credit' ? 'bg-rose-100 text-rose-700' : 'bg-green-100 text-green-700'}`}>{tx.type}</span>
                                  </td>
                                  <td className="p-3 text-muted-foreground">{tx.paymentMode || "—"}</td>
                                  <td className="p-3 max-w-48 truncate" title={tx.note}>{tx.note || "—"}</td>
                                  <td className={`p-3 text-right font-bold ${tx.type === 'Credit' ? 'text-rose-600' : 'text-green-600'}`}>{tx.type === 'Credit' ? '+' : '-'}{inr(tx.amount || 0)}</td>
                                  <td className="p-3 text-right">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50" onClick={() => deletePayment(tx.id || tx._id || "")} title="Delete"><Trash2 className="w-4 h-4" /></Button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      {totalPaymentPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                          <div className="text-xs text-muted-foreground">Page {currentPaymentPage} of {totalPaymentPages}</div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => setPaymentPage(p => Math.max(1, p - 1))} disabled={currentPaymentPage === 1}>Prev</Button>
                            <Button size="sm" variant="outline" onClick={() => setPaymentPage(p => Math.min(totalPaymentPages, p + 1))} disabled={currentPaymentPage === totalPaymentPages}>Next</Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* -------------------------- Purchase History (read-only) -------------------------- */}
                <TabsContent value="history" className="space-y-4">
                  <Card className="shadow-sm overflow-hidden">
                    <CardContent className="p-0">
                      {historyList.length === 0 ? <p className="text-center text-muted-foreground py-12">No purchase history for this supplier yet.</p> : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/30 text-left border-b">
                              <tr><th className="p-3">Bill</th><th>Date</th><th>Type</th><th>Metal</th><th className="text-right">Wt (g)</th><th className="text-right">Total</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                              {paginatedHistory.map((p: any) => (
                                <tr key={p._id || p.id} className="border-b last:border-0 hover:bg-muted/20">
                                  <td className="p-3 font-semibold">{p.billNo}</td>
                                  <td className="whitespace-nowrap">{formatDate(p.date)}</td>
                                  <td className="text-xs text-muted-foreground">{p.docType === "Return" ? "Return" : "Purchase"}</td>
                                  <td>{p.metal} {p.purity}</td>
                                  <td className="text-right">{p.weight}g</td>
                                  <td className={`text-right font-bold ${p.docType === "Return" ? "text-red-600" : "text-emerald-600"}`}>{p.docType === "Return" ? "-" : ""}{inr(p.total)}</td>
                                  <td><StatusBadge status={p.status} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {totalHistoryPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                          <div className="text-xs text-muted-foreground">Page {currentHistoryPage} of {totalHistoryPages}</div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={currentHistoryPage === 1}>Prev</Button>
                            <Button size="sm" variant="outline" onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))} disabled={currentHistoryPage === totalHistoryPages}>Next</Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* -------------------------- Orders (read-only) -------------------------- */}
                <TabsContent value="orders" className="space-y-4">
                  <Card className="shadow-sm overflow-hidden">
                    <CardContent className="p-0">
                      {ordersList.length === 0 ? <p className="text-center text-muted-foreground py-12">No purchase orders for this supplier yet.</p> : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/30 text-left border-b">
                              <tr><th className="p-3">PO No</th><th>Date</th><th>Metal</th><th className="text-right">Wt (g)</th><th className="text-right">Total</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                              {paginatedDetailOrders.map((p: any) => (
                                <tr key={p._id || p.id} className="border-b last:border-0 hover:bg-muted/20">
                                  <td className="p-3 font-semibold">{p.billNo}</td>
                                  <td className="whitespace-nowrap">{formatDate(p.date)}</td>
                                  <td>{p.metal} {p.purity}</td>
                                  <td className="text-right">{p.weight}g</td>
                                  <td className="text-right font-bold text-emerald-600">{inr(p.total)}</td>
                                  <td><StatusBadge status={p.status} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {totalOrdersPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t">
                          <div className="text-xs text-muted-foreground">Page {currentOrdersPage} of {totalOrdersPages}</div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => setOrdersPage(p => Math.max(1, p - 1))} disabled={currentOrdersPage === 1}>Prev</Button>
                            <Button size="sm" variant="outline" onClick={() => setOrdersPage(p => Math.min(totalOrdersPages, p + 1))} disabled={currentOrdersPage === totalOrdersPages}>Next</Button>
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground px-3 pb-3">Approve, reject or receive orders from the Purchases page's Orders/Approvals tabs.</p>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function Field({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">{label}</Label><Input value={v} onChange={e => on(e.target.value)} /></div>;
}

