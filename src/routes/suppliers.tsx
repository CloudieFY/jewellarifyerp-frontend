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
import { Plus, Trash2, Pencil, Search, Loader2, BookOpen, Eye, Wallet, ShoppingBag, ClipboardList, AlertCircle, BarChart3, Truck, Building2, Coins, Sparkles, Printer, UserCheck } from "lucide-react";
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
  const empty: Supplier = {
    id: "",
    name: "",
    acNo: "1001",
    group: "SUPPLIER",
    mobile: "",
    phone: "",
    email: "",
    category: "Wholesale",
    gstNumber: "",
    pan: "",
    address: "",
    location: "",
    city: "",
    state: "",
    pin: "",
    country: "India",
    occupation: "",
    refBy: "",
    website: "",
    dob: "",
    anniversary: "",
    companyNo: "",
    taxNo: "",
    tcs: 0,
    tds: 0,
    uidNo: "",
    cstNo: "",
    note: "",
    openingBalanceGold: 0,
    openingBalanceGoldType: "Dr",
    openingBalanceSilver: 0,
    openingBalanceSilverType: "Dr",
    openingBalanceAmount: 0,
    openingBalanceAmountType: "Dr",
    openingBalanceDate: new Date().toISOString().slice(0, 10),
    outstanding: 0,
    balanceGold: 0,
    balanceSilver: 0,
    transactions: [],
  } as any;

  const [form, setForm] = useState<Supplier>(empty);
  const [formTab, setFormTab] = useState("acDetail");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useLocalState<string[]>("ajms.supplierCategories", ["Wholesale", "Manufacturer", "Distributor", "Bullion Dealer"]);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCat, setNewCat] = useState("");

  const save = async () => {
    if (!form.name?.trim()) {
      toast.error("Account / Supplier Name is required");
      return;
    }
    if (!form.mobile?.trim() && !(form as any).phone?.trim()) {
      toast.error("Mobile or Phone number is required");
      return;
    }

    // Compute net balances based on Opening Balances & Dr/Cr
    const goldMultiplier = form.openingBalanceGoldType === "Cr" ? -1 : 1;
    const silverMultiplier = form.openingBalanceSilverType === "Cr" ? -1 : 1;
    const amountMultiplier = form.openingBalanceAmountType === "Cr" ? -1 : 1;

    const goldBal = (Number(form.openingBalanceGold) || 0) * goldMultiplier;
    const silverBal = (Number(form.openingBalanceSilver) || 0) * silverMultiplier;
    const amountBal = (Number(form.openingBalanceAmount) || 0) * amountMultiplier;

    const payload: Supplier = {
      ...form,
      group: form.group || "SUPPLIER",
      category: form.category || "Wholesale",
      balanceGold: editingId ? form.balanceGold : goldBal,
      balanceSilver: editingId ? form.balanceSilver : silverBal,
      outstanding: editingId ? form.outstanding : amountBal,
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: payload });
        toast.success("Supplier account updated successfully");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Supplier account created successfully");
      }
      setForm(empty);
      setEditingId(null);
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save supplier");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this supplier account?")) return;
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
    (s.name || "").toLowerCase().includes(debouncedQ.toLowerCase()) ||
    (s.mobile || "").includes(debouncedQ) ||
    (s.companyNo || "").toLowerCase().includes(debouncedQ.toLowerCase()) ||
    (s.acNo || "").toLowerCase().includes(debouncedQ.toLowerCase())
  ).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const isLoading_UI = isLoading || createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const totalPages = Math.ceil(filtered.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  /* ---------------------------------------------------------------------- */
  /* Supplier Detail dialog (Dual Flow Ledger / Payments / Purchase History) */
  /* ---------------------------------------------------------------------- */
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const [detailTab, setDetailTab] = useState("unified");
  const [goldPage, setGoldPage] = useState(1);
  const [silverPage, setSilverPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [unifiedPage, setUnifiedPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [ordersPage, setOrdersPage] = useState(1);

  const [txSearchQuery, setTxSearchQuery] = useState("");
  const debouncedTxSearchQuery = useDebounce(txSearchQuery, 300);
  const [txSearchDate, setTxSearchDate] = useState<string>("");

  // Combined Dual Flow Form (Metal & Cash)
  const [dualForm, setDualForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    refNo: "",
    type: "Credit" as "Credit" | "Debit",
    goldWeight: 0,
    silverWeight: 0,
    amount: 0,
    note: ""
  });

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

  const openDetail = (s: Supplier, tab: string = "unified") => {
    setDetailSupplier(s);
    setDetailTab(tab);
    setGoldPage(1); setSilverPage(1); setPaymentPage(1); setUnifiedPage(1); setHistoryPage(1); setOrdersPage(1);
    setTxSearchQuery(""); setTxSearchDate("");
  };

  // Add Unified Flow Transaction (Metal + Amount)
  const addDualTransaction = async () => {
    if (!detailSupplier) return;
    if (!dualForm.goldWeight && !dualForm.silverWeight && !dualForm.amount) {
      toast.error("Please enter Gold Weight, Silver Weight, or Cash Amount.");
      return;
    }

    const multiplier = dualForm.type === "Credit" ? 1 : -1;

    const newTx: SupplierTransaction = {
      id: Date.now().toString(),
      date: dualForm.date,
      refNo: dualForm.refNo,
      type: dualForm.type,
      kind: "Dual",
      weight: Number(dualForm.goldWeight || dualForm.silverWeight) || 0,
      goldWeight: Number(dualForm.goldWeight) || 0,
      silverWeight: Number(dualForm.silverWeight) || 0,
      amount: Number(dualForm.amount) || 0,
      note: dualForm.note
    };

    const newBalanceGold = (detailSupplier.balanceGold || 0) + (newTx.goldWeight || 0) * multiplier;
    const newBalanceSilver = (detailSupplier.balanceSilver || 0) + (newTx.silverWeight || 0) * multiplier;
    const newOutstanding = (detailSupplier.outstanding || 0) + (newTx.amount || 0) * multiplier;

    const updatedSupplier = {
      ...detailSupplier,
      balanceGold: newBalanceGold,
      balanceSilver: newBalanceSilver,
      outstanding: newOutstanding,
      transactions: [...(detailSupplier.transactions || []), newTx]
    };

    try {
      const saved = await updateMutation.mutateAsync({ id: detailSupplier._id || detailSupplier.id || "", body: updatedSupplier });
      setDetailSupplier(saved || updatedSupplier);
      setDualForm({ date: new Date().toISOString().slice(0, 10), refNo: "", type: "Credit", goldWeight: 0, silverWeight: 0, amount: 0, note: "" });
      toast.success("Dual flow transaction recorded!");
    } catch (e) {
      toast.error("Failed to record transaction");
    }
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
    let newOutstanding = detailSupplier.outstanding || 0;

    if (txToDelete.kind === "Dual") {
      newBalanceGold += (txToDelete.goldWeight || 0) * multiplier;
      newBalanceSilver += (txToDelete.silverWeight || 0) * multiplier;
      newOutstanding += (txToDelete.amount || 0) * multiplier;
    } else {
      if (txToDelete.metal === "Gold") newBalanceGold += (txToDelete.weight || 0) * multiplier;
      if (txToDelete.metal === "Silver") newBalanceSilver += (txToDelete.weight || 0) * multiplier;
      if (txToDelete.kind === "Payment") newOutstanding += (txToDelete.amount || 0) * multiplier;
    }

    const updatedSupplier = {
      ...detailSupplier,
      balanceGold: newBalanceGold,
      balanceSilver: newBalanceSilver,
      outstanding: newOutstanding,
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

  const activeBillNumbers = useMemo(() => new Set(purchases.map((p: any) => p.billNo).filter(Boolean)), [purchases]);

  const isDocActive = (t: SupplierTransaction) => {
    if (!t.note) return true;
    const match = t.note.match(/(?:PUR|PO|PR)-\d+/i);
    if (match) {
      const billNo = match[0];
      return activeBillNumbers.has(billNo);
    }
    return true;
  };

  // Unified Transactions List for Credit/Debit Flow
  const unifiedTxList = useMemo(() => {
    if (!detailSupplier?.transactions) return [];
    let txs = detailSupplier.transactions.filter(isDocActive);
    if (debouncedTxSearchQuery) {
      const sq = debouncedTxSearchQuery.toLowerCase();
      txs = txs.filter(t =>
        t.type.toLowerCase().includes(sq) ||
        (t.note || "").toLowerCase().includes(sq) ||
        (t.refNo || "").toLowerCase().includes(sq) ||
        formatDate(t.date).toLowerCase().includes(sq)
      );
    }
    if (txSearchDate) txs = txs.filter(t => t.date === txSearchDate);
    return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [detailSupplier, debouncedTxSearchQuery, txSearchDate, activeBillNumbers]);

  const goldTx = useMemo(() => {
    if (!detailSupplier?.transactions) return [];
    let txs = detailSupplier.transactions.filter(t => (t.kind !== "Payment" && t.metal === "Gold") || (t.kind === "Dual" && t.goldWeight));
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
    let txs = detailSupplier.transactions.filter(t => (t.kind !== "Payment" && t.metal === "Silver") || (t.kind === "Dual" && t.silverWeight));
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
    return detailSupplier.transactions.filter(t => t.kind === "Payment" || (t.kind === "Dual" && t.amount)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [detailSupplier]);

  const totalUnifiedPages = Math.ceil(unifiedTxList.length / 10) || 1;
  const currentUnifiedPage = Math.min(unifiedPage, totalUnifiedPages);
  const paginatedUnifiedTx = unifiedTxList.slice((currentUnifiedPage - 1) * 10, currentUnifiedPage * 10);

  const totalGoldPages = Math.ceil(goldTx.length / 10) || 1;
  const currentGoldPage = Math.min(goldPage, totalGoldPages);
  const paginatedGoldTx = goldTx.slice((currentGoldPage - 1) * 10, currentGoldPage * 10);

  const totalSilverPages = Math.ceil(silverTx.length / 10) || 1;
  const currentSilverPage = Math.min(silverPage, totalSilverPages);
  const paginatedSilverTx = silverTx.slice((currentSilverPage - 1) * 10, currentSilverPage * 10);

  const totalPaymentPages = Math.ceil(paymentTx.length / 10) || 1;
  const currentPaymentPage = Math.min(paymentPage, totalPaymentPages);
  const paginatedPaymentTx = paymentTx.slice((currentPaymentPage - 1) * 10, currentPaymentPage * 10);

  // Purchase History & Orders
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
      {/* Header Banner */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900 border-b border-amber-900/30 p-6 rounded-2xl text-white shadow-lg mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Truck className="w-3.5 h-3.5" /> Bullion Vendor Directory
            </span>
            <span className="text-xs text-slate-300">{list.length} Suppliers Registered</span>
          </div>
          <h1 className="text-3xl font-display font-bold">Suppliers &amp; Bullion Ledgers</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Track bullion vendor accounts, fine gold/silver metal weights, cash balances &amp; dual credit/debit flows.
          </p>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md h-auto bg-muted/80 p-1 rounded-xl gap-1 border">
          <TabsTrigger value="master" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-amber-900 data-[state=active]:shadow-xs"><ShoppingBag className="w-3.5 h-3.5" />Master</TabsTrigger>
          <TabsTrigger value="outstanding" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-amber-900 data-[state=active]:shadow-xs"><AlertCircle className="w-3.5 h-3.5" />Outstanding</TabsTrigger>
          <TabsTrigger value="reports" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-amber-900 data-[state=active]:shadow-xs"><BarChart3 className="w-3.5 h-3.5" />Reports</TabsTrigger>
        </TabsList>

        {/* ==================================================================== */}
        {/* TAB: SUPPLIER MASTER */}
        {/* ==================================================================== */}
        <TabsContent value="master" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
            <Card className="border shadow-sm bg-card hover:shadow-md transition-all">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Suppliers</div>
                  <div className="text-2xl font-bold font-display text-indigo-600 mt-1">{list.length}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Active Vendors</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 grid place-items-center">
                  <Building2 className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm bg-card hover:shadow-md transition-all">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Gold Due</div>
                  <div className="text-2xl font-bold font-display text-amber-600 mt-1">{totalGoldDue.toFixed(3)} g</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Fine Gold Balance</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 grid place-items-center">
                  <Coins className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm bg-card hover:shadow-md transition-all">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Silver Due</div>
                  <div className="text-2xl font-bold font-display text-slate-700 dark:text-slate-300 mt-1">{totalSilverDue.toFixed(3)} g</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Fine Silver Balance</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 grid place-items-center">
                  <Sparkles className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm bg-card hover:shadow-md transition-all">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Cash Outstanding</div>
                  <div className="text-2xl font-bold font-display text-rose-600 mt-1">{inr(totalOutstanding)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Unpaid Cash Dues</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 grid place-items-center">
                  <Wallet className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col-reverse md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9 bg-background focus:bg-background transition-colors shadow-2xs rounded-lg border-slate-300 dark:border-slate-700" placeholder="Search by name, mobile, A/c No or company..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
            <div className="flex justify-end w-full md:w-auto">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button data-new-button="true" size="lg" className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-sm" onClick={() => { setForm(empty); setEditingId(null); setFormTab("acDetail"); }} disabled={isLoading_UI}>
                    <Plus className="w-4 h-4 mr-2" /> Add Supplier Account
                  </Button>
                </DialogTrigger>

                {/* DESKTOP ERP STYLE ACCOUNTS INFO DIALOG (FULL PAGE) */}
                <DialogContent className="fixed inset-0 z-[100] w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 top-0 left-0 rounded-none border-0 p-3 sm:p-5 bg-neutral-50 dark:bg-slate-950 flex flex-col overflow-y-auto shadow-none" onInteractOutside={(e) => e.preventDefault()} onKeyDown={handleKeyNav}>
                  <DialogHeader className="p-3.5 sm:p-4 bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-200 dark:border-slate-800 flex items-center justify-between pr-8">
                    <DialogTitle className="text-base sm:text-lg font-bold font-sans text-amber-950 dark:text-amber-100 uppercase tracking-wide flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <span>{editingId ? "Edit Accounts Info — Supplier Master" : "Accounts Info — New Supplier Master"}</span>
                    </DialogTitle>
                  </DialogHeader>

                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Top Control Section: Account Name, Group & A/c No */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-300 dark:border-slate-800 shadow-2xs">
                      <div className="sm:col-span-6">
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">Account Name *</Label>
                        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. SANMATI JEWELLERS" className="mt-1 font-bold text-sm bg-white dark:bg-slate-950 border-slate-300 focus:ring-amber-500" />
                      </div>
                      <div className="sm:col-span-3">
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">Group</Label>
                        <Input value={form.group || "SUPPLIER"} onChange={(e) => setForm({ ...form, group: e.target.value })} className="mt-1 font-bold text-xs uppercase bg-white dark:bg-slate-950 border-slate-300 focus:ring-amber-500" />
                      </div>
                      <div className="sm:col-span-3">
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">A/c No</Label>
                        <Input value={form.acNo || "1001"} onChange={(e) => setForm({ ...form, acNo: e.target.value })} className="mt-1 font-mono font-bold text-xs bg-white dark:bg-slate-950 border-slate-300 focus:ring-amber-500" />
                      </div>
                    </div>

                    {/* Main Body Grid: Left Tabbed Details & Right Opening Balance Card */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      {/* Left Column: Tabs */}
                      <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-3 shadow-2xs">
                        <Tabs value={formTab} onValueChange={setFormTab}>
                          <TabsList className="grid grid-cols-2 w-full mb-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-md">
                            <TabsTrigger value="acDetail" className="text-xs font-bold py-1.5">A/c &amp; Contact Details</TabsTrigger>
                            <TabsTrigger value="taxDetail" className="text-xs font-bold py-1.5">Tax &amp; Compliance Details</TabsTrigger>
                          </TabsList>

                          <TabsContent value="acDetail" className="space-y-3">
                            <div>
                              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Address *</Label>
                              <textarea
                                value={form.address || ""}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                placeholder="Shop / Building, Street Address, Landmark..."
                                rows={2}
                                className="w-full text-xs font-medium mt-1 p-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-amber-500 outline-none"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Location / Area</Label>
                                <Input value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Zaveri Bazar" className="h-8 text-xs mt-0.5" />
                              </div>
                              <div>
                                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">City</Label>
                                <Input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Mumbai" className="h-8 text-xs mt-0.5" />
                              </div>
                              <div>
                                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">State</Label>
                                <Input value={form.state || ""} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Maharashtra" className="h-8 text-xs mt-0.5" />
                              </div>
                              <div>
                                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Pincode</Label>
                                <Input value={form.pin || ""} onChange={(e) => setForm({ ...form, pin: e.target.value })} placeholder="400002" className="h-8 text-xs mt-0.5 font-mono" />
                              </div>
                              <div>
                                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Mobile No *</Label>
                                <Input value={form.mobile || ""} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="9876543210" className="h-8 text-xs mt-0.5 font-mono" />
                              </div>
                              <div>
                                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Landline Phone</Label>
                                <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="022-23456789" className="h-8 text-xs mt-0.5 font-mono" />
                              </div>
                              <div>
                                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Email ID</Label>
                                <Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="supplier@bullion.com" className="h-8 text-xs mt-0.5" />
                              </div>
                              <div>
                                <div className="flex items-center justify-between">
                                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Category</Label>
                                  <Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
                                    <DialogTrigger asChild>
                                      <button className="text-[10px] text-amber-700 hover:underline font-bold">+ Add</button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-xs" onInteractOutside={(e) => e.preventDefault()}>
                                      <DialogHeader>
                                        <DialogTitle className="text-sm font-bold">Add Category</DialogTitle>
                                      </DialogHeader>
                                      <div className="py-2">
                                        <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category name" autoFocus className="h-8 text-xs" />
                                      </div>
                                      <DialogFooter>
                                        <Button size="sm" variant="outline" onClick={() => setAddCatOpen(false)}>Cancel</Button>
                                        <Button size="sm" onClick={addCategory} className="bg-amber-600 hover:bg-amber-700 text-white">Add</Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                                <Select value={form.category || "Wholesale"} onValueChange={(v) => setForm({ ...form, category: v })}>
                                  <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {categories.map((c) => (
                                      <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </TabsContent>

                          <TabsContent value="taxDetail" className="space-y-3">
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">GSTIN (B2B)</Label>
                                <Input value={form.gstNumber || ""} onChange={(e) => setForm({ ...form, gstNumber: e.target.value.toUpperCase() })} placeholder="27AAAAA0000A1Z5" className="h-8 text-xs font-mono uppercase mt-0.5" />
                              </div>
                              <div>
                                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">PAN No (Bullion HUID)</Label>
                                <Input value={form.pan || ""} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" className="h-8 text-xs font-mono uppercase mt-0.5" />
                              </div>
                              <div>
                                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Tax No</Label>
                                <Input value={form.taxNo || ""} onChange={(e) => setForm({ ...form, taxNo: e.target.value })} placeholder="Tax Reg No" className="h-8 text-xs mt-0.5" />
                              </div>
                              <div>
                                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">UID / Aadhaar</Label>
                                <Input value={form.uidNo || ""} onChange={(e) => setForm({ ...form, uidNo: e.target.value })} placeholder="12 Digit UID" className="h-8 text-xs font-mono mt-0.5" />
                              </div>
                              <div>
                                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">TCS (%)</Label>
                                <Input type="number" step="0.01" value={form.tcs || ""} onChange={(e) => setForm({ ...form, tcs: Number(e.target.value) })} placeholder="0.10" className="h-8 text-xs font-mono mt-0.5" />
                              </div>
                              <div>
                                <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">TDS (%)</Label>
                                <Input type="number" step="0.01" value={form.tds || ""} onChange={(e) => setForm({ ...form, tds: Number(e.target.value) })} placeholder="0.10" className="h-8 text-xs font-mono mt-0.5" />
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>

                      {/* Right Column: Opening Balance Box (Desktop ERP exact replica) */}
                      <div className="lg:col-span-5 bg-amber-500/10 dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-900/60 rounded-lg p-4 font-mono shadow-2xs flex flex-col justify-between">
                        <div>
                          <div className="text-xs font-black uppercase text-amber-950 dark:text-amber-200 border-b border-amber-300 pb-1.5 mb-3 flex items-center justify-between">
                            <span>Opening Balance</span>
                            <span className="text-[10px] text-amber-800 dark:text-amber-400 font-sans">Metal &amp; Cash</span>
                          </div>

                          <div className="space-y-3 text-xs">
                            {/* Gold Fine */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-amber-900 dark:text-amber-300 w-24">Gold Fine (g):</span>
                              <Input
                                type="number"
                                step="0.001"
                                value={form.openingBalanceGold || ""}
                                onChange={(e) => setForm({ ...form, openingBalanceGold: Number(e.target.value) })}
                                placeholder="0.000"
                                className="h-8 w-24 text-right font-mono font-bold bg-white dark:bg-slate-950 border-amber-300"
                              />
                              <div className="flex items-center gap-1 font-sans bg-white dark:bg-slate-950 border border-amber-300 p-0.5 rounded text-[11px]">
                                <label className="flex items-center gap-0.5 px-1 cursor-pointer font-bold">
                                  <input type="radio" name="goldDrCr" checked={form.openingBalanceGoldType !== "Cr"} onChange={() => setForm({ ...form, openingBalanceGoldType: "Dr" })} /> Dr
                                </label>
                                <label className="flex items-center gap-0.5 px-1 cursor-pointer font-bold text-rose-700">
                                  <input type="radio" name="goldDrCr" checked={form.openingBalanceGoldType === "Cr"} onChange={() => setForm({ ...form, openingBalanceGoldType: "Cr" })} /> Cr
                                </label>
                              </div>
                            </div>

                            {/* Silver Fine */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-800 dark:text-slate-300 w-24">Silver Fine (g):</span>
                              <Input
                                type="number"
                                step="0.001"
                                value={form.openingBalanceSilver || ""}
                                onChange={(e) => setForm({ ...form, openingBalanceSilver: Number(e.target.value) })}
                                placeholder="0.000"
                                className="h-8 w-24 text-right font-mono font-bold bg-white dark:bg-slate-950 border-amber-300"
                              />
                              <div className="flex items-center gap-1 font-sans bg-white dark:bg-slate-950 border border-amber-300 p-0.5 rounded text-[11px]">
                                <label className="flex items-center gap-0.5 px-1 cursor-pointer font-bold">
                                  <input type="radio" name="silverDrCr" checked={form.openingBalanceSilverType !== "Cr"} onChange={() => setForm({ ...form, openingBalanceSilverType: "Dr" })} /> Dr
                                </label>
                                <label className="flex items-center gap-0.5 px-1 cursor-pointer font-bold text-rose-700">
                                  <input type="radio" name="silverDrCr" checked={form.openingBalanceSilverType === "Cr"} onChange={() => setForm({ ...form, openingBalanceSilverType: "Cr" })} /> Cr
                                </label>
                              </div>
                            </div>

                            {/* Cash Amount */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-rose-900 dark:text-rose-300 w-24">Amount (₹):</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={form.openingBalanceAmount || ""}
                                onChange={(e) => setForm({ ...form, openingBalanceAmount: Number(e.target.value) })}
                                placeholder="0.00"
                                className="h-8 w-24 text-right font-mono font-bold bg-white dark:bg-slate-950 border-amber-300"
                              />
                              <div className="flex items-center gap-1 font-sans bg-white dark:bg-slate-950 border border-amber-300 p-0.5 rounded text-[11px]">
                                <label className="flex items-center gap-0.5 px-1 cursor-pointer font-bold">
                                  <input type="radio" name="amountDrCr" checked={form.openingBalanceAmountType !== "Cr"} onChange={() => setForm({ ...form, openingBalanceAmountType: "Dr" })} /> Dr
                                </label>
                                <label className="flex items-center gap-0.5 px-1 cursor-pointer font-bold text-rose-700">
                                  <input type="radio" name="amountDrCr" checked={form.openingBalanceAmountType === "Cr"} onChange={() => setForm({ ...form, openingBalanceAmountType: "Cr" })} /> Cr
                                </label>
                              </div>
                            </div>

                            {/* Bal Date */}
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-amber-300">
                              <span className="font-bold text-slate-800 dark:text-slate-300 w-24">Bal Date:</span>
                              <Input
                                type="date"
                                value={form.openingBalanceDate || ""}
                                onChange={(e) => setForm({ ...form, openingBalanceDate: e.target.value })}
                                className="h-8 w-44 font-mono font-bold text-xs bg-white dark:bg-slate-950 border-amber-300"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-amber-300 text-[11px] text-amber-900 dark:text-amber-200 font-sans">
                          <strong>Note:</strong> Dr = Metal/Amount We Owe to Supplier. Cr = Metal/Amount Paid or Advance.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ERP Footer Action Toolbar */}
                  <DialogFooter className="p-3.5 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => window.print()} className="h-9 text-xs gap-1 bg-white border-slate-300">
                        <Printer className="w-3.5 h-3.5" /> Print
                      </Button>
                      <Button variant="outline" onClick={() => { setForm(empty); setEditingId(null); }} className="h-9 text-xs bg-white border-slate-300">
                        New
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading_UI} className="h-9 text-xs bg-white border-slate-300">
                        Cancel
                      </Button>
                      <Button onClick={save} disabled={isLoading_UI || !form.name} className="h-9 px-6 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase shadow-sm">
                        {isLoading_UI ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Supplier"}
                      </Button>
                    </div>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card className="border shadow-sm overflow-hidden bg-card">
            <CardContent className="p-0">
              {isLoading ? <p className="text-center text-muted-foreground py-12">Loading suppliers...</p> : error ? <p className="text-center text-red-500 py-12">Failed to load suppliers</p> : filtered.length === 0 ? <p className="text-center text-muted-foreground py-12">No suppliers yet.</p> : (
                <div>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto max-h-[600px] relative">
                    <table className="w-full text-sm min-w-[950px] border-collapse">
                      <thead className="text-left text-xs font-bold uppercase tracking-wider sticky top-0 bg-slate-900 text-slate-200 z-10 shadow-sm">
                        <tr>
                          <th className="p-3.5 pl-5 whitespace-nowrap">Supplier Name</th>
                          <th className="p-3.5 whitespace-nowrap">A/c No / Mobile</th>
                          <th className="p-3.5 whitespace-nowrap">Group / Category</th>
                          <th className="p-3.5 text-right whitespace-nowrap">Gold Fine (g)</th>
                          <th className="p-3.5 text-right whitespace-nowrap">Silver Fine (g)</th>
                          <th className="p-3.5 text-right whitespace-nowrap">Outstanding (₹)</th>
                          <th className="p-3.5 text-right pr-5 whitespace-nowrap w-40">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 bg-card">
                        {paginated.map((s, idx) => {
                          const initials = (s.name || "S").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                          const colors = ["bg-amber-600", "bg-indigo-600", "bg-emerald-600", "bg-purple-600", "bg-blue-600"];
                          const avatarBg = colors[idx % colors.length];

                          return (
                            <tr key={s._id || s.id} className="group hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-all">
                              <td className="p-3.5 pl-5">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full ${avatarBg} text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0`}>
                                    {initials}
                                  </div>
                                  <div>
                                    <div className="font-bold text-foreground text-sm group-hover:text-amber-900 dark:group-hover:text-amber-300 transition-colors">{s.name}</div>
                                    {(s as any).address && <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-[200px]">{(s as any).address}</div>}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                                <div>A/c: <span className="font-bold">{s.acNo || "1001"}</span></div>
                                <div>{s.mobile}</div>
                              </td>
                              <td className="p-3.5">
                                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-2xs">
                                  {s.category || "Wholesale"}
                                </Badge>
                              </td>
                              <td className="p-3.5 text-right">
                                <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-3 py-1 font-mono font-bold text-xs rounded-full shadow-2xs">
                                  {(s.balanceGold || 0).toFixed(3)} g
                                </span>
                              </td>
                              <td className="p-3.5 text-right">
                                <span className="inline-flex items-center gap-1 bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-400/30 px-3 py-1 font-mono font-bold text-xs rounded-full shadow-2xs">
                                  {(s.balanceSilver || 0).toFixed(3)} g
                                </span>
                              </td>
                              <td className="p-3.5 text-right">
                                <span className={`inline-flex items-center gap-1 px-3 py-1 font-mono font-bold text-xs rounded-full shadow-2xs ${
                                  (s.outstanding || 0) > 0 
                                    ? "bg-rose-500/10 text-rose-700 border border-rose-500/30" 
                                    : (s.outstanding || 0) < 0 
                                    ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30" 
                                    : "bg-muted text-muted-foreground border border-border"
                                }`}>
                                  {inr(s.outstanding || 0)}
                                </span>
                              </td>
                              <td className="p-3.5 text-right pr-5">
                                <div className="flex gap-1.5 justify-end">
                                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-amber-400 text-amber-900 bg-amber-50/50 hover:bg-amber-100 font-semibold shadow-2xs" onClick={() => openDetail(s, "unified")}>
                                    <BookOpen className="w-3.5 h-3.5 text-amber-700" /> Ledger
                                  </Button>
                                  <Button size="icon" variant="outline" className="h-8 w-8 text-slate-700 hover:bg-slate-100" onClick={() => { setForm(s); setEditingId(s._id || null); setOpen(true); }} disabled={isLoading_UI} title="Edit Supplier Account">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button size="icon" variant="outline" className="h-8 w-8 border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => remove(s._id || "")} disabled={isLoading_UI} title="Delete Supplier Account">
                                    <Trash2 className="w-3.5 h-3.5" />
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
                    {paginated.map(s => (
                      <div key={s._id} className="p-3.5 rounded-xl border border-border bg-card shadow-sm space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-base text-foreground">{s.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">A/c: {s.acNo || "1001"} · {s.mobile}</div>
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
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => openDetail(s, "unified")}>
                            <Eye className="w-3.5 h-3.5 text-amber-600" /> Ledger
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
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB: OUTSTANDING */}
        {/* ==================================================================== */}
        <TabsContent value="outstanding" className="space-y-6">
          <Card className="border shadow-sm overflow-hidden bg-card">
            <CardHeader className="bg-amber-500/10 dark:bg-amber-950/40 p-4 border-b border-amber-200">
              <CardTitle className="text-base font-bold text-amber-950 dark:text-amber-100 flex items-center justify-between">
                <span>Supplier Outstanding Summary</span>
                <span className="text-xs font-mono font-normal">Active Dues: {suppliersWithDues.length} Suppliers</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {suppliersWithDues.length === 0 ? <p className="text-center text-muted-foreground py-12">No outstanding supplier dues.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[800px] border-collapse">
                    <thead className="bg-slate-900 text-slate-200 text-xs font-bold uppercase">
                      <tr>
                        <th className="p-3.5 pl-5">Supplier</th>
                        <th className="p-3.5">Category</th>
                        <th className="p-3.5 text-right">Gold Due (g)</th>
                        <th className="p-3.5 text-right">Silver Due (g)</th>
                        <th className="p-3.5 text-right">Cash Outstanding</th>
                        <th className="p-3.5 text-right pr-5">Quick Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 bg-card">
                      {suppliersWithDues.map((s: any, idx: number) => {
                        const initials = (s.name || "S").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                        const colors = ["bg-amber-600", "bg-indigo-600", "bg-emerald-600", "bg-purple-600", "bg-blue-600"];
                        const avatarBg = colors[idx % colors.length];

                        return (
                          <tr key={s._id || s.id} className="group hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-all">
                            <td className="p-3.5 pl-5">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full ${avatarBg} text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0`}>
                                  {initials}
                                </div>
                                <div>
                                  <div className="font-bold text-foreground text-sm">{s.name}</div>
                                  <div className="text-[11px] text-muted-foreground font-mono">{s.mobile}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3.5">
                              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-300 text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-2xs">
                                {s.category || "—"}
                              </Badge>
                            </td>
                            <td className="p-3.5 text-right">
                              <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-3 py-1 font-mono font-bold text-xs rounded-full shadow-2xs">
                                {(s.balanceGold || 0).toFixed(3)} g
                              </span>
                            </td>
                            <td className="p-3.5 text-right">
                              <span className="inline-flex items-center gap-1 bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-400/30 px-3 py-1 font-mono font-bold text-xs rounded-full shadow-2xs">
                                {(s.balanceSilver || 0).toFixed(3)} g
                              </span>
                            </td>
                            <td className="p-3.5 text-right">
                              <span className={`inline-flex items-center gap-1 px-3 py-1 font-mono font-bold text-xs rounded-full shadow-2xs ${
                                (s.outstanding || 0) > 0 
                                  ? "bg-rose-500/10 text-rose-700 border border-rose-500/30" 
                                  : (s.outstanding || 0) < 0 
                                  ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30" 
                                  : "bg-muted text-muted-foreground border border-border"
                              }`}>
                                {inr(s.outstanding || 0)}
                              </span>
                            </td>
                            <td className="p-3.5 text-right pr-5">
                              <Button size="sm" className="h-8 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-2xs" onClick={() => openDetail(s, "unified")}>
                                <Wallet className="w-3.5 h-3.5" /> Ledger &amp; Pay
                              </Button>
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
                      <Bar dataKey="value" fill="#d97706" radius={[4, 4, 0, 0]} />
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
      {/* Supplier Detail Dialog (Dual Metal & Cash Flow Master Ledger FULL PAGE) */}
      {/* ==================================================================== */}
      <Dialog open={!!detailSupplier} onOpenChange={(v) => { if (!v) setDetailSupplier(null); }}>
        <DialogContent className="fixed inset-0 z-[100] w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 top-0 left-0 rounded-none border-0 p-3 sm:p-5 bg-neutral-50 dark:bg-slate-950 flex flex-col overflow-y-auto shadow-none" aria-describedby={undefined} onInteractOutside={(e) => e.preventDefault()}>
          {detailSupplier && (
            <>
              <DialogHeader className="p-3.5 sm:p-4 bg-amber-500/10 dark:bg-amber-950/40 border-b border-amber-200 dark:border-slate-800 flex items-center justify-between pr-8">
                <DialogTitle className="text-base sm:text-xl font-bold font-sans text-amber-950 dark:text-amber-100 flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-amber-600" /> {detailSupplier.name}
                  <span className="text-xs font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-amber-300">A/c: {detailSupplier.acNo || "1001"}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-amber-900/80 dark:text-amber-300">
                  Comprehensive Dual Metal &amp; Cash Flow Ledger, Purchase History &amp; Orders.
                </DialogDescription>
              </DialogHeader>

              <div className="p-4 sm:p-5 space-y-4">
                {/* 3 Live Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Card className="bg-amber-500/10 border-amber-300 dark:border-amber-900/60 shadow-2xs">
                    <CardContent className="p-3.5">
                      <div className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase">Gold Fine Balance</div>
                      <div className="text-2xl font-black font-mono text-amber-600 mt-1">{(detailSupplier.balanceGold || 0).toFixed(3)} g</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-500/10 border-slate-300 dark:border-slate-700 shadow-2xs">
                    <CardContent className="p-3.5">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase">Silver Fine Balance</div>
                      <div className="text-2xl font-black font-mono text-slate-700 dark:text-slate-200 mt-1">{(detailSupplier.balanceSilver || 0).toFixed(3)} g</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-rose-500/10 border-rose-300 dark:border-rose-900/60 shadow-2xs">
                    <CardContent className="p-3.5">
                      <div className="text-xs font-bold text-rose-900 dark:text-rose-300 uppercase">Cash Outstanding</div>
                      <div className="text-2xl font-black font-mono text-rose-600 mt-1">{inr(detailSupplier.outstanding || 0)}</div>
                    </CardContent>
                  </Card>
                </div>

                <Tabs value={detailTab} onValueChange={setDetailTab}>
                  <TabsList className="grid grid-cols-2 sm:grid-cols-6 w-full h-auto bg-slate-200 dark:bg-slate-900 p-1 rounded-xl gap-1 mb-4">
                    <TabsTrigger value="unified" className="text-xs font-bold py-2 rounded-lg flex items-center gap-1.5 data-[state=active]:bg-amber-600 data-[state=active]:text-white"><BookOpen className="w-3.5 h-3.5" />Master Dual Flow</TabsTrigger>
                    <TabsTrigger value="ledger" className="text-xs font-bold py-2 rounded-lg flex items-center gap-1.5"><Coins className="w-3.5 h-3.5" />Gold Ledger</TabsTrigger>
                    <TabsTrigger value="silver" className="text-xs font-bold py-2 rounded-lg flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />Silver Ledger</TabsTrigger>
                    <TabsTrigger value="payments" className="text-xs font-bold py-2 rounded-lg flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" />Payments (₹)</TabsTrigger>
                    <TabsTrigger value="history" className="text-xs font-bold py-2 rounded-lg flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5" />Purchases</TabsTrigger>
                    <TabsTrigger value="orders" className="text-xs font-bold py-2 rounded-lg flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" />Orders</TabsTrigger>
                  </TabsList>

                  {/* -------------------------- UNIFIED MASTER DUAL FLOW LEDGER -------------------------- */}
                  <TabsContent value="unified" className="space-y-4">
                    {/* Add Combined Dual Flow Form */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-300 dark:border-amber-900/60 shadow-2xs space-y-3">
                      <div className="text-xs font-black text-amber-950 dark:text-amber-200 uppercase tracking-wide flex items-center gap-2">
                        <Plus className="w-4 h-4 text-amber-600" />
                        <span>Record Dual Credit / Debit Transaction (Metal &amp; Amount)</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-12 gap-2.5 items-end">
                        <div className="sm:col-span-2">
                          <Label className="text-[11px] font-bold uppercase">Date</Label>
                          <Input type="date" value={dualForm.date} onChange={e => setDualForm({ ...dualForm, date: e.target.value })} className="h-8 text-xs font-mono bg-white dark:bg-slate-950" />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-[11px] font-bold uppercase">Ref / Bill No</Label>
                          <Input value={dualForm.refNo} onChange={e => setDualForm({ ...dualForm, refNo: e.target.value })} placeholder="PO-1002" className="h-8 text-xs font-mono uppercase bg-white dark:bg-slate-950" />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-[11px] font-bold uppercase">Flow Type</Label>
                          <Select value={dualForm.type} onValueChange={(v: any) => setDualForm({ ...dualForm, type: v })}>
                            <SelectTrigger className="h-8 text-xs font-bold bg-white dark:bg-slate-950"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Credit" className="font-bold text-amber-800">Credit (+ We Owe)</SelectItem>
                              <SelectItem value="Debit" className="font-bold text-rose-700">Debit (- We Paid)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase">Gold Fine (g)</Label>
                          <Input type="number" step="0.001" value={dualForm.goldWeight || ""} onChange={e => setDualForm({ ...dualForm, goldWeight: Number(e.target.value) })} placeholder="0.000" className="h-8 text-xs font-mono font-bold bg-white dark:bg-slate-950 border-amber-300" />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">Silver Fine (g)</Label>
                          <Input type="number" step="0.001" value={dualForm.silverWeight || ""} onChange={e => setDualForm({ ...dualForm, silverWeight: Number(e.target.value) })} placeholder="0.000" className="h-8 text-xs font-mono font-bold bg-white dark:bg-slate-950 border-slate-300" />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase">Cash Amount (₹)</Label>
                          <Input type="number" step="0.01" value={dualForm.amount || ""} onChange={e => setDualForm({ ...dualForm, amount: Number(e.target.value) })} placeholder="0.00" className="h-8 text-xs font-mono font-bold bg-white dark:bg-slate-950 border-rose-300" />
                        </div>
                        <div className="sm:col-span-10">
                          <Label className="text-[11px] font-bold uppercase">Particulars / Note</Label>
                          <Input value={dualForm.note} onChange={e => setDualForm({ ...dualForm, note: e.target.value })} placeholder="Transaction particulars..." className="h-8 text-xs bg-white dark:bg-slate-950" />
                        </div>
                        <div className="sm:col-span-2">
                          <Button onClick={addDualTransaction} disabled={updateMutation.isPending} className="h-8 w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase shadow-sm">
                            Add Flow
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Master Dual Flow Table */}
                    <Card className="border border-slate-300 dark:border-slate-800 overflow-hidden shadow-2xs">
                      <CardHeader className="bg-slate-100 dark:bg-slate-900 py-3 border-b border-slate-300 flex items-center justify-between">
                        <CardTitle className="text-sm font-bold text-slate-900 dark:text-white uppercase flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-amber-600" /> Master Credit &amp; Debit Ledger (Metal &amp; Amount Flow)
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs font-mono border-collapse min-w-[900px]">
                            <thead className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 uppercase font-black border-b border-slate-300">
                              <tr>
                                <th className="p-2.5 border border-slate-300 dark:border-slate-700 text-left">Date / Ref</th>
                                <th className="p-2.5 border border-slate-300 dark:border-slate-700 text-left">Particulars</th>
                                <th className="p-2.5 border border-slate-300 dark:border-slate-700 text-center">Type</th>
                                <th className="p-2.5 border border-slate-300 dark:border-slate-700 text-right bg-amber-100/60 dark:bg-amber-950/40 text-amber-950">Gold Fine (g)</th>
                                <th className="p-2.5 border border-slate-300 dark:border-slate-700 text-right bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100">Silver Fine (g)</th>
                                <th className="p-2.5 border border-slate-300 dark:border-slate-700 text-right bg-rose-100/60 dark:bg-rose-950/40 text-rose-950">Cash Amount (₹)</th>
                                <th className="p-2.5 border border-slate-300 dark:border-slate-700 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-950">
                              {paginatedUnifiedTx.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground font-sans">No transactions in master flow ledger.</td></tr>
                              ) : (
                                paginatedUnifiedTx.map((tx, idx) => (
                                  <tr key={tx._id || tx.id || idx} className="hover:bg-amber-50/40 dark:hover:bg-slate-800/40 transition-colors">
                                    <td className="p-2 border border-slate-300 dark:border-slate-700 font-bold whitespace-nowrap">
                                      <div>{formatDate(tx.date)}</div>
                                      {tx.refNo && <div className="text-[10px] text-amber-800 dark:text-amber-400 font-semibold">{tx.refNo}</div>}
                                    </td>
                                    <td className="p-2 border border-slate-300 dark:border-slate-700 font-sans">
                                      <div className="font-semibold text-slate-900 dark:text-slate-100">{tx.note || "Voucher Transaction"}</div>
                                      {tx.purity && <span className="text-[10px] text-muted-foreground">Purity: {tx.purity}</span>}
                                    </td>
                                    <td className="p-2 border border-slate-300 dark:border-slate-700 text-center font-bold">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${tx.type === "Credit" ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-rose-100 text-rose-800 border border-rose-300"}`}>
                                        {tx.type === "Credit" ? "Cr (+)" : "Dr (-)"}
                                      </span>
                                    </td>
                                    <td className="p-2 border border-slate-300 dark:border-slate-700 text-right font-black text-amber-700 dark:text-amber-400">
                                      {(tx.goldWeight || (tx.metal === "Gold" ? tx.weight : 0) || 0) > 0 ? `${(tx.goldWeight || tx.weight || 0).toFixed(3)} g` : "—"}
                                    </td>
                                    <td className="p-2 border border-slate-300 dark:border-slate-700 text-right font-black text-slate-700 dark:text-slate-300">
                                      {(tx.silverWeight || (tx.metal === "Silver" ? tx.weight : 0) || 0) > 0 ? `${(tx.silverWeight || tx.weight || 0).toFixed(3)} g` : "—"}
                                    </td>
                                    <td className="p-2 border border-slate-300 dark:border-slate-700 text-right font-black text-rose-700 dark:text-rose-400">
                                      {(tx.amount || 0) > 0 ? inr(tx.amount || 0) : "—"}
                                    </td>
                                    <td className="p-2 border border-slate-300 dark:border-slate-700 text-center">
                                      <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => deleteTransaction(tx.id || tx._id || "")} title="Delete Flow Record">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {totalUnifiedPages > 1 && (
                          <div className="flex items-center justify-between p-3 bg-slate-100 border-t border-slate-300">
                            <span className="text-xs font-semibold text-slate-700">Page {currentUnifiedPage} of {totalUnifiedPages}</span>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setUnifiedPage(p => Math.max(1, p - 1))} disabled={currentUnifiedPage === 1}>Prev</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setUnifiedPage(p => Math.min(totalUnifiedPages, p + 1))} disabled={currentUnifiedPage === totalUnifiedPages}>Next</Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* -------------------------- Gold Ledger Tab -------------------------- */}
                  <TabsContent value="ledger" className="space-y-4">
                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-300 shadow-2xs">
                      <h3 className="font-bold text-xs uppercase mb-2">Record Gold Weight Flow</h3>
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 items-end">
                        <div>
                          <Label className="text-[11px] uppercase font-bold">Type</Label>
                          <Select value={txForm.type} onValueChange={(v: any) => setTxForm({ ...txForm, type: v })}>
                            <SelectTrigger className="h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Credit">Credit (+ We Owe)</SelectItem>
                              <SelectItem value="Debit">Debit (- We Paid)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[11px] uppercase font-bold">Purity</Label>
                          <Input value={txForm.purity} onChange={e => setTxForm({ ...txForm, purity: e.target.value })} placeholder="22K" className="h-8 text-xs font-bold" />
                        </div>
                        <div>
                          <Label className="text-[11px] uppercase font-bold">Weight (g)</Label>
                          <Input type="number" step="0.001" value={txForm.weight || ""} onChange={e => setTxForm({ ...txForm, weight: Number(e.target.value) })} placeholder="0.000" className="h-8 text-xs font-mono font-bold" />
                        </div>
                        <div>
                          <Label className="text-[11px] uppercase font-bold">Date</Label>
                          <Input type="date" value={txForm.date} onChange={e => setTxForm({ ...txForm, date: e.target.value })} className="h-8 text-xs font-mono" />
                        </div>
                        <div className="col-span-2 md:col-span-2 flex gap-2">
                          <Input value={txForm.note} onChange={e => setTxForm({ ...txForm, note: e.target.value })} placeholder="Remarks..." className="h-8 text-xs flex-1" />
                          <Button onClick={addTransaction} disabled={updateMutation.isPending || !txForm.weight} className="h-8 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase">
                            Add Gold
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Card className="border border-slate-300 overflow-hidden shadow-2xs">
                      <CardHeader className="bg-amber-500/10 py-2.5 border-b border-amber-200">
                        <CardTitle className="text-xs font-black uppercase text-amber-950 flex items-center justify-between">
                          <span>Gold Weight Ledger</span>
                          <span className="font-mono">Total: {(detailSupplier.balanceGold || 0).toFixed(3)} g</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <table className="w-full text-xs font-mono">
                          <thead className="bg-slate-100 border-b border-slate-300 text-left font-bold uppercase">
                            <tr><th className="p-2">Date</th><th className="p-2">Details</th><th className="p-2 text-center">Type</th><th className="p-2 text-right">Weight (g)</th><th className="p-2 text-center">Action</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {paginatedGoldTx.length === 0 ? <tr><td colSpan={5} className="text-center py-6 text-muted-foreground font-sans">No Gold weight records.</td></tr> : paginatedGoldTx.map((tx, i) => (
                              <tr key={tx._id || tx.id || i} className="hover:bg-amber-50/40">
                                <td className="p-2 font-bold">{formatDate(tx.date)}</td>
                                <td className="p-2 font-sans">{tx.purity || "22K"} · {tx.note || "Gold Flow"}</td>
                                <td className="p-2 text-center font-bold">{tx.type}</td>
                                <td className="p-2 text-right font-black text-amber-700">{(tx.goldWeight || tx.weight || 0).toFixed(3)} g</td>
                                <td className="p-2 text-center"><Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-rose-600" onClick={() => deleteTransaction(tx.id || tx._id || "")}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* -------------------------- Silver Ledger Tab -------------------------- */}
                  <TabsContent value="silver" className="space-y-4">
                    <Card className="border border-slate-300 overflow-hidden shadow-2xs">
                      <CardHeader className="bg-slate-200 py-2.5 border-b border-slate-300">
                        <CardTitle className="text-xs font-black uppercase text-slate-900 flex items-center justify-between">
                          <span>Silver Weight Ledger</span>
                          <span className="font-mono">Total: {(detailSupplier.balanceSilver || 0).toFixed(3)} g</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <table className="w-full text-xs font-mono">
                          <thead className="bg-slate-100 border-b border-slate-300 text-left font-bold uppercase">
                            <tr><th className="p-2">Date</th><th className="p-2">Details</th><th className="p-2 text-center">Type</th><th className="p-2 text-right">Weight (g)</th><th className="p-2 text-center">Action</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {paginatedSilverTx.length === 0 ? <tr><td colSpan={5} className="text-center py-6 text-muted-foreground font-sans">No Silver weight records.</td></tr> : paginatedSilverTx.map((tx, i) => (
                              <tr key={tx._id || tx.id || i} className="hover:bg-slate-100">
                                <td className="p-2 font-bold">{formatDate(tx.date)}</td>
                                <td className="p-2 font-sans">{tx.note || "Silver Flow"}</td>
                                <td className="p-2 text-center font-bold">{tx.type}</td>
                                <td className="p-2 text-right font-black text-slate-700">{(tx.silverWeight || tx.weight || 0).toFixed(3)} g</td>
                                <td className="p-2 text-center"><Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-rose-600" onClick={() => deleteTransaction(tx.id || tx._id || "")}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* -------------------------- Payments Tab -------------------------- */}
                  <TabsContent value="payments" className="space-y-4">
                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-300 shadow-2xs">
                      <h3 className="font-bold text-xs uppercase mb-2">Record Cash / Bank Payment</h3>
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 items-end">
                        <div>
                          <Label className="text-[11px] uppercase font-bold">Type</Label>
                          <Select value={paymentForm.type} onValueChange={(v: any) => setPaymentForm({ ...paymentForm, type: v })}>
                            <SelectTrigger className="h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Credit">Credit (+ We Owe)</SelectItem>
                              <SelectItem value="Debit">Debit (- Paid Cash)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[11px] uppercase font-bold">Amount (₹)</Label>
                          <Input type="number" step="0.01" value={paymentForm.amount || ""} onChange={e => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} placeholder="0.00" className="h-8 text-xs font-mono font-bold" />
                        </div>
                        <div>
                          <Label className="text-[11px] uppercase font-bold">Mode</Label>
                          <Select value={paymentForm.paymentMode} onValueChange={v => setPaymentForm({ ...paymentForm, paymentMode: v })}>
                            <SelectTrigger className="h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Cash">Cash</SelectItem>
                              <SelectItem value="UPI">UPI / GPay</SelectItem>
                              <SelectItem value="NEFT">NEFT / Bank</SelectItem>
                              <SelectItem value="Cheque">Cheque</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[11px] uppercase font-bold">Date</Label>
                          <Input type="date" value={paymentForm.date} onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })} className="h-8 text-xs font-mono" />
                        </div>
                        <div className="col-span-2 md:col-span-2 flex gap-2">
                          <Input value={paymentForm.note} onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })} placeholder="Remarks..." className="h-8 text-xs flex-1" />
                          <Button onClick={addPayment} disabled={updateMutation.isPending || !paymentForm.amount} className="h-8 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase">
                            Pay
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Card className="border border-slate-300 overflow-hidden shadow-2xs">
                      <CardHeader className="bg-rose-500/10 py-2.5 border-b border-rose-200">
                        <CardTitle className="text-xs font-black uppercase text-rose-950 flex items-center justify-between">
                          <span>Cash Payment Ledger</span>
                          <span className="font-mono">Outstanding: {inr(detailSupplier.outstanding || 0)}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <table className="w-full text-xs font-mono">
                          <thead className="bg-slate-100 border-b border-slate-300 text-left font-bold uppercase">
                            <tr><th className="p-2">Date</th><th className="p-2">Mode &amp; Details</th><th className="p-2 text-center">Type</th><th className="p-2 text-right">Amount (₹)</th><th className="p-2 text-center">Action</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {paginatedPaymentTx.length === 0 ? <tr><td colSpan={5} className="text-center py-6 text-muted-foreground font-sans">No payment records.</td></tr> : paginatedPaymentTx.map((tx, i) => (
                              <tr key={tx._id || tx.id || i} className="hover:bg-rose-50/40">
                                <td className="p-2 font-bold">{formatDate(tx.date)}</td>
                                <td className="p-2 font-sans">{tx.paymentMode || "Cash"} · {tx.note || "Payment"}</td>
                                <td className="p-2 text-center font-bold">{tx.type}</td>
                                <td className="p-2 text-right font-black text-rose-700">{inr(tx.amount || 0)}</td>
                                <td className="p-2 text-center"><Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-rose-600" onClick={() => deleteTransaction(tx.id || tx._id || "")}><Trash2 className="w-3.5 h-3.5" /></Button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* -------------------------- Purchases History -------------------------- */}
                  <TabsContent value="history" className="space-y-4">
                    <Card className="border border-slate-300 overflow-hidden shadow-2xs">
                      <CardContent className="p-0">
                        {historyList.length === 0 ? <p className="text-center text-muted-foreground py-10 font-sans">No purchase vouchers for this supplier.</p> : (
                          <table className="w-full text-xs font-mono">
                            <thead className="bg-slate-900 text-slate-200 text-left font-bold uppercase">
                              <tr><th className="p-2.5">Voucher No</th><th>Date</th><th className="text-right">Total ₹</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {paginatedHistory.map((p: any) => (
                                <tr key={p._id || p.id} className="hover:bg-slate-100">
                                  <td className="p-2.5 font-bold">{p.billNo}</td>
                                  <td>{formatDate(p.date)}</td>
                                  <td className="text-right font-black text-amber-700">{inr(p.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* -------------------------- Orders -------------------------- */}
                  <TabsContent value="orders" className="space-y-4">
                    <Card className="border border-slate-300 overflow-hidden shadow-2xs">
                      <CardContent className="p-0">
                        {ordersList.length === 0 ? <p className="text-center text-muted-foreground py-10 font-sans">No purchase orders for this supplier yet.</p> : (
                          <table className="w-full text-xs font-mono">
                            <thead className="bg-slate-900 text-slate-200 text-left font-bold uppercase">
                              <tr><th className="p-2.5">PO No</th><th>Date</th><th>Metal</th><th className="text-right">Wt (g)</th><th className="text-right">Total ₹</th><th>Status</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {paginatedDetailOrders.map((p: any) => (
                                <tr key={p._id || p.id} className="hover:bg-slate-100">
                                  <td className="p-2.5 font-bold">{p.billNo}</td>
                                  <td>{formatDate(p.date)}</td>
                                  <td>{p.metal} {p.purity}</td>
                                  <td className="text-right">{p.weight}g</td>
                                  <td className="text-right font-bold text-amber-700">{inr(p.total)}</td>
                                  <td><StatusBadge status={p.status} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
