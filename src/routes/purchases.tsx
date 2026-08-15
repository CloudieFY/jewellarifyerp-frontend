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
  PackageCheck, BarChart3, Truck, Receipt,
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
  const deleteInventoryMutation = useApiMutation((id: string) => api.inventory.remove(id), ["inventory"]);

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

  const createDefaultItem = (metal = "Gold", purity = "22K", rate = 0) => ({
    name: "",
    category: metal,
    metal: metal,
    purity: purity,
    huid: "",
    barcode: "",
    pcs: 1,
    grossWeight: 0,
    lessWeight: 0,
    netWeight: 0,
    hmc: 0,
    ratePerGram: rate,
    makingChargeType: "percentage" as "percentage" | "per_gram" | "fixed",
    makingChargeValue: 0,
    makingChargeAmount: 0,
    total: 0,
  });

  const calculateItemRow = (item: any) => {
    const gross = Number(item.grossWeight) || 0;
    const less = Number(item.lessWeight) || 0;
    const net = Math.max(0, gross - less);
    const rate = Number(item.ratePerGram) || 0;
    const hmc = Number(item.hmc) || 0;
    const mcVal = Number(item.makingChargeValue) || 0;

    let mcAmount = 0;
    if (item.makingChargeType === "percentage") {
      mcAmount = (net * rate * mcVal) / 100;
    } else if (item.makingChargeType === "per_gram") {
      mcAmount = net * mcVal;
    } else {
      mcAmount = mcVal;
    }

    const total = (net * rate) + mcAmount + hmc;
    return {
      ...item,
      grossWeight: gross,
      lessWeight: less,
      netWeight: net,
      ratePerGram: rate,
      hmc,
      makingChargeValue: mcVal,
      makingChargeAmount: mcAmount,
      total,
    };
  };

  const updateFormFromItems = (formState: any, itemsList: any[]) => {
    if (!itemsList || itemsList.length === 0) return formState;
    const calcItems = itemsList.map(calculateItemRow);
    const sumNetWt = calcItems.reduce((acc, i) => acc + (i.netWeight || 0), 0);
    const sumMc = calcItems.reduce((acc, i) => acc + (i.makingChargeAmount || 0), 0);
    const avgRate = sumNetWt > 0 ? (calcItems.reduce((acc, i) => acc + (i.netWeight * i.ratePerGram), 0) / sumNetWt) : (calcItems[0]?.ratePerGram || formState.ratePerGram || 0);

    return {
      ...formState,
      items: calcItems,
      weight: sumNetWt > 0 ? sumNetWt : (formState.weight || 0),
      ratePerGram: Math.round(avgRate),
      makingCharge: Math.round(sumMc),
      metal: calcItems[0]?.category || calcItems[0]?.metal || formState.metal || "Gold",
      purity: calcItems[0]?.purity || formState.purity || "22K",
    };
  };

  const empty: any = {
    id: "", type: "GST", billNo: "", date: new Date().toISOString().slice(0, 10),
    supplierId: "", supplierName: "", supplierGstin: "", metal: "Gold", category: "Metal",
    purity: "22K", hsnCode: "7113", weight: 0, ratePerGram: 0, makingCharge: 0, taxableValue: 0,
    gstPct: 3, cgst: 0, sgst: 0, igst: 0, total: 0, paymentMode: "Cash", note: "",
    docType: "Entry", status: "Completed", needsApproval: false, addToInventory: true,
    items: [createDefaultItem("Gold", "22K", 0)]
  };
  const [form, setForm] = useState<any>({ ...empty, type: isOperator ? "NON-GST" : "GST", gstPct: isOperator ? 0 : 3 });
  const isOrderForm = form.docType === "Order";
  const gstCalc = calcGST(form);

  const addItemRow = () => {
    const curItems = form.items && form.items.length > 0 ? form.items : [createDefaultItem(form.metal, form.purity, form.ratePerGram)];
    const newItem = createDefaultItem(form.metal, form.purity, form.ratePerGram);
    const updated = [...curItems, newItem];
    setForm((f: any) => updateFormFromItems(f, updated));
  };

  const updateItemRow = (idx: number, field: string, val: any) => {
    const curItems = form.items && form.items.length > 0 ? [...form.items] : [createDefaultItem(form.metal, form.purity, form.ratePerGram)];
    if (!curItems[idx]) return;
    curItems[idx] = { ...curItems[idx], [field]: val };
    setForm((f: any) => updateFormFromItems(f, curItems));
  };

  const removeItemRow = (idx: number) => {
    if (!form.items || form.items.length <= 1) return;
    const updated = form.items.filter((_: any, i: number) => i !== idx);
    setForm((f: any) => updateFormFromItems(f, updated));
  };

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
    setForm({
      ...empty,
      items: [createDefaultItem("Gold", "22K", 0)],
      docType: "Entry",
      type: isOperator ? "NON-GST" : "GST",
      gstPct: isOperator ? 0 : 3,
      addToInventory: true
    });
    setSearchSup("");
    setOpen(true);
  };
  const openNewOrder = () => {
    setEditingId(null);
    setForm({
      ...empty,
      items: [createDefaultItem("Gold", "22K", 0)],
      docType: "Order",
      status: "Draft",
      type: "GST",
      gstPct: 3,
      addToInventory: false
    });
    setSearchSup("");
    setOpen(true);
  };
  const openEdit = (p: any) => {
    setEditingId(p._id || p.id);
    let existingItems = p.items;
    if (!existingItems || existingItems.length === 0) {
      existingItems = [{
        name: p.category || p.metal || "Gold",
        category: p.metal || "Gold",
        metal: p.metal || "Gold",
        purity: p.purity || "22K",
        huid: "",
        barcode: "",
        pcs: 1,
        grossWeight: p.weight || 0,
        lessWeight: 0,
        netWeight: p.weight || 0,
        hmc: 0,
        ratePerGram: p.ratePerGram || 0,
        makingChargeType: "fixed",
        makingChargeValue: p.makingCharge || 0,
        makingChargeAmount: p.makingCharge || 0,
        total: (p.weight * p.ratePerGram) + (p.makingCharge || 0),
      }];
    }
    setForm({
      ...empty,
      ...p,
      id: p._id || p.id,
      items: existingItems.map(calculateItemRow),
      date: p.date ? new Date(p.date).toISOString().slice(0, 10) : empty.date
    });
    setSearchSup(p.supplierName || "");
    setOpen(true);
  };

  const save = async () => {
    if (!form.supplierName) {
      toast.error("Please enter or select a supplier name.");
      return;
    }

    const rawItems = form.items && form.items.length > 0 ? form.items : [createDefaultItem(form.metal, form.purity, form.ratePerGram)];
    const itemsList = rawItems.map(calculateItemRow);
    const totalWeight = itemsList.reduce((sum: number, i: any) => sum + (i.netWeight || 0), 0) || Number(form.weight) || 0;

    if (!totalWeight && !form.weight) {
      toast.error("Please enter item weight details.");
      return;
    }

    const prefix = isOrderForm ? "PO" : "PUR";
    const countForPrefix = list.filter((p: any) => (isOrderForm ? p.docType === "Order" : p.docType === "Entry" || !p.docType)).length;
    const billNo = form.billNo || `${prefix}-${(countForPrefix + 1).toString().padStart(4, "0")}`;

    const syncedForm = {
      ...form,
      items: itemsList,
      weight: totalWeight,
      makingCharge: itemsList.reduce((sum: number, i: any) => sum + (i.makingChargeAmount || 0), 0),
      metal: itemsList[0]?.category || itemsList[0]?.metal || form.metal || "Gold",
      purity: itemsList[0]?.purity || form.purity || "22K",
    };

    const { taxableValue, cgst, sgst, igst, total } = calcGST(syncedForm);
    const status = isOrderForm ? (form.status || "Draft") : "Completed";

    const payload = {
      ...syncedForm,
      billNo,
      taxableValue,
      cgst,
      sgst,
      igst,
      total,
      status,
    };

    if (editingId) {
      try {
        await updateMutation.mutateAsync({ id: editingId, body: payload });
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
      await createMutation.mutateAsync(payload as any);

      if (!isOrderForm && status === "Completed" && form.supplierId) {
        await applySupplierLedgerTx(form.supplierId, {
          type: "Credit", amount: total, metal: payload.metal, purity: payload.purity || "22K",
          weight: Number(payload.weight) || 0, note: `Purchase Bill: ${billNo} (${form.type || "GST"})`,
        }, form.paymentMode === "Credit");
      }

      if (!isOrderForm && status === "Completed" && form.addToInventory) {
        let addedCount = 0;
        for (let idx = 0; idx < itemsList.length; idx++) {
          const item = itemsList[idx];
          try {
            await createInventoryMutation.mutateAsync({
              id: Date.now().toString() + Math.random().toString().slice(2, 6),
              name: item.name?.trim() ? item.name.trim() : `${item.category || payload.metal || "Gold"} ${item.purity || payload.purity || "22K"} (${billNo})`,
              category: item.category || payload.metal || "Gold",
              subcategory: form.category || "Metal",
              metalType: item.category || payload.metal || "Gold",
              purity: item.purity || payload.purity || "22K",
              huid: item.huid || "",
              barcode: item.barcode || `PUR-${billNo}-${Date.now().toString().slice(-4)}-${idx + 1}`,
              grossWeight: Number(item.grossWeight) || Number(totalWeight) || 0,
              stoneWeight: Number(item.lessWeight) || 0,
              netWeight: Number(item.netWeight) || Number(totalWeight) || 0,
              stock: Number(item.pcs) || 1,
              availableStock: Number(item.pcs) || 1,
              ratePerGram: Number(item.ratePerGram) || Number(payload.ratePerGram) || 0,
              purchaseRate: Number(item.ratePerGram) || Number(payload.ratePerGram) || 0,
              costPrice: Number(item.total) || total,
              sellingPrice: Number(item.total) || total,
              makingChargeType: item.makingChargeType || "fixed",
              makingCharge: Number(item.makingChargeValue) || 0,
              hsnCode: form.hsnCode || "7113",
              defaultSupplierId: form.supplierId || "",
              supplierItemCode: billNo,
              gstPct: form.gstPct || 0,
              status: "Active"
            });
            addedCount++;
          } catch (e) {
            console.error("Failed to add purchase item to inventory:", e);
          }
        }
        if (addedCount > 0) {
          toast.success(`Logged ${addedCount} item(s) directly into Inventory stock!`);
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

  // Full ledger-reversing and inventory-deleting removal for Purchase Entries.
  const removeEntry = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this purchase? This will remove the supplier ledger transaction AND delete matching items from Inventory stock.")) {
      const p: any = list.find((x: any) => (x._id || x.id) === id);
      if (p) {
        // 1. Reverse Supplier Ledger
        if (p.supplierId) {
          const s: any = suppliers.find((x: any) => (x._id || x.id) === p.supplierId);
          if (s) {
            const billKey = p.billNo || "";
            const matchingTxs = (s.transactions || []).filter((t: any) => t.note && billKey && t.note.toLowerCase().includes(billKey.toLowerCase()));
            
            let weightToDeduct = 0;
            let silverWeightToDeduct = 0;
            let amountToDeduct = 0;

            matchingTxs.forEach((tx: any) => {
              const sign = tx.type === "Credit" ? 1 : -1;
              if (tx.metal === "Gold") weightToDeduct += (tx.weight || 0) * sign;
              else if (tx.metal === "Silver") silverWeightToDeduct += (tx.weight || 0) * sign;
              if (p.paymentMode === "Credit" || tx.kind === "Payment") amountToDeduct += (tx.amount || p.total || 0) * sign;
            });

            const updatedTransactions = (s.transactions || []).filter((t: any) => !(t.note && billKey && t.note.toLowerCase().includes(billKey.toLowerCase())));
            let newOutstanding = Math.max(0, (s.outstanding || 0) - amountToDeduct);

            try {
              await updateSupplierMutation.mutateAsync({
                id: s._id || s.id || "",
                body: {
                  ...s,
                  balanceGold: Math.max(0, (s.balanceGold || 0) - weightToDeduct),
                  balanceSilver: Math.max(0, (s.balanceSilver || 0) - silverWeightToDeduct),
                  outstanding: newOutstanding,
                  transactions: updatedTransactions
                } as any
              });
            } catch (e) {
              console.error("Failed to reverse supplier ledger:", e);
            }
          }
        }

        // 2. Delete associated inventory items created from this purchase
        try {
          const invRes: any = await api.inventory.getAll();
          const allInv = Array.isArray(invRes) ? invRes : (invRes?.data || []);
          const matchingInv = allInv.filter((inv: any) => 
            inv.supplierItemCode === p.billNo ||
            (p.supplierId && inv.defaultSupplierId === p.supplierId && 
             (inv.metalType?.toLowerCase() === p.metal?.toLowerCase() || inv.category?.toLowerCase() === p.metal?.toLowerCase()) &&
             inv.purity === p.purity)
          );

          let removedInvCount = 0;
          for (const invItem of matchingInv) {
            const invId = invItem._id || invItem.id;
            if (!invId) continue;
            await deleteInventoryMutation.mutateAsync(invId);
            removedInvCount++;
          }
          if (removedInvCount > 0) {
            toast.success(`Removed ${removedInvCount} matching item(s) from Inventory stock!`);
          }
        } catch (e) {
          console.error("Failed to delete inventory items for deleted purchase:", e);
        }
      }

      await deleteMutation.mutateAsync(id);
      toast.success("Purchase deleted successfully!");
    }
  };

  // Plain delete for Orders / Returns / Old Gold docs — also cleans matching ledger transactions if any exist.
  const removeDoc = async (id: string) => {
    if (window.confirm("Delete this record? This will also remove any matching supplier ledger transaction.")) {
      const p: any = list.find((x: any) => (x._id || x.id) === id);
      if (p && p.supplierId && p.billNo) {
        const s: any = suppliers.find((x: any) => (x._id || x.id) === p.supplierId);
        if (s) {
          const billKey = p.billNo;
          const updatedTransactions = (s.transactions || []).filter((t: any) => !(t.note && t.note.toLowerCase().includes(billKey.toLowerCase())));
          try {
            await updateSupplierMutation.mutateAsync({
              id: s._id || s.id || "",
              body: { ...s, transactions: updatedTransactions } as any
            });
          } catch (e) {
            console.error("Failed to clean supplier ledger on doc delete:", e);
          }
        }
      }
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
  const [viewReturn, setViewReturn] = useState<any>(null);
  const emptyReturn: any = { id: "", billNo: "", date: new Date().toISOString().slice(0, 10), linkedDocId: "", supplierId: "", supplierName: "", metal: "Gold", purity: "22K", weight: 0, ratePerGram: 0, makingCharge: 0, gstPct: 0, note: "" };
  const [returnForm, setReturnForm] = useState<any>(emptyReturn);
  const returnList = useMemo(() => list.filter((p: any) => p.docType === "Return"), [list]);
  const returnedDocIds = useMemo(() => new Set(returnList.map((r: any) => r.linkedDocId).filter(Boolean)), [returnList]);
  const returnableEntries = useMemo(() => list.filter((p: any) => (p.docType === "Entry" || !p.docType) && p.supplierId && !returnedDocIds.has(p._id || p.id)), [list, returnedDocIds]);
  const returnGstCalc = calcGST(returnForm);

  const openNewReturn = () => { setReturnForm(emptyReturn); setOpenReturn(true); };
  const pickReturnSource = (id: string) => {
    const src: any = returnableEntries.find((p: any) => (p._id || p.id) === id);
    if (!src) return;

    const items = src.items || [];
    const calcWeight = src.weight || items.reduce((s: number, i: any) => s + (i.netWeight || i.grossWeight || 0), 0) || 0;
    const calcRate = src.ratePerGram || items[0]?.ratePerGram || (calcWeight > 0 ? Math.round((src.taxableValue || src.total || 0) / calcWeight) : 0);
    const calcMetal = src.metal || items[0]?.category || items[0]?.metal || "Gold";
    const calcPurity = src.purity || items[0]?.purity || "22K";
    const calcGstPct = src.gstPct ?? (src.type === "GST" ? 3 : 0);

    setReturnForm((f: any) => ({
      ...f,
      linkedDocId: id,
      supplierId: src.supplierId,
      supplierName: src.supplierName,
      metal: calcMetal,
      purity: calcPurity,
      weight: calcWeight,
      ratePerGram: calcRate,
      makingCharge: src.makingCharge || 0,
      gstPct: calcGstPct,
      originalWeight: calcWeight,
      originalTotal: src.total || 0,
      originalBillNo: src.billNo,
      items: items.map((it: any) => ({ ...it })),
    }));
  };

  const updateReturnItem = (index: number, field: string, value: any) => {
    setReturnForm((f: any) => {
      const items = [...(f.items || [])];
      const updated = { ...items[index], [field]: value };
      
      const netWt = Number(updated.netWeight ?? updated.grossWeight ?? 0);
      const rate = Number(updated.ratePerGram || 0);
      const mc = Number(updated.makingChargeValue || updated.makingCharge || 0);
      updated.total = Math.round(netWt * rate + mc);
      
      items[index] = updated;

      const totalWt = items.reduce((sum: number, it: any) => sum + Number(it.netWeight ?? it.grossWeight ?? 0), 0);
      const avgRate = items.length > 0 ? (items[0].ratePerGram || f.ratePerGram) : f.ratePerGram;

      return {
        ...f,
        items,
        weight: totalWt > 0 ? totalWt : f.weight,
        ratePerGram: avgRate || f.ratePerGram,
      };
    });
  };

  const addReturnItem = () => {
    setReturnForm((f: any) => {
      const newItem = {
        name: `Return Item ${(f.items?.length || 0) + 1}`,
        category: f.metal || "Gold",
        purity: f.purity || "22K",
        pcs: 1,
        grossWeight: 0,
        netWeight: 0,
        ratePerGram: f.ratePerGram || 0,
        makingChargeValue: 0,
        total: 0
      };
      const items = [...(f.items || []), newItem];
      return { ...f, items };
    });
  };

  const removeReturnItem = (index: number) => {
    setReturnForm((f: any) => {
      const items = (f.items || []).filter((_: any, i: number) => i !== index);
      const totalWt = items.reduce((sum: number, it: any) => sum + Number(it.netWeight ?? it.grossWeight ?? 0), 0);
      return { ...f, items, weight: totalWt > 0 ? totalWt : f.weight };
    });
  };

  const saveReturn = async () => {
    if (!returnForm.linkedDocId) { toast.error("Select the original purchase bill."); return; }
    if (returnedDocIds.has(returnForm.linkedDocId)) { toast.error("This purchase bill has already been returned!"); return; }
    if (!returnForm.weight || returnForm.weight <= 0) { toast.error("Enter a valid returned weight (g)."); return; }

    const src: any = returnableEntries.find((p: any) => (p._id || p.id) === returnForm.linkedDocId);
    const billNo = `PR-${(returnList.length + 1).toString().padStart(4, "0")}`;
    const { taxableValue, cgst, sgst, igst, total } = calcGST(returnForm);

    try {
      await createMutation.mutateAsync({
        ...returnForm,
        billNo,
        originalBillNo: returnForm.originalBillNo || src?.billNo,
        taxableValue,
        cgst,
        sgst,
        igst,
        total,
        docType: "Return",
        status: "Completed",
        paymentMode: src?.paymentMode || "Cash",
        items: returnForm.items || src?.items || []
      } as any);
      if (returnForm.supplierId) {
        await applySupplierLedgerTx(returnForm.supplierId, {
          type: "Debit", amount: total, metal: returnForm.metal, purity: returnForm.purity || "22K",
          weight: Number(returnForm.weight) || 0, note: `Purchase Return: ${billNo} (against ${src?.billNo || ""})`,
        }, true);
      }

      // Completely remove returned purchase items from Inventory database & stock
      try {
        const invRes: any = await api.inventory.getAll();
        const allInv = Array.isArray(invRes) ? invRes : (invRes?.data || []);
        
        const returnItemBarcodes = (returnForm.items || []).map((it: any) => it.barcode).filter(Boolean);
        const returnItemHuids = (returnForm.items || []).map((it: any) => it.huid).filter(Boolean);
        const returnItemNames = (returnForm.items || []).map((it: any) => it.name).filter(Boolean);

        const matchingInv = allInv.filter((inv: any) => 
          (src?.billNo && (
            inv.supplierItemCode === src?.billNo ||
            inv.barcode?.includes(src?.billNo) ||
            inv.name?.includes(src?.billNo)
          )) ||
          (inv.barcode && returnItemBarcodes.includes(inv.barcode)) ||
          (inv.huid && returnItemHuids.includes(inv.huid)) ||
          (inv.name && returnItemNames.includes(inv.name)) ||
          (returnForm.supplierId && inv.defaultSupplierId === returnForm.supplierId && 
           (inv.metalType?.toLowerCase() === returnForm.metal?.toLowerCase() || inv.category?.toLowerCase() === returnForm.metal?.toLowerCase()) &&
           inv.purity === returnForm.purity)
        );

        let removedCount = 0;
        for (const invItem of matchingInv) {
          const invId = invItem._id || invItem.id;
          if (!invId) continue;
          
          await deleteInventoryMutation.mutateAsync(invId);
          removedCount++;
        }
        if (removedCount > 0) {
          queryClient.invalidateQueries({ queryKey: ["inventory"] });
          toast.success(`Removed ${removedCount} returned item(s) from Inventory stock!`);
        }
      } catch (err) {
        console.error("Error removing inventory item on purchase return:", err);
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
      {/* Header Banner */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-6 rounded-2xl text-white shadow-lg mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <ShoppingBag className="w-3.5 h-3.5" /> Bullion &amp; Vendor Procurement
            </span>
            <span className="text-xs text-slate-300">{filteredEntries.length} Purchases Recorded</span>
          </div>
          <h1 className="text-3xl font-display font-bold">Purchases &amp; Vendor Bills</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Entries, purchase orders, vendor returns, old gold buyback &amp; supplier invoice management.
          </p>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 w-full h-auto bg-muted/80 p-1 rounded-xl gap-1 border">
          <TabsTrigger value="entry" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-amber-900 data-[state=active]:shadow-xs"><ShoppingBag className="w-3.5 h-3.5" />Entry</TabsTrigger>
          <TabsTrigger value="orders" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-amber-900 data-[state=active]:shadow-xs"><ClipboardList className="w-3.5 h-3.5" />Orders</TabsTrigger>
          <TabsTrigger value="returns" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-amber-900 data-[state=active]:shadow-xs"><RotateCcw className="w-3.5 h-3.5" />Returns</TabsTrigger>
          <TabsTrigger value="oldgold" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-amber-900 data-[state=active]:shadow-xs"><Coins className="w-3.5 h-3.5" />Old Gold</TabsTrigger>
          <TabsTrigger value="reports" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:text-amber-900 data-[state=active]:shadow-xs"><BarChart3 className="w-3.5 h-3.5" />Reports</TabsTrigger>
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
            <Button size="lg" className="bg-amber-800 hover:bg-amber-900 text-white font-medium shadow-sm" onClick={openNewEntry}><Plus className="w-4 h-4 mr-2" />New Purchase</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border shadow-sm bg-card hover:shadow-md transition-all">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Purchases</div>
                  <div className="text-2xl font-bold font-display text-indigo-600 mt-1">{filteredEntries.length}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Recorded Invoices</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 grid place-items-center">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm bg-card hover:shadow-md transition-all">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">This Month</div>
                  <div className="text-2xl font-bold font-display text-emerald-600 mt-1">{inr(monthTotal)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Monthly Purchase Value</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 grid place-items-center">
                  <Receipt className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm bg-card hover:shadow-md transition-all">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Suppliers Used</div>
                  <div className="text-2xl font-bold font-display text-amber-600 mt-1">
                    {new Set(filteredEntries.map((p: any) => p.supplierName)).size}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Active Vendors</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 grid place-items-center">
                  <Truck className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border shadow-sm overflow-hidden bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 bg-card border-b">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-600" /> Purchase Bills &amp; Invoices
              </CardTitle>
              <Button size="sm" variant={gstOnly ? "default" : "outline"} className={gstOnly ? "bg-amber-800 hover:bg-amber-900 text-white" : ""} onClick={() => setGstOnly(v => !v)}>
                {gstOnly ? "Showing GST Invoices" : "GST Invoices Only"}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? <p className="text-center text-muted-foreground py-12">Loading purchases...</p> : filteredEntries.length === 0 ? <p className="text-center text-muted-foreground py-12">No purchases yet.</p> :
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto max-h-[600px] relative">
                    <table className="w-full text-sm min-w-[950px] border-collapse">
                      <thead className="text-left text-xs font-bold uppercase tracking-wider sticky top-0 bg-slate-900 text-slate-200 z-10 shadow-sm">
                        <tr>
                          <th className="p-3.5 pl-5 whitespace-nowrap">Bill No</th>
                          <th className="p-3.5 whitespace-nowrap">Type</th>
                          <th className="p-3.5 whitespace-nowrap">Category</th>
                          <th className="p-3.5 whitespace-nowrap">Date</th>
                          <th className="p-3.5 whitespace-nowrap">Supplier</th>
                          <th className="p-3.5 whitespace-nowrap">Metal / Purity</th>
                          <th className="p-3.5 text-right whitespace-nowrap">Wt (g)</th>
                          <th className="p-3.5 text-right whitespace-nowrap">Total Amount</th>
                          <th className="p-3.5 whitespace-nowrap">Status</th>
                          <th className="p-3.5 text-right pr-5 whitespace-nowrap w-36">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 bg-card">
                        {paginated.map((p: any) => (
                          <tr key={p._id || p.id} className="group hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-all">
                            <td className="p-3.5 pl-5">
                              <span className="font-mono font-bold text-foreground text-xs bg-muted/60 px-2 py-1 rounded border border-border">
                                {p.billNo}
                              </span>
                            </td>
                            <td className="p-3.5">
                              <span className={`text-[10px] font-bold uppercase tracking-wider border rounded-full px-2.5 py-0.5 ${
                                p.type === "NON-GST"
                                  ? "bg-slate-100 text-slate-700 border-slate-300"
                                  : "bg-emerald-50 text-emerald-800 border-emerald-300"
                              }`}>
                                {p.type === "NON-GST" ? "Non-GST" : "GST"}
                              </span>
                            </td>
                            <td className="p-3.5 text-xs font-medium text-muted-foreground">{p.category || "Metal"}</td>
                            <td className="p-3.5 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatDate(p.date)}</td>
                            <td className="p-3.5 font-semibold text-foreground">{p.supplierName}</td>
                            <td className="p-3.5">
                              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-300 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                                {p.metal} {p.purity}
                              </Badge>
                            </td>
                            <td className="p-3.5 text-right">
                              <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2.5 py-0.5 font-mono font-bold text-xs rounded-full">
                                {p.weight} g
                              </span>
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-emerald-600 text-sm">{inr(p.total)}</td>
                            <td className="p-3.5 space-y-1">
                               <StatusBadge status={p.status} />
                               {returnList.some((r: any) => r.linkedDocId === (p._id || p.id)) && (
                                 <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-bold text-[10px] flex items-center gap-1 w-fit shadow-2xs">
                                   <RotateCcw className="w-2.5 h-2.5 text-rose-600" /> Returned
                                 </Badge>
                               )}
                             </td>
                            <td className="p-3.5 text-right pr-5">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="outline" className="h-8 w-8 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => setViewPurchase(p)} title="View Bill"><Eye className="w-3.5 h-3.5" /></Button>
                                <Button size="icon" variant="outline" className="h-8 w-8 text-slate-700 hover:bg-slate-100" onClick={() => openEdit(p)} title="Edit Bill"><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button size="icon" variant="outline" className="h-8 w-8 border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => removeEntry(p._id || p.id)} title="Delete Bill"><Trash2 className="w-3.5 h-3.5" /></Button>
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
              <p className="text-xs text-muted-foreground">Raise a PO with a supplier, then receive it directly into a purchase entry.</p>
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
                              {p.status !== "Completed" && <Button size="sm" onClick={() => handleReceive(p)}><PackageCheck className="w-3.5 h-3.5 mr-1" />Receive</Button>}
                              <Button size="sm" variant="ghost" onClick={() => setViewPurchase(p)} title="View"><Eye className="w-4 h-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => openEdit(p)} title="Edit"><Pencil className="w-4 h-4" /></Button>
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
                        const againstBill = p.originalBillNo || src?.billNo || "—";
                        return (
                          <tr key={p._id || p.id} className="border-b last:border-0 hover:bg-rose-50/40 dark:hover:bg-rose-950/20 transition-all cursor-pointer" onClick={() => setViewReturn(p)}>
                            <td className="py-2.5 px-4 font-mono font-bold text-foreground">{p.billNo}</td>
                            <td className="whitespace-nowrap font-mono text-xs">{formatDate(p.date)}</td>
                            <td className="font-semibold text-foreground">{p.supplierName}</td>
                            <td>
                              {againstBill !== "—" ? (
                                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-300 font-mono font-bold text-xs">
                                  {againstBill}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td>{p.metal} {p.purity}</td>
                            <td className="text-right font-mono font-bold">{p.weight}g</td>
                            <td className="text-right font-mono font-bold text-rose-600">-{inr(p.total)}</td>
                            <td className="text-right px-4" onClick={e => e.stopPropagation()}>
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="outline" className="h-8 w-8 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => setViewReturn(p)} title="View Return Details">
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="icon" variant="outline" className="h-8 w-8 text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => removeDoc(p._id || p.id)} title="Delete Return">
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
        <DialogContent className="w-[96vw] max-w-6xl max-h-[92vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6" aria-describedby={undefined} onInteractOutside={(e) => e.preventDefault()} onKeyDown={handleKeyNav}>
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

            {/* Section: Purchased Items / Stock Details (Fixed width & responsive layout) */}
            <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3.5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                    <PackageCheck className="w-4 h-4 text-amber-700 shrink-0" />
                    Purchased Item(s) &amp; Inventory Details
                  </h3>
                  <p className="text-[11px] text-amber-800/80">Enter specific item specs (HUID, weights, rates, making charges) to save directly into inventory stock.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs bg-white border-amber-300 text-amber-900 hover:bg-amber-100 font-semibold shadow-xs shrink-0 whitespace-nowrap"
                  onClick={addItemRow}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Product Item
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-amber-200/90 bg-white max-w-full">
                <table className="w-full text-xs min-w-[780px] border-collapse">
                  <thead className="bg-amber-100/80 text-amber-950 text-[10px] font-bold uppercase tracking-wider border-b border-amber-200">
                    <tr>
                      <th className="p-2 text-left w-[18%]">Product / Purity</th>
                      <th className="p-2 text-left w-[9%]">HUID</th>
                      <th className="p-2 text-center w-[5%]">Pcs</th>
                      <th className="p-2 text-right w-[9%]">Gross Wt</th>
                      <th className="p-2 text-right w-[8%]">Less Wt</th>
                      <th className="p-2 text-right w-[8%]">Net Wt</th>
                      <th className="p-2 text-right w-[7%]">HMC (₹)</th>
                      <th className="p-2 text-right w-[11%]">Rate(₹/g)</th>
                      <th className="p-2 text-left w-[14%]">Making Charge</th>
                      <th className="p-2 text-right w-[11%]">Total (₹)</th>
                      <th className="p-2 text-center w-[4%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100/80">
                    {(form.items || []).map((item: any, idx: number) => {
                      const calc = calculateItemRow(item);
                      return (
                        <tr key={idx} className="hover:bg-amber-50/60 transition-colors">
                          <td className="p-1.5 space-y-1">
                            <Input
                              placeholder="Item name (e.g. Ring)"
                              value={item.name || ""}
                              onChange={e => updateItemRow(idx, "name", e.target.value)}
                              className="h-7.5 text-xs bg-white border-amber-200 focus-visible:ring-amber-500 font-medium px-2"
                            />
                            <div className="flex gap-1">
                              <select
                                className="h-6.5 border border-amber-200 rounded text-[11px] px-1 bg-white font-semibold text-amber-900 w-1/2"
                                value={item.purity || "22K"}
                                onChange={e => updateItemRow(idx, "purity", e.target.value)}
                              >
                                {["24K", "22K", "20K", "18K", "14K", "925", "999"].map(pur => (
                                  <option key={pur} value={pur}>{pur}</option>
                                ))}
                              </select>
                              <select
                                className="h-6.5 border border-amber-200 rounded text-[11px] px-1 bg-white text-slate-700 w-1/2"
                                value={item.category || "Gold"}
                                onChange={e => updateItemRow(idx, "category", e.target.value)}
                              >
                                {["Gold", "Silver", "Diamond", "Stone", "Other"].map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="p-1.5 align-top">
                            <Input
                              placeholder="HUID"
                              value={item.huid || ""}
                              onChange={e => updateItemRow(idx, "huid", e.target.value.toUpperCase())}
                              className="h-7.5 text-xs bg-white border-amber-200 font-mono uppercase px-1.5"
                            />
                          </td>
                          <td className="p-1.5 align-top">
                            <Input
                              type="number"
                              min={1}
                              value={item.pcs ?? 1}
                              onChange={e => updateItemRow(idx, "pcs", Math.max(1, +e.target.value))}
                              className="h-7.5 text-xs bg-white border-amber-200 text-center font-bold px-1"
                            />
                          </td>
                          <td className="p-1.5 align-top">
                            <Input
                              type="number"
                              step="0.001"
                              placeholder="0"
                              value={item.grossWeight || ""}
                              onChange={e => updateItemRow(idx, "grossWeight", +e.target.value)}
                              className="h-7.5 text-xs bg-white border-amber-200 text-right font-mono font-semibold px-1.5"
                            />
                          </td>
                          <td className="p-1.5 align-top">
                            <Input
                              type="number"
                              step="0.001"
                              placeholder="0"
                              value={item.lessWeight || ""}
                              onChange={e => updateItemRow(idx, "lessWeight", +e.target.value)}
                              className="h-7.5 text-xs bg-white border-amber-200 text-right font-mono px-1.5"
                            />
                          </td>
                          <td className="p-1.5 align-top text-right font-bold text-amber-950 font-mono pt-2.5 text-xs">
                            {calc.netWeight.toFixed(3)}g
                          </td>
                          <td className="p-1.5 align-top">
                            <Input
                              type="number"
                              placeholder="0"
                              value={item.hmc || ""}
                              onChange={e => updateItemRow(idx, "hmc", +e.target.value)}
                              className="h-7.5 text-xs bg-white border-amber-200 text-right font-mono px-1.5"
                            />
                          </td>
                          <td className="p-1.5 align-top">
                            <Input
                              type="number"
                              placeholder="0"
                              value={item.ratePerGram || ""}
                              onChange={e => updateItemRow(idx, "ratePerGram", +e.target.value)}
                              className="h-7.5 text-xs bg-white border-amber-200 text-right font-mono font-bold text-emerald-800 px-1.5"
                            />
                          </td>
                          <td className="p-1.5 align-top space-y-1">
                            <select
                              className="h-6.5 border border-amber-200 rounded text-[11px] px-1 bg-white w-full text-slate-700 font-medium"
                              value={item.makingChargeType || "percentage"}
                              onChange={e => updateItemRow(idx, "makingChargeType", e.target.value)}
                            >
                              <option value="percentage">% of value</option>
                              <option value="per_gram">Per gram (₹/g)</option>
                              <option value="fixed">Fixed Amount (₹)</option>
                            </select>
                            <Input
                              type="number"
                              placeholder="0"
                              value={item.makingChargeValue || ""}
                              onChange={e => updateItemRow(idx, "makingChargeValue", +e.target.value)}
                              className="h-6.5 text-xs bg-white border-amber-200 text-right font-mono px-1.5"
                            />
                          </td>
                          <td className="p-1.5 align-top text-right font-bold text-emerald-700 text-xs font-mono pt-2.5 whitespace-nowrap">
                            {inr(calc.total)}
                          </td>
                          <td className="p-1.5 align-top text-center pt-1.5">
                            {(form.items || []).length > 1 && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-rose-600 hover:bg-rose-100 hover:text-rose-800"
                                onClick={() => removeItemRow(idx)}
                                title="Remove Item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
        <DialogContent className="w-[95vw] sm:max-w-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader><DialogTitle className="text-lg font-display">{viewPurchase?.docType === "Order" ? "Purchase Order Details" : "Purchase Bill Details"}</DialogTitle></DialogHeader>
          {viewPurchase && (() => {
            const p = viewPurchase;
            const cgst = p.cgst ?? ((p.weight * p.ratePerGram + p.makingCharge) * (p.gstPct / 2) / 100);
            const sgst = p.sgst ?? cgst;
            const taxable = p.taxableValue ?? (p.weight * p.ratePerGram + p.makingCharge);
            return (
              <div className="space-y-3 mt-2 text-sm">
                {(() => {
                  const returns = returnList.filter((r: any) => r.linkedDocId === (p._id || p.id));
                  if (returns.length === 0) return null;
                  return (
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-1.5 text-xs shadow-xs">
                      <div className="flex justify-between items-center font-bold text-rose-950">
                        <span className="flex items-center gap-1.5 text-rose-900 font-semibold">
                          <RotateCcw className="w-4 h-4 text-rose-600 shrink-0" /> Purchase Return Recorded
                        </span>
                        <Badge className="bg-rose-600 text-white font-bold text-[10px]">
                          {returns.map((r: any) => r.billNo).join(", ")}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-rose-900 text-[11px] border-t border-rose-200/70 pt-1 font-mono">
                        <span>Returned Weight: <strong>{returns.reduce((s: number, r: any) => s + (r.weight || 0), 0)}g</strong></span>
                        <span>Returned Amount: <strong className="text-rose-700">-{inr(returns.reduce((s: number, r: any) => s + (r.total || 0), 0))}</strong></span>
                      </div>
                    </div>
                  );
                })()}
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

                {p.items && p.items.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Purchased Items ({p.items.length})</div>
                    <div className="overflow-x-auto rounded border bg-muted/20">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted text-muted-foreground font-semibold">
                          <tr>
                            <th className="p-2">Item</th>
                            <th className="p-2">HUID</th>
                            <th className="p-2 text-center">Pcs</th>
                            <th className="p-2 text-right">Gross Wt</th>
                            <th className="p-2 text-right">Less Wt</th>
                            <th className="p-2 text-right">Net Wt</th>
                            <th className="p-2 text-right">Rate/g</th>
                            <th className="p-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {p.items.map((it: any, i: number) => (
                            <tr key={i}>
                              <td className="p-2 font-medium">{it.name || `${it.category || p.metal} ${it.purity || p.purity}`}</td>
                              <td className="p-2 font-mono uppercase">{it.huid || "—"}</td>
                              <td className="p-2 text-center">{it.pcs || 1}</td>
                              <td className="p-2 text-right font-mono">{it.grossWeight}g</td>
                              <td className="p-2 text-right font-mono">{it.lessWeight || 0}g</td>
                              <td className="p-2 text-right font-mono font-bold">{it.netWeight}g</td>
                              <td className="p-2 text-right font-mono">{inr(it.ratePerGram)}</td>
                              <td className="p-2 text-right font-mono font-bold text-emerald-600">{inr(it.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

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

      {/* View Return Details dialog */}
      <Dialog open={!!viewReturn} onOpenChange={(v) => { if (!v) setViewReturn(null); }}>
        <DialogContent className="w-[95vw] sm:max-w-xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-lg font-display flex items-center justify-between">
              <span className="flex items-center gap-2 text-rose-950 font-bold">
                <RotateCcw className="w-5 h-5 text-rose-600" /> Purchase Return Details
              </span>
              <Badge className="bg-rose-600 text-white font-bold">{viewReturn?.billNo}</Badge>
            </DialogTitle>
          </DialogHeader>

          {viewReturn && (() => {
            const p = viewReturn;
            const src = list.find((x: any) => (x._id || x.id) === p.linkedDocId);
            const againstBillNo = p.originalBillNo || src?.billNo || "—";
            const cgst = p.cgst || 0;
            const sgst = p.sgst || 0;
            const taxable = p.taxableValue || (p.weight * p.ratePerGram);

            return (
              <div className="space-y-4 mt-2 text-sm">
                <div className="bg-rose-50/80 border border-rose-200 rounded-lg p-3 grid grid-cols-2 gap-3 text-xs">
                  <ViewField label="Return Voucher No" value={p.billNo} />
                  <ViewField label="Return Date" value={formatDate(p.date)} />
                  <ViewField label="Supplier Name" value={p.supplierName || "—"} />
                  <div>
                    <span className="text-muted-foreground text-[11px] font-semibold block">Against Bill No</span>
                    <Badge variant="outline" className="bg-amber-100/70 text-amber-900 border-amber-300 font-mono font-bold text-xs mt-0.5">
                      {againstBillNo}
                    </Badge>
                  </div>
                  <ViewField label="Metal / Purity" value={`${p.metal} ${p.purity || ""}`} />
                  <ViewField label="Returned Weight" value={`${p.weight}g`} />
                  <ViewField label="Rate / Gram" value={inr(p.ratePerGram || 0)} />
                  <ViewField label="Payment Mode" value={p.paymentMode || "Cash"} />
                </div>

                {p.note && (
                  <div className="bg-muted/30 border rounded-lg p-2.5 text-xs">
                    <span className="font-bold text-muted-foreground block mb-0.5">Reason for Return</span>
                    <p className="text-foreground italic">{p.note}</p>
                  </div>
                )}

                {p.items && p.items.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-rose-900 flex justify-between items-center">
                      <span>Returned Item Spec Breakdown ({p.items.length})</span>
                    </div>
                    <div className="overflow-x-auto rounded-lg border bg-card">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-rose-100/70 text-rose-950 font-semibold border-b">
                          <tr>
                            <th className="p-2">Item Name</th>
                            <th className="p-2">HUID / Barcode</th>
                            <th className="p-2 text-center">Pcs</th>
                            <th className="p-2 text-right">Net Wt</th>
                            <th className="p-2 text-right">Rate/g</th>
                            <th className="p-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {p.items.map((it: any, i: number) => (
                            <tr key={i} className="hover:bg-muted/30">
                              <td className="p-2 font-medium text-foreground">{it.name || `${it.category || p.metal} ${it.purity || p.purity}`}</td>
                              <td className="p-2 font-mono text-[10px] uppercase text-muted-foreground">{it.huid || it.barcode || "—"}</td>
                              <td className="p-2 text-center font-mono">{it.pcs || 1}</td>
                              <td className="p-2 text-right font-mono font-bold">{it.netWeight || it.grossWeight || 0}g</td>
                              <td className="p-2 text-right font-mono">{inr(it.ratePerGram || 0)}</td>
                              <td className="p-2 text-right font-mono font-bold text-rose-700">{inr(it.total || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t">
                  <div className="bg-muted/40 rounded p-2 text-center">
                    <div className="text-[11px] text-muted-foreground">Taxable Value</div>
                    <div className="font-semibold">{inr(taxable)}</div>
                  </div>
                  <div className="bg-rose-50 rounded p-2 text-center">
                    <div className="text-[11px] text-rose-700">CGST</div>
                    <div className="font-semibold text-rose-700">{inr(cgst)}</div>
                  </div>
                  <div className="bg-rose-50 rounded p-2 text-center">
                    <div className="text-[11px] text-rose-700">SGST</div>
                    <div className="font-semibold text-rose-700">{inr(sgst)}</div>
                  </div>
                  <div className="bg-rose-700 rounded p-2 text-center text-white">
                    <div className="text-[11px] text-rose-100">Supplier Debit</div>
                    <div className="font-bold">{inr(p.total)}</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Purchase Return dialog */}
      <Dialog open={openReturn} onOpenChange={setOpenReturn}>
        <DialogContent className="w-[95vw] sm:max-w-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader><DialogTitle className="text-lg font-display">Record Purchase Return</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs">Original Purchase *</Label>
              <Select value={returnForm.linkedDocId || ""} onValueChange={pickReturnSource}>
                <SelectTrigger><SelectValue placeholder={returnableEntries.length === 0 ? "No eligible purchase bills to return" : "Select a purchase bill to return against"} /></SelectTrigger>
                <SelectContent>
                  {returnableEntries.map((p: any) => {
                    const w = p.weight || p.items?.reduce((s: number, i: any) => s + (i.netWeight || i.grossWeight || 0), 0) || 0;
                    const m = p.metal || p.items?.[0]?.category || "Gold";
                    const pur = p.purity || p.items?.[0]?.purity || "22K";
                    return (
                      <SelectItem key={p._id || p.id} value={p._id || p.id}>{p.billNo} · {p.supplierName} · {m} {pur} · {w}g</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {returnForm.linkedDocId && (
              <>
                <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex justify-between font-bold text-amber-950">
                    <span>Original Bill: {returnForm.originalBillNo}</span>
                    <span>Supplier: {returnForm.supplierName}</span>
                  </div>
                  <div className="flex justify-between text-amber-800 text-[11px]">
                    <span>Original Wt: {returnForm.originalWeight}g</span>
                    <span>Original Total: {inr(returnForm.originalTotal)}</span>
                  </div>
                </div>

                <div className="space-y-2 border rounded-lg p-3 bg-card shadow-2xs">
                  <div className="text-xs font-bold uppercase tracking-wider text-rose-900 flex justify-between items-center">
                    <span className="flex items-center gap-1.5 font-semibold">
                      Returned Item Details ({returnForm.items?.length || 0})
                    </span>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs border-rose-300 text-rose-800 hover:bg-rose-50" onClick={addReturnItem}>
                      <Plus className="w-3 h-3 mr-1" /> Add Return Item
                    </Button>
                  </div>
                  {(!returnForm.items || returnForm.items.length === 0) ? (
                    <div className="text-center py-4 text-xs text-muted-foreground bg-muted/20 rounded border border-dashed">
                      No items specified. Click "+ Add Return Item" to add return items manually.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded border bg-muted/20 max-h-56">
                      <table className="w-full text-xs text-left min-w-[520px]">
                        <thead className="bg-rose-100/90 text-rose-950 font-semibold sticky top-0 z-10">
                          <tr>
                            <th className="p-2 w-32">Item Name</th>
                            <th className="p-2 w-28">HUID / Barcode</th>
                            <th className="p-2 text-center w-16">Pcs</th>
                            <th className="p-2 text-right w-24">Net Wt (g)</th>
                            <th className="p-2 text-right w-28">Rate ₹/g</th>
                            <th className="p-2 text-right w-28">Total (₹)</th>
                            <th className="p-2 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {returnForm.items.map((it: any, i: number) => (
                            <tr key={i} className="hover:bg-rose-50/50">
                              <td className="p-1.5">
                                <Input
                                  className="h-7 text-xs font-medium bg-background"
                                  value={it.name || ""}
                                  onChange={e => updateReturnItem(i, "name", e.target.value)}
                                  placeholder="Item name"
                                />
                              </td>
                              <td className="p-1.5">
                                <Input
                                  className="h-7 text-xs font-mono uppercase bg-background"
                                  value={it.huid || it.barcode || ""}
                                  onChange={e => updateReturnItem(i, "huid", e.target.value)}
                                  placeholder="HUID/Code"
                                />
                              </td>
                              <td className="p-1.5 text-center">
                                <Input
                                  type="number"
                                  className="h-7 text-xs font-mono text-center bg-background px-1"
                                  value={String(it.pcs ?? 1)}
                                  onChange={e => updateReturnItem(i, "pcs", +e.target.value)}
                                />
                              </td>
                              <td className="p-1.5 text-right">
                                <Input
                                  type="number"
                                  step="0.001"
                                  className="h-7 text-xs font-mono text-right font-bold bg-background px-1"
                                  value={String(it.netWeight ?? it.grossWeight ?? "")}
                                  onChange={e => updateReturnItem(i, "netWeight", +e.target.value)}
                                />
                              </td>
                              <td className="p-1.5 text-right">
                                <Input
                                  type="number"
                                  className="h-7 text-xs font-mono text-right bg-background px-1"
                                  value={String(it.ratePerGram ?? "")}
                                  onChange={e => updateReturnItem(i, "ratePerGram", +e.target.value)}
                                />
                              </td>
                              <td className="p-1.5 text-right font-mono font-bold text-rose-700 text-xs">
                                {inr(it.total || 0)}
                              </td>
                              <td className="p-1.5 text-center">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-rose-600 hover:bg-rose-100"
                                  onClick={() => removeReturnItem(i)}
                                  title="Remove Item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Return Date" type="date" v={returnForm.date} on={v => setReturnForm((f: any) => ({ ...f, date: v }))} />
                  <Field label="Returned Weight (g) *" type="number" v={String(returnForm.weight || "")} on={v => setReturnForm((f: any) => ({ ...f, weight: +v }))} />
                  <Field label="Rate ₹/g *" type="number" v={String(returnForm.ratePerGram || "")} on={v => setReturnForm((f: any) => ({ ...f, ratePerGram: +v }))} />
                  <div>
                    <Label className="text-xs">Metal / Purity</Label>
                    <Input value={`${returnForm.metal} ${returnForm.purity || ""}`} disabled className="bg-muted/40 font-semibold" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Reason for Return</Label>
                  <Textarea value={returnForm.note || ""} onChange={e => setReturnForm((f: any) => ({ ...f, note: e.target.value }))} placeholder="Reason for return (damaged, wrong purity, excess stock...)" />
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-1">
                  <div className="flex justify-between text-xs text-rose-800">
                    <span>Return Taxable Value:</span>
                    <span className="font-semibold">{inr(returnGstCalc.taxableValue)}</span>
                  </div>
                  {returnGstCalc.cgst > 0 && (
                    <div className="flex justify-between text-[11px] text-rose-700">
                      <span>GST ({returnForm.gstPct}%):</span>
                      <span>+{inr(returnGstCalc.cgst + returnGstCalc.sgst)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t border-rose-200 pt-1.5 font-bold text-rose-950 text-sm">
                    <span>Total Supplier Debit Amount:</span>
                    <span className="text-rose-600">-{inr(returnGstCalc.total)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
          <Button onClick={saveReturn} className="mt-4 w-full bg-rose-700 hover:bg-rose-800 text-white font-bold" disabled={createMutation.isPending || !returnForm.linkedDocId}>
            {createMutation.isPending ? "Saving..." : "Save Purchase Return"}
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

