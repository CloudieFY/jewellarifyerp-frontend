import { useState, useMemo, useEffect, useRef } from "react";
import { useFormKeyboardNav } from "@/lib/useFormKeyboardNav";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  PackageCheck, BarChart3, Truck, Receipt, X,
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
    if (form.supplierName?.trim() || searchSup.trim()) {
      const q = (form.supplierName || searchSup).trim().toLowerCase();
      return suppliers.find(
        (s: any) =>
          s.name.toLowerCase() === q ||
          (s.mobile && s.mobile === q) ||
          (s.company && s.company.toLowerCase() === q)
      ) || null;
    }
    return null;
  }, [suppliers, form.supplierId, form.supplierName, searchSup]);

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
  const firstItemInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Shortcut to Save: Ctrl+S, Ctrl+Enter, F12, Alt+S
      if (
        (e.ctrlKey && e.key.toLowerCase() === "s") ||
        (e.ctrlKey && e.key === "Enter") ||
        (e.altKey && e.key.toLowerCase() === "s") ||
        e.key === "F12"
      ) {
        e.preventDefault();
        save();
        return;
      }

      // 2. Shortcut to Print: Ctrl+P, Alt+P, F8
      if (
        (e.ctrlKey && e.key.toLowerCase() === "p") ||
        (e.altKey && e.key.toLowerCase() === "p") ||
        e.key === "F8"
      ) {
        e.preventDefault();
        window.print();
        return;
      }

      // 3. Shortcut to Add Product Item: Insert, F3, Alt+N, Alt+A
      if (
        e.key === "Insert" ||
        e.key === "F3" ||
        (e.altKey && (e.key.toLowerCase() === "n" || e.key.toLowerCase() === "a"))
      ) {
        e.preventDefault();
        addItemRow();
        toast.info("➕ Product Item row added");
        return;
      }

      // 4. Shortcut to jump cursor directly to Item Table on Purchase form: Alt+I or F4
      if (
        e.key === "F4" ||
        (e.altKey && e.key.toLowerCase() === "i")
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (firstItemInputRef.current) {
          firstItemInputRef.current.focus();
          firstItemInputRef.current.select?.();
        } else {
          const firstInput = document.querySelector("#purchase-item-table-container input, #purchase-item-table-container select") as HTMLElement;
          firstInput?.focus();
        }
        toast.info("🎯 Cursor focused on Purchase Item Table");
        return;
      }

      // 5. Shortcut for New Purchase Form: F2
      if (e.key === "F2") {
        e.preventDefault();
        setForm({ ...empty, type: isOperator ? "NON-GST" : "GST" });
        toast.info("➕ New Purchase form initialized");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, form, isOperator]);

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
  /* Old Gold & Silver Purchase (buyback & trade-in from customers)         */
  /* ---------------------------------------------------------------------- */
  /* ---------------------------------------------------------------------- */
  const [openOldGold, setOpenOldGold] = useState(false);
  const [viewOldGoldDoc, setViewOldGoldDoc] = useState<any>(null);
  const [searchCust, setSearchCust] = useState("");
  const debouncedSearchCust = useDebounce(searchCust, 300);

  const defaultOldGoldItem = {
    itemDescription: "",
    metal: "Gold",
    purity: "22K",
    grossWeight: "",
    lessWeight: "",
    tunchPct: "91.6",
    deductionPct: "",
    ratePerGram: "",
  };

  const emptyOldGold: any = {
    id: "",
    billNo: "",
    date: new Date().toISOString().slice(0, 10),
    customerId: "",
    customerName: "",
    customerMobile: "",
    paymentMode: "Cash",
    linkedBillNo: "",
    note: "",
    items: [{ ...defaultOldGoldItem }],
  };

  const [oldGoldForm, setOldGoldForm] = useState<any>(emptyOldGold);
  const oldGoldList = useMemo(() => list.filter((p: any) => p.docType === "OldGold"), [list]);

  const calcOldItemRow = (it: any) => {
    const gross = Number(it.grossWeight) || 0;
    const less = Number(it.lessWeight) || 0;
    const net = Math.max(0, gross - less);

    let defaultTunch = 91.6;
    if (it.purity === "24K" || it.purity === "999") defaultTunch = 99.9;
    else if (it.purity === "22K") defaultTunch = 91.6;
    else if (it.purity === "20K") defaultTunch = 83.3;
    else if (it.purity === "18K") defaultTunch = 75.0;
    else if (it.purity === "14K") defaultTunch = 58.5;
    else if (it.purity === "925 Silver") defaultTunch = 92.5;
    else if (it.purity === "Fine Silver") defaultTunch = 99.9;

    const tunch = it.tunchPct !== undefined && it.tunchPct !== null && it.tunchPct !== "" ? Number(it.tunchPct) : defaultTunch;
    const deduction = Number(it.deductionPct) || 0;
    const effectiveTunch = Math.max(0, tunch - deduction);
    const fineWeight = Number(((net * effectiveTunch) / 100).toFixed(3));
    const rate = Number(it.ratePerGram) || 0;
    const payout = Math.round(fineWeight * rate);

    return { gross, less, net, tunch, deduction, effectiveTunch, fineWeight, rate, payout };
  };

  const currentOldGoldTotals = useMemo(() => {
    const items = oldGoldForm.items || [];
    let gross = 0, less = 0, net = 0, fineWeight = 0, payout = 0;
    const calculatedRows = items.map((it: any) => {
      const calc = calcOldItemRow(it);
      gross += calc.gross;
      less += calc.less;
      net += calc.net;
      fineWeight += calc.fineWeight;
      payout += calc.payout;
      return { ...it, ...calc };
    });
    const avgEffectiveTunch = net > 0 ? (fineWeight / net) * 100 : 0;
    return { gross, less, net, fineWeight, payout, avgEffectiveTunch, rows: calculatedRows };
  }, [oldGoldForm.items]);

  const addOldGoldRow = () => {
    setOldGoldForm((f: any) => ({
      ...f,
      items: [...(f.items || []), { ...defaultOldGoldItem }]
    }));
  };

  const updateOldGoldRow = (index: number, field: string, value: any) => {
    setOldGoldForm((f: any) => {
      const newItems = [...(f.items || [])];
      const cur = { ...(newItems[index] || defaultOldGoldItem) };
      cur[field] = value;
      if (field === "purity") {
        let tunch = "91.6";
        if (value === "24K" || value === "999") tunch = "99.9";
        else if (value === "22K") tunch = "91.6";
        else if (value === "20K") tunch = "83.3";
        else if (value === "18K") tunch = "75.0";
        else if (value === "14K") tunch = "58.5";
        else if (value === "925 Silver") tunch = "92.5";
        else if (value === "Fine Silver") tunch = "99.9";
        cur.tunchPct = tunch;
      } else if (field === "metal") {
        cur.purity = value === "Silver" ? "925 Silver" : "22K";
        cur.tunchPct = value === "Silver" ? "92.5" : "91.6";
      }
      newItems[index] = cur;
      return { ...f, items: newItems };
    });
  };

  const removeOldGoldRow = (index: number) => {
    setOldGoldForm((f: any) => ({
      ...f,
      items: (f.items || []).filter((_: any, i: number) => i !== index)
    }));
  };

  const oldGoldFirstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!openOldGold) return;
    const handleOldGoldKeyNav = (e: KeyboardEvent) => {
      if ((e.altKey && (e.key === "i" || e.key === "I")) || e.key === "F4") {
        e.preventDefault();
        oldGoldFirstInputRef.current?.focus();
      } else if ((e.ctrlKey && (e.key === "s" || e.key === "S")) || e.key === "F12") {
        e.preventDefault();
        saveOldGold();
      } else if (e.key === "Insert" || (e.altKey && (e.key === "n" || e.key === "N"))) {
        e.preventDefault();
        addOldGoldRow();
      }
    };
    window.addEventListener("keydown", handleOldGoldKeyNav);
    return () => window.removeEventListener("keydown", handleOldGoldKeyNav);
  }, [openOldGold, oldGoldForm, currentOldGoldTotals]);

  const openNewOldGold = () => { setOldGoldForm(emptyOldGold); setSearchCust(""); setOpenOldGold(true); };

  const saveOldGold = async () => {
    if (!oldGoldForm.customerName) { toast.error("Please select a customer."); return; }
    if (!currentOldGoldTotals.net || currentOldGoldTotals.net <= 0) { toast.error("Please enter a valid item gross weight."); return; }
    if (!currentOldGoldTotals.payout || currentOldGoldTotals.payout <= 0) { toast.error("Please enter a valid rate per gram."); return; }

    const billNo = oldGoldForm.billNo || `OG-${(oldGoldList.length + 1).toString().padStart(4, "0")}`;
    const payload = {
      ...oldGoldForm,
      billNo,
      grossWeight: currentOldGoldTotals.gross,
      lessWeight: currentOldGoldTotals.less,
      weight: currentOldGoldTotals.net,
      netWeight: currentOldGoldTotals.net,
      tunchPct: currentOldGoldTotals.avgEffectiveTunch,
      deductionPct: 0,
      effectiveTunchPct: currentOldGoldTotals.avgEffectiveTunch,
      fineWeight: currentOldGoldTotals.fineWeight,
      ratePerGram: currentOldGoldTotals.rows[0]?.rate || 0,
      taxableValue: currentOldGoldTotals.payout,
      cgst: 0, sgst: 0, igst: 0,
      total: currentOldGoldTotals.payout,
      docType: "OldGold",
      status: "Completed",
      items: currentOldGoldTotals.rows.map((r: any) => ({
        itemDescription: r.itemDescription || `${r.metal || "Gold"} ${r.purity || "22K"} Buyback`,
        metal: r.metal || "Gold",
        purity: r.purity || "22K",
        grossWeight: r.gross,
        lessWeight: r.less,
        netWeight: r.net,
        tunchPct: r.tunch,
        deductionPct: r.deduction,
        effectiveTunchPct: r.effectiveTunch,
        fineWeight: r.fineWeight,
        ratePerGram: r.rate,
        amount: r.payout,
      }))
    };

    try {
      await createMutation.mutateAsync(payload as any);
      setOpenOldGold(false);
      toast.success(`Old Metal purchase voucher ${billNo} recorded successfully!`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to record old metal purchase.");
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
            <Button data-new-button="true" size="lg" className="bg-amber-800 hover:bg-amber-900 text-white font-medium shadow-sm" onClick={openNewEntry}><Plus className="w-4 h-4 mr-2" />New Purchase</Button>
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
        {/* TAB: OLD GOLD & SILVER BUYBACK (CUSTOMER TRADE-IN)                  */}
        {/* ==================================================================== */}
        <TabsContent value="oldgold" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3 bg-amber-500/10 dark:bg-amber-950/30 p-4 rounded-xl border border-amber-300 dark:border-amber-900">
            <div>
              <h2 className="text-lg font-display font-bold text-amber-950 dark:text-amber-100 flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-600" />
                <span>Old Gold &amp; Silver Buyback (Customer Purchase / Exchange)</span>
              </h2>
              <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-0.5">
                Buyback &amp; trade-in of used Gold &amp; Silver ornaments with MMI melting tunch, wastage deduction, and sales bill integration.
              </p>
            </div>
            <Button size="lg" className="bg-amber-600 hover:bg-amber-700 text-white font-black shadow-md gap-2" onClick={openNewOldGold}>
              <Plus className="w-4 h-4" /> Record Old Metal Purchase
            </Button>
          </div>

          <Card className="shadow-sm border-slate-300 dark:border-slate-800">
            <CardContent className="p-0">
              {oldGoldList.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <Coins className="w-12 h-12 text-amber-500/50 mx-auto" />
                  <p className="text-slate-500 text-sm font-medium">No old gold or silver purchases recorded yet.</p>
                  <Button variant="outline" size="sm" onClick={openNewOldGold} className="border-amber-400 text-amber-900 font-bold">
                    + Record First Buyback Entry
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm border-collapse min-w-[900px]">
                    <thead className="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 uppercase font-black border-b">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Voucher</th>
                        <th className="py-2.5 px-2">Date</th>
                        <th className="py-2.5 px-3 text-left">Customer</th>
                        <th className="py-2.5 px-2 text-center">Metal / Purity</th>
                        <th className="py-2.5 px-2 text-right">Gross Wt</th>
                        <th className="py-2.5 px-2 text-right">Net Wt</th>
                        <th className="py-2.5 px-2 text-center">Effective Tunch</th>
                        <th className="py-2.5 px-2 text-right">Fine Wt</th>
                        <th className="py-2.5 px-2 text-right">Rate ₹/g</th>
                        <th className="py-2.5 px-3 text-right bg-amber-100 dark:bg-amber-950 font-black">Total Payout</th>
                        <th className="py-2.5 px-2 text-center">Mode</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-xs sm:text-sm">
                      {oldGoldList.map((p: any) => {
                        const netWt = Number(p.netWeight || p.weight) || 0;
                        const effTunch = Number(p.effectiveTunchPct) || (Number(p.tunchPct || 91.6) - Number(p.deductionPct || 0));
                        const fineWt = Number(p.fineWeight) || Number(((netWt * effTunch) / 100).toFixed(3));
                        const isGold = (p.metal || "Gold") === "Gold";

                        return (
                          <tr key={p._id || p.id} className="hover:bg-amber-50/40 dark:hover:bg-slate-800/50">
                            <td className="py-2 px-3 font-black text-amber-900 dark:text-amber-300">{p.billNo}</td>
                            <td className="py-2 px-2 whitespace-nowrap">{formatDate(p.date)}</td>
                            <td className="py-2 px-3 font-sans font-bold text-slate-900 dark:text-slate-100">{p.customerName}</td>
                            <td className="py-2 px-2 text-center font-sans font-bold">
                              <Badge variant="outline" className={isGold ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-slate-200 text-slate-900 border-slate-300"}>
                                {isGold ? "🥇 Gold" : "🥈 Silver"} {p.purity || ""}
                              </Badge>
                            </td>
                            <td className="py-2 px-2 text-right">{p.grossWeight || netWt}g</td>
                            <td className="py-2 px-2 text-right font-black">{netWt}g</td>
                            <td className="py-2 px-2 text-center">{effTunch.toFixed(2)}%</td>
                            <td className="py-2 px-2 text-right font-bold text-blue-700 dark:text-blue-400">{fineWt}g</td>
                            <td className="py-2 px-2 text-right">{inr(p.ratePerGram)}</td>
                            <td className="py-2 px-3 text-right font-black text-emerald-700 dark:text-emerald-400 bg-amber-50 dark:bg-amber-950/40 text-sm">
                              {inr(p.total || p.taxableValue)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <Badge className="text-[10px] uppercase font-bold bg-slate-100 text-slate-800 border">
                                {p.paymentMode || "Cash"}
                              </Badge>
                            </td>
                            <td className="py-2 px-3 text-right space-x-1">
                              <Button size="sm" variant="outline" className="h-7 text-xs font-bold px-2" onClick={() => setViewOldGoldDoc(p)}>
                                <Eye className="w-3.5 h-3.5 mr-1" /> Receipt
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 text-rose-600 hover:bg-rose-100" onClick={() => removeDoc(p._id || p.id)} title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
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
        <DialogContent className="fixed inset-0 z-[100] w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 top-0 left-0 rounded-none border-0 p-0 bg-slate-100 dark:bg-slate-950 flex flex-col overflow-hidden shadow-none" aria-describedby={undefined} onInteractOutside={(e) => e.preventDefault()} onKeyDown={handleKeyNav}>
          {/* Header Banner - Modern Desktop ERP Suite */}
          <DialogHeader className="px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 text-white border-b border-slate-800 flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xs">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold font-display text-white uppercase tracking-wider flex items-center gap-2">
                  <span>{editingId ? (isOrderForm ? "Edit Purchase Order" : "Edit Purchase Voucher") : (isOrderForm ? "Create Purchase Order" : "Purchase Voucher Master")}</span>
                </DialogTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] uppercase tracking-widest font-extrabold px-2 py-0.2 rounded-full">
                    FULL DESKTOP SUITE
                  </Badge>
                  <span className="text-[11px] text-slate-400 font-medium">ERP Inventory &amp; Stock Inward</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1 text-xs">
                <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Bill No:</span>
                <Input
                  placeholder="259"
                  value={form.billNo || ""}
                  onChange={e => setForm((f: any) => ({ ...f, billNo: e.target.value }))}
                  className="h-7 text-xs w-20 bg-slate-950 font-mono font-black border-amber-500/50 text-amber-300 text-center rounded-lg focus:ring-2 focus:ring-amber-500/50 shadow-2xs"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 bg-slate-50/80 dark:bg-slate-900/80">
            {/* 1. TOP ERP CONTROL HEADER PANEL */}
            <div className="bg-white dark:bg-slate-800 border border-border/80 p-4 rounded-xl shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  {/* DATE */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date:</span>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={e => setForm((f: any) => ({ ...f, date: e.target.value }))}
                      className="h-9 text-xs sm:text-sm w-40 sm:w-44 bg-background font-mono font-bold border-border rounded-lg px-2.5 text-foreground focus:ring-2 focus:ring-amber-500/40 shadow-2xs cursor-pointer"
                    />
                  </div>

                  {/* SERIES */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Series:</span>
                    <select
                      value={form.type || "GST"}
                      onChange={e => setForm((f: any) => ({ ...f, type: e.target.value, gstPct: e.target.value === "NON-GST" ? 0 : 3 }))}
                      className="h-9 w-44 text-xs sm:text-sm bg-background border border-border font-bold rounded-lg px-2.5 text-foreground cursor-pointer focus:ring-2 focus:ring-amber-500/40 shadow-2xs"
                    >
                      <option value="GST">GST PURCHASE</option>
                      <option value="NON-GST">RD PURCHASE / EST</option>
                      <option value="TAX">TAX PURCHASE</option>
                    </select>
                  </div>

                  {/* A/C NAME (SUPPLIER) */}
                  <div className="flex flex-col gap-1 min-w-[260px] flex-1 sm:flex-initial">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">A/C Name (Supplier):</span>
                    <select
                      value={form.supplierId || ""}
                      onChange={e => {
                        const val = e.target.value;
                        const s = suppliers.find(x => (x._id || x.id) === val);
                        if (s) {
                          setForm((f: any) => ({ ...f, supplierId: val, supplierName: s.name, supplierGstin: (s as any).gstNumber || "" }));
                          setSearchSup(s.name);
                        }
                      }}
                      className="h-9 w-full sm:w-72 text-xs sm:text-sm bg-background border border-border font-bold rounded-lg px-2.5 text-foreground cursor-pointer focus:ring-2 focus:ring-amber-500/40 shadow-2xs"
                    >
                      <option value="" disabled>Select Supplier Account</option>
                      {suppliers.sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(s => (
                        <option key={s._id || s.id} value={s._id || s.id}>{s.name} {s.company ? `(${s.company})` : ""} · {s.mobile}</option>
                      ))}
                    </select>
                  </div>

                  {/* NARRATION */}
                  <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Narration / Notes:</span>
                    <Input
                      placeholder="Enter purchase narration or remarks..."
                      value={form.note || ""}
                      onChange={e => setForm((f: any) => ({ ...f, note: e.target.value }))}
                      className="h-9 text-xs sm:text-sm bg-background border-border flex-1 font-medium rounded-lg"
                    />
                  </div>

                  {/* FINAL VOUCHER CHECKBOX */}
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="finalVoucher"
                      checked={form.finalVoucher ?? true}
                      onChange={e => setForm((f: any) => ({ ...f, finalVoucher: e.target.checked }))}
                      className="w-4 h-4 rounded border-border text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <label htmlFor="finalVoucher" className="font-bold text-foreground text-xs cursor-pointer select-none">Final Voucher</label>
                  </div>
                </div>
              </div>

              {/* Inline Supplier Info Badge */}
              {selectedSupplier && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-900 dark:text-amber-300 text-sm">{selectedSupplier.name}</span>
                    {selectedSupplier.company && <span className="text-muted-foreground">({selectedSupplier.company})</span>}
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground font-mono text-[11px]">
                    {selectedSupplier.mobile && <span>Ph: <strong className="text-foreground">{selectedSupplier.mobile}</strong></span>}
                    {selectedSupplier.gstNumber && <span>GSTIN: <strong className="text-foreground">{selectedSupplier.gstNumber}</strong></span>}
                    {selectedSupplier.address && <span className="max-w-xs truncate">{selectedSupplier.address}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* 2. MAIN PURCHASE ITEMS GRID TABLE */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs uppercase tracking-wider text-foreground flex items-center gap-2">
                  <PackageCheck className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" /> Item Details Table
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={addItemRow}
                  className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg px-3 shadow-xs transition-all gap-1.5"
                >
                  <Plus className="w-4 h-4 mr-0.5" /> Add Product Item
                  <kbd className="ml-1 px-1.5 py-0.5 text-[10px] bg-amber-800 text-amber-100 border border-amber-500/40 rounded font-mono font-bold">
                    Alt+N / Insert / F3
                  </kbd>
                </Button>
              </div>

              <div id="purchase-item-table-container" className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-sm">
                <table className="w-full text-xs sm:text-sm border-collapse min-w-[1100px]">
                  <thead className="bg-slate-900 dark:bg-slate-950 text-slate-100 uppercase text-[11px] font-extrabold tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-2.5 border-r border-slate-800 text-left min-w-52">ITEM NAME</th>
                      <th className="p-2.5 border-r border-slate-800 w-32 text-center">PURITY / STAMP</th>
                      <th className="p-2.5 border-r border-slate-800 w-32 text-center">HUID / SERIAL</th>
                      <th className="p-2.5 border-r border-slate-800 w-20 text-center">QTY</th>
                      <th className="p-2.5 border-r border-slate-800 w-20 text-center">UNIT</th>
                      <th className="p-2.5 border-r border-slate-800 w-28 text-right">RATE</th>
                      <th className="p-2.5 border-r border-slate-800 w-20 text-center">ON</th>
                      <th className="p-2.5 border-r border-slate-800 w-20 text-right">DIS %</th>
                      <th className="p-2.5 border-r border-slate-800 w-28 text-right">DISCOUNT</th>
                      <th className="p-2.5 border-r border-slate-800 w-32 text-right bg-amber-500/20 text-amber-300 font-black">TOTAL ₹</th>
                      <th className="p-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs sm:text-sm divide-y divide-border/60">
                    {(form.items || []).map((item: any, idx: number) => {
                      const calc = calculateItemRow(item);
                      return (
                        <tr key={idx} className="hover:bg-amber-500/5 transition-colors">
                          <td className="p-0 border-r border-border/60">
                            <input
                              ref={idx === 0 ? firstItemInputRef : undefined}
                              placeholder="Item Name (e.g. Gold Ring / Chain)"
                              value={item.name || ""}
                              onChange={e => updateItemRow(idx, "name", e.target.value)}
                              className="w-full h-10 px-3 text-xs sm:text-sm font-bold font-sans bg-transparent border-0 focus:outline-none focus:bg-amber-500/10 focus:ring-2 focus:ring-amber-500/50 transition-colors"
                            />
                          </td>
                          <td className="p-0 border-r border-border/60 text-center">
                            <select
                              className="w-full h-10 text-xs sm:text-sm font-bold text-center bg-transparent border-0 focus:outline-none focus:bg-amber-500/10 focus:ring-2 focus:ring-amber-500/50 cursor-pointer text-foreground"
                              value={item.purity || "22K"}
                              onChange={e => updateItemRow(idx, "purity", e.target.value)}
                            >
                              {["24K", "22K", "20K", "18K", "14K", "925 Silver", "Fine Silver", "Hallmark"].map(pur => (
                                <option key={pur} value={pur}>{pur}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-0 border-r border-border/60">
                            <input
                              placeholder="HUID / Serial"
                              value={item.huid || ""}
                              onChange={e => updateItemRow(idx, "huid", e.target.value.toUpperCase())}
                              className="w-full h-10 px-2 text-xs sm:text-sm font-mono uppercase bg-transparent border-0 focus:outline-none focus:bg-amber-500/10 focus:ring-2 focus:ring-amber-500/50 text-center font-bold"
                            />
                          </td>
                          <td className="p-0 border-r border-border/60">
                            <input
                              type="number"
                              min={1}
                              step="1"
                              value={item.grossWeight || item.pcs || 1}
                              onChange={e => updateItemRow(idx, "grossWeight", +e.target.value)}
                              className="w-full h-10 px-2 text-center font-mono text-sm sm:text-base font-black bg-transparent border-0 focus:outline-none focus:bg-amber-500/10 focus:ring-2 focus:ring-amber-500/50"
                            />
                          </td>
                          <td className="p-0 border-r border-border/60 text-center">
                            <select
                              className="w-full h-10 text-xs sm:text-sm font-bold text-center bg-transparent border-0 focus:outline-none focus:bg-amber-500/10 focus:ring-2 focus:ring-amber-500/50 cursor-pointer text-foreground"
                              value={item.unit || "Pc"}
                              onChange={e => updateItemRow(idx, "unit", e.target.value)}
                            >
                              <option value="Pc">Pc</option>
                              <option value="Gm">Gm</option>
                              <option value="Kg">Kg</option>
                              <option value="Ct">Ct</option>
                              <option value="Tola">Tola</option>
                            </select>
                          </td>
                          <td className="p-0 border-r border-border/60">
                            <input
                              type="number"
                              placeholder="0.00"
                              value={item.ratePerGram || ""}
                              onChange={e => updateItemRow(idx, "ratePerGram", +e.target.value)}
                              className="w-full h-10 px-2.5 text-right font-mono text-sm sm:text-base font-black bg-transparent border-0 focus:outline-none focus:bg-amber-500/10 focus:ring-2 focus:ring-amber-500/50 text-foreground"
                            />
                          </td>
                          <td className="p-0 border-r border-border/60 text-center">
                            <select
                              className="w-full h-10 text-xs sm:text-sm font-bold text-center bg-transparent border-0 focus:outline-none focus:bg-amber-500/10 focus:ring-2 focus:ring-amber-500/50 cursor-pointer text-foreground"
                              value={item.onBasis || "1.00"}
                              onChange={e => updateItemRow(idx, "onBasis", e.target.value)}
                            >
                              <option value="1.00">1.00</option>
                              <option value="2.00">2.00</option>
                              <option value="100.00">100.00</option>
                            </select>
                          </td>
                          <td className="p-0 border-r border-border/60">
                            <input
                              type="number"
                              placeholder="0.00"
                              value={item.discountPct || ""}
                              onChange={e => updateItemRow(idx, "discountPct", +e.target.value)}
                              className="w-full h-10 px-2 text-right font-mono text-sm sm:text-base font-bold bg-transparent border-0 focus:outline-none focus:bg-amber-500/10 focus:ring-2 focus:ring-amber-500/50"
                            />
                          </td>
                          <td className="p-0 border-r border-border/60">
                            <input
                              type="number"
                              placeholder="0.00"
                              value={item.discountAmt || ""}
                              onChange={e => updateItemRow(idx, "discountAmt", +e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter" && idx === (form.items || []).length - 1) {
                                  e.preventDefault();
                                  addItemRow();
                                }
                              }}
                              className="w-full h-10 px-2 text-right font-mono text-sm sm:text-base font-bold bg-transparent border-0 focus:outline-none focus:bg-amber-500/10 focus:ring-2 focus:ring-amber-500/50"
                            />
                          </td>
                          <td className="p-2 border-r border-border/60 text-right bg-amber-500/10 dark:bg-amber-950/40 font-black text-sm sm:text-base text-amber-700 dark:text-amber-300 font-mono">
                            {inr(calc.total)}
                          </td>
                          <td className="p-1 text-center">
                            {(form.items || []).length > 1 && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/50 rounded-md"
                                onClick={() => removeItemRow(idx)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 dark:bg-slate-950 font-bold border-t border-border">
                    <tr>
                      <td colSpan={3} className="p-2.5 text-right uppercase font-extrabold text-xs">Subtotal:</td>
                      <td className="p-2.5 text-center font-mono font-black text-sm sm:text-base text-foreground">
                        {(form.items || []).reduce((acc: number, i: any) => acc + (Number(i.grossWeight) || Number(i.pcs) || 1), 0).toFixed(3)}
                      </td>
                      <td colSpan={5} className="p-2.5"></td>
                      <td className="p-2.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-base sm:text-lg">
                        {inr((form.items || []).reduce((acc: number, i: any) => acc + calculateItemRow(i).total, 0))}
                      </td>
                      <td className="p-2.5"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 3. DUAL-PANE PAYMENT SETTLEMENT & SUNDRY / TAX BREAKDOWN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* LEFT PANE: PARTY PAYMENT DETAILS */}
              <div className="border border-border/80 rounded-xl p-4 bg-card space-y-3 shadow-xs">
                <div className="font-bold text-xs uppercase tracking-wider text-foreground border-b pb-2 flex items-center justify-between">
                  <span>Party Details &amp; Settlement</span>
                  <div className="flex gap-1.5">
                    <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] px-2.5 font-bold rounded-md">1-Receipt</Button>
                    <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] px-2.5 font-bold rounded-md bg-blue-500/10 text-blue-600 border-blue-300">2-Payment</Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">Mode:</span>
                    <select
                      value={form.paymentMode || "Cash"}
                      onChange={e => setForm((f: any) => ({ ...f, paymentMode: e.target.value }))}
                      className="w-full h-9 border border-border rounded-lg font-bold px-2.5 bg-background cursor-pointer text-xs sm:text-sm text-foreground focus:ring-2 focus:ring-amber-500/40"
                    >
                      {["Cash", "UPI", "Card", "Bank", "Credit"].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">A/c Name:</span>
                    <Input value={form.paymentMode === "Cash" ? "CASH ACCOUNT" : (form.paymentMode || "BANK")} className="h-9 font-bold bg-muted/60 text-xs sm:text-sm rounded-lg" readOnly />
                  </div>
                  <div className="col-span-2">
                    <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">Amount Paid (₹):</span>
                    <Input
                      type="number"
                      value={form.paidAmount || ""}
                      onChange={e => setForm((f: any) => ({ ...f, paidAmount: +e.target.value }))}
                      className="h-10 font-mono font-black text-lg text-emerald-600 dark:text-emerald-400 bg-background border-border rounded-lg shadow-2xs"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-2">
                    <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider block mb-1">Particulars / Payment Notes:</span>
                    <Input
                      value={form.particulars || ""}
                      onChange={e => setForm((f: any) => ({ ...f, particulars: e.target.value }))}
                      className="h-9 bg-background text-xs sm:text-sm font-medium rounded-lg"
                      placeholder="Enter payment reference / cash voucher details..."
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT PANE: SUNDRY CHARGES & TAX BREAKDOWN */}
              <div className="border border-border/80 rounded-xl p-4 bg-card space-y-3 shadow-xs">
                <div className="font-bold text-xs uppercase tracking-wider text-foreground border-b pb-2">
                  Sundry Charges, Taxes &amp; Balances
                </div>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-muted font-bold uppercase text-[10px] text-muted-foreground">
                      <tr>
                        <th className="p-2 text-left border-r border-border">Sundry Name</th>
                        <th className="p-2 text-right w-20 border-r border-border">Per.(%)</th>
                        <th className="p-2 text-right w-28">Amount ₹</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono divide-y divide-border">
                      <tr>
                        <td className="p-2 font-bold font-sans">PACKING AND FORWARDING</td>
                        <td className="p-2 text-right font-bold text-xs">0.00</td>
                        <td className="p-2 text-right font-bold text-xs">0.00</td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold font-sans">FREIGHT / TRANSPORT</td>
                        <td className="p-2 text-right">
                          <input className="w-14 text-right h-7 px-1.5 border rounded-md bg-background font-mono font-bold text-xs" value={form.freightPct || 0} onChange={e => setForm((f: any) => ({ ...f, freightPct: +e.target.value }))} />
                        </td>
                        <td className="p-2 text-right font-bold">
                          <input className="w-24 text-right h-7 px-2 border rounded-md bg-background font-mono font-black text-xs" value={form.freightAmt || 0} onChange={e => setForm((f: any) => ({ ...f, freightAmt: +e.target.value }))} />
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold font-sans">ROUND OFF</td>
                        <td className="p-2 text-right font-bold text-xs">0.00</td>
                        <td className="p-2 text-right font-bold text-xs">0.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* TAX BREAKDOWN & FINAL TOTALS */}
                <div className="grid grid-cols-2 gap-2.5 text-xs font-mono pt-1">
                  <div className="bg-muted/60 p-2.5 rounded-lg border border-border flex justify-between items-center">
                    <span className="font-bold">CGST:</span>
                    <strong className="text-blue-600 dark:text-blue-400 text-sm font-black">{inr(gstCalc.cgst)}</strong>
                  </div>
                  <div className="bg-muted/60 p-2.5 rounded-lg border border-border flex justify-between items-center">
                    <span className="font-bold">SGST:</span>
                    <strong className="text-blue-600 dark:text-blue-400 text-sm font-black">{inr(gstCalc.sgst)}</strong>
                  </div>
                  <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/15 border-2 border-amber-500/40 p-3 rounded-xl flex justify-between items-center col-span-2 text-sm font-black shadow-xs">
                    <span className="uppercase tracking-wider font-extrabold text-foreground">Bill Total:</span>
                    <strong className="text-amber-700 dark:text-amber-300 text-lg sm:text-xl font-black">{inr(gstCalc.total + (form.freightAmt || 0))}</strong>
                  </div>
                  <div className="bg-muted/80 p-2.5 rounded-xl flex justify-between items-center text-xs col-span-2 border border-border">
                    <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Closing Balance:</span>
                    <strong className="text-rose-600 dark:text-rose-400 font-mono text-sm sm:text-base font-black">{inr(Math.max(0, (gstCalc.total + (form.freightAmt || 0)) - (form.paidAmount || 0)))}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Desktop Control Action Bar */}
          <div className="border-t border-border p-3 bg-background/95 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                onClick={save}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black text-xs sm:text-sm uppercase px-5 h-9 rounded-lg shadow-md flex items-center gap-2 active:scale-95 transition-all"
              >
                <span>{createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}</span>
                <kbd className="px-1.5 py-0.5 text-[10px] bg-amber-900/60 text-amber-200 border border-amber-500/40 rounded font-mono font-bold lowercase">
                  Ctrl+S / F12
                </kbd>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="h-9 text-xs sm:text-sm font-bold uppercase rounded-lg border-border"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const activeEl = document.activeElement as HTMLElement;
                  const container = activeEl?.closest("table, form, [role='dialog']") || document.body;
                  const inputs = Array.from(container.querySelectorAll<HTMLElement>("input, select, textarea")).filter(
                    el => !el.hasAttribute("disabled") && el.tabIndex !== -1
                  );
                  const index = inputs.indexOf(activeEl);
                  if (index > 0) {
                    inputs[index - 1].focus();
                    if (inputs[index - 1].tagName === "INPUT") (inputs[index - 1] as HTMLInputElement).select?.();
                  }
                }}
                className="h-9 text-xs sm:text-sm font-bold uppercase rounded-lg border-border"
              >
                Prev.
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const activeEl = document.activeElement as HTMLElement;
                  const container = activeEl?.closest("table, form, [role='dialog']") || document.body;
                  const inputs = Array.from(container.querySelectorAll<HTMLElement>("input, select, textarea")).filter(
                    el => !el.hasAttribute("disabled") && el.tabIndex !== -1
                  );
                  const index = inputs.indexOf(activeEl);
                  if (index >= 0 && index < inputs.length - 1) {
                    inputs[index + 1].focus();
                    if (inputs[index + 1].tagName === "INPUT") (inputs[index + 1] as HTMLInputElement).select?.();
                  }
                }}
                className="h-9 text-xs sm:text-sm font-bold uppercase rounded-lg border-border"
              >
                Next
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (form.items && form.items.length > 0) window.print();
                }}
                className="h-9 text-xs sm:text-sm font-bold uppercase rounded-lg border-border gap-1.5"
              >
                <span>Print</span>
                <kbd className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground border border-border rounded font-mono font-bold">
                  Ctrl+P / F8
                </kbd>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setForm({ ...empty, type: isOperator ? "NON-GST" : "GST" })}
                className="h-9 text-xs sm:text-sm font-bold uppercase rounded-lg border-border gap-1.5"
              >
                <span>New</span>
                <kbd className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground border border-border rounded font-mono font-bold">
                  F2
                </kbd>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setForm({ ...empty, type: isOperator ? "NON-GST" : "GST" })}
                className="h-9 text-xs sm:text-sm font-bold uppercase text-rose-600 border-border hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
              >
                Delete
              </Button>
            </div>

            <div className="flex items-center gap-3 bg-slate-900 text-white px-4 py-2 rounded-xl border border-slate-800 font-mono font-bold text-xs sm:text-sm shadow-sm">
              <span>Bill Total: <strong className="text-amber-400 text-sm sm:text-base font-black">{inr(gstCalc.total + (form.freightAmt || 0))}</strong></span>
              <span className="text-slate-700">|</span>
              <span>Paid: <strong className="text-emerald-400 text-sm sm:text-base font-black">{inr(form.paidAmount || 0)}</strong></span>
              <span className="text-slate-700">|</span>
              <span>Closing Bal: <strong className="text-rose-400 text-sm sm:text-base font-black">{inr(Math.max(0, (gstCalc.total + (form.freightAmt || 0)) - (form.paidAmount || 0)))}</strong></span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View dialog (Entry & Order) */}
      <Dialog open={!!viewPurchase} onOpenChange={(v) => { if (!v) setViewPurchase(null); }}>
        <DialogContent className="fixed inset-0 z-[100] w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 top-0 left-0 rounded-none border-0 p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 flex flex-col overflow-y-auto shadow-none" aria-describedby={undefined}>
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
        <DialogContent className="fixed inset-0 z-[100] w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 top-0 left-0 rounded-none border-0 p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 flex flex-col overflow-y-auto shadow-none" aria-describedby={undefined}>
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
        <DialogContent className="fixed inset-0 z-[100] w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 top-0 left-0 rounded-none border-0 p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 flex flex-col overflow-y-auto shadow-none" aria-describedby={undefined}>
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

      {/* Old Gold & Silver Purchase dialog - FULL ERP SPREADSHEET TABLE FORM */}
      <Dialog open={openOldGold} onOpenChange={setOpenOldGold}>
        <DialogContent className="fixed inset-0 z-[100] w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 top-0 left-0 rounded-none border-0 p-3 sm:p-5 bg-slate-100 dark:bg-slate-950 flex flex-col overflow-y-auto shadow-none" aria-describedby={undefined}>
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b pb-3 bg-white dark:bg-slate-900 p-3 rounded-lg border shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-400 flex items-center justify-center">
                <Coins className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-black font-sans uppercase tracking-wider text-amber-950 dark:text-amber-100 flex items-center gap-2">
                  <span>Record Old Gold &amp; Silver Buyback (Voucher Form)</span>
                  <Badge className="bg-amber-600 text-white font-bold text-xs">{oldGoldForm.billNo || "AUTO"}</Badge>
                </h2>
                <p className="text-[11px] text-muted-foreground">MMI ERP Customer Old Metal Purchase &amp; Trade-In Calculation Table</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-200/70 dark:bg-slate-800 px-3 py-1.5 rounded-lg border">
                <span>Focus Table: <kbd className="bg-amber-600 text-white px-1.5 py-0.5 rounded text-[10px]">Alt+I</kbd> / <kbd className="bg-amber-600 text-white px-1.5 py-0.5 rounded text-[10px]">F4</kbd></span>
                <span>•</span>
                <span>Save: <kbd className="bg-emerald-700 text-white px-1.5 py-0.5 rounded text-[10px]">Ctrl+S</kbd> / <kbd className="bg-emerald-700 text-white px-1.5 py-0.5 rounded text-[10px]">F12</kbd></span>
                <span>•</span>
                <span>Add Row: <kbd className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[10px]">Insert</kbd></span>
              </div>
              <Button onClick={saveOldGold} className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs px-4 h-9 uppercase tracking-wide gap-1.5 shadow-md" disabled={createMutation.isPending}>
                <Coins className="w-4 h-4" />
                {createMutation.isPending ? "Saving..." : "Save Buyback Voucher"}
                <kbd className="ml-1 bg-amber-800 text-amber-100 px-1.5 py-0.5 rounded text-[10px] font-mono">Ctrl+S</kbd>
              </Button>
            </div>
          </div>

          {/* Top Voucher Header Table */}
          <div className="overflow-x-auto my-3">
            <table className="w-full text-xs border-collapse bg-white dark:bg-slate-900 border rounded-lg shadow-2xs font-sans">
              <thead className="bg-slate-800 text-white font-black uppercase text-[11px] border-b">
                <tr>
                  <th className="py-2 px-3 text-left w-1/4 border-r border-slate-700">Search Customer</th>
                  <th className="py-2 px-3 text-left w-1/3 border-r border-slate-700">Select Customer *</th>
                  <th className="py-2 px-3 text-left w-1/5 border-r border-slate-700">Voucher Date</th>
                  <th className="py-2 px-3 text-left w-1/5">Payment Settlement Mode</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                    <Input
                      placeholder="Name, mobile..."
                      value={searchCust}
                      onChange={e => {
                        setSearchCust(e.target.value);
                        const match = customers.find(c => c.name.toLowerCase() === e.target.value.toLowerCase() || (c.mobile || c.phone || "").includes(e.target.value));
                        if (match) setOldGoldForm((f: any) => ({ ...f, customerId: match._id || match.id, customerName: match.name, customerMobile: match.mobile || match.phone || "" }));
                      }}
                      className="h-8 text-xs font-bold bg-slate-50 dark:bg-slate-900"
                    />
                  </td>
                  <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                    <Select value={oldGoldForm.customerId || ""} onValueChange={val => {
                      const c = customers.find(x => (x._id || x.id) === val);
                      if (c) setOldGoldForm((f: any) => ({ ...f, customerId: val, customerName: c.name, customerMobile: c.mobile || c.phone || "" }));
                    }}>
                      <SelectTrigger className="h-8 text-xs font-bold bg-slate-50 dark:bg-slate-900"><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent>
                        {customers.filter(c => c.name.toLowerCase().includes(debouncedSearchCust.toLowerCase()) || (c.mobile || c.phone || "").includes(debouncedSearchCust)).sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(c => (
                          <SelectItem key={c._id || c.id} value={(c._id || c.id) as string}>{c.name} · {c.mobile || c.phone}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2 border-r border-slate-200 dark:border-slate-800">
                    <Input
                      type="date"
                      value={oldGoldForm.date}
                      onChange={e => setOldGoldForm((f: any) => ({ ...f, date: e.target.value }))}
                      className="h-8 text-xs font-bold bg-slate-50 dark:bg-slate-900"
                    />
                  </td>
                  <td className="p-2">
                    <select
                      className="w-full h-8 border rounded-md px-2 bg-slate-50 dark:bg-slate-900 font-bold text-xs cursor-pointer"
                      value={oldGoldForm.paymentMode || "Cash"}
                      onChange={e => setOldGoldForm((f: any) => ({ ...f, paymentMode: e.target.value }))}
                    >
                      {["Cash", "UPI", "Bank", "Adjusted in Bill"].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* SPREADSHEET TABLE MATRIX GRID */}
          <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg overflow-hidden flex flex-col shadow-xs">
            <div className="bg-amber-500/10 dark:bg-amber-950/40 p-2.5 border-b border-slate-300 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs font-black uppercase tracking-wider text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-600" />
                <span>Old Metal Item Entry Table (Row &amp; Column Spreadsheet Grid)</span>
              </span>
              <Button type="button" size="sm" onClick={addOldGoldRow} className="h-7 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1">
                <Plus className="w-3.5 h-3.5" /> Add Item Row
              </Button>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-xs border-collapse min-w-[1100px] font-mono border-b border-slate-300 dark:border-slate-800">
                <thead className="bg-slate-800 text-white font-black uppercase text-[11px] border-b border-slate-700">
                  <tr>
                    <th className="py-2.5 px-2 text-center w-10 border-r border-slate-700">#</th>
                    <th className="py-2.5 px-3 text-left w-64 border-r border-slate-700">Item Description</th>
                    <th className="py-2.5 px-2 text-center w-28 border-r border-slate-700">Metal</th>
                    <th className="py-2.5 px-2 text-center w-36 border-r border-slate-700">Purity / Stamp</th>
                    <th className="py-2.5 px-2 text-right w-28 border-r border-slate-700">Gross Wt (g)</th>
                    <th className="py-2.5 px-2 text-right w-28 border-r border-slate-700">Less Wt (g)</th>
                    <th className="py-2.5 px-2 text-right w-28 border-r border-slate-700 bg-amber-900/60 text-amber-200">Net Wt (g)</th>
                    <th className="py-2.5 px-2 text-right w-24 border-r border-slate-700">Tunch %</th>
                    <th className="py-2.5 px-2 text-right w-24 border-r border-slate-700">Deduction %</th>
                    <th className="py-2.5 px-2 text-center w-28 border-r border-slate-700 bg-amber-900/60 text-amber-200">Eff. Tunch</th>
                    <th className="py-2.5 px-2 text-right w-28 border-r border-slate-700 bg-blue-900/60 text-blue-200">Fine Wt (g)</th>
                    <th className="py-2.5 px-2 text-right w-32 border-r border-slate-700">Fine Rate ₹/g</th>
                    <th className="py-2.5 px-3 text-right w-36 bg-emerald-900 text-emerald-200 font-black border-r border-slate-700">Valuation (₹)</th>
                    <th className="py-2.5 px-2 text-center w-12">Act</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 dark:divide-slate-800">
                  {currentOldGoldTotals.rows.map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-amber-50/50 border-b border-slate-300 dark:border-slate-800">
                      <td className="py-2 px-2 text-center font-bold border-r border-slate-300 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900">{i + 1}</td>
                      <td className="p-0 border-r border-slate-300 dark:border-slate-800">
                        <Input
                          ref={i === 0 ? oldGoldFirstInputRef : undefined}
                          placeholder="e.g. Old 22K Gold Chain / Ornament"
                          value={r.itemDescription || ""}
                          onChange={e => updateOldGoldRow(i, "itemDescription", e.target.value)}
                          className="h-9 font-sans font-medium text-xs border-0 rounded-none shadow-none focus:ring-1 focus:ring-amber-500 focus:bg-amber-50/50 dark:focus:bg-amber-950/50 px-2"
                        />
                      </td>
                      <td className="p-0 border-r border-slate-300 dark:border-slate-800">
                        <select
                          className="w-full h-9 border-0 rounded-none bg-transparent font-bold text-xs cursor-pointer text-center focus:bg-amber-50/50 focus:outline-none"
                          value={r.metal || "Gold"}
                          onChange={e => updateOldGoldRow(i, "metal", e.target.value)}
                        >
                          <option value="Gold">🥇 Gold</option>
                          <option value="Silver">🥈 Silver</option>
                        </select>
                      </td>
                      <td className="p-0 border-r border-slate-300 dark:border-slate-800">
                        <select
                          className="w-full h-9 border-0 rounded-none bg-transparent font-bold text-xs cursor-pointer text-center focus:bg-amber-50/50 focus:outline-none"
                          value={r.purity || "22K"}
                          onChange={e => updateOldGoldRow(i, "purity", e.target.value)}
                        >
                          {r.metal === "Silver" ? (
                            <>
                              <option value="925 Silver">925 (92.5%)</option>
                              <option value="Fine Silver">Fine (99.9%)</option>
                              <option value="999">999 (99.9%)</option>
                              <option value="850">850 (85.0%)</option>
                            </>
                          ) : (
                            <>
                              <option value="24K">24K (99.9%)</option>
                              <option value="22K">22K (91.6%)</option>
                              <option value="20K">20K (83.3%)</option>
                              <option value="18K">18K (75.0%)</option>
                              <option value="14K">14K (58.5%)</option>
                              <option value="Hallmark">Hallmark</option>
                            </>
                          )}
                        </select>
                      </td>
                      <td className="p-0 border-r border-slate-300 dark:border-slate-800 bg-amber-50/20">
                        <Input
                          type="number"
                          step="0.001"
                          placeholder="0.000"
                          value={r.grossWeight ?? ""}
                          onChange={e => updateOldGoldRow(i, "grossWeight", e.target.value)}
                          className="h-9 font-black text-right text-xs border-0 rounded-none shadow-none focus:ring-1 focus:ring-amber-500 px-2 text-amber-950 dark:text-amber-100"
                        />
                      </td>
                      <td className="p-0 border-r border-slate-300 dark:border-slate-800">
                        <Input
                          type="number"
                          step="0.001"
                          placeholder="0.000"
                          value={r.lessWeight ?? ""}
                          onChange={e => updateOldGoldRow(i, "lessWeight", e.target.value)}
                          className="h-9 font-bold text-right text-xs border-0 rounded-none shadow-none focus:ring-1 focus:ring-amber-500 px-2"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-black text-amber-950 dark:text-amber-300 bg-amber-100/50 dark:bg-amber-950/40 border-r border-slate-300 dark:border-slate-800 text-sm">
                        {r.net.toFixed(3)}g
                      </td>
                      <td className="p-0 border-r border-slate-300 dark:border-slate-800">
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="91.6"
                          value={r.tunchPct ?? ""}
                          onChange={e => updateOldGoldRow(i, "tunchPct", e.target.value)}
                          className="h-9 font-bold text-right text-xs border-0 rounded-none shadow-none focus:ring-1 focus:ring-amber-500 px-2"
                        />
                      </td>
                      <td className="p-0 border-r border-slate-300 dark:border-slate-800">
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          value={r.deductionPct ?? ""}
                          onChange={e => updateOldGoldRow(i, "deductionPct", e.target.value)}
                          className="h-9 font-bold text-right text-xs border-0 rounded-none shadow-none focus:ring-1 focus:ring-amber-500 px-2"
                        />
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-slate-900 border-r border-slate-300 dark:border-slate-800">
                        {r.effectiveTunch.toFixed(2)}%
                      </td>
                      <td className="py-2 px-3 text-right font-black text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/40 border-r border-slate-300 dark:border-slate-800 text-sm">
                        {r.fineWeight.toFixed(3)}g
                      </td>
                      <td className="p-0 border-r border-slate-300 dark:border-slate-800 bg-amber-50/20">
                        <Input
                          type="number"
                          placeholder="Rate ₹/g"
                          value={r.ratePerGram ?? ""}
                          onChange={e => updateOldGoldRow(i, "ratePerGram", e.target.value)}
                          className="h-9 font-black text-right text-xs border-0 rounded-none shadow-none focus:ring-1 focus:ring-amber-500 px-2 text-amber-950 dark:text-amber-100"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-950/40 text-base border-r border-slate-300 dark:border-slate-800">
                        {inr(r.payout)}
                      </td>
                      <td className="p-1 text-center">
                        {currentOldGoldTotals.rows.length > 1 && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-rose-600 hover:bg-rose-100"
                            onClick={() => removeOldGoldRow(i)}
                            title="Remove Row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* TABLE FOOTER SUMMARY BANNER */}
            <div className="bg-slate-900 text-white p-3.5 flex items-center justify-between flex-wrap gap-4 border-t border-slate-700 font-mono">
              <div className="flex items-center gap-6 text-xs">
                <div>
                  <span className="text-slate-400 uppercase text-[10px]">Total Net Weight:</span>
                  <div className="font-black text-amber-300 text-sm">{currentOldGoldTotals.net.toFixed(3)}g</div>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px]">Avg Effective Tunch:</span>
                  <div className="font-black text-amber-300 text-sm">{currentOldGoldTotals.avgEffectiveTunch.toFixed(2)}%</div>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px]">Total Fine Weight:</span>
                  <div className="font-black text-blue-300 text-sm">{currentOldGoldTotals.fineWeight.toFixed(3)}g</div>
                </div>
              </div>
              <div className="text-right flex items-center gap-3">
                <span className="text-slate-300 font-sans font-bold uppercase text-xs">Grand Total Valuation Payout:</span>
                <span className="font-black text-emerald-400 text-2xl tracking-tight bg-emerald-950/80 px-4 py-1.5 rounded border border-emerald-500/50">
                  {inr(currentOldGoldTotals.payout)}
                </span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Old Gold Buyback Voucher Receipt Dialog */}
      <Dialog open={!!viewOldGoldDoc} onOpenChange={v => { if (!v) setViewOldGoldDoc(null); }}>
        <DialogContent className="fixed inset-0 z-[100] w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 top-0 left-0 rounded-none border-0 p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 flex flex-col overflow-y-auto shadow-none" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-lg font-display flex items-center justify-between">
              <span className="flex items-center gap-2 font-bold text-amber-950">
                <Coins className="w-5 h-5 text-amber-600" /> Old Metal Buyback Receipt
              </span>
              <Badge className="bg-amber-600 text-white font-bold">{viewOldGoldDoc?.billNo}</Badge>
            </DialogTitle>
          </DialogHeader>
          {viewOldGoldDoc && (() => {
            const p = viewOldGoldDoc;
            const netWt = Number(p.netWeight || p.weight) || 0;
            const effTunch = Number(p.effectiveTunchPct) || (Number(p.tunchPct || 91.6) - Number(p.deductionPct || 0));
            const fineWt = Number(p.fineWeight) || Number(((netWt * effTunch) / 100).toFixed(3));

            return (
              <div className="space-y-4 mt-2 text-sm font-mono">
                <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground font-sans">Customer:</span>
                    <strong className="font-sans text-amber-950">{p.customerName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">Date:</span>
                    <strong>{formatDate(p.date)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">Metal &amp; Purity:</span>
                    <strong>{p.metal || "Gold"} {p.purity || "22K"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">Gross Weight:</span>
                    <strong>{p.grossWeight || netWt}g</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">Less Weight:</span>
                    <strong>{p.lessWeight || 0}g</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">Net Weight:</span>
                    <strong className="font-black text-slate-950">{netWt}g</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">Effective Tunch:</span>
                    <strong>{effTunch.toFixed(2)}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">Fine Weight:</span>
                    <strong className="text-blue-700">{fineWt}g</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-sans">Rate / Gram:</span>
                    <strong>{inr(p.ratePerGram)}</strong>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 text-sm font-black text-emerald-700">
                    <span className="font-sans uppercase">Total Buyback Payout:</span>
                    <span>{inr(p.total || p.taxableValue)}</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" onClick={() => window.print()} className="font-bold">Print Receipt</Button>
                </div>
              </div>
            );
          })()}
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

