import { useState, useMemo } from "react";
import { useFormKeyboardNav } from "@/lib/useFormKeyboardNav";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { inr, type Purchase, type Supplier, type Customer } from "@/lib/storage";
import { useAuth } from "@/lib/auth";
import { useDebounce } from "@/lib/utils";
import { useTenantAPI } from "@/lib/api";
import {
  Plus, Trash2, ShoppingBag, Eye, Pencil, ClipboardList, RotateCcw, Coins,
  CheckCircle2, XCircle, Send, PackageCheck, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
const calcGST = (p: { weight: number; ratePerGram: number; makingCharge: number; gstPct: number }) => {
  const taxableValue = p.weight * p.ratePerGram + p.makingCharge;
  const cgst = (taxableValue * (p.gstPct / 2)) / 100;
  const sgst = (taxableValue * (p.gstPct / 2)) / 100;
  const igst = 0;
  const total = taxableValue + cgst + sgst + igst;
  return { taxableValue, cgst, sgst, igst, total };
};

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  "Pending Approval": "bg-amber-100 text-amber-700 border-amber-200",
  Approved: "bg-blue-100 text-blue-700 border-blue-200",
  Rejected: "bg-red-100 text-red-700 border-red-200",
  Received: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Cancelled: "bg-muted text-muted-foreground",
  Completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
};
function StatusBadge({ status }: { status?: string }) {
  const s = status || "Completed";
  return <Badge variant="outline" className={`text-[10px] font-semibold whitespace-nowrap ${STATUS_STYLES[s] || ""}`}>{s}</Badge>;
}

export default function PurchasesPage() {
  const { tenantSession } = useAuth();
  const authUser = tenantSession?.user;
  const isOperator = authUser?.role === "operator";
  const isOwner = authUser?.role === "owner";
  const api = useTenantAPI();
  const queryClient = useQueryClient();

  const useApiMutation = (mutationFn: (...args: any[]) => Promise<any>, queryKey: string[]) => {
    return useMutation({
      mutationFn,
      onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });
  };

  const { data: list = [], isLoading } = useQuery({ queryKey: ["purchases"], queryFn: api.purchases.getAll });
  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ["suppliers"], queryFn: api.suppliers.getAll });
  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ["customers"], queryFn: api.customers.getAll });

  const createMutation = useApiMutation((data: Purchase) => api.purchases.create(data), ["purchases"]);
  const updateMutation = useApiMutation((data: { id: string; body: Partial<Purchase> }) => api.purchases.update(data.id, data.body), ["purchases"]);
  const deleteMutation = useApiMutation((id: string) => api.purchases.remove(id), ["purchases"]);
  const updateSupplierMutation = useApiMutation((data: { id: string; body: Supplier }) => api.suppliers.update(data.id, data.body), ["suppliers"]);
  const createInventoryMutation = useApiMutation((data: any) => api.inventory.create(data), ["inventory"]);

  // Applies (or reverses, via type: "Debit") a ledger movement on a supplier — shared by
  // Entry creation, Order receipt and Purchase Returns so the balance math lives in one place.
  const applySupplierLedgerTx = async (
    supplierId: string,
    tx: { type: "Credit" | "Debit"; amount: number; metal: string; purity?: string; weight: number; note: string },
    adjustOutstanding: boolean
  ) => {
    const s: any = suppliers.find(x => (x._id || x.id) === supplierId);
    if (!s) return;
    const isGold = tx.metal === "Gold";
    const sign = tx.type === "Credit" ? 1 : -1;
    let newOutstanding = s.outstanding || 0;
    if (adjustOutstanding) newOutstanding += sign * tx.amount;
    await updateSupplierMutation.mutateAsync({
      id: s._id || s.id || "",
      body: {
        ...s,
        balanceGold: (s.balanceGold || 0) + sign * (isGold ? tx.weight : 0),
        balanceSilver: (s.balanceSilver || 0) + sign * (!isGold ? tx.weight : 0),
        outstanding: newOutstanding,
        transactions: [...(s.transactions || []), { id: Date.now().toString(), date: new Date().toISOString().slice(0, 10), kind: "Weight", ...tx }],
      } as any,
    });
  };

  const [activeTab, setActiveTab] = useState("entry");

  /* ---------------------------------------------------------------------- */
  /* Purchase Entry / Purchase Order — shared create/edit dialog            */
  /* ---------------------------------------------------------------------- */
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewPurchase, setViewPurchase] = useState<any>(null);
  const [searchSup, setSearchSup] = useState("");
  const [page, setPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [gstOnly, setGstOnly] = useState(false);

  const empty: any = {
    id: "", type: "GST", billNo: "", date: new Date().toISOString().slice(0, 10),
    supplierId: "", supplierName: "", supplierGstin: "", metal: "Gold", category: "Metal",
    purity: "22K", hsnCode: "7113", weight: 0, ratePerGram: 0, makingCharge: 0, taxableValue: 0,
    gstPct: 3, cgst: 0, sgst: 0, igst: 0, total: 0, paymentMode: "Cash", note: "",
    docType: "Entry", status: "Completed", needsApproval: false, addToInventory: false
  };
  const [form, setForm] = useState<any>({ ...empty, type: isOperator ? "NON-GST" : "GST", gstPct: isOperator ? 0 : 3 });
  const isOrderForm = form.docType === "Order";
  const gstCalc = calcGST(form);

  const selectedSupplier = useMemo(() => {
    if (form.supplierId) {
      return suppliers.find((s: any) => (s._id || s.id) === form.supplierId) || null;
    }
    if (form.supplierName?.trim()) {
      const q = form.supplierName.trim().toLowerCase();
      return suppliers.find(
        (s: any) =>
          s.name.toLowerCase() === q ||
          (s.mobile && s.mobile === q) ||
          (s.company && s.company.toLowerCase() === q)
      ) || null;
    }
    return null;
  }, [suppliers, form.supplierId, form.supplierName]);

  const matchingSuppliers = useMemo(() => {
    const q = (searchSup || form.supplierName || "").trim().toLowerCase();
    if (!q || form.supplierId) return [];
    return suppliers.filter(
      (s: any) =>
        s.name.toLowerCase().includes(q) ||
        (s.mobile || "").includes(q) ||
        (s.company || "").toLowerCase().includes(q) ||
        (s.gstNumber || "").toLowerCase().includes(q)
    );
  }, [suppliers, searchSup, form.supplierName, form.supplierId]);

  const openNewEntry = () => {
    setEditingId(null);
    setForm({ ...empty, docType: "Entry", type: isOperator ? "NON-GST" : "GST", gstPct: isOperator ? 0 : 3 });
    setSearchSup("");
    setOpen(true);
  };
  const openNewOrder = () => {
    setEditingId(null);
    setForm({ ...empty, docType: "Order", status: "Draft", type: "GST", gstPct: 3 });
    setSearchSup("");
    setOpen(true);
  };
  const openEdit = (p: any) => {
    setEditingId(p._id || p.id);
    setForm({ ...empty, ...p, id: p._id || p.id, date: p.date ? new Date(p.date).toISOString().slice(0, 10) : empty.date });
    setSearchSup(p.supplierName || "");
    setOpen(true);
  };

  const save = async () => {
    if (!form.supplierName || !form.weight) return;
    const prefix = isOrderForm ? "PO" : "PUR";
    const countForPrefix = list.filter((p: any) => (isOrderForm ? p.docType === "Order" : p.docType === "Entry" || !p.docType)).length;
    const billNo = form.billNo || `${prefix}-${(countForPrefix + 1).toString().padStart(4, "0")}`;
    const { taxableValue, cgst, sgst, igst, total } = calcGST(form);
    const status = isOrderForm ? (form.status || "Draft") : (form.needsApproval ? "Pending Approval" : "Completed");

    if (editingId) {
      try {
        await updateMutation.mutateAsync({ id: editingId, body: { ...form, billNo, taxableValue, cgst, sgst, igst, total, status } });
        setForm(empty);
        setEditingId(null);
        setOpen(false);
        toast.success(`${isOrderForm ? "Purchase Order" : "Purchase"} updated successfully!`);
      } catch (error) {
        console.error("[Purchases] Error updating purchase:", error);
        toast.error("Failed to update. Please try again.");
      }
      return;
    }

    try {
      await createMutation.mutateAsync({ ...form, billNo, taxableValue, cgst, sgst, igst, total, status } as any);

      if (!isOrderForm && status === "Completed" && form.supplierId) {
        await applySupplierLedgerTx(form.supplierId, {
          type: "Credit", amount: total, metal: form.metal, purity: form.purity || "22K",
          weight: Number(form.weight) || 0, note: `Purchase Bill: ${billNo} (${form.type || "GST"})`,
        }, form.paymentMode === "Credit");

        if (form.addToInventory) {
          try {
            await createInventoryMutation.mutateAsync({
              id: Date.now().toString(),
              name: `Bulk Purchase: ${form.metal} ${form.purity} (${billNo})`,
              category: form.metal || "Gold",
              subcategory: form.category || "Metal",
              purity: form.purity || "22K",
              grossWeight: Number(form.weight) || 0,
              netWeight: Number(form.weight) || 0,
              ratePerGram: Number(form.ratePerGram) || 0,
              stock: 1,
              barcode: `PUR-${billNo}-${Date.now().toString().slice(-4)}`
            });
            toast.success("Added to inventory stock.");
          } catch (e) {
            console.error("Failed to add to inventory:", e);
          }
        }
      }

      setForm(empty);
      setOpen(false);
      toast.success(isOrderForm ? "Purchase Order created!" : status === "Pending Approval" ? "Purchase submitted for approval!" : "Purchase recorded successfully!");
    } catch (error) {
      console.error("[Purchases] Error saving to DB:", error);
      toast.error("Failed to save. Please try again.");
    }
  };

  const handleKeyNav = useFormKeyboardNav(save);

  // Full ledger-reversing delete — used only for completed Purchase Entries.
  const removeEntry = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this purchase? This will also remove the transaction from the supplier's ledger.")) {
      const p: any = list.find((x: any) => (x._id || x.id) === id);
      if (p && p.supplierId) {
        const s: any = suppliers.find((x: any) => (x._id || x.id) === p.supplierId);
        if (s) {
          const txIndex = (s.transactions || []).findIndex((t: any) => t.note && t.note.includes(`Purchase Bill: ${p.billNo}`));
          let updatedTransactions = s.transactions || [];
          let weightToDeduct = p.weight || 0;
          let isGold = p.metal === "Gold";
          if (txIndex !== -1) {
            const tx = updatedTransactions[txIndex];
            if (tx.type === "Credit") { weightToDeduct = tx.weight; isGold = tx.metal === "Gold"; } else { weightToDeduct = 0; }
            updatedTransactions = [...s.transactions];
            updatedTransactions.splice(txIndex, 1);
          }
          let newOutstanding = s.outstanding || 0;
          if (p.paymentMode === "Credit") newOutstanding -= p.total;
          try {
            await updateSupplierMutation.mutateAsync({ id: s._id || s.id || "", body: { ...s, balanceGold: (s.balanceGold || 0) - (isGold ? weightToDeduct : 0), balanceSilver: (s.balanceSilver || 0) - (!isGold ? weightToDeduct : 0), outstanding: newOutstanding, transactions: updatedTransactions } as any });
          } catch (e) { console.error("Failed to reverse supplier ledger:", e); }
        }
      }
      await deleteMutation.mutateAsync(id);
      toast.success("Purchase deleted successfully!");
    }
  };

  // Plain delete for Orders / Returns / Old Gold docs — these don't carry a matching
  // "Purchase Bill:" ledger transaction that can be found & reversed automatically.
  const removeDoc = async (id: string) => {
    if (window.confirm("Delete this record? If it already affected the supplier ledger, adjust the balance manually afterwards.")) {
      await deleteMutation.mutateAsync(id);
      toast.success("Deleted successfully!");
    }
  };

  const entryList = useMemo(() => list.filter((p: any) => p.docType === "Entry" || !p.docType), [list]);
  const roleFilteredEntries = useMemo(
    () => entryList.filter((p: any) => isOperator ? p.type !== "GST" && (!p.gstPct || p.gstPct === 0) : p.type === "GST" || p.gstPct > 0),
    [entryList, isOperator]
  );
  const filteredEntries = useMemo(() => gstOnly ? roleFilteredEntries.filter((p: any) => p.type === "GST" || p.gstPct > 0) : roleFilteredEntries, [roleFilteredEntries, gstOnly]);
  const monthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;
  const monthTotal = filteredEntries.filter((p: any) => { const d = new Date(p.date); return `${d.getFullYear()}-${d.getMonth()}` === monthKey; }).reduce((s: number, p: any) => s + p.total, 0);
  const totalPages = Math.ceil(filteredEntries.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const sortedEntries = [...filteredEntries].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const paginated = sortedEntries.slice((currentPage - 1) * 10, currentPage * 10);

  /* ---------------------------------------------------------------------- */
  /* Purchase Orders                                                        */
  /* ---------------------------------------------------------------------- */
  const orderList = useMemo(() => list.filter((p: any) => p.docType === "Order"), [list]);
  const sortedOrders = [...orderList].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const orderTotalPages = Math.ceil(orderList.length / 10) || 1;
  const orderCurrentPage = Math.min(orderPage, orderTotalPages);
  const paginatedOrders = sortedOrders.slice((orderCurrentPage - 1) * 10, orderCurrentPage * 10);

  const sendOrderForApproval = async (id: string) => {
    try {
      await updateMutation.mutateAsync({ id, body: { status: "Pending Approval" } });
      toast.success("Sent for approval.");
    } catch (e) { console.error(e); toast.error("Failed to submit for approval."); }
  };

  const handleReceive = async (order: any) => {
    try {
      const entry: any = await api.purchases.receive(order._id || order.id);
      if (order.supplierId) {
        await applySupplierLedgerTx(order.supplierId, {
          type: "Credit", amount: entry.total ?? order.total, metal: order.metal, purity: order.purity || "22K",
          weight: Number(order.weight) || 0, note: `Purchase Bill: ${entry.billNo} (PO ${order.billNo})`,
        }, order.paymentMode === "Credit");
      }
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast.success("Purchase Order received — a purchase entry was created.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to receive purchase order.");
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Purchase Returns                                                       */
  /* ---------------------------------------------------------------------- */
  const [openReturn, setOpenReturn] = useState(false);
  const emptyReturn: any = { id: "", billNo: "", date: new Date().toISOString().slice(0, 10), linkedDocId: "", supplierId: "", supplierName: "", metal: "Gold", purity: "22K", weight: 0, ratePerGram: 0, makingCharge: 0, gstPct: 0, note: "" };
  const [returnForm, setReturnForm] = useState<any>(emptyReturn);
  const returnList = useMemo(() => list.filter((p: any) => p.docType === "Return"), [list]);
  const returnableEntries = useMemo(() => list.filter((p: any) => (p.docType === "Entry" || !p.docType) && p.supplierId), [list]);
  const returnGstCalc = calcGST(returnForm);

  const openNewReturn = () => { setReturnForm(emptyReturn); setOpenReturn(true); };
  const pickReturnSource = (id: string) => {
    const src: any = returnableEntries.find((p: any) => (p._id || p.id) === id);
    if (!src) return;
    setReturnForm((f: any) => ({ ...f, linkedDocId: id, supplierId: src.supplierId, supplierName: src.supplierName, metal: src.metal, purity: src.purity, ratePerGram: src.ratePerGram, makingCharge: 0, gstPct: src.gstPct || 0 }));
  };
  const saveReturn = async () => {
    if (!returnForm.linkedDocId || !returnForm.weight) { toast.error("Select the original purchase and enter a returned weight."); return; }
    const src: any = returnableEntries.find((p: any) => (p._id || p.id) === returnForm.linkedDocId);
    const billNo = `PR-${(returnList.length + 1).toString().padStart(4, "0")}`;
    const { taxableValue, cgst, sgst, igst, total } = calcGST(returnForm);
    try {
      await createMutation.mutateAsync({ ...returnForm, billNo, taxableValue, cgst, sgst, igst, total, docType: "Return", status: "Completed", paymentMode: src?.paymentMode || "Cash" } as any);
      if (returnForm.supplierId) {
        await applySupplierLedgerTx(returnForm.supplierId, {
          type: "Debit", amount: total, metal: returnForm.metal, purity: returnForm.purity || "22K",
          weight: Number(returnForm.weight) || 0, note: `Purchase Return against ${src?.billNo || ""}`,
        }, src?.paymentMode === "Credit");
      }
      setOpenReturn(false);
      toast.success("Purchase return recorded and supplier ledger updated!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to record return.");
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Old Gold Purchase (buyback from customers)                             */
  /* ---------------------------------------------------------------------- */
  const [openOldGold, setOpenOldGold] = useState(false);
  const [searchCust, setSearchCust] = useState("");
  const debouncedSearchCust = useDebounce(searchCust, 300);
  const emptyOldGold: any = { id: "", billNo: "", date: new Date().toISOString().slice(0, 10), customerId: "", customerName: "", metal: "Gold", purity: "22K", weight: 0, deductionPct: 0, ratePerGram: 0, makingCharge: 0, gstPct: 0, paymentMode: "Cash", note: "" };
  const [oldGoldForm, setOldGoldForm] = useState<any>(emptyOldGold);
  const oldGoldList = useMemo(() => list.filter((p: any) => p.docType === "OldGold"), [list]);
  const netOldGoldWeight = (oldGoldForm.weight || 0) * (1 - (oldGoldForm.deductionPct || 0) / 100);
  const oldGoldPayout = netOldGoldWeight * (oldGoldForm.ratePerGram || 0);

  const openNewOldGold = () => { setOldGoldForm(emptyOldGold); setSearchCust(""); setOpenOldGold(true); };
  const saveOldGold = async () => {
    if (!oldGoldForm.customerName || !oldGoldForm.weight) { toast.error("Select a customer and enter the item weight."); return; }
    const billNo = `OG-${(oldGoldList.length + 1).toString().padStart(4, "0")}`;
    try {
      await createMutation.mutateAsync({ ...oldGoldForm, billNo, taxableValue: oldGoldPayout, cgst: 0, sgst: 0, igst: 0, total: oldGoldPayout, docType: "OldGold", status: "Completed", metal: "Gold" } as any);
      setOpenOldGold(false);
      toast.success("Old gold purchase recorded!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to record old gold purchase.");
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Purchase Approvals                                                     */
  /* ---------------------------------------------------------------------- */
  const pendingApprovals = useMemo(() => list.filter((p: any) => p.status === "Pending Approval"), [list]);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleApprove = async (p: any) => {
    try {
      await api.purchases.approve(p._id || p.id);
      if (p.docType !== "Order" && p.supplierId) {
        await applySupplierLedgerTx(p.supplierId, {
          type: "Credit", amount: p.total, metal: p.metal, purity: p.purity || "22K",
          weight: Number(p.weight) || 0, note: `Purchase Bill: ${p.billNo} (${p.type || "GST"})`,
        }, p.paymentMode === "Credit");
      }
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast.success("Approved.");
    } catch (e) { console.error(e); toast.error("Failed to approve."); }
  };
  const handleReject = async (id: string, reason: string) => {
    try {
      await api.purchases.reject(id, reason);
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast.success("Rejected.");
    } catch (e) { console.error(e); toast.error("Failed to reject."); }
  };

  /* ---------------------------------------------------------------------- */
  /* Purchase Reports                                                       */
  /* ---------------------------------------------------------------------- */
  const reportStats = useMemo(() => {
    const entries = list.filter((p: any) => p.docType === "Entry" || !p.docType);
    const orders = list.filter((p: any) => p.docType === "Order");
    const returns = list.filter((p: any) => p.docType === "Return");
    const oldGold = list.filter((p: any) => p.docType === "OldGold");
    const totalEntryValue = entries.reduce((s: number, p: any) => s + (p.total || 0), 0);
    const totalReturnValue = returns.reduce((s: number, p: any) => s + (p.total || 0), 0);
    const pendingOrders = orders.filter((p: any) => p.status === "Draft" || p.status === "Pending Approval" || p.status === "Approved").length;
    const mKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;
    const oldGoldThisMonth = oldGold.filter((p: any) => { const d = new Date(p.date); return `${d.getFullYear()}-${d.getMonth()}` === mKey; }).reduce((s: number, p: any) => s + (p.total || 0), 0);
    return { entries, orders, returns, oldGold, totalEntryValue, totalReturnValue, pendingOrders, oldGoldThisMonth };
  }, [list]);

  const monthlyTrend = useMemo(() => {
    const map: Record<string, { key: string; month: string; Purchases: number; Returns: number }> = {};
    [...reportStats.entries, ...reportStats.returns].forEach((p: any) => {
      const d = new Date(p.date);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      if (!map[key]) map[key] = { key, month: format(d, "MMM yy"), Purchases: 0, Returns: 0 };
      if (p.docType === "Return") map[key].Returns += p.total || 0; else map[key].Purchases += p.total || 0;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key)).slice(-6);
  }, [reportStats]);

  const categoryPie = useMemo(() => {
    const map: Record<string, number> = {};
    reportStats.entries.forEach((p: any) => { const k = p.category || "Metal"; map[k] = (map[k] || 0) + (p.total || 0); });
    if (reportStats.oldGold.length) map["Old Gold"] = reportStats.oldGold.reduce((s: number, p: any) => s + (p.total || 0), 0);
    return Object.entries(map).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  }, [reportStats]);

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold">Purchases</h1>
          <p className="text-muted-foreground mt-1 text-sm">Entries, orders, returns &amp; supplier purchase management.</p>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 w-full h-auto bg-muted/60 p-1 rounded-xl gap-1">
          <TabsTrigger value="entry" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5" />Entry</TabsTrigger>
          <TabsTrigger value="orders" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" />Orders</TabsTrigger>
          <TabsTrigger value="returns" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" />Returns</TabsTrigger>
          <TabsTrigger value="oldgold" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5"><Coins className="w-3.5 h-3.5" />Old Gold</TabsTrigger>
          <TabsTrigger value="approvals" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />Approvals
            {pendingApprovals.length > 0 && <Badge className="ml-0.5 h-4 min-w-4 px-1 text-[10px]">{pendingApprovals.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" />Reports</TabsTrigger>
        </TabsList>

        {/* ==================================================================== */}
        {/* TAB: PURCHASE ENTRY (also covers Metal/Diamond/Stone & Supplier Invoices) */}
        {/* ==================================================================== */}
        <TabsContent value="entry" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-display font-semibold">Purchase Entry</h2>
              <p className="text-xs text-muted-foreground">Metal, diamond &amp; stone stock bought from suppliers — a GST bill here doubles as the supplier invoice.</p>
            </div>
            <Button size="lg" onClick={openNewEntry}><Plus className="w-4 h-4 mr-2" />New Purchase</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-indigo-100 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-indigo-600/80 uppercase tracking-wider mb-1">Total Purchases</div>
                <div className="text-2xl font-bold text-indigo-900">{filteredEntries.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-emerald-600/80 uppercase tracking-wider mb-1">This Month</div>
                <div className="text-2xl font-bold text-emerald-900">{inr(monthTotal)}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-100 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-amber-600/80 uppercase tracking-wider mb-1">Suppliers Used</div>
                <div className="text-2xl font-bold text-amber-900">{new Set(filteredEntries.map((p: any) => p.supplierName)).size}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="font-display flex items-center gap-2"><ShoppingBag className="w-5 h-5" />Purchase Bills</CardTitle>
              <Button size="sm" variant={gstOnly ? "default" : "outline"} onClick={() => setGstOnly(v => !v)}>
                {gstOnly ? "Showing GST Invoices" : "GST Invoices Only"}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? <p className="text-center text-muted-foreground py-12">Loading purchases...</p> : filteredEntries.length === 0 ? <p className="text-center text-muted-foreground py-12">No purchases yet.</p> :
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm min-w-225">
                      <thead className="text-left text-muted-foreground border-b bg-muted/20 text-xs uppercase">
                        <tr>
                          <th className="py-2.5 px-4">Bill</th>
                          <th>Type</th>
                          <th>Category</th>
                          <th>Date</th>
                          <th>Supplier</th>
                          <th>Metal</th>
                          <th className="text-right">Wt (g)</th>
                          <th className="text-right">Total</th>
                          <th>Status</th>
                          <th className="text-right pr-4">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((p: any) => (
                          <tr key={p._id || p.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="py-2 px-4 font-semibold">{p.billNo}</td>
                            <td><span className="text-[10px] font-semibold uppercase tracking-wider border rounded-sm px-1.5 py-0.5 text-muted-foreground">{p.type === "NON-GST" ? "Non-GST" : "GST"}</span></td>
                            <td className="text-xs text-muted-foreground">{p.category || "Metal"}</td>
                            <td className="whitespace-nowrap">{formatDate(p.date)}</td>
                            <td>{p.supplierName}</td>
                            <td>{p.metal} {p.purity}</td>
                            <td className="text-right">{p.weight}g</td>
                            <td className="text-right font-bold text-emerald-600">{inr(p.total)}</td>
                            <td><StatusBadge status={p.status} /></td>
                            <td className="text-right px-4">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setViewPurchase(p)} title="View"><Eye className="w-4 h-4" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => openEdit(p)} title="Edit"><Pencil className="w-4 h-4" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => removeEntry(p._id || p.id)} title="Delete"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y">
                    {paginated.map((p: any) => (
                      <div key={p._id || p.id} className="p-3 space-y-1.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-sm">{p.billNo}</span>
                            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider border rounded-sm px-1.5 py-0.5 text-muted-foreground">{p.type === "NON-GST" ? "Non-GST" : "GST"}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-emerald-600 mr-1">{inr(p.total)}</span>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setViewPurchase(p)} title="View"><Eye className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(p)} title="Edit"><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeEntry(p._id || p.id)} title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">{p.supplierName} · {p.metal} {p.purity} · {formatDate(p.date)}</div>
                        <div className="flex items-center gap-2"><StatusBadge status={p.status} /><span className="text-xs text-muted-foreground">{p.category || "Metal"}</span></div>
                        <div className="text-xs text-muted-foreground">{p.weight}g @ {inr(p.ratePerGram)}/g · {p.paymentMode}</div>
                      </div>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <div className="text-xs text-muted-foreground">Showing {(currentPage - 1) * 10 + 1}–{Math.min(currentPage * 10, filteredEntries.length)} of {filteredEntries.length}</div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                        <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                      </div>
                    </div>
                  )}
                </>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB: PURCHASE ORDERS */}
        {/* ==================================================================== */}
        <TabsContent value="orders" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-display font-semibold">Purchase Orders</h2>
              <p className="text-xs text-muted-foreground">Raise a PO with a supplier, get it approved, then receive it into a purchase entry.</p>
            </div>
            <Button size="lg" onClick={openNewOrder}><Plus className="w-4 h-4 mr-2" />New Purchase Order</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {orderList.length === 0 ? <p className="text-center text-muted-foreground py-12">No purchase orders yet.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-200">
                    <thead className="text-left text-muted-foreground border-b bg-muted/20 text-xs uppercase">
                      <tr>
                        <th className="py-2.5 px-4">PO No</th><th>Date</th><th>Supplier</th><th>Metal</th>
                        <th className="text-right">Wt (g)</th><th className="text-right">Total</th><th>Status</th><th className="text-right pr-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOrders.map((p: any) => (
                        <tr key={p._id || p.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-2 px-4 font-semibold">{p.billNo}</td>
                          <td className="whitespace-nowrap">{formatDate(p.date)}</td>
                          <td>{p.supplierName}</td>
                          <td>{p.metal} {p.purity}</td>
                          <td className="text-right">{p.weight}g</td>
                          <td className="text-right font-bold text-emerald-600">{inr(p.total)}</td>
                          <td><StatusBadge status={p.status} /></td>
                          <td className="text-right px-4">
                            <div className="flex justify-end gap-1 flex-wrap">
                              {p.status === "Draft" && <Button size="sm" variant="outline" onClick={() => sendOrderForApproval(p._id || p.id)}><Send className="w-3.5 h-3.5 mr-1" />Send for Approval</Button>}
                              {p.status === "Approved" && <Button size="sm" onClick={() => handleReceive(p)}><PackageCheck className="w-3.5 h-3.5 mr-1" />Receive</Button>}
                              <Button size="sm" variant="ghost" onClick={() => setViewPurchase(p)} title="View"><Eye className="w-4 h-4" /></Button>
                              {p.status === "Draft" && <Button size="sm" variant="ghost" onClick={() => openEdit(p)} title="Edit"><Pencil className="w-4 h-4" /></Button>}
                              <Button size="sm" variant="ghost" onClick={() => removeDoc(p._id || p.id)} title="Delete"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {orderTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-xs text-muted-foreground">Showing {(orderCurrentPage - 1) * 10 + 1}–{Math.min(orderCurrentPage * 10, orderList.length)} of {orderList.length}</div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setOrderPage(p => Math.max(1, p - 1))} disabled={orderCurrentPage === 1}>Prev</Button>
                    <Button size="sm" variant="outline" onClick={() => setOrderPage(p => Math.min(orderTotalPages, p + 1))} disabled={orderCurrentPage === orderTotalPages}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================================================================== */}
        {/* TAB: PURCHASE RETURNS */}
        {/* ==================================================================== */}
        <TabsContent value="returns" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-display font-semibold">Purchase Returns</h2>
              <p className="text-xs text-muted-foreground">Send goods back to a supplier against an existing purchase entry.</p>
            </div>
            <Button size="lg" onClick={openNewReturn}><Plus className="w-4 h-4 mr-2" />New Return</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {returnList.length === 0 ? <p className="text-center text-muted-foreground py-12">No purchase returns yet.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-175">
                    <thead className="text-left text-muted-foreground border-b bg-muted/20 text-xs uppercase">
                      <tr><th className="py-2.5 px-4">Return No</th><th>Date</th><th>Supplier</th><th>Against Bill</th><th>Metal</th><th className="text-right">Wt (g)</th><th className="text-right">Value</th><th className="text-right pr-4">Action</th></tr>
                    </thead>
                    <tbody>
                      {returnList.map((p: any) => {
                        const src: any = list.find((x: any) => (x._id || x.id) === p.linkedDocId);
                        return (
                          <tr key={p._id || p.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="py-2 px-4 font-semibold">{p.billNo}</td>
                            <td className="whitespace-nowrap">{formatDate(p.date)}</td>
                            <td>{p.supplierName}</td>
                            <td>{src?.billNo || "—"}</td>
                            <td>{p.metal} {p.purity}</td>
                            <td className="text-right">{p.weight}g</td>
                            <td className="text-right font-bold text-red-600">-{inr(p.total)}</td>
                            <td className="text-right px-4"><Button size="sm" variant="ghost" onClick={() => removeDoc(p._id || p.id)} title="Delete"><Trash2 className="w-4 h-4" /></Button></td>
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
        {/* TAB: OLD GOLD PURCHASE */}
        {/* ==================================================================== */}
        <TabsContent value="oldgold" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-display font-semibold">Old Gold Purchase</h2>
              <p className="text-xs text-muted-foreground">Buyback of used/old gold jewellery from walk-in customers.</p>
            </div>
            <Button size="lg" onClick={openNewOldGold}><Plus className="w-4 h-4 mr-2" />New Old Gold Purchase</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {oldGoldList.length === 0 ? <p className="text-center text-muted-foreground py-12">No old gold purchases yet.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-175">
                    <thead className="text-left text-muted-foreground border-b bg-muted/20 text-xs uppercase">
                      <tr><th className="py-2.5 px-4">Bill</th><th>Date</th><th>Customer</th><th className="text-right">Gross Wt</th><th className="text-right">Deduction</th><th className="text-right">Rate</th><th className="text-right">Payout</th><th className="text-right pr-4">Action</th></tr>
                    </thead>
                    <tbody>
                      {oldGoldList.map((p: any) => (
                        <tr key={p._id || p.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-2 px-4 font-semibold">{p.billNo}</td>
                          <td className="whitespace-nowrap">{formatDate(p.date)}</td>
                          <td>{p.customerName}</td>
                          <td className="text-right">{p.weight}g</td>
                          <td className="text-right">{p.deductionPct || 0}%</td>
                          <td className="text-right">{inr(p.ratePerGram)}</td>
                          <td className="text-right font-bold text-emerald-600">{inr(p.total)}</td>
                          <td className="text-right px-4"><Button size="sm" variant="ghost" onClick={() => removeDoc(p._id || p.id)} title="Delete"><Trash2 className="w-4 h-4" /></Button></td>
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
        {/* TAB: PURCHASE APPROVALS */}
        {/* ==================================================================== */}
        <TabsContent value="approvals" className="space-y-6">
          <div>
            <h2 className="text-lg font-display font-semibold">Purchase Approvals</h2>
            <p className="text-xs text-muted-foreground">{isOwner ? "Review purchase orders and flagged entries awaiting sign-off." : "Purchases and orders awaiting owner approval."}</p>
          </div>
          <Card>
            <CardContent className="p-0">
              {pendingApprovals.length === 0 ? <p className="text-center text-muted-foreground py-12">Nothing pending approval.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-175">
                    <thead className="text-left text-muted-foreground border-b bg-muted/20 text-xs uppercase">
                      <tr><th className="py-2.5 px-4">Bill</th><th>Type</th><th>Date</th><th>Party</th><th className="text-right">Total</th>{isOwner && <th className="text-right pr-4">Action</th>}</tr>
                    </thead>
                    <tbody>
                      {pendingApprovals.map((p: any) => (
                        <tr key={p._id || p.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-2 px-4 font-semibold">{p.billNo}</td>
                          <td><Badge variant="outline" className="text-[10px]">{p.docType === "Order" ? "Purchase Order" : "Purchase Entry"}</Badge></td>
                          <td className="whitespace-nowrap">{formatDate(p.date)}</td>
                          <td>{p.supplierName || p.customerName}</td>
                          <td className="text-right font-bold">{inr(p.total)}</td>
                          {isOwner && (
                            <td className="text-right px-4">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200" onClick={() => handleApprove(p)}><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Approve</Button>
                                <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => { setRejectTarget(p); setRejectReason(""); }}><XCircle className="w-3.5 h-3.5 mr-1" />Reject</Button>
                              </div>
                            </td>
                          )}
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
        {/* TAB: PURCHASE REPORTS */}
        {/* ==================================================================== */}
        <TabsContent value="reports" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-indigo-100 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-indigo-600/80 uppercase tracking-wider mb-1">Total Purchases</div>
                <div className="text-2xl font-bold text-indigo-900">{inr(reportStats.totalEntryValue)}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-100 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-rose-600/80 uppercase tracking-wider mb-1">Total Returns</div>
                <div className="text-2xl font-bold text-rose-900">{inr(reportStats.totalReturnValue)}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-100 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-amber-600/80 uppercase tracking-wider mb-1">Orders in Progress</div>
                <div className="text-2xl font-bold text-amber-900">{reportStats.pendingOrders}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-emerald-600/80 uppercase tracking-wider mb-1">Old Gold (This Month)</div>
                <div className="text-2xl font-bold text-emerald-900">{inr(reportStats.oldGoldThisMonth)}</div>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base font-display">Purchases vs Returns (Last 6 Months)</CardTitle></CardHeader>
              <CardContent className="h-72 pt-4">
                {monthlyTrend.length === 0 ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data yet.</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <RechartsTooltip formatter={(val: number) => [inr(val), undefined]} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Purchases" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Returns" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-base font-display">By Category</CardTitle></CardHeader>
              <CardContent className="h-72 pt-4">
                {categoryPie.length === 0 ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data yet.</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                        {categoryPie.map((_entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(val: number) => [inr(val), "Amount"]} />
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
      {/* Shared Purchase Entry / Purchase Order dialog                        */}
      {/* ==================================================================== */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingId(null); }}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6" aria-describedby={undefined} onInteractOutside={(e) => e.preventDefault()} onKeyDown={handleKeyNav}>
          <DialogHeader><DialogTitle className="text-lg font-display">{editingId ? (isOrderForm ? "Edit Purchase Order" : "Edit Purchase Bill") : (isOrderForm ? "Create Purchase Order" : "Record Purchase Bill")}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">

            {/* Section: Supplier */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supplier Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <Label className="text-xs">Type or Search Supplier Name *</Label>
                  <Input
                    placeholder="Type name, company or mobile..."
                    value={form.supplierName || searchSup}
                    onChange={e => {
                      const val = e.target.value;
                      setSearchSup(val);
                      setForm((f: any) => ({ ...f, supplierName: val, supplierId: "" }));
                      const match = suppliers.find(s => s.name.toLowerCase() === val.trim().toLowerCase() || (s.mobile && s.mobile === val.trim()));
                      if (match) {
                        setForm((f: any) => ({
                          ...f,
                          supplierId: match._id || match.id,
                          supplierName: match.name,
                          supplierGstin: (match as any).gstNumber || ""
                        }));
                      }
                    }}
                  />
                  {matchingSuppliers.length > 0 && !form.supplierId && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {matchingSuppliers.map((s: any) => (
                        <div
                          key={s._id || s.id}
                          className="p-2 hover:bg-accent cursor-pointer text-xs border-b border-border/50 last:border-b-0 flex items-center justify-between"
                          onClick={() => {
                            setForm((f: any) => ({
                              ...f,
                              supplierId: s._id || s.id,
                              supplierName: s.name,
                              supplierGstin: (s as any).gstNumber || ""
                            }));
                            setSearchSup(s.name);
                          }}
                        >
                          <div>
                            <span className="font-semibold text-foreground">{s.name}</span>
                            {s.company && <span className="text-muted-foreground ml-1">({s.company})</span>}
                            <div className="text-[11px] text-muted-foreground">{s.mobile} {s.gstNumber ? `· GST: ${s.gstNumber}` : ""}</div>
                          </div>
                          <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                            Bal: {inr(s.outstanding || 0)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-xs">Select Supplier from Dropdown</Label>
                  <Select value={form.supplierId || ""} onValueChange={val => {
                    const s = suppliers.find(x => (x._id || x.id) === val);
                    if (s) {
                      setForm((f: any) => ({ ...f, supplierId: val, supplierName: s.name, supplierGstin: (s as any).gstNumber || "" }));
                      setSearchSup(s.name);
                    }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(s => (
                        <SelectItem key={s._id || s.id} value={s._id || s.id}>{s.name} {s.company ? `(${s.company})` : ""} · {s.mobile}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <Label className="text-xs">Supplier GSTIN</Label>
                  <Input placeholder="27AAACR1234A1Z5" value={form.supplierGstin || ""} onChange={e => setForm((f: any) => ({ ...f, supplierGstin: e.target.value.toUpperCase() }))} className="font-mono" />
                </div>

                {/* Fetched Supplier Profile Card */}
                {selectedSupplier && (
                  <div className="col-span-1 sm:col-span-2 bg-emerald-50/90 border border-emerald-300 rounded-lg p-3 text-xs space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-emerald-700 text-white font-semibold px-2 py-0.5 rounded text-[10px]">
                          ✓ Existing Supplier Found &amp; Fetched
                        </span>
                        <span className="font-bold text-emerald-950 text-sm">{selectedSupplier.name}</span>
                        {selectedSupplier.company && <span className="text-emerald-800 font-medium">({selectedSupplier.company})</span>}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] text-emerald-800 hover:text-emerald-950 hover:bg-emerald-200"
                        onClick={() => {
                          setForm((f: any) => ({ ...f, supplierId: "", supplierName: "", supplierGstin: "" }));
                          setSearchSup("");
                        }}
                      >
                        Clear / Change
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-emerald-200/60 text-slate-800">
                      <div><span className="text-slate-500">Mobile:</span> <span className="font-semibold">{selectedSupplier.mobile || "—"}</span></div>
                      <div><span className="text-slate-500">GSTIN:</span> <span className="font-semibold font-mono">{selectedSupplier.gstNumber || "—"}</span></div>
                      <div><span className="text-slate-500">Outstanding:</span> <strong className="text-emerald-800 font-bold">{inr(selectedSupplier.outstanding || 0)}</strong></div>
                      <div><span className="text-slate-500">Metal Bal:</span> <span className="font-semibold">Gold {selectedSupplier.balanceGold || 0}g / Silver {selectedSupplier.balanceSilver || 0}g</span></div>
                    </div>
                    {selectedSupplier.address && (
                      <div className="text-[11px] text-slate-600"><span className="text-slate-500">Address:</span> {selectedSupplier.address}</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Section: Bill Info */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{isOrderForm ? "Order Information" : "Bill Information"}</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label={isOrderForm ? "PO No (auto if empty)" : "Bill No (auto if empty)"} v={form.billNo} on={v => setForm((f: any) => ({ ...f, billNo: v }))} />
                <Field label={isOrderForm ? "Order Date" : "Bill Date"} type="date" v={form.date} on={v => setForm((f: any) => ({ ...f, date: v }))} />
                <div>
                  <Label className="text-xs">Bill Type</Label>
                  <Select value={form.type || "GST"} onValueChange={v => setForm((f: any) => ({ ...f, type: v, gstPct: v === "NON-GST" ? 0 : 3 }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GST">GST Bill</SelectItem>
                      <SelectItem value="NON-GST">Estimate / Non-GST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Payment Mode</Label>
                  <select className="w-full h-10 border rounded-md px-3 bg-background text-sm" value={form.paymentMode} onChange={e => setForm((f: any) => ({ ...f, paymentMode: e.target.value }))}>
                    {["Cash", "UPI", "Card", "Bank", "Credit"].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Section: Metal Details */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metal &amp; Stock Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Category</Label>
                  <select className="w-full h-10 border rounded-md px-3 bg-background text-sm" value={form.category || "Metal"} onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))}>
                    <option value="Metal">Metal</option>
                    <option value="Diamond">Diamond</option>
                    <option value="Stone">Stone</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Metal</Label>
                  <select className="w-full h-10 border rounded-md px-3 bg-background text-sm" value={form.metal} onChange={e => setForm((f: any) => ({ ...f, metal: e.target.value }))}>
                    <option>Gold</option><option>Silver</option><option>Diamond</option><option>Stone</option><option>Other</option>
                  </select>
                </div>
                <Field label="Purity" v={form.purity || ""} on={v => setForm((f: any) => ({ ...f, purity: v }))} />
                <Field label="HSN Code" v={form.hsnCode || ""} on={v => setForm((f: any) => ({ ...f, hsnCode: v }))} />
                <Field label="Weight (g) *" type="number" v={String(form.weight)} on={v => setForm((f: any) => ({ ...f, weight: +v }))} />
                <Field label="Rate ₹/g *" type="number" v={String(form.ratePerGram)} on={v => setForm((f: any) => ({ ...f, ratePerGram: +v }))} />
                <Field label="Making Charge ₹" type="number" v={String(form.makingCharge)} on={v => setForm((f: any) => ({ ...f, makingCharge: +v }))} />
                <div className="col-span-2"><Field label="Note" v={form.note || ""} on={v => setForm((f: any) => ({ ...f, note: v }))} /></div>
              </div>
            </div>

            {/* Section: GST Computation (live) */}
            {(form.type || "GST") === "GST" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">GST Breakdown (Live)</p>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-emerald-700">GST %</Label>
                    <select className="h-8 border border-emerald-300 rounded-md px-2 bg-white text-sm font-semibold text-emerald-800" value={form.gstPct} onChange={e => setForm((f: any) => ({ ...f, gstPct: +e.target.value }))}>
                      <option value={3}>3%</option><option value={5}>5%</option><option value={12}>12%</option><option value={18}>18%</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div className="bg-white rounded p-2 text-center">
                    <div className="text-xs text-muted-foreground">Taxable Value</div>
                    <div className="font-bold text-foreground">{inr(gstCalc.taxableValue)}</div>
                  </div>
                  <div className="bg-white rounded p-2 text-center">
                    <div className="text-xs text-muted-foreground">CGST ({form.gstPct / 2}%)</div>
                    <div className="font-bold text-blue-600">{inr(gstCalc.cgst)}</div>
                  </div>
                  <div className="bg-white rounded p-2 text-center">
                    <div className="text-xs text-muted-foreground">SGST ({form.gstPct / 2}%)</div>
                    <div className="font-bold text-blue-600">{inr(gstCalc.sgst)}</div>
                  </div>
                  <div className="bg-emerald-600 rounded p-2 text-center">
                    <div className="text-xs text-emerald-100">Total</div>
                    <div className="font-bold text-white">{inr(gstCalc.total)}</div>
                  </div>
                </div>
              </div>
            )}
            {(form.type || "GST") !== "GST" && (
              <div className="bg-muted/30 border rounded-lg p-3 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total (Non-GST)</span>
                <span className="font-bold text-lg">{inr(gstCalc.taxableValue)}</span>
              </div>
            )}

            {!isOrderForm && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <Checkbox id="needsApproval" checked={!!form.needsApproval} onCheckedChange={(v: any) => setForm((f: any) => ({ ...f, needsApproval: !!v }))} className="mt-0.5" />
                  <Label htmlFor="needsApproval" className="text-xs font-medium text-amber-800 cursor-pointer">Send this purchase for owner approval before finalizing (supplier ledger is only updated once approved)</Label>
                </div>
                <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <Checkbox id="addToInventory" checked={!!form.addToInventory} onCheckedChange={(v: any) => setForm((f: any) => ({ ...f, addToInventory: !!v }))} className="mt-0.5" />
                  <Label htmlFor="addToInventory" className="text-xs font-medium text-indigo-800 cursor-pointer">Automatically log this purchase into Inventory stock</Label>
                </div>
              </div>
            )}
          </div>
          <Button onClick={save} className="mt-4 w-full" disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? (isOrderForm ? "Update Purchase Order" : "Update Purchase Bill") : (isOrderForm ? "Save Purchase Order" : "Save Purchase Bill")}
          </Button>
        </DialogContent>
      </Dialog>

      {/* View dialog (Entry & Order) */}
      <Dialog open={!!viewPurchase} onOpenChange={(v) => { if (!v) setViewPurchase(null); }}>
        <DialogContent className="w-[95vw] sm:max-w-lg p-4 sm:p-6" aria-describedby={undefined}>
          <DialogHeader><DialogTitle className="text-lg font-display">{viewPurchase?.docType === "Order" ? "Purchase Order Details" : "Purchase Bill Details"}</DialogTitle></DialogHeader>
          {viewPurchase && (() => {
            const p = viewPurchase;
            const cgst = p.cgst ?? ((p.weight * p.ratePerGram + p.makingCharge) * (p.gstPct / 2) / 100);
            const sgst = p.sgst ?? cgst;
            const taxable = p.taxableValue ?? (p.weight * p.ratePerGram + p.makingCharge);
            return (
              <div className="space-y-3 mt-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <ViewField label="Bill No" value={p.billNo} />
                  <ViewField label="Status" value={p.status || "Completed"} />
                  <ViewField label="Type" value={p.type === "NON-GST" ? "Non-GST" : "GST"} />
                  <ViewField label="Category" value={p.category || "Metal"} />
                  <ViewField label="Date" value={formatDate(p.date)} />
                  <ViewField label="Payment Mode" value={p.paymentMode} />
                  <ViewField label="Supplier" value={p.supplierName || "—"} />
                  <ViewField label="Supplier GSTIN" value={p.supplierGstin || "—"} />
                  <ViewField label="Metal" value={`${p.metal} ${p.purity || ""}`} />
                  <ViewField label="HSN Code" value={p.hsnCode || "—"} />
                  <ViewField label="Weight" value={`${p.weight}g`} />
                  <ViewField label="Rate/g" value={inr(p.ratePerGram)} />
                  <ViewField label="Making Charge" value={inr(p.makingCharge)} />
                  <ViewField label="GST %" value={`${p.gstPct || 0}%`} />
                  {p.rejectionReason && <ViewField label="Rejection Reason" value={p.rejectionReason} />}
                </div>
                {p.note && <ViewField label="Note" value={p.note} />}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t">
                  <div className="bg-muted/40 rounded p-2 text-center">
                    <div className="text-xs text-muted-foreground">Taxable</div>
                    <div className="font-semibold">{inr(taxable)}</div>
                  </div>
                  <div className="bg-blue-50 rounded p-2 text-center">
                    <div className="text-xs text-muted-foreground">CGST</div>
                    <div className="font-semibold text-blue-600">{inr(cgst)}</div>
                  </div>
                  <div className="bg-blue-50 rounded p-2 text-center">
                    <div className="text-xs text-muted-foreground">SGST</div>
                    <div className="font-semibold text-blue-600">{inr(sgst)}</div>
                  </div>
                  <div className="bg-emerald-600 rounded p-2 text-center">
                    <div className="text-xs text-emerald-100">Total</div>
                    <div className="font-semibold text-white">{inr(p.total)}</div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { const v = viewPurchase; setViewPurchase(null); openEdit(v); }}><Pencil className="w-4 h-4 mr-2" />Edit</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Purchase Return dialog */}
      <Dialog open={openReturn} onOpenChange={setOpenReturn}>
        <DialogContent className="w-[95vw] sm:max-w-lg p-4 sm:p-6" aria-describedby={undefined}>
          <DialogHeader><DialogTitle className="text-lg font-display">Record Purchase Return</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs">Original Purchase *</Label>
              <Select value={returnForm.linkedDocId || ""} onValueChange={pickReturnSource}>
                <SelectTrigger><SelectValue placeholder="Select a purchase bill to return against" /></SelectTrigger>
                <SelectContent>
                  {returnableEntries.map((p: any) => (
                    <SelectItem key={p._id || p.id} value={p._id || p.id}>{p.billNo} · {p.supplierName} · {p.metal} {p.purity} · {p.weight}g</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {returnForm.linkedDocId && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Return Date" type="date" v={returnForm.date} on={v => setReturnForm((f: any) => ({ ...f, date: v }))} />
                  <Field label="Returned Weight (g) *" type="number" v={String(returnForm.weight)} on={v => setReturnForm((f: any) => ({ ...f, weight: +v }))} />
                  <Field label="Rate ₹/g" type="number" v={String(returnForm.ratePerGram)} on={v => setReturnForm((f: any) => ({ ...f, ratePerGram: +v }))} />
                  <div>
                    <Label className="text-xs">Metal</Label>
                    <Input value={`${returnForm.metal} ${returnForm.purity || ""}`} disabled className="bg-muted/40" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Reason</Label>
                  <Textarea value={returnForm.note || ""} onChange={e => setReturnForm((f: any) => ({ ...f, note: e.target.value }))} placeholder="Reason for return (damaged, wrong purity, excess stock...)" />
                </div>
                <div className="bg-muted/30 border rounded-lg p-3 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Return Value</span>
                  <span className="font-bold text-lg text-red-600">-{inr(returnGstCalc.taxableValue)}</span>
                </div>
              </>
            )}
          </div>
          <Button onClick={saveReturn} className="mt-4 w-full" disabled={createMutation.isPending || !returnForm.linkedDocId}>
            {createMutation.isPending ? "Saving..." : "Save Return"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Old Gold Purchase dialog */}
      <Dialog open={openOldGold} onOpenChange={setOpenOldGold}>
        <DialogContent className="w-[95vw] sm:max-w-lg p-4 sm:p-6" aria-describedby={undefined}>
          <DialogHeader><DialogTitle className="text-lg font-display">Record Old Gold Purchase</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Search Customer</Label>
                <Input placeholder="Name, mobile..." value={searchCust} onChange={e => {
                  setSearchCust(e.target.value);
                  const match = customers.find(c => c.name.toLowerCase() === e.target.value.toLowerCase() || (c.mobile || c.phone || "").includes(e.target.value));
                  if (match) setOldGoldForm((f: any) => ({ ...f, customerId: match._id || match.id, customerName: match.name }));
                }} />
              </div>
              <div>
                <Label className="text-xs">Customer *</Label>
                <Select value={oldGoldForm.customerId || ""} onValueChange={val => {
                  const c = customers.find(x => (x._id || x.id) === val);
                  if (c) setOldGoldForm((f: any) => ({ ...f, customerId: val, customerName: c.name }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.filter(c => c.name.toLowerCase().includes(debouncedSearchCust.toLowerCase()) || (c.mobile || c.phone || "").includes(debouncedSearchCust)).sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(c => (
                      <SelectItem key={c._id || c.id} value={(c._id || c.id) as string}>{c.name} · {c.mobile || c.phone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" type="date" v={oldGoldForm.date} on={v => setOldGoldForm((f: any) => ({ ...f, date: v }))} />
              <Field label="Item Description" v={oldGoldForm.note || ""} on={v => setOldGoldForm((f: any) => ({ ...f, note: v }))} />
              <div>
                <Label className="text-xs">Purity</Label>
                <select className="w-full h-10 border rounded-md px-3 bg-background text-sm" value={oldGoldForm.purity} onChange={e => setOldGoldForm((f: any) => ({ ...f, purity: e.target.value }))}>
                  <option>24K</option><option>22K</option><option>18K</option><option>14K</option>
                </select>
              </div>
              <Field label="Gross Weight (g) *" type="number" v={String(oldGoldForm.weight)} on={v => setOldGoldForm((f: any) => ({ ...f, weight: +v }))} />
              <Field label="Deduction / Wastage %" type="number" v={String(oldGoldForm.deductionPct)} on={v => setOldGoldForm((f: any) => ({ ...f, deductionPct: +v }))} />
              <Field label="Rate ₹/g *" type="number" v={String(oldGoldForm.ratePerGram)} on={v => setOldGoldForm((f: any) => ({ ...f, ratePerGram: +v }))} />
              <div>
                <Label className="text-xs">Payment Mode</Label>
                <select className="w-full h-10 border rounded-md px-3 bg-background text-sm" value={oldGoldForm.paymentMode} onChange={e => setOldGoldForm((f: any) => ({ ...f, paymentMode: e.target.value }))}>
                  {["Cash", "UPI", "Card", "Bank"].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="bg-muted/30 border rounded-lg p-3 flex justify-between items-center">
              <div className="text-sm text-muted-foreground">Net Weight: {netOldGoldWeight.toFixed(3)}g</div>
              <div className="text-right"><div className="text-xs text-muted-foreground">Payout</div><span className="font-bold text-lg text-emerald-600">{inr(oldGoldPayout)}</span></div>
            </div>
          </div>
          <Button onClick={saveOldGold} className="mt-4 w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Saving..." : "Save Old Gold Purchase"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Reject reason dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(v) => { if (!v) setRejectTarget(null); }}>
        <DialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6" aria-describedby={undefined}>
          <DialogHeader><DialogTitle className="text-lg font-display">Reject {rejectTarget?.billNo}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Label className="text-xs">Reason</Label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Why is this being rejected?" />
            <Button variant="destructive" className="w-full" onClick={async () => { if (rejectTarget) { await handleReject(rejectTarget._id || rejectTarget.id, rejectReason); setRejectTarget(null); } }}>
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  const [focused, setFocused] = useState(false);

  if (type === "date") {
    let displayValue = v;
    if (!focused && v) {
      const parts = v.split('-');
      if (parts.length === 3) {
        displayValue = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <Input
          type={focused ? "date" : "text"}
          placeholder="DD/MM/YYYY"
          value={displayValue}
          onChange={(e) => on(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full h-9"
        />
      </div>
    );
  }
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label><Input type={type} value={v} onChange={e => on(e.target.value)} /></div>;
}
function ViewField({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

