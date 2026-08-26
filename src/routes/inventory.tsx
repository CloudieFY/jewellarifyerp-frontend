import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useMemo, useEffect } from "react";
import {
  Plus, Trash2, Pencil, Image as ImageIcon, Printer,
  ScanBarcode, Award, Boxes, ArrowLeftRight,
  FileSpreadsheet, CheckCircle2, AlertTriangle, Search,
  Store, DollarSign, BarChart3, History, Scale,
  PhoneCall, ArrowDownRight, ArrowUpRight, Download, Filter
} from "lucide-react";
import { inr, type Product } from "@/lib/storage";
import { useDebounce } from "@/lib/utils";
import { useTenantAPI } from "@/lib/api";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { BarcodeTagModal } from "@/components/BarcodeTagModal";

// Extended Product Type Interface
export interface ExtendedProduct extends Product {
  itemCode?: string;
  qrCode?: string;
  sku?: string;
  brand?: string;
  collectionName?: string;
  productType?: string;
  designNo?: string;
  modelNo?: string;
  metalType?: string;
  hallmarkCertified?: boolean;
  metalColor?: string;
  gender?: string;
  diamondWeight?: number;
  otherWeight?: number;
  stones?: Array<{ name: string; pcs: number; weight: number; rate: number; amount: number }>;
  diamonds?: Array<{ shape: string; color: string; clarity: string; weight: number; pcs: number; rate: number; certNo?: string; amount?: number }>;
  purchaseRate?: number;
  metalRate?: number;
  makingChargeType?: 'per_gram' | 'percentage' | 'fixed';
  makingChargePct?: number;
  wastagePct?: number;
  stoneCost?: number;
  diamondCost?: number;
  otherCharges?: number;
  costPrice?: number;
  sellingPrice?: number;
  minSellingPrice?: number;
  mrp?: number;
  hsnCode?: string;
  gstType?: 'Inclusive' | 'Exclusive';
  availableStock?: number;
  reservedStock?: number;
  minStock?: number;
  maxStock?: number;
  reorderLevel?: number;
  allowNegativeStock?: boolean;
  branch?: string;
  godown?: string;
  rack?: string;
  shelf?: string;
  tray?: string;
  locker?: string;
  defaultSupplierId?: string;
  supplierItemCode?: string;
  leadTimeDays?: number;
  isManufactured?: boolean;
  bom?: string;
  labourCharge?: number;
  castingCharge?: number;
  polishingCharge?: number;
  settingCharge?: number;
  certificatePdf?: string;
  status?: 'Active' | 'Inactive' | 'Discontinued';
}

const emptyProduct: ExtendedProduct = {
  id: "",
  name: "",
  itemCode: "",
  barcode: "",
  sku: "",
  category: "",
  subcategory: "",
  brand: "",
  collectionName: "",
  productType: "",
  designNo: "",
  modelNo: "",
  metalType: "",
  purity: "",
  huid: "",
  hallmarkCertified: true,
  metalColor: "",
  gender: "",

  grossWeight: 0,
  stoneWeight: 0,
  diamondWeight: 0,
  otherWeight: 0,
  netWeight: 0,

  stones: [],
  diamonds: [],

  purchaseRate: 0,
  metalRate: 0,
  makingChargeType: "fixed",
  makingCharge: 0,
  makingChargePct: 0,
  wastagePct: 0,
  stoneCost: 0,
  diamondCost: 0,
  otherCharges: 0,
  costPrice: 0,
  sellingPrice: 0,
  minSellingPrice: 0,
  mrp: 0,

  hsnCode: "",
  gstPct: 0,
  gstType: "Exclusive",

  stock: 0,
  minStock: 0,
  maxStock: 0,
  reorderLevel: 0,
  allowNegativeStock: false,

  branch: "",
  godown: "",
  rack: "",
  shelf: "",
  tray: "",
  locker: "",

  status: "Active",
  note: "",
  imageUrl: "",
  imageUrls: [],
} as any;

export default function InventoryPage() {
  const api = useTenantAPI();
  const queryClient = useQueryClient();

  // Queries
  const { data: allItems = [], isLoading: isLoadingItems } = useQuery<ExtendedProduct[]>({
    queryKey: ["inventory"],
    queryFn: api.inventory.getAll
  });

  const { data: stockAdjustments = [] } = useQuery<any[]>({
    queryKey: ["stockAdjustments"],
    queryFn: api.stockAdjustments.getAll
  });

  const { data: stockTransfers = [] } = useQuery<any[]>({
    queryKey: ["stockTransfers"],
    queryFn: api.stockTransfers.getAll
  });

  const { data: stockLedger = [] } = useQuery<any[]>({
    queryKey: ["stockLedger"],
    queryFn: () => api.stockLedger.get()
  });

  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["invoices"],
    queryFn: api.invoices.getAll
  });

  const { data: purchases = [] } = useQuery<any[]>({
    queryKey: ["purchases"],
    queryFn: api.purchases.getAll
  });

  const { data: summaryReport } = useQuery({
    queryKey: ["inventorySummaryReport"],
    queryFn: api.inventoryReports.getSummary
  });

  // State for Item Ledger Modal & Stock Audit Filter
  const [ledgerSelectedItem, setLedgerSelectedItem] = useState<ExtendedProduct | null>(null);
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState("");
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState("ALL");

  // Mutations
  const createItemMutation = useMutation({
    mutationFn: (data: ExtendedProduct) => api.inventory.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventorySummaryReport"] });
      toast.success("Item saved successfully!");
      setModalOpen(false);
      setEditingId(null);
    },
    onError: (err: any) => toast.error(`Failed to save item: ${err.message}`)
  });

  const updateItemMutation = useMutation({
    mutationFn: (data: { id: string; body: ExtendedProduct }) => api.inventory.update(data.id, data.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventorySummaryReport"] });
      toast.success("Item updated successfully!");
      setModalOpen(false);
      setEditingId(null);
    },
    onError: (err: any) => toast.error(`Failed to update item: ${err.message}`)
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => api.inventory.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventorySummaryReport"] });
      toast.success("Item removed from inventory.");
    },
    onError: (err: any) => toast.error(`Failed to delete item: ${err.message}`)
  });

  const createAdjustmentMutation = useMutation({
    mutationFn: (data: any) => api.stockAdjustments.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["stockAdjustments"] });
      queryClient.invalidateQueries({ queryKey: ["stockLedger"] });
      toast.success("Stock adjustment recorded!");
      setAdjModalOpen(false);
    },
    onError: (err: any) => toast.error(`Failed adjustment: ${err.message}`)
  });

  // State Management
  const [activeMainTab, setActiveMainTab] = useState("stock-list");
  const [activeFormTab, setActiveFormTab] = useState("basic");
  const [formViewMode, setFormViewMode] = useState<"openstock" | "all" | "tabbed">("openstock");
  const [inventoryLedgerView, setInventoryLedgerView] = useState<"master_stock" | "purity_weight" | "movement" | "tag_audit" | "low_stock">("master_stock");
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<ExtendedProduct>(emptyProduct);
  const [editingId, setEditingId] = useState<string | null>(null);

  // OPEN.STOCK Desktop ERP Form State & Helpers
  const createDefaultOpenStockRow = () => ({
    name: "",
    stamp: "22K",
    unit: "Gm",
    pcs: 1,
    grossWeight: 0,
    lessWeight: 0,
    netWeight: 0,
    tunch: 0,
    wastage: 0,
    rate: 0,
    labour: 0,
    on: "Wt",
    other: 0,
    goldFine: 0,
    silFine: 0,
    total: 0,
  });

  const [openStockHeader, setOpenStockHeader] = useState({
    date: new Date().toISOString().slice(0, 10),
    billNo: "1",
    narration: "Opening Stock Entry",
  });

  const [openStockRows, setOpenStockRows] = useState([
    createDefaultOpenStockRow(),
  ]);

  const updateOpenStockRow = (idx: number, field: string, val: any) => {
    setOpenStockRows(prev => {
      const updated = [...prev];
      const item = { ...updated[idx], [field]: val };

      if (field === "stamp") {
        if (val === "24K" || val === "999") item.tunch = 99.9;
        else if (val === "22K") item.tunch = 91.6;
        else if (val === "20K") item.tunch = 83.3;
        else if (val === "18K") item.tunch = 75.0;
        else if (val === "14K") item.tunch = 58.5;
        else if (val === "925") item.tunch = 92.5;
      }

      const gw = Number(item.grossWeight) || 0;
      const less = Number(item.lessWeight) || 0;
      const net = Math.max(0, gw - less);
      item.netWeight = parseFloat(net.toFixed(3));

      const tunch = Number(item.tunch) || 0;
      const wastage = Number(item.wastage) || 0;
      const fineWt = parseFloat((net * (tunch + wastage) / 100).toFixed(3));

      const isSilver = (item.stamp && item.stamp.toLowerCase().includes("sil")) ||
                       (item.stamp && (item.stamp.includes("925") || item.stamp.includes("999"))) ||
                       (item.unit && item.unit.toLowerCase().includes("sil"));
      if (isSilver) {
        item.silFine = fineWt;
        item.goldFine = 0;
      } else {
        item.goldFine = fineWt;
        item.silFine = 0;
      }

      const rate = Number(item.rate) || 0;
      const lbr = Number(item.labour) || 0;
      const other = Number(item.other) || 0;

      let calcLabour = lbr;
      if (item.on === "Wt") {
        calcLabour = lbr * net;
      } else if (item.on === "%") {
        calcLabour = (net * rate) * (lbr / 100);
      } else {
        calcLabour = lbr;
      }

      if (field === "total") {
        item.total = Number(val) || 0;
      } else {
        item.total = Math.round((net * rate) + calcLabour + other);
      }

      updated[idx] = item;
      return updated;
    });
  };

  const addOpenStockRow = () => {
    setOpenStockRows(prev => [...prev, createDefaultOpenStockRow()]);
  };

  const removeOpenStockRow = (idx: number) => {
    if (openStockRows.length <= 1) {
      setOpenStockRows([createDefaultOpenStockRow()]);
    } else {
      setOpenStockRows(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const handleSaveOpenStock = async () => {
    const validRows = openStockRows.filter(r => r.name && r.name.trim());
    if (validRows.length === 0) {
      return toast.error("Please enter at least one item name in OPEN.STOCK grid!");
    }

    try {
      let savedCount = 0;
      let updatedCount = 0;
      for (const row of validRows) {
        const rowId = (row as any)._id || (validRows.length === 1 ? editingId : null);
        const barcode = (row as any).barcode || `STK-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;
        
        const lbrRaw = Number(row.labour) || 0;
        const netWtVal = Number(row.netWeight) || 0;
        const rateVal = Number(row.rate) || 0;
        let calcLabour = lbrRaw;
        if (row.on === "Wt") {
          calcLabour = lbrRaw * netWtVal;
        } else if (row.on === "%") {
          calcLabour = (netWtVal * rateVal) * (lbrRaw / 100);
        }
        
        const payload: any = {
          ...(editingId && draft ? draft : {}),
          name: row.name.toUpperCase(),
          category: (row.stamp.toLowerCase().includes("sil") || row.unit.toLowerCase().includes("sil")) ? "Silver" : "Gold",
          subcategory: (editingId && draft.subcategory) ? draft.subcategory : "Ornaments",
          purity: row.stamp || "22K",
          unit: row.unit || "Gm",
          stock: Number(row.pcs) || 1,
          initialStock: Number(row.pcs) || 1,
          grossWeight: Number(row.grossWeight) || 0,
          stoneWeight: Number(row.lessWeight) || 0,
          netWeight: netWtVal,
          tunch: Number(row.tunch) || 91.6,
          wastage: Number(row.wastage) || 0,
          costPrice: rateVal,
          sellingPrice: Number(row.total) || Math.round((netWtVal * rateVal) + calcLabour + Number(row.other || 0)),
          makingChargeType: row.on === "Wt" ? "per_gram" : row.on === "%" ? "percentage" : "fixed",
          makingChargePct: row.on === "%" ? lbrRaw : 0,
          makingCharge: lbrRaw,
          labourCharges: Math.round(calcLabour),
          otherCharges: Number(row.other) || 0,
          barcode,
          status: "Active",
          location: "Main Counter Display",
          narration: openStockHeader.narration,
          billNo: openStockHeader.billNo,
          entryDate: openStockHeader.date,
        };

        if (rowId) {
          await updateItemMutation.mutateAsync({ id: rowId, body: payload });
          updatedCount++;
        } else {
          await createItemMutation.mutateAsync(payload);
          savedCount++;
        }
      }

      if (updatedCount > 0 && savedCount === 0) {
        toast.success(`✓ Updated ${updatedCount} item(s) in Inventory stock!`);
      } else if (updatedCount > 0 && savedCount > 0) {
        toast.success(`✓ Updated ${updatedCount} item(s) and saved ${savedCount} new item(s)!`);
      } else {
        toast.success(`✓ Saved ${savedCount} OPEN.STOCK item(s) into Inventory stock!`);
      }
      setModalOpen(false);
      setEditingId(null);
    } catch (err: any) {
      console.error("Failed to save OPEN.STOCK entry:", err);
      toast.error("Error saving OPEN.STOCK entry.");
    }
  };

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [subcategoryFilter, setSubcategoryFilter] = useState("ALL");
  const [purityFilter, setPurityFilter] = useState("ALL");

  // Dynamic Categories and Subcategories
  const availableCategories = useMemo(() => {
    const cats = new Set(["Gold", "Silver", "Diamond", "Platinum", ...allItems.map(i => i.category).filter(Boolean)]);
    return ["ALL", ...Array.from(cats)];
  }, [allItems]);

  const availableSubcategories = useMemo(() => {
    const relevantItems = categoryFilter === "ALL" ? allItems : allItems.filter(i => i.category === categoryFilter);
    const subcats = new Set(relevantItems.map(i => i.subcategory).filter((sc): sc is string => Boolean(sc)));
    return ["ALL", ...Array.from(subcats)];
  }, [allItems, categoryFilter]);

  // Barcode & Tag Printing State
  const [selectedTagItem, setSelectedTagItem] = useState<ExtendedProduct | null>(null);
  const [tagModalOpen, setTagModalOpen] = useState(false);

  // Stock Adjustment / Transfer / Opening Stock Modal States
  const [adjModalOpen, setAdjModalOpen] = useState(false);
  const [opnModalOpen, setOpnModalOpen] = useState(false);
  const [selectedItemForAction, setSelectedItemForAction] = useState<ExtendedProduct | null>(null);

  const [adjForm, setAdjForm] = useState({ type: "INCREASE" as "INCREASE" | "DECREASE", qty: 1, grossWeight: 0, netWeight: 0, reason: "Physical Audit Correction", remarks: "" });
  const [opnForm, setOpnForm] = useState({ qty: 1, grossWeight: 0, netWeight: 0, rate: 0, totalValue: 0, remarks: "" });

  // Auto-Calculate Net Weight & Stone/Diamond Costs only
  useEffect(() => {
    if (!modalOpen) return;
    const gross = Number(draft.grossWeight) || 0;
    const stone = Number(draft.stoneWeight) || 0;
    const diamond = Number(draft.diamondWeight) || 0;
    const other = Number(draft.otherWeight) || 0;
    const calcNet = Math.max(0, gross - stone - diamond - other);

    const stoneVal = (draft.stones || []).reduce((sum, s) => sum + (Number(s.amount) || Number(s.weight * s.rate) || 0), 0);
    const diamondVal = (draft.diamonds || []).reduce((sum, d) => sum + (Number(d.amount) || Number(d.weight * d.rate) || 0), 0);

    setDraft(prev => ({
      ...prev,
      netWeight: parseFloat(calcNet.toFixed(3)),
      stoneCost: stoneVal,
      diamondCost: diamondVal,
    }));
  }, [draft.grossWeight, draft.stoneWeight, draft.diamondWeight, draft.otherWeight, draft.stones, draft.diamonds, modalOpen]);

  // Filtered Inventory Data
  const filteredItems = useMemo(() => {
    return allItems.filter((p) => {
      const matchQuery =
        !debouncedSearch ||
        (p.name + p.barcode + (p.itemCode || "") + (p.huid || "") + (p.category || "") + (p.subcategory || "") + (p.purity || ""))
          .toLowerCase()
          .includes(debouncedSearch.toLowerCase());

      const matchCat = categoryFilter === "ALL" || p.category === categoryFilter;
      const matchSubCat = subcategoryFilter === "ALL" || p.subcategory === subcategoryFilter;
      const matchPur = purityFilter === "ALL" || p.purity === purityFilter;

      return matchQuery && matchCat && matchSubCat && matchPur;
    });
  }, [allItems, debouncedSearch, categoryFilter, subcategoryFilter, purityFilter]);

  // ── Unified Master Inventory Stock Audit Ledger Calculation ──
  const unifiedStockLedger = useMemo(() => {
    const records: any[] = [];
    const recordIds = new Set<string>();

    // 1. Process Sales Invoices (Deductions / Stock OUT)
    (invoices || []).forEach((inv: any) => {
      const invNo = inv.invoiceNumber || inv.invoiceNo || (inv.id ? `INV-${inv.id.slice(-4)}` : "INV-SALE");
      const invDate = (inv.date || inv.createdAt || new Date().toISOString()).slice(0, 10);
      const buyerName = inv.customerName || inv.customer?.name || "Walk-in Customer";
      const buyerMobile = inv.customerMobile || inv.phone || inv.customer?.phone || "";

      (inv.items || []).forEach((item: any, idx: number) => {
        const recId = `inv-${inv._id || inv.id}-${item._id || item.id || idx}`;
        if (recordIds.has(recId)) return;
        recordIds.add(recId);

        const qty = Math.abs(Number(item.quantity || item.qty || 1));
        const rate = Number(item.unitPrice || item.rate || (item.total ? item.total / qty : 0));
        const totalAmt = Number(item.total || (rate * qty));

        records.push({
          id: recId,
          date: invDate,
          rawDate: new Date(inv.date || inv.createdAt || Date.now()).getTime(),
          itemId: item.productId || item.id || item._id || item.itemId || "",
          itemName: item.productName || item.name || item.itemName || item.description || "Inventory Item",
          sku: item.sku || item.tagNo || item.barcode || "",
          transactionType: "Sale Invoice (Stock OUT)",
          txnCategory: "SALE",
          qtyChange: -qty,
          unitPrice: rate,
          totalAmount: totalAmt,
          referenceNo: invNo,
          partyName: buyerName,
          partyMobile: buyerMobile,
          partyType: "Customer",
          netWeight: item.netWeight || item.netWt || 0,
          grossWeight: item.grossWeight || item.grossWt || 0,
          remarks: `Deducted on Sale Invoice #${invNo} to ${buyerName}${buyerMobile ? ` (${buyerMobile})` : ""}`,
        });
      });
    });

    // 2. Process Purchase Bills (Inward / Stock IN)
    (purchases || []).forEach((pur: any) => {
      const purNo = pur.billNo || pur.purchaseNumber || pur.invoiceNo || (pur.id ? `PUR-${pur.id.slice(-4)}` : "PUR-IN");
      const purDate = (pur.date || pur.createdAt || new Date().toISOString()).slice(0, 10);
      const supplierName = pur.supplierName || pur.supplier?.name || "Direct Supplier";

      (pur.items || []).forEach((item: any, idx: number) => {
        const recId = `pur-${pur._id || pur.id}-${item._id || item.id || idx}`;
        if (recordIds.has(recId)) return;
        recordIds.add(recId);

        const qty = Math.abs(Number(item.quantity || item.qty || 1));
        const rate = Number(item.unitPrice || item.rate || (item.total ? item.total / qty : 0));
        const totalAmt = Number(item.total || (rate * qty));

        records.push({
          id: recId,
          date: purDate,
          rawDate: new Date(pur.date || pur.createdAt || Date.now()).getTime(),
          itemId: item.productId || item.id || item._id || item.itemId || "",
          itemName: item.productName || item.name || item.itemName || "Inventory Item",
          sku: item.sku || item.tagNo || item.barcode || "",
          transactionType: "Purchase Bill (Stock IN)",
          txnCategory: "PURCHASE",
          qtyChange: qty,
          unitPrice: rate,
          totalAmount: totalAmt,
          referenceNo: purNo,
          partyName: supplierName,
          partyMobile: pur.supplierMobile || "",
          partyType: "Supplier",
          netWeight: item.netWeight || item.netWt || 0,
          grossWeight: item.grossWeight || item.grossWt || 0,
          remarks: `Inward stock received from Purchase Bill #${purNo} (${supplierName})`,
        });
      });
    });

    // 3. Process Manual Stock Adjustments
    (stockAdjustments || []).forEach((adj: any) => {
      const recId = `adj-${adj._id || adj.id}`;
      if (recordIds.has(recId)) return;
      recordIds.add(recId);

      const isAdd = adj.type === "Addition" || (adj.qtyChange || 0) > 0;
      const qty = Math.abs(Number(adj.qtyChange || adj.quantity || 1));

      records.push({
        id: recId,
        date: (adj.date || new Date().toISOString()).slice(0, 10),
        rawDate: new Date(adj.date || Date.now()).getTime(),
        itemId: adj.itemId || "",
        itemName: adj.itemName || "Inventory Item",
        sku: adj.sku || adj.tagNo || "",
        transactionType: isAdd ? "Stock Adjustment (Inward)" : "Stock Adjustment (Deduction)",
        txnCategory: isAdd ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        qtyChange: isAdd ? qty : -qty,
        unitPrice: Number(adj.unitPrice || 0),
        totalAmount: Number(adj.totalAmount || 0),
        referenceNo: adj.referenceNo || `ADJ-${(adj._id || adj.id || "").slice(-4)}`,
        partyName: "Internal Audit",
        partyMobile: "",
        partyType: "Internal",
        remarks: adj.reason || adj.remarks || "Manual stock adjustment entry",
      });
    });

    // 4. Backend Stock Ledger entries fallback
    (stockLedger || []).forEach((led: any) => {
      const recId = `led-${led._id || led.id}`;
      if (recordIds.has(recId)) return;
      recordIds.add(recId);

      const qty = Number(led.qtyChange || 1);
      records.push({
        id: recId,
        date: (led.date || new Date().toISOString()).slice(0, 10),
        rawDate: new Date(led.date || Date.now()).getTime(),
        itemId: led.itemId || "",
        itemName: led.itemName || led.item || "Inventory Item",
        sku: led.sku || led.tagNo || "",
        transactionType: led.transactionType || (qty >= 0 ? "Stock Inward" : "Stock Deduction"),
        txnCategory: qty >= 0 ? "INWARD" : "DEDUCTION",
        qtyChange: qty,
        unitPrice: Number(led.unitPrice || 0),
        totalAmount: Number(led.totalAmount || 0),
        referenceNo: led.referenceNo || "-",
        partyName: led.customerName || led.supplierName || led.partyName || "Record Entry",
        partyMobile: led.customerMobile || led.partyMobile || "",
        partyType: led.partyType || (qty >= 0 ? "Supplier" : "Customer"),
        remarks: led.remarks || "Stock movement log",
      });
    });

    // 5. Initial Opening Stock entries for inventory products
    (allItems || []).forEach((item: any) => {
      const initialStock = Number(item.initialStock || item.stock || 0);
      if (initialStock > 0) {
        const recId = `init-${item._id || item.id}`;
        if (!recordIds.has(recId)) {
          recordIds.add(recId);
          records.push({
            id: recId,
            date: (item.createdAt || new Date().toISOString()).slice(0, 10),
            rawDate: new Date(item.createdAt || 0).getTime(),
            itemId: item._id || item.id || "",
            itemName: item.name || "Inventory Item",
            sku: item.sku || item.tagNo || item.barcode || "",
            transactionType: "Opening Stock",
            txnCategory: "OPENING",
            qtyChange: initialStock,
            unitPrice: Number(item.costPrice || item.sellingPrice || 0),
            totalAmount: Number(item.costPrice || item.sellingPrice || 0) * initialStock,
            referenceNo: "INIT-STOCK",
            partyName: "Opening Balance",
            partyMobile: "",
            partyType: "Internal",
            remarks: `Initial opening inventory stock entry for ${item.name}`,
          });
        }
      }
    });

    // Sort chronologically (oldest to newest) to calculate running stock balance
    records.sort((a, b) => a.rawDate - b.rawDate);

    // Calculate running stock balance per item
    const itemRunningBalances: Record<string, number> = {};
    records.forEach((rec) => {
      const itemKey = (rec.itemId || rec.itemName || "").trim().toLowerCase();
      const currentBal = itemRunningBalances[itemKey] || 0;
      const newBal = currentBal + rec.qtyChange;
      itemRunningBalances[itemKey] = newBal;
      rec.balanceQty = newBal;
    });

    // Reverse to show newest transactions at top
    return records.reverse();
  }, [invoices, purchases, stockAdjustments, stockLedger, allItems]);

  // Main Stock Audit Ledger Filter
  const filteredStockLedger = useMemo(() => {
    return unifiedStockLedger.filter((led: any) => {
      if (ledgerTypeFilter !== "ALL") {
        if (ledgerTypeFilter === "SALE" && !led.txnCategory.includes("SALE")) return false;
        if (ledgerTypeFilter === "PURCHASE" && !led.txnCategory.includes("PURCHASE")) return false;
        if (ledgerTypeFilter === "ADJUSTMENT" && !led.txnCategory.includes("ADJUSTMENT")) return false;
        if (ledgerTypeFilter === "OPENING" && !led.txnCategory.includes("OPENING")) return false;
      }

      if (!ledgerSearchTerm.trim()) return true;
      const q = ledgerSearchTerm.toLowerCase();
      return (
        (led.itemName && led.itemName.toLowerCase().includes(q)) ||
        (led.sku && led.sku.toLowerCase().includes(q)) ||
        (led.referenceNo && led.referenceNo.toLowerCase().includes(q)) ||
        (led.partyName && led.partyName.toLowerCase().includes(q)) ||
        (led.partyMobile && led.partyMobile.includes(q)) ||
        (led.remarks && led.remarks.toLowerCase().includes(q))
      );
    });
  }, [unifiedStockLedger, ledgerTypeFilter, ledgerSearchTerm]);

  // Individual Per-Item Audit Ledger Computation
  const itemLedgerEntries = useMemo(() => {
    if (!ledgerSelectedItem) return [];
    const targetId = (ledgerSelectedItem._id || ledgerSelectedItem.id || "").toString();
    const targetSku = (ledgerSelectedItem.sku || (ledgerSelectedItem as any).tagNo || ledgerSelectedItem.barcode || "").trim().toLowerCase();
    const targetName = (ledgerSelectedItem.name || "").trim().toLowerCase();

    return unifiedStockLedger.filter((rec: any) => {
      if (rec.itemId && rec.itemId.toString() === targetId) return true;
      if (targetSku && rec.sku && rec.sku.trim().toLowerCase() === targetSku) return true;
      if (targetName && rec.itemName && rec.itemName.trim().toLowerCase() === targetName) return true;
      return false;
    });
  }, [unifiedStockLedger, ledgerSelectedItem]);

  const itemLedgerSummary = useMemo(() => {
    let totalInward = 0;
    let totalSold = 0;
    let totalSalesRevenue = 0;

    itemLedgerEntries.forEach((rec: any) => {
      if (rec.qtyChange > 0) {
        totalInward += rec.qtyChange;
      } else if (rec.qtyChange < 0) {
        const soldQty = Math.abs(rec.qtyChange);
        totalSold += soldQty;
        totalSalesRevenue += (rec.totalAmount || (rec.unitPrice * soldQty) || 0);
      }
    });

    return {
      totalInward,
      totalSold,
      totalSalesRevenue,
      currentStock: ledgerSelectedItem?.stock || 0,
    };
  }, [itemLedgerEntries, ledgerSelectedItem]);

  // Export Stock Ledger to Excel
  const exportStockLedgerToExcel = () => {
    if (!filteredStockLedger.length) {
      return toast.error("No stock ledger entries to export!");
    }

    const sheetData = [
      ["Date", "Item Name", "SKU / Tag No", "Transaction Type", "Qty Change", "Running Balance", "Reference No", "Buyer / Supplier Name", "Buyer Mobile", "Unit Rate (INR)", "Total Amount (INR)", "Remarks"],
      ...filteredStockLedger.map((led: any) => [
        led.date || "",
        led.itemName || "",
        led.sku || "",
        led.transactionType || "",
        led.qtyChange || 0,
        led.balanceQty || 0,
        led.referenceNo || "",
        led.partyName || "",
        led.partyMobile || "",
        led.unitPrice || 0,
        led.totalAmount || 0,
        led.remarks || "",
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!cols"] = [{ wch: 14 }, { wch: 25 }, { wch: 15 }, { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 16 }, { wch: 35 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory Stock Ledger");
    XLSX.writeFile(wb, `Inventory_Stock_Audit_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Stock Audit Ledger exported to Excel!");
  };

  // ── MMI Purity & Metal Weight Breakdown Ledger Computation ──
  const mmiPurityLedgerData = useMemo(() => {
    const purityMap: Record<string, { count: number; netWt: number; grossWt: number; fineGold: number; fineSilver: number; totalValuation: number }> = {
      "24K (99.9%)": { count: 0, netWt: 0, grossWt: 0, fineGold: 0, fineSilver: 0, totalValuation: 0 },
      "22K (91.6%)": { count: 0, netWt: 0, grossWt: 0, fineGold: 0, fineSilver: 0, totalValuation: 0 },
      "20K (83.3%)": { count: 0, netWt: 0, grossWt: 0, fineGold: 0, fineSilver: 0, totalValuation: 0 },
      "18K (75.0%)": { count: 0, netWt: 0, grossWt: 0, fineGold: 0, fineSilver: 0, totalValuation: 0 },
      "14K (58.5%)": { count: 0, netWt: 0, grossWt: 0, fineGold: 0, fineSilver: 0, totalValuation: 0 },
      "925 Sterling Silver": { count: 0, netWt: 0, grossWt: 0, fineGold: 0, fineSilver: 0, totalValuation: 0 },
      "999 Fine Silver": { count: 0, netWt: 0, grossWt: 0, fineGold: 0, fineSilver: 0, totalValuation: 0 },
      "Diamonds & Gemstones": { count: 0, netWt: 0, grossWt: 0, fineGold: 0, fineSilver: 0, totalValuation: 0 },
      "Other / Imitation": { count: 0, netWt: 0, grossWt: 0, fineGold: 0, fineSilver: 0, totalValuation: 0 },
    };

    (allItems || []).forEach((item) => {
      const pcs = typeof item.stock === "number" ? Math.max(0, item.stock) : 1;
      const gw = (item.grossWeight || 0) * pcs;
      const nw = (item.netWeight || 0) * pcs;
      const val = (item.costPrice || item.sellingPrice || 0) * pcs;
      const pur = (item.purity || "").toUpperCase();
      const cat = (item.category || "").toUpperCase();

      let targetKey = "Other / Imitation";
      if (pur.includes("24K") || pur.includes("999 GOLD")) targetKey = "24K (99.9%)";
      else if (pur.includes("22K") || pur.includes("916")) targetKey = "22K (91.6%)";
      else if (pur.includes("20K") || pur.includes("833")) targetKey = "20K (83.3%)";
      else if (pur.includes("18K") || pur.includes("750")) targetKey = "18K (75.0%)";
      else if (pur.includes("14K") || pur.includes("585")) targetKey = "14K (58.5%)";
      else if (pur.includes("925") || cat.includes("SILVER")) targetKey = "925 Sterling Silver";
      else if (pur.includes("999") && cat.includes("SILVER")) targetKey = "999 Fine Silver";
      else if (cat.includes("DIAMOND") || cat.includes("GEMSTONE")) targetKey = "Diamonds & Gemstones";

      purityMap[targetKey].count += pcs;
      purityMap[targetKey].grossWt += gw;
      purityMap[targetKey].netWt += nw;
      purityMap[targetKey].totalValuation += val;

      if (targetKey.includes("24K")) purityMap[targetKey].fineGold += nw * 0.999;
      else if (targetKey.includes("22K")) purityMap[targetKey].fineGold += nw * 0.916;
      else if (targetKey.includes("20K")) purityMap[targetKey].fineGold += nw * 0.833;
      else if (targetKey.includes("18K")) purityMap[targetKey].fineGold += nw * 0.750;
      else if (targetKey.includes("14K")) purityMap[targetKey].fineGold += nw * 0.585;
      else if (targetKey.includes("Silver")) purityMap[targetKey].fineSilver += nw * (targetKey.includes("999") ? 0.999 : 0.925);
    });

    return Object.entries(purityMap).map(([purity, data]) => ({ purity, ...data }));
  }, [allItems]);

  // Export MMI Master Stock Register to Excel
  const exportMasterStockRegisterExcel = () => {
    if (!allItems.length) return toast.error("No items in stock register to export!");

    const sheetData = [
      ["Item Name", "Barcode / Tag", "HUID", "Category", "Subcategory", "Purity", "Pcs Qty", "Gross Wt (g)", "Net Wt (g)", "Fine Gold (g)", "Fine Silver (g)", "Cost Rate (INR)", "Total Valuation (INR)", "Location / Tray", "Status"],
      ...allItems.map((item) => {
        const pur = (item.purity || "").toUpperCase();
        const nw = item.netWeight || 0;
        const isSil = (item.category || "").toUpperCase().includes("SILVER") || pur.includes("925");
        const fineGold = isSil ? 0 : parseFloat((nw * (pur.includes("24K") ? 0.999 : pur.includes("22K") ? 0.916 : pur.includes("20K") ? 0.833 : pur.includes("18K") ? 0.750 : 0.916)).toFixed(3));
        const fineSilver = isSil ? parseFloat((nw * (pur.includes("999") ? 0.999 : 0.925)).toFixed(3)) : 0;
        const val = (item.costPrice || item.sellingPrice || 0) * (item.stock || 1);

        return [
          item.name,
          item.barcode || item.itemCode || item.sku || "N/A",
          item.huid || "N/A",
          item.category || "Jewellery",
          item.subcategory || "",
          item.purity || "22K",
          item.stock || 0,
          item.grossWeight || 0,
          item.netWeight || 0,
          fineGold,
          fineSilver,
          item.costPrice || 0,
          val,
          item.tray || item.godown || "Vault",
          (item.stock || 0) > 0 ? "IN STOCK" : "OUT OF STOCK",
        ];
      }),
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 15 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MMI_Stock_Register");
    XLSX.writeFile(wb, `MMI_Master_Stock_Register_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("MMI Master Stock Register exported to Excel!");
  };


  // Open Create Modal
  const handleOpenCreate = () => {
    setDraft({
      ...emptyProduct,
    });
    setEditingId(null);
    setActiveFormTab("basic");
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: ExtendedProduct) => {
    setDraft({ ...item });
    const targetId = item._id || item.id || null;
    setEditingId(targetId);
    setActiveFormTab("basic");
    setFormViewMode("openstock");

    const tunchVal = (item as any).tunch ?? (item.purity === "24K" || item.purity === "999" ? 99.9 : item.purity === "22K" ? 91.6 : item.purity === "20K" ? 83.3 : item.purity === "18K" ? 75.0 : item.purity === "14K" ? 58.5 : item.purity === "925" ? 92.5 : 91.6);
    const lessWt = Number(item.stoneWeight || 0) + Number(item.diamondWeight || 0) + Number(item.otherWeight || 0);
    const gw = Number(item.grossWeight) || 0;
    const netWt = item.netWeight ?? Math.max(0, gw - lessWt);
    const fine = parseFloat((netWt * (tunchVal + ((item as any).wastage || 0)) / 100).toFixed(3));
    const isSilver = (item.category && item.category.toLowerCase().includes("sil")) || (item.purity && item.purity.toLowerCase().includes("925")) || (item.purity && item.purity.toLowerCase().includes("999"));

    const rowFromItem = {
      _id: targetId || undefined,
      name: (item.name || "").toUpperCase(),
      stamp: item.purity || "22K",
      unit: (item as any).unit || "Gm",
      pcs: item.stock ?? 1,
      grossWeight: gw,
      lessWeight: lessWt,
      netWeight: parseFloat(netWt.toFixed(3)),
      tunch: tunchVal,
      wastage: (item as any).wastage || 0,
      rate: item.costPrice || item.purchaseRate || (item as any).ratePerGram || 0,
      labour: (item as any).labourCharges || item.makingCharge || 0,
      on: "Wt",
      other: item.otherCharges || 0,
      goldFine: isSilver ? 0 : fine,
      silFine: isSilver ? fine : 0,
      total: item.sellingPrice || Math.round((netWt * (item.costPrice || 0)) + (item.makingCharge || 0) + (item.otherCharges || 0)),
      barcode: item.barcode || "",
    };

    setOpenStockRows([rowFromItem]);
    setModalOpen(true);
  };

  // Save Item Handler
  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();

    if (!draft.name.trim()) return toast.error("Item Name is required!");
    if (!draft.category) return toast.error("Category is required!");
    if (!draft.purity) return toast.error("Purity is required!");
    if (draft.sellingPrice && draft.minSellingPrice && draft.sellingPrice < draft.minSellingPrice) {
      return toast.error("Selling Price cannot be lower than Minimum Selling Price!");
    }

    if (editingId) {
      updateItemMutation.mutate({ id: editingId, body: draft });
    } else {
      createItemMutation.mutate(draft);
    }
  };

  // Stone Add/Remove
  const addStoneRow = () => {
    setDraft(prev => ({
      ...prev,
      stones: [...(prev.stones || []), { name: "Ruby", pcs: 1, weight: 0.5, rate: 2000, amount: 1000 }]
    }));
  };
  const removeStoneRow = (idx: number) => {
    setDraft(prev => ({
      ...prev,
      stones: (prev.stones || []).filter((_, i) => i !== idx)
    }));
  };

  // Diamond Add/Remove
  const addDiamondRow = () => {
    setDraft(prev => ({
      ...prev,
      diamonds: [...(prev.diamonds || []), { shape: "Round", color: "G", clarity: "VS1", weight: 0.25, pcs: 1, rate: 45000, certNo: "IGI-12345", amount: 11250 }]
    }));
  };
  const removeDiamondRow = (idx: number) => {
    setDraft(prev => ({
      ...prev,
      diamonds: (prev.diamonds || []).filter((_, i) => i !== idx)
    }));
  };



  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">Jewellery Inventory Hub</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Enterprise Stock Tracking, Multi-Tenant Item Master, Barcode Tags & Stock Ledger
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button data-new-button="true" onClick={handleOpenCreate} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-1.5" /> Add New Item
          </Button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-6 w-full max-w-full min-w-0 overflow-hidden">
        <div className="w-full max-w-full overflow-x-auto scrollbar-none pb-1">
          <TabsList className="inline-flex w-max max-w-none bg-muted/60 p-1 rounded-xl h-auto gap-1 whitespace-nowrap">
            <TabsTrigger value="dashboard" className="text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-1.5 shrink-0">
              <BarChart3 className="w-3.5 h-3.5" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="stock-list" className="text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-1.5 shrink-0">
              <Boxes className="w-3.5 h-3.5 text-emerald-600" /> Item Master & Stock
            </TabsTrigger>
            <TabsTrigger value="opening-stock" className="text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-1.5 shrink-0">
              <Store className="w-3.5 h-3.5 text-blue-600" /> Opening Stock
            </TabsTrigger>
            <TabsTrigger value="stock-adjustment" className="text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-1.5 shrink-0">
              <Scale className="w-3.5 h-3.5 text-amber-600" /> Stock Adjustment
            </TabsTrigger>
            <TabsTrigger value="stock-transfer" className="text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-1.5 shrink-0">
              <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" /> Stock Transfer
            </TabsTrigger>
            <TabsTrigger value="stock-ledger" className="text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-1.5 shrink-0">
              <History className="w-3.5 h-3.5 text-purple-600" /> Stock Ledger
            </TabsTrigger>
            <TabsTrigger value="barcode-mgr" className="text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-1.5 shrink-0">
              <ScanBarcode className="w-3.5 h-3.5 text-rose-600" /> Barcode & Tags
            </TabsTrigger>
            <TabsTrigger value="reports" className="text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-1.5 shrink-0">
              <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600" /> Inventory Reports
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: INVENTORY DASHBOARD */}
        {/* ======================================================== */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border shadow-sm">
              <CardContent className="pt-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase">Total Stock Valuation</div>
                  <div className="text-2xl font-bold font-display text-emerald-600 mt-1">
                    {inr(summaryReport?.totalValuationCost || filteredItems.reduce((sum, p) => sum + ((p.costPrice || p.sellingPrice || 0) * (p.stock || 0)), 0))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Estimated Cost Price</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center">
                  <DollarSign className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardContent className="pt-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase">Total Gold Net Weight</div>
                  <div className="text-2xl font-bold font-display text-amber-600 mt-1">
                    {(summaryReport?.totalNetWeight || filteredItems.filter((p: any) => {
                      const stock = typeof p.stock === "number" ? Math.max(0, p.stock) : 0;
                      if (stock <= 0) return false;
                      const metal = (p.metal || p.metalType || p.category || "").toString().toUpperCase();
                      return metal.includes("GOLD") || metal === "GOLD";
                    }).reduce((sum, p) => sum + (p.netWeight || 0), 0)).toFixed(2)} g
                  </div>



                  <div className="text-xs text-muted-foreground mt-1">Pure Metal Equivalent</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 grid place-items-center">
                  <Award className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardContent className="pt-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase">Total Items in Vault</div>
                  <div className="text-2xl font-bold font-display text-blue-600 mt-1">
                    {allItems.length} SKUs ({allItems.reduce((sum, i) => sum + (i.stock || 0), 0)} Pcs)
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Active Catalog Count</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 grid place-items-center">
                  <Boxes className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardContent className="pt-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase">Low Stock Alerts</div>
                  <div className="text-2xl font-bold font-display text-rose-600 mt-1">
                    {allItems.filter(i => (i.stock || 0) <= (i.reorderLevel || i.minStock || 1)).length} Items
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Reorder Threshold Met</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 grid place-items-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Low Stock Table */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" /> Items Requiring Reorder
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {allItems.filter(i => (i.stock || 0) <= (i.reorderLevel || i.minStock || 1)).length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                  All stock levels are optimal. No low stock warnings.
                </div>
              ) : (
                <>
                  {/* Mobile View */}
                  <div className="block md:hidden divide-y w-full max-w-full overflow-hidden">
                    {allItems
                      .filter(i => (i.stock || 0) <= (i.reorderLevel || i.minStock || 1))
                      .map(item => (
                        <div key={item._id || item.id} className="p-3 space-y-2 hover:bg-muted/10 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="font-bold text-sm text-foreground">{item.name}</div>
                            <Badge variant="outline" className="font-mono text-xs text-rose-600 border-rose-200 bg-rose-50/50">
                              {item.stock} Pcs
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground flex justify-between">
                            <span>Code: {item.barcode || item.itemCode || "N/A"}</span>
                            <span>{item.category} ({item.purity})</span>
                          </div>
                          <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => { setSelectedItemForAction(item); setAdjModalOpen(true); }}>
                            Adjust Stock
                          </Button>
                        </div>
                      ))}
                  </div>

                  {/* Desktop View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                        <tr>
                          <th className="py-2.5 px-4">Barcode / Code</th>
                          <th>Item Name</th>
                          <th>Category</th>
                          <th>Current Stock</th>
                          <th>Reorder Level</th>
                          <th className="text-right px-4">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allItems
                          .filter(i => (i.stock || 0) <= (i.reorderLevel || i.minStock || 1))
                          .map(item => (
                            <tr key={item._id || item.id} className="border-b hover:bg-muted/20">
                              <td className="py-2.5 px-4 font-semibold">{item.barcode || item.itemCode || item._id}</td>
                              <td className="font-medium">{item.name}</td>
                              <td>{item.category} ({item.purity})</td>
                              <td className="font-bold text-rose-600">{item.stock} Pcs</td>
                              <td className="text-muted-foreground">{item.reorderLevel || 2} Pcs</td>
                              <td className="text-right px-4">
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelectedItemForAction(item); setAdjModalOpen(true); }}>
                                  Adjust Stock
                                </Button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 2: ITEM MASTER & STOCK LIST */}
        {/* ======================================================== */}
        <TabsContent value="stock-list" className="space-y-6 w-full max-w-full min-w-0 overflow-hidden">
          {/* Search & Filter Bar */}
          <Card className="shadow-sm bg-muted/20 border w-full max-w-full overflow-hidden">
            <CardContent className="p-2.5 sm:p-4">
              <div className="flex flex-col gap-2.5 w-full">
                {/* Search Input */}
                <div className="relative w-full">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search Item Name, Barcode, HUID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs bg-background w-full"
                  />
                </div>

                {/* Filters row: Category, Subcategory, Purity, Count Badge */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 w-full">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 w-full">
                    <Select value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val); setSubcategoryFilter("ALL"); }}>
                      <SelectTrigger className="h-9 text-xs w-full sm:w-36 bg-background">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.map((c) => (
                          <SelectItem key={c} value={c}>{c === "ALL" ? "All Categories" : c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={subcategoryFilter} onValueChange={setSubcategoryFilter}>
                      <SelectTrigger className="h-9 text-xs w-full sm:w-36 bg-background">
                        <SelectValue placeholder="Subcategory" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSubcategories.map((sc) => (
                          <SelectItem key={sc} value={sc}>{sc === "ALL" ? "All Subcategories" : sc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={purityFilter} onValueChange={setPurityFilter}>
                      <SelectTrigger className="h-9 text-xs w-full sm:w-32 bg-background">
                        <SelectValue placeholder="Purity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Purities</SelectItem>
                        <SelectItem value="24K">24K</SelectItem>
                        <SelectItem value="22K">22K</SelectItem>
                        <SelectItem value="18K">18K</SelectItem>
                        <SelectItem value="14K">14K</SelectItem>
                        <SelectItem value="925">925 Silver</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-start">
                    <span className="text-[11px] font-medium text-muted-foreground bg-background px-2.5 py-1 rounded border border-border/50">
                      Showing {filteredItems.length} of {allItems.length} Items
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Item List */}
          <Card className="shadow-sm">
            <CardContent className="p-0">
              {isLoadingItems ? (
                <div className="py-12 text-center text-muted-foreground">Loading jewellery catalog...</div>
              ) : filteredItems.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">No inventory items match your search.</div>
              ) : (
                <>
                  {/* Mobile Card View (Visible on screens < md) */}
                  <div className="block md:hidden divide-y">
                    {filteredItems.map((item) => (
                      <div key={item._id || item.id} className="p-3 space-y-2.5 bg-card hover:bg-muted/10 transition-colors">
                        {/* Row 1: Item Name & Price/Stock */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-10 h-10 object-cover rounded-md border shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0 border">
                                <ImageIcon className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-sm text-foreground truncate">{item.name}</div>
                              <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1 flex-wrap">
                                <span className="font-semibold text-foreground">{item.category}</span>
                                {item.subcategory && (
                                  <>
                                    <span className="text-muted-foreground/60">›</span>
                                    <span className="text-primary font-medium">{item.subcategory}</span>
                                  </>
                                )}
                                <span className="text-muted-foreground/60">•</span>
                                <span>{item.purity}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                <span className="bg-muted px-1.5 py-0.2 rounded font-mono text-[9px] truncate">
                                  {item.itemCode || item.barcode || "N/A"}
                                </span>
                                {item.huid && (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-mono text-[9px] py-0 px-1 truncate">
                                    HUID: {item.huid}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-bold text-xs text-emerald-600">{inr(item.sellingPrice || 0)}</div>
                            <span className={`inline-block mt-0.5 font-bold text-[10px] px-1.5 py-0.5 rounded ${item.stock <= (item.reorderLevel || 1) ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                              }`}>
                              {item.stock} Pcs
                            </span>
                          </div>
                        </div>

                        {/* Row 2: 4 Grid Cards - Label on top, Value below */}
                        <div className="grid grid-cols-2 gap-1.5 bg-muted/30 p-1.5 rounded-lg">
                          <div className="bg-background/90 p-1.5 rounded border border-border/50">
                            <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Gross Wt</div>
                            <div className="font-mono font-bold text-xs text-foreground mt-0.5">{item.grossWeight || 0} g</div>
                          </div>
                          <div className="bg-background/90 p-1.5 rounded border border-border/50">
                            <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Net Wt</div>
                            <div className="font-mono font-bold text-xs text-emerald-600 mt-0.5">{item.netWeight || 0} g</div>
                          </div>
                          <div className="bg-background/90 p-1.5 rounded border border-border/50">
                            <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Cost Price</div>
                            <div className="font-mono font-bold text-xs text-foreground mt-0.5">{inr(item.costPrice || 0)}</div>
                          </div>
                          <div className="bg-background/90 p-1.5 rounded border border-border/50">
                            <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-tight">Reorder Level</div>
                            <div className="font-mono font-bold text-xs text-foreground mt-0.5">{item.reorderLevel || 1} Pcs</div>
                          </div>
                        </div>

                        {/* Row 3: Action Buttons */}
                        <div className="grid grid-cols-4 gap-1 pt-0.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-[10px] px-1 gap-1 w-full text-purple-700 border-purple-200 hover:bg-purple-50"
                            onClick={() => setLedgerSelectedItem(item)}
                            title="View Stock Ledger & Deductions"
                          >
                            <History className="w-3 h-3" /> Ledger
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-[10px] px-1 gap-1 w-full"
                            onClick={() => { setSelectedTagItem(item); setTagModalOpen(true); }}
                          >
                            <Printer className="w-3 h-3" /> Tag
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-[10px] px-1 gap-1 w-full"
                            onClick={() => handleOpenEdit(item)}
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-[10px] px-1 gap-1 w-full text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete ${item.name}?`)) {
                                deleteItemMutation.mutate(item._id || item.id || "");
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View (Visible on screens >= md) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse min-w-[950px]">
                      <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b">
                        <tr>
                          <th className="py-3 px-4">Item Details</th>
                          <th>Category & Purity</th>
                          <th>HUID / Tag</th>
                          <th>Weights (Gross / Net)</th>
                          <th>Stock Qty</th>
                          <th>Cost & Price</th>
                          <th className="text-right px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItems.map((item) => (
                          <tr key={item._id || item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.name} className="w-10 h-10 object-cover rounded-md border" />
                                ) : (
                                  <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                                    <ImageIcon className="w-5 h-5" />
                                  </div>
                                )}
                                <div>
                                  <div className="font-semibold text-foreground">{item.name}</div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                    <span>Code: {item.itemCode || item.barcode || "N/A"}</span>
                                    {item.barcode && <span className="bg-slate-100 px-1 py-0.2 rounded font-mono text-[10px]">{item.barcode}</span>}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-foreground">{item.category}</span>
                                {item.subcategory && (
                                  <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                                    {item.subcategory}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">{item.purity} ({item.metalType || 'Gold'})</div>
                            </td>

                            <td>
                              {item.huid ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-mono text-xs">
                                  {item.huid}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </td>

                            <td>
                              <div className="font-medium text-foreground">{item.grossWeight || 0} g Gross</div>
                              <div className="text-xs text-emerald-700 font-semibold">{item.netWeight || 0} g Net</div>
                            </td>

                            <td>
                              <span className={`font-bold ${item.stock <= (item.reorderLevel || 1) ? "text-rose-600" : "text-foreground"}`}>
                                {item.stock} Pcs
                              </span>
                            </td>

                            <td>
                              <div className="font-semibold text-emerald-700">{inr(item.sellingPrice || 0)}</div>
                              <div className="text-[11px] text-muted-foreground">Cost: {inr(item.costPrice || 0)}</div>
                            </td>

                            <td className="text-right px-4">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-purple-600 hover:text-purple-900 hover:bg-purple-50"
                                  title="View Item Stock Audit Ledger & Sales Deductions"
                                  onClick={() => setLedgerSelectedItem(item)}
                                >
                                  <History className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                                  title="Print Barcode Tag"
                                  onClick={() => { setSelectedTagItem(item); setTagModalOpen(true); }}
                                >
                                  <ScanBarcode className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-900"
                                  title="Edit Item"
                                  onClick={() => handleOpenEdit(item)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-rose-600 hover:text-rose-900"
                                  title="Delete Item"
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete ${item.name}?`)) {
                                      deleteItemMutation.mutate(item._id || item.id || "");
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
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 3: OPENING STOCK */}
        {/* ======================================================== */}
        <TabsContent value="opening-stock" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-display">Opening Stock Ledger Initializer</CardTitle>
                <CardDescription>Initialize physical count and initial cost valuation for SKUs</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile View */}
              <div className="block md:hidden divide-y">
                {allItems.map((item) => (
                  <div key={item._id || item.id} className="p-3 space-y-2 hover:bg-muted/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm text-foreground">{item.name}</div>
                      <Badge variant="outline" className="font-mono text-xs">{item.stock} Pcs</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{item.category} ({item.purity})</div>
                    <div className="grid grid-cols-3 gap-1.5 bg-muted/30 p-2 rounded-lg text-xs font-mono">
                      <div>
                        <span className="text-[9px] text-muted-foreground uppercase block">Gross</span>
                        <span className="font-semibold">{item.grossWeight || 0}g</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground uppercase block">Net</span>
                        <span className="font-semibold text-emerald-600">{item.netWeight || 0}g</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground uppercase block">Cost</span>
                        <span className="font-semibold">{inr(item.costPrice || 0)}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => {
                      setSelectedItemForAction(item);
                      setOpnForm({ qty: item.stock || 1, grossWeight: item.grossWeight || 0, netWeight: item.netWeight || 0, rate: item.costPrice || 0, totalValue: (item.costPrice || 0) * (item.stock || 1), remarks: "Initial Opening Balance" });
                      setOpnModalOpen(true);
                    }}>
                      Set Opening Stock
                    </Button>
                  </div>
                ))}
              </div>

              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                    <tr>
                      <th className="py-3 px-4">Item Name</th>
                      <th>Category</th>
                      <th>Current Qty</th>
                      <th>Gross Weight</th>
                      <th>Net Weight</th>
                      <th>Cost Rate</th>
                      <th className="text-right px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allItems.map(item => (
                      <tr key={item._id || item.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="py-3 px-4 font-semibold">{item.name}</td>
                        <td>{item.category} ({item.purity})</td>
                        <td>{item.stock} Pcs</td>
                        <td>{item.grossWeight} g</td>
                        <td>{item.netWeight} g</td>
                        <td>{inr(item.costPrice || 0)}</td>
                        <td className="text-right px-4">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                            setSelectedItemForAction(item);
                            setOpnForm({ qty: item.stock || 1, grossWeight: item.grossWeight || 0, netWeight: item.netWeight || 0, rate: item.costPrice || 0, totalValue: (item.costPrice || 0) * (item.stock || 1), remarks: "Initial Opening Balance" });
                            setOpnModalOpen(true);
                          }}>
                            Set Opening Stock
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 4: STOCK ADJUSTMENT */}
        {/* ======================================================== */}
        <TabsContent value="stock-adjustment" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-display">Stock Adjustment Audit Log</CardTitle>
                <CardDescription>Records of manual stock increases or physical audit write-offs</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {stockAdjustments.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No stock adjustments recorded yet.
                </div>
              ) : (
                <>
                  {/* Mobile View */}
                  <div className="block md:hidden divide-y">
                    {stockAdjustments.map((adj: any) => (
                      <div key={adj._id || adj.id} className="p-3 space-y-2 hover:bg-muted/10 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-foreground">{adj.adjustmentNo}</span>
                          <Badge className={adj.type === "INCREASE" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}>
                            {adj.type} ({adj.qty} Pcs)
                          </Badge>
                        </div>
                        <div className="font-semibold text-sm">{adj.itemName}</div>
                        <div className="text-xs text-muted-foreground flex justify-between">
                          <span>Reason: {adj.reason}</span>
                          <span>{adj.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse min-w-[700px]">
                      <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                        <tr>
                          <th className="py-3 px-4">Adj #</th>
                          <th>Date</th>
                          <th>Item</th>
                          <th>Type</th>
                          <th>Qty Change</th>
                          <th>Reason</th>
                          <th>Recorded By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockAdjustments.map((adj: any) => (
                          <tr key={adj._id || adj.id} className="border-b last:border-0">
                            <td className="py-3 px-4 font-mono font-semibold">{adj.adjustmentNo}</td>
                            <td>{adj.date}</td>
                            <td className="font-medium">{adj.itemName}</td>
                            <td>
                              <Badge className={adj.type === "INCREASE" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}>
                                {adj.type}
                              </Badge>
                            </td>
                            <td className="font-bold">{adj.qty} Pcs</td>
                            <td>{adj.reason}</td>
                            <td className="text-muted-foreground">{adj.createdBy || "Admin"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 5: STOCK TRANSFER */}
        {/* ======================================================== */}
        <TabsContent value="stock-transfer" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-display">Branch & Vault Stock Transfers</CardTitle>
                <CardDescription>Movement history of items across stores and lockers</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {stockTransfers.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No stock transfers recorded yet.
                </div>
              ) : (
                <>
                  {/* Mobile View */}
                  <div className="block md:hidden divide-y">
                    {stockTransfers.map((trf: any) => (
                      <div key={trf._id || trf.id} className="p-3 space-y-2 hover:bg-muted/10 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs">{trf.transferNo}</span>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {trf.status}
                          </Badge>
                        </div>
                        <div className="font-semibold text-sm">{trf.itemName} ({trf.qty} Pcs)</div>
                        <div className="text-xs text-muted-foreground flex justify-between">
                          <span>{trf.fromBranch} → {trf.toBranch}</span>
                          <span>{trf.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse min-w-[700px]">
                      <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                        <tr>
                          <th className="py-3 px-4">Transfer #</th>
                          <th>Date</th>
                          <th>Item</th>
                          <th>From</th>
                          <th>To</th>
                          <th>Qty</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockTransfers.map((trf: any) => (
                          <tr key={trf._id || trf.id} className="border-b last:border-0">
                            <td className="py-3 px-4 font-mono font-semibold">{trf.transferNo}</td>
                            <td>{trf.date}</td>
                            <td className="font-medium">{trf.itemName}</td>
                            <td>{trf.fromBranch}</td>
                            <td>{trf.toBranch} ({trf.toGodown || 'Vault'})</td>
                            <td className="font-bold">{trf.qty} Pcs</td>
                            <td>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                {trf.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 6: MMI INVENTORY STOCK LEDGERS SUITE */}
        {/* ======================================================== */}
        <TabsContent value="stock-ledger" className="space-y-6">
          {/* MMI Stock Ledger Mode Selector Bar */}
          <div className="flex items-center gap-1.5 bg-card border border-amber-500/20 rounded-2xl p-2 shadow-sm overflow-x-auto scrollbar-none">
            <button
              onClick={() => setInventoryLedgerView("master_stock")}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                inventoryLedgerView === "master_stock"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-slate-700 dark:text-slate-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/40"
              }`}
            >
              <Boxes className="w-4 h-4" /> Master Stock Register
            </button>

            <button
              onClick={() => setInventoryLedgerView("purity_weight")}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                inventoryLedgerView === "purity_weight"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-slate-700 dark:text-slate-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/40"
              }`}
            >
              <Scale className="w-4 h-4" /> Metal Purity Balance Ledger
            </button>

            <button
              onClick={() => setInventoryLedgerView("movement")}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                inventoryLedgerView === "movement"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-slate-700 dark:text-slate-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/40"
              }`}
            >
              <History className="w-4 h-4" /> Movement Audit Register
            </button>

            <button
              onClick={() => setInventoryLedgerView("tag_audit")}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                inventoryLedgerView === "tag_audit"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-slate-700 dark:text-slate-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/40"
              }`}
            >
              <ScanBarcode className="w-4 h-4" /> Tag & Barcode Audit
            </button>

            <button
              onClick={() => setInventoryLedgerView("low_stock")}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                inventoryLedgerView === "low_stock"
                  ? "bg-amber-600 text-white shadow-md"
                  : "text-slate-700 dark:text-slate-300 hover:bg-amber-100/60 dark:hover:bg-amber-950/40"
              }`}
            >
              <AlertTriangle className="w-4 h-4" /> Low Stock Warning Ledger
            </button>
          </div>

          {/* LEDGER 1: MASTER STOCK REGISTER */}
          {inventoryLedgerView === "master_stock" && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <Boxes className="w-5 h-5 text-amber-600" /> Master Stock Book Register (Stock Book)
                  </CardTitle>
                  <CardDescription className="text-xs">Comprehensive item-by-item stock register with gross weight, net weight, fine weight & valuation</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-emerald-800 border-emerald-300 hover:bg-emerald-50" onClick={exportMasterStockRegisterExcel}>
                    <Download className="w-3.5 h-3.5" /> Export Excel
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => window.print()}>
                    <Printer className="w-3.5 h-3.5" /> Print Register
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse min-w-[1000px]">
                    <thead className="bg-muted/50 text-muted-foreground uppercase font-bold text-[11px] border-b">
                      <tr>
                        <th className="py-2.5 px-3">Tag / Barcode</th>
                        <th className="py-2.5">Item Name</th>
                        <th className="py-2.5">Category</th>
                        <th className="py-2.5">Purity</th>
                        <th className="py-2.5 text-center">Stock Qty</th>
                        <th className="py-2.5 text-right">Gross Wt (g)</th>
                        <th className="py-2.5 text-right text-emerald-700">Net Wt (g)</th>
                        <th className="py-2.5 text-right text-amber-700">Fine Gold (g)</th>
                        <th className="py-2.5 text-right text-slate-700">Fine Sil (g)</th>
                        <th className="py-2.5 text-right px-3">Valuation (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {allItems.map((item) => {
                        const pcs = typeof item.stock === "number" ? Math.max(0, item.stock) : 1;
                        const gw = (item.grossWeight || 0) * pcs;
                        const nw = (item.netWeight || 0) * pcs;
                        const pur = (item.purity || "").toUpperCase();
                        const isSil = (item.category || "").toUpperCase().includes("SILVER") || pur.includes("925");
                        const fineGold = isSil ? 0 : parseFloat((nw * (pur.includes("24K") ? 0.999 : pur.includes("22K") ? 0.916 : pur.includes("20K") ? 0.833 : pur.includes("18K") ? 0.750 : 0.916)).toFixed(3));
                        const fineSilver = isSil ? parseFloat((nw * (pur.includes("999") ? 0.999 : 0.925)).toFixed(3)) : 0;
                        const val = (item.costPrice || item.sellingPrice || 0) * pcs;

                        return (
                          <tr key={item._id || item.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-primary">{item.barcode || item.itemCode || item.sku || "N/A"}</td>
                            <td className="font-sans font-semibold text-foreground">{item.name}</td>
                            <td>{item.category || "Jewellery"}</td>
                            <td>
                              <Badge variant="outline" className="text-[10px]">{item.purity || "22K"}</Badge>
                            </td>
                            <td className="text-center font-bold">{pcs} Pcs</td>
                            <td className="text-right">{gw.toFixed(3)}g</td>
                            <td className="text-right font-bold text-emerald-700">{nw.toFixed(3)}g</td>
                            <td className="text-right font-bold text-amber-700">{fineGold > 0 ? `${fineGold.toFixed(3)}g` : "—"}</td>
                            <td className="text-right font-bold text-slate-700">{fineSilver > 0 ? `${fineSilver.toFixed(3)}g` : "—"}</td>
                            <td className="text-right px-3 font-bold text-emerald-700">{inr(val)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-muted/40 font-bold border-t-2 border-slate-900 text-xs">
                      <tr>
                        <td colSpan={4} className="py-3 px-3 uppercase text-right">Total Stock Summary:</td>
                        <td className="text-center font-mono text-blue-700">{allItems.reduce((s, i) => s + (i.stock || 0), 0)} Pcs</td>
                        <td className="text-right font-mono">{allItems.reduce((s, i) => s + ((i.grossWeight || 0) * (i.stock || 1)), 0).toFixed(3)}g</td>
                        <td className="text-right font-mono text-emerald-800">{allItems.reduce((s, i) => s + ((i.netWeight || 0) * (i.stock || 1)), 0).toFixed(3)}g</td>
                        <td colSpan={2} className="text-right font-mono text-amber-800">
                          Gold: {allItems.filter(i => !(i.category || "").toUpperCase().includes("SILVER")).reduce((s, i) => s + ((i.netWeight || 0) * 0.916 * (i.stock || 1)), 0).toFixed(3)}g
                        </td>
                        <td className="text-right px-3 font-mono text-emerald-900">{inr(allItems.reduce((s, i) => s + ((i.costPrice || i.sellingPrice || 0) * (i.stock || 1)), 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* LEDGER 2: METAL PURITY BALANCE LEDGER */}
          {inventoryLedgerView === "purity_weight" && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <Scale className="w-5 h-5 text-amber-600" /> Metal Purity & Fine Weight Balance Ledger (Sona-Chandi Weight Khata)
                  </CardTitle>
                  <CardDescription className="text-xs">Purity-wise physical gross weight, net weight, fine gold & silver equivalent audit</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse min-w-[800px]">
                    <thead className="bg-muted/50 text-muted-foreground uppercase font-bold text-[11px] border-b">
                      <tr>
                        <th className="py-3 px-4">Purity Stamp / Metal Category</th>
                        <th className="py-3 text-center">Item Count</th>
                        <th className="py-3 text-right">Gross Wt (g)</th>
                        <th className="py-3 text-right text-emerald-700">Net Wt (g)</th>
                        <th className="py-3 text-right text-amber-700">Fine Gold Eq. (g)</th>
                        <th className="py-3 text-right text-slate-700">Fine Silver Eq. (g)</th>
                        <th className="py-3 px-4 text-right">Total Valuation (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {mmiPurityLedgerData.map((row) => (
                        <tr key={row.purity} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-sans font-bold text-foreground">{row.purity}</td>
                          <td className="text-center font-bold">{row.count} Pcs</td>
                          <td className="text-right">{row.grossWt.toFixed(3)}g</td>
                          <td className="text-right font-bold text-emerald-700">{row.netWt.toFixed(3)}g</td>
                          <td className="text-right font-bold text-amber-700">{row.fineGold > 0 ? `${row.fineGold.toFixed(3)}g` : "—"}</td>
                          <td className="text-right font-bold text-slate-700">{row.fineSilver > 0 ? `${row.fineSilver.toFixed(3)}g` : "—"}</td>
                          <td className="text-right px-4 font-bold text-emerald-700">{inr(row.totalValuation)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* LEDGER 3: MOVEMENT AUDIT REGISTER */}
          {inventoryLedgerView === "movement" && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <History className="w-5 h-5 text-purple-600" /> Stock Inward vs Outward Movement Audit Log
                  </CardTitle>

                  <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                    <div className="relative flex-1 md:w-64">
                      <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                      <Input
                        placeholder="Search Item, Tag #, Buyer, Mobile, Invoice..."
                        className="pl-8 h-9 text-xs"
                        value={ledgerSearchTerm}
                        onChange={(e) => setLedgerSearchTerm(e.target.value)}
                      />
                    </div>

                    <Select value={ledgerTypeFilter} onValueChange={setLedgerTypeFilter}>
                      <SelectTrigger className="h-9 text-xs w-36">
                        <SelectValue placeholder="Txn Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Movements</SelectItem>
                        <SelectItem value="SALE">Sales Outward</SelectItem>
                        <SelectItem value="PURCHASE">Purchase Inward</SelectItem>
                        <SelectItem value="ADJUSTMENT">Adjustments</SelectItem>
                        <SelectItem value="OPENING">Opening Stock</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button size="sm" variant="outline" className="h-9 text-xs gap-1" onClick={exportStockLedgerToExcel}>
                      <Download className="w-3.5 h-3.5" /> Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse min-w-[950px]">
                    <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th>Item & SKU</th>
                        <th>Txn Type</th>
                        <th>Reference #</th>
                        <th>Buyer / Customer / Supplier</th>
                        <th>Qty Change</th>
                        <th>Stock Balance</th>
                        <th>Rate & Value</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredStockLedger.map((led: any) => (
                        <tr key={led.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs font-medium">{led.date}</td>
                          <td>
                            <div className="font-semibold text-foreground">{led.itemName}</div>
                            {led.sku && <div className="text-[11px] font-mono text-purple-700">SKU: {led.sku}</div>}
                          </td>
                          <td>
                            <Badge
                              variant="outline"
                              className={`font-semibold text-xs ${
                                led.qtyChange < 0
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : led.txnCategory === "PURCHASE"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {led.transactionType}
                            </Badge>
                          </td>
                          <td className="font-mono font-bold text-xs text-primary">{led.referenceNo || "-"}</td>
                          <td>
                            <div className="font-medium text-xs">{led.partyName || "-"}</div>
                            {led.partyMobile && (
                              <div className="text-[11px] text-muted-foreground font-mono">{led.partyMobile}</div>
                            )}
                          </td>
                          <td className={`font-bold font-mono ${led.qtyChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {led.qtyChange >= 0 ? `+${led.qtyChange}` : led.qtyChange} Pcs
                          </td>
                          <td className="font-bold font-mono text-foreground">{led.balanceQty} Pcs</td>
                          <td className="text-xs font-mono">
                            {led.unitPrice ? inr(led.unitPrice) : "-"}
                            {led.totalAmount ? <div className="text-[10px] text-muted-foreground">Total: {inr(led.totalAmount)}</div> : null}
                          </td>
                          <td className="text-xs text-muted-foreground max-w-[200px] truncate" title={led.remarks}>
                            {led.remarks || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* LEDGER 4: TAG & BARCODE AUDIT REGISTER */}
          {inventoryLedgerView === "tag_audit" && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <ScanBarcode className="w-5 h-5 text-rose-600" /> Barcode Tag Audit Register
                </CardTitle>
                <CardDescription className="text-xs">Unique SKU barcode tag tracking with HUID numbers, making charges & vault storage status</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse min-w-[900px]">
                    <thead className="bg-muted/50 text-muted-foreground uppercase font-bold text-[11px] border-b">
                      <tr>
                        <th className="py-3 px-4">Barcode / Tag #</th>
                        <th>Item Name</th>
                        <th>HUID Number</th>
                        <th>Purity</th>
                        <th className="text-right">Net Wt (g)</th>
                        <th>Making Charge</th>
                        <th className="text-right">Selling Price</th>
                        <th>Tray / Locker</th>
                        <th className="text-right px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {allItems.map((item) => (
                        <tr key={item._id || item.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-bold text-rose-700">{item.barcode || item.itemCode || item.sku || "N/A"}</td>
                          <td className="font-sans font-semibold text-foreground">{item.name}</td>
                          <td><span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold">{item.huid || "NOT-HALLMARKED"}</span></td>
                          <td>{item.purity || "22K"}</td>
                          <td className="text-right font-bold text-emerald-700">{item.netWeight || 0}g</td>
                          <td className="font-sans text-xs">{item.makingCharge ? `${inr(item.makingCharge)} (${item.makingChargeType || "fixed"})` : "—"}</td>
                          <td className="text-right font-bold text-emerald-700">{inr(item.sellingPrice || 0)}</td>
                          <td className="font-sans text-xs">{item.tray || item.godown || "Vault T-1"}</td>
                          <td className="text-right px-4">
                            <Badge className={(item.stock || 0) > 0 ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-rose-100 text-rose-800 border-rose-300"}>
                              {(item.stock || 0) > 0 ? `IN VAULT (${item.stock} Pcs)` : "SOLD / OUT"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* LEDGER 5: LOW STOCK WARNING LEDGER */}
          {inventoryLedgerView === "low_stock" && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-base font-display flex items-center gap-2 text-rose-700">
                  <AlertTriangle className="w-5 h-5 text-rose-600" /> Low Stock & Reorder Threshold Ledger
                </CardTitle>
                <CardDescription className="text-xs">Items at or below minimum stock threshold requiring reorder from manufacturers / karigars</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse min-w-[800px]">
                    <thead className="bg-muted/50 text-muted-foreground uppercase font-bold text-[11px] border-b">
                      <tr>
                        <th className="py-3 px-4">Item Name</th>
                        <th>Category</th>
                        <th>Purity</th>
                        <th className="text-center">Current Stock</th>
                        <th className="text-center">Reorder Level</th>
                        <th className="text-right">Unit Cost Price</th>
                        <th className="text-right px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {allItems
                        .filter((i) => (i.stock || 0) <= (i.reorderLevel || i.minStock || 1))
                        .map((item) => (
                          <tr key={item._id || item.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4 font-bold text-foreground">{item.name}</td>
                            <td>{item.category} ({item.subcategory || "General"})</td>
                            <td><Badge variant="outline">{item.purity}</Badge></td>
                            <td className="text-center font-bold font-mono text-rose-600">{item.stock || 0} Pcs</td>
                            <td className="text-center font-mono font-bold text-amber-700">{item.reorderLevel || item.minStock || 1} Pcs</td>
                            <td className="text-right font-mono font-bold">{inr(item.costPrice || 0)}</td>
                            <td className="text-right px-4">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelectedItemForAction(item); setAdjModalOpen(true); }}>
                                Adjust Stock
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 7: BARCODE & TAG PRINTING */}
        {/* ======================================================== */}
        <TabsContent value="barcode-mgr" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="font-display">Jewellery Tag & Barcode Generator</CardTitle>
              <CardDescription>Select any item to generate & print barcode labels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {allItems.slice(0, 12).map(item => (
                  <div key={item._id || item.id} className="border p-4 rounded-xl flex items-center justify-between bg-card hover:shadow-sm transition-all">
                    <div>
                      <div className="font-bold text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.category} • {item.purity} • {item.grossWeight}g</div>
                      <div className="text-xs font-mono text-primary mt-1">{item.barcode || "No Barcode"}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedTagItem(item); setTagModalOpen(true); }}>
                      <ScanBarcode className="w-4 h-4 mr-1" /> Print Tag
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 8: INVENTORY REPORTS */}
        {/* ======================================================== */}
        <TabsContent value="reports" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-teal-600" /> Stock Valuation & Breakdown Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-sm mb-3">Category Breakdown</h4>
                  <div className="space-y-2">
                    {Object.entries(summaryReport?.categoryBreakdown || {}).map(([cat, val]: any) => (
                      <div key={cat} className="flex items-center justify-between border-b pb-2 text-sm">
                        <span className="font-medium">{cat}</span>
                        <span className="text-muted-foreground">{val.count} Items | {val.netWeight.toFixed(2)}g Net | <strong className="text-emerald-700">{inr(val.valuation)}</strong></span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-3">Purity Breakdown</h4>
                  <div className="space-y-2">
                    {Object.entries(summaryReport?.purityBreakdown || {}).map(([pur, val]: any) => (
                      <div key={pur} className="flex items-center justify-between border-b pb-2 text-sm">
                        <span className="font-medium">{pur}</span>
                        <span className="text-muted-foreground">{val.count} Items | <strong className="text-amber-700">{val.netWeight.toFixed(2)}g Net</strong></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ======================================================== */}
      {/* ALL-IN-ONE ITEM MASTER CREATE / EDIT DIALOG MODAL        */}
      {/* ======================================================== */}
      <Dialog open={modalOpen} onOpenChange={(open) => {
        setModalOpen(open);
        if (!open) setEditingId(null);
      }}>
        <DialogContent className="fixed inset-0 z-[100] w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 top-0 left-0 rounded-none border-0 p-3 sm:p-5 bg-slate-100 dark:bg-slate-950 flex flex-col overflow-y-auto shadow-none">
          {/* Header */}
          <DialogHeader className="p-3.5 md:p-4 pb-2.5 border-b border-amber-300 dark:border-slate-800 bg-amber-100/80 dark:bg-slate-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <DialogTitle className="font-sans text-base md:text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-amber-100 uppercase tracking-wide">
                  <Boxes className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                  <span>{editingId ? "Edit Jewellery Item Master" : "Create New Jewellery Item Master"}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
                  Professional Desktop ERP master form with real-time fine weight calculation & stock ledger integration.
                </DialogDescription>
              </div>

              {/* View Mode Selector Toggle */}
              <div className="flex items-center gap-1 bg-muted p-1 rounded-lg self-start sm:self-auto border">
                <button
                  type="button"
                  onClick={() => setFormViewMode("openstock")}
                  className={`text-xs px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                    formViewMode === "openstock"
                      ? "bg-background text-foreground shadow-sm font-bold border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>OPEN.STOCK Grid</span>
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">Default ERP</Badge>
                </button>
                <button
                  type="button"
                  onClick={() => setFormViewMode("all")}
                  className={`text-xs px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                    formViewMode === "all"
                      ? "bg-background text-foreground shadow-sm font-bold border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
                  <span>All-in-One Form</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormViewMode("tabbed")}
                  className={`text-xs px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                    formViewMode === "tabbed"
                      ? "bg-background text-foreground shadow-sm font-bold border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Tabbed View</span>
                </button>
              </div>
            </div>

            {/* Live Summary Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 p-2 bg-background/90 rounded-md border text-xs font-mono">
              <div className="flex items-center justify-between px-2 py-1 bg-muted/30 rounded">
                <span className="text-muted-foreground text-[10px] uppercase font-bold">Gross Weight:</span>
                <span className="font-bold text-foreground">
                  {formViewMode === "openstock"
                    ? openStockRows.reduce((s, r) => s + (r.grossWeight || 0), 0).toFixed(3)
                    : (draft.grossWeight || 0)} g
                </span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 bg-emerald-50 dark:bg-emerald-950/30 rounded border border-emerald-200">
                <span className="text-emerald-800 dark:text-emerald-300 text-[10px] uppercase font-bold">Net Fine Wt:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {formViewMode === "openstock"
                    ? openStockRows.reduce((s, r) => s + (r.goldFine + r.silFine || 0), 0).toFixed(3)
                    : (draft.netWeight || 0)} g
                </span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200">
                <span className="text-blue-800 dark:text-blue-300 text-[10px] uppercase font-bold">Total Stock Value:</span>
                <span className="font-bold text-blue-700 dark:text-blue-400">
                  {formViewMode === "openstock"
                    ? inr(openStockRows.reduce((s, r) => s + (r.total || 0), 0))
                    : inr(draft.sellingPrice || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200">
                <span className="text-amber-800 dark:text-amber-300 text-[10px] uppercase font-bold">Current Items:</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">
                  {formViewMode === "openstock" ? `${openStockRows.length} Rows` : `${draft.stock || 0} Pcs`}
                </span>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={formViewMode === "openstock" ? (e) => { e.preventDefault(); handleSaveOpenStock(); } : handleSaveItem} className="flex-1 flex flex-col overflow-hidden">
            {/* If tabbed view is selected, render tab list */}
            {formViewMode === "tabbed" && (
              <div className="px-6 pt-2 border-b bg-muted/20">
                <Tabs value={activeFormTab} onValueChange={setActiveFormTab}>
                  <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
                    <TabsTrigger value="basic" className="text-xs py-1.5 px-3">Basic Info</TabsTrigger>
                    <TabsTrigger value="jewellery" className="text-xs py-1.5 px-3">Jewellery Specs</TabsTrigger>
                    <TabsTrigger value="weight" className="text-xs py-1.5 px-3">Weight Details</TabsTrigger>
                    <TabsTrigger value="stone" className="text-xs py-1.5 px-3">Stones ({draft.stones?.length || 0})</TabsTrigger>
                    <TabsTrigger value="diamond" className="text-xs py-1.5 px-3">Diamonds ({draft.diamonds?.length || 0})</TabsTrigger>
                    <TabsTrigger value="pricing" className="text-xs py-1.5 px-3">Pricing & Cost</TabsTrigger>
                    <TabsTrigger value="gst" className="text-xs py-1.5 px-3">GST</TabsTrigger>
                    <TabsTrigger value="inventory-tab" className="text-xs py-1.5 px-3">Inventory & Location</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
              {formViewMode === "openstock" ? (
                /* OPEN.STOCK TRADITIONAL DESKTOP ERP INTERFACE (SOFTWARE THEME - NO PINK) */
                <div className="space-y-3.5 bg-amber-50/20 dark:bg-slate-950 p-3.5 rounded-xl border border-amber-200 dark:border-slate-800 shadow-sm">
                  {/* Top Header Card */}
                  <div className="bg-amber-100/90 dark:bg-slate-900 p-2.5 rounded-lg border border-amber-300 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap flex-1">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-bold text-slate-900 dark:text-amber-100 uppercase">Date</Label>
                        <Input
                          type="date"
                          value={openStockHeader.date}
                          onChange={e => setOpenStockHeader(h => ({ ...h, date: e.target.value }))}
                          className="h-7.5 text-xs font-mono font-bold bg-white dark:bg-slate-800 w-36 border-slate-300"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-bold text-slate-900 dark:text-amber-100 uppercase">Bill No</Label>
                        <Input
                          type="text"
                          value={openStockHeader.billNo}
                          onChange={e => setOpenStockHeader(h => ({ ...h, billNo: e.target.value }))}
                          className="h-7.5 text-xs font-mono font-bold bg-white dark:bg-slate-800 w-24 border-slate-300"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                        <Label className="text-xs font-bold text-slate-900 dark:text-amber-100 uppercase">Narration</Label>
                        <Input
                          type="text"
                          value={openStockHeader.narration}
                          onChange={e => setOpenStockHeader(h => ({ ...h, narration: e.target.value }))}
                          placeholder="Opening stock entry remarks..."
                          className="h-7.5 text-xs bg-white dark:bg-slate-800 border-slate-300 flex-1"
                        />
                      </div>
                    </div>
                    <Badge className="bg-slate-900 text-white font-mono font-bold text-xs uppercase px-3 py-1 shadow-2xs">
                      OPEN.STOCK
                    </Badge>
                  </div>

                  {/* Master Stock Table Grid (Full Width - Fits Screen cleanly) */}
                  <div className="overflow-x-auto border-2 border-slate-400 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md">
                    <table className="w-full text-xs sm:text-sm border-collapse min-w-[1250px]">
                      <thead className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 uppercase font-black border-b-2 border-slate-400 dark:border-slate-700">
                        <tr>
                          <th className="p-1.5 border border-slate-300 dark:border-slate-700 text-left w-[14%]">Item Name</th>
                          <th className="p-1.5 border border-slate-300 dark:border-slate-700 text-center w-[7%]">Stamp</th>
                          <th className="p-1.5 border border-slate-300 dark:border-slate-700 text-center w-[5%]">Unit</th>
                          <th className="p-1.5 border border-slate-300 dark:border-slate-700 text-center w-[4%]">Pc</th>
                          <th className="p-1.5 border border-slate-300 dark:border-slate-700 text-right w-[6%]">Gr.Wt.</th>
                          <th className="p-1.5 border border-slate-300 dark:border-slate-700 text-right w-[5%]">Less</th>
                          <th className="p-1.5 border border-slate-300 dark:border-slate-700 text-right w-[6%]">Net.Wt.</th>
                          <th className="p-1.5 border border-slate-300 dark:border-slate-700 text-right w-[5%]">Tunch</th>
                          <th className="p-1.5 border border-slate-300 dark:border-slate-700 text-right w-[5%]">Wstg</th>
                          <th className="p-1.5 border border-slate-300 dark:border-slate-700 text-right w-[7%]">Rate</th>
                          <th className="p-1.5 border border-slate-300 dark:border-slate-700 text-right w-[6%]">Lbr.</th>
                          <th className="p-1.5 border border-slate-300 dark:border-slate-700 text-center w-[4%]">On</th>
                          <th className="p-1.5 border border-slate-300 dark:border-slate-700 text-right w-[5%]">Other</th>
                          <th className="p-1.5 border border-slate-300 dark:border-slate-700 text-right w-[7%] bg-amber-100 dark:bg-amber-950/80 font-bold">Gold Fine</th>
                          <th className="p-1.5 border border-slate-300 dark:border-slate-700 text-right w-[6%] bg-amber-100 dark:bg-amber-950/80 font-bold">Sil.Fine</th>
                          <th className="p-1.5 border border-slate-300 dark:border-slate-700 text-right w-[8%] bg-amber-200 dark:bg-amber-900/90 font-black">Total</th>
                          <th className="p-1.5 text-center w-[4%] border border-slate-300 dark:border-slate-700"></th>
                        </tr>
                      </thead>
                      <tbody className="font-mono text-xs sm:text-sm">
                        {openStockRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-sky-50/50 dark:hover:bg-slate-800/60 border-b border-slate-300 dark:border-slate-700">
                            <td className="p-0 border border-slate-300 dark:border-slate-700">
                              <input
                                value={row.name}
                                onChange={e => updateOpenStockRow(idx, "name", e.target.value.toUpperCase())}
                                placeholder="e.g. BENGAL / RING"
                                className="w-full h-8.5 px-2 text-xs sm:text-sm font-bold font-sans bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80 text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="p-0 border border-slate-300 dark:border-slate-700">
                              <select
                                value={row.stamp}
                                onChange={e => updateOpenStockRow(idx, "stamp", e.target.value)}
                                className="w-full h-8.5 text-xs sm:text-sm font-bold text-center bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80 cursor-pointer text-slate-900 dark:text-white"
                              >
                                {["24K", "22K", "20K", "18K", "14K", "925", "999"].map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                            <td className="p-0 border border-slate-300 dark:border-slate-700">
                              <select
                                value={row.unit}
                                onChange={e => updateOpenStockRow(idx, "unit", e.target.value)}
                                className="w-full h-8.5 text-xs sm:text-sm font-bold text-center bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80 cursor-pointer text-slate-900 dark:text-white"
                              >
                                {["Gm", "Pcs", "Ct", "Kg"].map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="p-0 border border-slate-300 dark:border-slate-700">
                              <input
                                type="number"
                                value={row.pcs}
                                onChange={e => updateOpenStockRow(idx, "pcs", +e.target.value)}
                                className="w-full h-8.5 px-1.5 text-center font-mono text-xs sm:text-sm font-bold bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80 text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="p-0 border border-slate-300 dark:border-slate-700">
                              <input
                                type="number"
                                step="0.001"
                                value={row.grossWeight || ""}
                                onChange={e => updateOpenStockRow(idx, "grossWeight", +e.target.value)}
                                className="w-full h-8.5 px-1.5 text-right font-mono text-xs sm:text-sm font-black bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80 text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="p-0 border border-slate-300 dark:border-slate-700">
                              <input
                                type="number"
                                step="0.001"
                                value={row.lessWeight || ""}
                                onChange={e => updateOpenStockRow(idx, "lessWeight", +e.target.value)}
                                className="w-full h-8.5 px-1.5 text-right font-mono text-xs sm:text-sm font-bold bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80 text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="p-2 border border-slate-300 dark:border-slate-700 text-right font-mono font-black text-xs sm:text-sm text-slate-950 dark:text-white bg-slate-100/70 dark:bg-slate-800/70">
                              {row.netWeight ? row.netWeight.toFixed(3) : "0.000"}
                            </td>
                            <td className="p-0 border border-slate-300 dark:border-slate-700">
                              <input
                                type="number"
                                step="0.1"
                                value={row.tunch || ""}
                                onChange={e => updateOpenStockRow(idx, "tunch", +e.target.value)}
                                className="w-full h-8.5 px-1.5 text-right font-mono text-xs sm:text-sm font-black text-amber-700 dark:text-amber-400 bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80"
                              />
                            </td>
                            <td className="p-0 border border-slate-300 dark:border-slate-700">
                              <input
                                type="number"
                                step="0.1"
                                value={row.wastage || ""}
                                onChange={e => updateOpenStockRow(idx, "wastage", +e.target.value)}
                                className="w-full h-8.5 px-1.5 text-right font-mono text-xs sm:text-sm font-bold bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80 text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="p-0 border border-slate-300 dark:border-slate-700">
                              <input
                                type="number"
                                value={row.rate || ""}
                                onChange={e => updateOpenStockRow(idx, "rate", +e.target.value)}
                                className="w-full h-8.5 px-1.5 text-right font-mono text-xs sm:text-sm font-bold bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80 text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="p-0 border border-slate-300 dark:border-slate-700">
                              <input
                                type="number"
                                value={row.labour || ""}
                                onChange={e => updateOpenStockRow(idx, "labour", +e.target.value)}
                                className="w-full h-8.5 px-1.5 text-right font-mono text-xs sm:text-sm font-bold bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80 text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="p-0 border border-slate-300 dark:border-slate-700">
                              <select
                                value={row.on}
                                onChange={e => updateOpenStockRow(idx, "on", e.target.value)}
                                className="w-full h-8.5 text-xs sm:text-sm font-bold text-center bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80 cursor-pointer text-slate-900 dark:text-white"
                              >
                                <option value="Wt">Wt</option>
                                <option value="%">%</option>
                                <option value="Rs">Rs</option>
                              </select>
                            </td>
                            <td className="p-0 border border-slate-300 dark:border-slate-700">
                              <input
                                type="number"
                                value={row.other || ""}
                                onChange={e => updateOpenStockRow(idx, "other", +e.target.value)}
                                className="w-full h-8.5 px-1.5 text-right font-mono text-xs sm:text-sm font-bold bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80 text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="p-2 border border-slate-300 dark:border-slate-700 text-right font-mono font-black text-xs sm:text-sm bg-amber-100/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200">
                              {row.goldFine ? row.goldFine.toFixed(3) : "0.000"}
                            </td>
                            <td className="p-2 border border-slate-300 dark:border-slate-700 text-right font-mono font-bold text-xs sm:text-sm bg-slate-100/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200">
                              {row.silFine ? row.silFine.toFixed(3) : "0.000"}
                            </td>
                            <td className="p-2 border border-slate-300 dark:border-slate-700 text-right font-mono font-black text-sm sm:text-base bg-amber-200/80 dark:bg-amber-900/70 text-slate-950 dark:text-white">
                              {inr(row.total || 0)}
                            </td>
                            <td className="p-1 border border-slate-300 dark:border-slate-700 text-center">
                              <button
                                type="button"
                                onClick={() => removeOpenStockRow(idx)}
                                className="text-rose-600 hover:text-rose-800 font-black text-sm px-2 py-0.5 rounded hover:bg-rose-100"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Add Row & Action Bar */}
                  <div className="flex justify-between items-center gap-2 pt-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addOpenStockRow}
                      className="bg-white border-amber-300 text-amber-950 hover:bg-amber-100 font-bold text-xs shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1 text-amber-700" /> Add Item Row
                    </Button>
                    <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                      Total Rows: {openStockRows.length} | Active Items: {openStockRows.filter(r => r.name).length}
                    </div>
                  </div>

                  {/* Bottom Summary Ledger Panel (Matching Software ERP Screenshot Layout) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    {/* Summary Box 1: Fine & Gross Weight Details */}
                    <div className="bg-amber-50/90 dark:bg-slate-900 border border-amber-300 dark:border-slate-800 rounded-lg p-2.5 space-y-2 text-xs font-mono shadow-2xs">
                      <div className="grid grid-cols-2 gap-2 border-b border-amber-200 dark:border-slate-800 pb-2">
                        <div>
                          <span className="text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px]">Fine Gold (g):</span>
                          <div className="text-base font-bold text-amber-800 dark:text-amber-300 bg-white dark:bg-slate-800 border border-amber-300 px-2 py-0.5 rounded mt-0.5">
                            {openStockRows.reduce((sum, r) => sum + (r.goldFine || 0), 0).toFixed(3)}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px]">T-G.W.-G (Gold GW):</span>
                          <div className="text-base font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 px-2 py-0.5 rounded mt-0.5">
                            {openStockRows.reduce((sum, r) => sum + (r.grossWeight || 0), 0).toFixed(3)}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px]">Total Labour:</span>
                          <div className="font-bold text-foreground bg-white dark:bg-slate-800 border border-slate-200 px-2 py-0.5 rounded mt-0.5">
                            {inr(openStockRows.reduce((sum, r) => sum + (r.labour || 0), 0))}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px]">No. of Pcs / Rows:</span>
                          <div className="font-bold text-foreground bg-white dark:bg-slate-800 border border-slate-200 px-2 py-0.5 rounded mt-0.5">
                            Pcs: {openStockRows.reduce((sum, r) => sum + (r.pcs || 0), 0)} | Rows: {openStockRows.length}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Summary Box 2: Total Values & Fine Summary */}
                    <div className="md:col-span-2 bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white rounded-lg p-3 flex flex-col justify-between shadow-sm border border-slate-800">
                      <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
                        <div className="text-xs uppercase font-bold tracking-wide text-amber-200 flex items-center gap-1.5">
                          <Boxes className="w-4 h-4 text-amber-400" /> Opening Stock Valuation Summary
                        </div>
                        <div className="font-mono text-xs font-bold text-amber-300">
                          {openStockHeader.date} (Bill No: {openStockHeader.billNo})
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1.5 font-mono">
                        <div>
                          <span className="text-[10px] text-slate-300 uppercase font-bold">Total Gross Wt</span>
                          <div className="text-base font-bold text-white">
                            {openStockRows.reduce((sum, r) => sum + (r.grossWeight || 0), 0).toFixed(3)} g
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] text-amber-300 uppercase font-bold">Total Net Fine Wt</span>
                          <div className="text-base font-bold text-amber-300">
                            {openStockRows.reduce((sum, r) => sum + (r.goldFine + r.silFine || 0), 0).toFixed(3)} g
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-300 uppercase font-bold">Total Opening Stock Value</span>
                          <div className="text-base font-bold text-emerald-400">
                            {inr(openStockRows.reduce((sum, r) => sum + (r.total || 0), 0))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Desktop Control Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        type="button"
                        onClick={handleSaveOpenStock}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs uppercase px-5 shadow-sm"
                      >
                        {editingId ? "Update Inventory Item" : "Save OPEN.STOCK"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setModalOpen(false)}
                        className="text-xs font-bold uppercase border-slate-300"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpenStockRows([createDefaultOpenStockRow()])}
                        className="text-xs font-bold uppercase text-rose-700 border-rose-300 hover:bg-rose-50"
                      >
                        Delete / Clear
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addOpenStockRow}
                        className="text-xs font-bold uppercase border-slate-300"
                      >
                        New Row
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
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
                          } else if (inputs.length > 0) {
                            inputs[0].focus();
                          }
                        }}
                        className="text-xs font-bold uppercase border-slate-300"
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
                          } else if (inputs.length > 0) {
                            inputs[inputs.length - 1].focus();
                          }
                        }}
                        className="text-xs font-bold uppercase border-slate-300"
                      >
                        Next
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => window.print()}
                        className="text-xs font-semibold border-slate-300"
                      >
                        Print Grid
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const ws = XLSX.utils.json_to_sheet(openStockRows);
                          const wb = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(wb, ws, "OPEN_STOCK");
                          XLSX.writeFile(wb, `OPEN_STOCK_${openStockHeader.date}.xlsx`);
                          toast.success("OPEN.STOCK exported to Excel!");
                        }}
                        className="text-xs font-semibold border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                      >
                        Export
                      </Button>
                    </div>
                  </div>
                </div>
              ) : formViewMode === "all" ? (
                /* ALL-IN-ONE SINGLE PAGE FORM TABLE VIEW */
                <div className="space-y-6">
                  {/* Section 1: Basic Identity & Barcode */}
                  <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
                    <div className="bg-muted/40 p-3 border-b flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Boxes className="w-4 h-4 text-amber-600" /> Section 1: Basic Identity & Barcode
                      </h3>
                      <Badge variant="outline" className="text-[10px] font-mono">Master Info</Badge>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs font-semibold">Item Name *</Label>
                        <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Traditional Gold Necklace 22K" required />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Barcode Number *</Label>
                        <Input value={draft.barcode || ""} onChange={e => setDraft({ ...draft, barcode: e.target.value })} placeholder="e.g. 89012345678" required />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Category *</Label>
                        <Select value={draft.category || ""} onValueChange={v => setDraft({ ...draft, category: v })}>
                          <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Gold">Gold Ornaments</SelectItem>
                            <SelectItem value="Silver">Silver Articles</SelectItem>
                            <SelectItem value="Diamond">Diamond Jewellery</SelectItem>
                            <SelectItem value="Platinum">Platinum Items</SelectItem>
                            <SelectItem value="Coins">Coins & Bars</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Sub Category</Label>
                        <Input value={draft.subcategory || ""} onChange={e => setDraft({ ...draft, subcategory: e.target.value })} placeholder="e.g. Necklace / Ring / Bangle" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Item Code (Manual/Auto)</Label>
                        <Input value={draft.itemCode || ""} onChange={e => setDraft({ ...draft, itemCode: e.target.value })} placeholder="e.g. JW-100234" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Brand / Manufacturer</Label>
                        <Input value={draft.brand || ""} onChange={e => setDraft({ ...draft, brand: e.target.value })} placeholder="e.g. In-House / Brand" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Collection</Label>
                        <Input value={draft.collectionName || ""} onChange={e => setDraft({ ...draft, collectionName: e.target.value })} placeholder="e.g. Bridal 2026" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Design Number / SKU</Label>
                        <Input value={draft.designNo || draft.sku || ""} onChange={e => setDraft({ ...draft, designNo: e.target.value, sku: e.target.value })} placeholder="e.g. DSG-99 / SKU-GOLD-01" />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Metal Specs & Hallmark HUID */}
                  <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
                    <div className="bg-muted/40 p-3 border-b flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-600" /> Section 2: Metal, Purity & Hallmark HUID
                      </h3>
                      <Badge variant="outline" className="text-[10px] font-mono bg-amber-50 text-amber-700">BIS Hallmark</Badge>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Metal Type *</Label>
                        <Select value={draft.metalType || ""} onValueChange={v => setDraft({ ...draft, metalType: v })}>
                          <SelectTrigger><SelectValue placeholder="Select Metal" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Gold">Gold</SelectItem>
                            <SelectItem value="Silver">Silver</SelectItem>
                            <SelectItem value="Diamond">Diamond</SelectItem>
                            <SelectItem value="Platinum">Platinum</SelectItem>
                            <SelectItem value="Gemstone">Gemstone</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Purity *</Label>
                        <Select value={draft.purity || ""} onValueChange={v => setDraft({ ...draft, purity: v })}>
                          <SelectTrigger><SelectValue placeholder="Select Purity" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="24K">24K (99.9%)</SelectItem>
                            <SelectItem value="22K">22K (91.6%)</SelectItem>
                            <SelectItem value="20K">20K (83.3%)</SelectItem>
                            <SelectItem value="18K">18K (75.0%)</SelectItem>
                            <SelectItem value="14K">14K (58.5%)</SelectItem>
                            <SelectItem value="925">925 Silver</SelectItem>
                            <SelectItem value="999">999 Fine Silver</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Hallmark HUID Number</Label>
                        <Input value={draft.huid || ""} onChange={e => setDraft({ ...draft, huid: e.target.value })} placeholder="e.g. HUID-ABC123" className="font-mono" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Metal Color & Gender</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Select value={draft.metalColor || ""} onValueChange={v => setDraft({ ...draft, metalColor: v })}>
                            <SelectTrigger><SelectValue placeholder="Color" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Yellow">Yellow</SelectItem>
                              <SelectItem value="White">White</SelectItem>
                              <SelectItem value="Rose">Rose</SelectItem>
                              <SelectItem value="Dual Tone">Dual</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={draft.gender || ""} onValueChange={v => setDraft({ ...draft, gender: v })}>
                            <SelectTrigger><SelectValue placeholder="Gender" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Women">Women</SelectItem>
                              <SelectItem value="Men">Men</SelectItem>
                              <SelectItem value="Kids">Kids</SelectItem>
                              <SelectItem value="Unisex">Unisex</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Weight Details */}
                  <div className="border rounded-lg overflow-hidden bg-card shadow-sm border-emerald-500/20">
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 border-b border-emerald-200/50 flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                        <Scale className="w-4 h-4 text-emerald-600" /> Section 3: Weight Breakdown & Pure Net Weight Formula
                      </h3>
                      <Badge className="bg-emerald-600 text-white font-mono text-[10px]">
                        Net Wt = Gross - Stones - Diamonds - Other
                      </Badge>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Gross Weight (g) *</Label>
                          <Input type="number" step="0.001" value={draft.grossWeight || ""} onChange={e => setDraft({ ...draft, grossWeight: parseFloat(e.target.value) || 0 })} placeholder="0.000" required className="font-bold" />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Stone Weight (g)</Label>
                          <Input type="number" step="0.001" value={draft.stoneWeight || ""} onChange={e => setDraft({ ...draft, stoneWeight: parseFloat(e.target.value) || 0 })} placeholder="0.000" />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Diamond Wt (g)</Label>
                          <Input type="number" step="0.001" value={draft.diamondWeight || ""} onChange={e => setDraft({ ...draft, diamondWeight: parseFloat(e.target.value) || 0 })} placeholder="0.000" />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Other Wt (g)</Label>
                          <Input type="number" step="0.001" value={draft.otherWeight || ""} onChange={e => setDraft({ ...draft, otherWeight: parseFloat(e.target.value) || 0 })} placeholder="0.000" />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Calculated Pure Net Wt (g)</Label>
                          <Input type="number" step="0.001" value={draft.netWeight || 0} readOnly placeholder="0.000" className="bg-emerald-50/80 font-bold text-emerald-800 dark:text-emerald-300 border-emerald-300" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Stones & Diamonds Tables */}
                  <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
                    <div className="bg-muted/40 p-3 border-b flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ScanBarcode className="w-4 h-4 text-purple-600" /> Section 4: Embedded Stones & Certified Diamonds
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={addStoneRow}>
                          <Plus className="w-3 h-3" /> Add Stone
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={addDiamondRow}>
                          <Plus className="w-3 h-3" /> Add Diamond
                        </Button>
                      </div>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* Stones Table */}
                      {(draft.stones || []).length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-bold text-muted-foreground">Precious & Semi-Precious Stones ({draft.stones?.length})</div>
                          <div className="space-y-2">
                            {(draft.stones || []).map((s, idx) => (
                              <div key={idx} className="grid grid-cols-6 gap-2 items-center border p-2 rounded-md bg-muted/20">
                                <Input placeholder="Stone Name" value={s.name} onChange={e => {
                                  const arr = [...(draft.stones || [])];
                                  arr[idx].name = e.target.value;
                                  setDraft({ ...draft, stones: arr });
                                }} className="text-xs h-8" />
                                <Input type="number" placeholder="Pcs" value={s.pcs || ""} onChange={e => {
                                  const arr = [...(draft.stones || [])];
                                  arr[idx].pcs = parseInt(e.target.value) || 0;
                                  setDraft({ ...draft, stones: arr });
                                }} className="text-xs h-8" />
                                <Input type="number" step="0.01" placeholder="Wt (ct/g)" value={s.weight || ""} onChange={e => {
                                  const arr = [...(draft.stones || [])];
                                  arr[idx].weight = parseFloat(e.target.value) || 0;
                                  arr[idx].amount = arr[idx].weight * arr[idx].rate;
                                  setDraft({ ...draft, stones: arr });
                                }} className="text-xs h-8" />
                                <Input type="number" placeholder="Rate" value={s.rate || ""} onChange={e => {
                                  const arr = [...(draft.stones || [])];
                                  arr[idx].rate = parseFloat(e.target.value) || 0;
                                  arr[idx].amount = arr[idx].weight * arr[idx].rate;
                                  setDraft({ ...draft, stones: arr });
                                }} className="text-xs h-8" />
                                <Input type="number" placeholder="Amount" value={s.amount || 0} readOnly className="text-xs h-8 bg-muted font-semibold" />
                                <Button type="button" size="sm" variant="ghost" className="h-8 text-rose-600" onClick={() => removeStoneRow(idx)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Diamonds Table */}
                      {(draft.diamonds || []).length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-bold text-muted-foreground">Certified Diamonds ({draft.diamonds?.length})</div>
                          <div className="space-y-2">
                            {(draft.diamonds || []).map((d, idx) => (
                              <div key={idx} className="grid grid-cols-7 gap-2 items-center border p-2 rounded-md bg-muted/20">
                                <Input placeholder="Shape (Round)" value={d.shape} onChange={e => {
                                  const arr = [...(draft.diamonds || [])];
                                  arr[idx].shape = e.target.value;
                                  setDraft({ ...draft, diamonds: arr });
                                }} className="text-xs h-8" />
                                <Input placeholder="Color/Clarity" value={`${d.color}/${d.clarity}`} onChange={e => {
                                  const parts = e.target.value.split("/");
                                  const arr = [...(draft.diamonds || [])];
                                  arr[idx].color = parts[0] || "G";
                                  arr[idx].clarity = parts[1] || "VS1";
                                  setDraft({ ...draft, diamonds: arr });
                                }} className="text-xs h-8" />
                                <Input type="number" step="0.01" placeholder="Carat Wt" value={d.weight || ""} onChange={e => {
                                  const arr = [...(draft.diamonds || [])];
                                  arr[idx].weight = parseFloat(e.target.value) || 0;
                                  arr[idx].amount = arr[idx].weight * arr[idx].rate;
                                  setDraft({ ...draft, diamonds: arr });
                                }} className="text-xs h-8" />
                                <Input type="number" placeholder="Rate/Ct" value={d.rate || ""} onChange={e => {
                                  const arr = [...(draft.diamonds || [])];
                                  arr[idx].rate = parseFloat(e.target.value) || 0;
                                  arr[idx].amount = arr[idx].weight * arr[idx].rate;
                                  setDraft({ ...draft, diamonds: arr });
                                }} className="text-xs h-8" />
                                <Input placeholder="Cert #" value={d.certNo || ""} onChange={e => {
                                  const arr = [...(draft.diamonds || [])];
                                  arr[idx].certNo = e.target.value;
                                  setDraft({ ...draft, diamonds: arr });
                                }} className="text-xs h-8" />
                                <Input type="number" placeholder="Amount" value={d.amount || 0} readOnly className="text-xs h-8 bg-muted font-semibold" />
                                <Button type="button" size="sm" variant="ghost" className="h-8 text-rose-600" onClick={() => removeDiamondRow(idx)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(draft.stones || []).length === 0 && (draft.diamonds || []).length === 0 && (
                        <div className="py-4 text-center text-xs text-muted-foreground border border-dashed rounded-md">
                          No embedded stones or diamonds added yet. Use buttons above to attach stones/diamonds.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 5: Pricing, Making Charges & GST Presets */}
                  <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
                    <div className="bg-muted/40 p-3 border-b flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-blue-600" /> Section 5: Pricing, Making Charges & GST
                      </h3>
                      <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-700">Tax & Valuation</Badge>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Metal Rate (₹/g)</Label>
                        <Input type="number" value={draft.metalRate || ""} onChange={e => setDraft({ ...draft, metalRate: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Making Charge Type</Label>
                        <Select value={draft.makingChargeType || "fixed"} onValueChange={(v: any) => setDraft({ ...draft, makingChargeType: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                            <SelectItem value="per_gram">Per Gram (₹/g)</SelectItem>
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Making Charge Value</Label>
                        <Input type="number" step="0.01" value={draft.makingCharge || ""} onChange={e => setDraft({ ...draft, makingCharge: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Cost Price (₹)</Label>
                        <Input type="number" value={draft.costPrice || ""} onChange={e => setDraft({ ...draft, costPrice: parseFloat(e.target.value) || 0 })} placeholder="0.00" className="font-bold text-blue-700" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Selling Price (₹) *</Label>
                        <Input type="number" value={draft.sellingPrice || ""} onChange={e => setDraft({ ...draft, sellingPrice: parseFloat(e.target.value) || 0 })} placeholder="0.00" className="font-bold text-emerald-700" required />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">GST Rate (%) & Presets</Label>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            value={draft.gstPct !== undefined && draft.gstPct !== null ? draft.gstPct : ""}
                            onChange={e => setDraft({ ...draft, gstPct: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                            placeholder="3%"
                            className="w-24 font-bold text-xs"
                          />
                          <div className="flex flex-wrap gap-1">
                            {[0, 1.5, 3, 5, 18].map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setDraft({ ...draft, gstPct: p })}
                                className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${draft.gstPct === p ? "bg-amber-600 text-white" : "bg-muted text-slate-700"}`}
                              >
                                {p}%
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 6: Inventory Stock & Store Location */}
                  <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
                    <div className="bg-muted/40 p-3 border-b flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-indigo-600" /> Section 6: Stock Quantity & Vault Location
                      </h3>
                      <Badge variant="outline" className="text-[10px] font-mono">Location & Stock</Badge>
                    </div>
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Current Stock Qty *</Label>
                        <Input type="number" value={draft.stock || ""} onChange={e => setDraft({ ...draft, stock: parseInt(e.target.value) || 0 })} placeholder="1" required className="font-bold" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Reorder Alert Level</Label>
                        <Input type="number" value={draft.reorderLevel || ""} onChange={e => setDraft({ ...draft, reorderLevel: parseInt(e.target.value) || 0 })} placeholder="1" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Store Branch</Label>
                        <Input value={draft.branch || ""} onChange={e => setDraft({ ...draft, branch: e.target.value })} placeholder="e.g. Main Store" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Locker / Tray Number</Label>
                        <Input value={draft.tray || ""} onChange={e => setDraft({ ...draft, tray: e.target.value })} placeholder="e.g. Tray T-1" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* TABBED VIEW FOR USERS WHO PREFER STEP-BY-STEP */
                <div className="space-y-4">
                  {/* TAB 1: BASIC INFO */}
                  {activeFormTab === "basic" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Item Name *</Label>
                        <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Traditional Bridal Necklace" required />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Item Code (Manual/Auto)</Label>
                        <Input value={draft.itemCode || ""} onChange={e => setDraft({ ...draft, itemCode: e.target.value })} placeholder="e.g. JW-100234" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Barcode Number *</Label>
                        <Input value={draft.barcode || ""} onChange={e => setDraft({ ...draft, barcode: e.target.value })} placeholder="e.g. 89012345678" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Category *</Label>
                        <Select value={draft.category || ""} onValueChange={v => setDraft({ ...draft, category: v })}>
                          <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Gold">Gold Ornaments</SelectItem>
                            <SelectItem value="Silver">Silver Articles</SelectItem>
                            <SelectItem value="Diamond">Diamond Jewellery</SelectItem>
                            <SelectItem value="Platinum">Platinum Items</SelectItem>
                            <SelectItem value="Coins">Coins & Bars</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Sub Category</Label>
                        <Input value={draft.subcategory || ""} onChange={e => setDraft({ ...draft, subcategory: e.target.value })} placeholder="e.g. Necklace / Ring / Bangle" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Brand</Label>
                        <Input value={draft.brand || ""} onChange={e => setDraft({ ...draft, brand: e.target.value })} placeholder="e.g. Brand / In-House" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Collection</Label>
                        <Input value={draft.collectionName || ""} onChange={e => setDraft({ ...draft, collectionName: e.target.value })} placeholder="e.g. Bridal 2026" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Design Number</Label>
                        <Input value={draft.designNo || ""} onChange={e => setDraft({ ...draft, designNo: e.target.value })} placeholder="e.g. DSG-99" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">SKU</Label>
                        <Input value={draft.sku || ""} onChange={e => setDraft({ ...draft, sku: e.target.value })} placeholder="e.g. SKU-GOLD-01" />
                      </div>
                    </div>
                  )}

                  {/* TAB 2: JEWELLERY SPECS */}
                  {activeFormTab === "jewellery" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Metal Type *</Label>
                        <Select value={draft.metalType || ""} onValueChange={v => setDraft({ ...draft, metalType: v })}>
                          <SelectTrigger><SelectValue placeholder="Select Metal Type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Gold">Gold</SelectItem>
                            <SelectItem value="Silver">Silver</SelectItem>
                            <SelectItem value="Diamond">Diamond</SelectItem>
                            <SelectItem value="Platinum">Platinum</SelectItem>
                            <SelectItem value="Gemstone">Gemstone</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Purity *</Label>
                        <Select value={draft.purity || ""} onValueChange={v => setDraft({ ...draft, purity: v })}>
                          <SelectTrigger><SelectValue placeholder="Select Purity" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="24K">24K (99.9%)</SelectItem>
                            <SelectItem value="22K">22K (91.6%)</SelectItem>
                            <SelectItem value="20K">20K (83.3%)</SelectItem>
                            <SelectItem value="18K">18K (75.0%)</SelectItem>
                            <SelectItem value="14K">14K (58.5%)</SelectItem>
                            <SelectItem value="925">925 Silver</SelectItem>
                            <SelectItem value="999">999 Fine Silver</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Hallmark Number (HUID)</Label>
                        <Input value={draft.huid || ""} onChange={e => setDraft({ ...draft, huid: e.target.value })} placeholder="e.g. ABC123" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Metal Color</Label>
                        <Select value={draft.metalColor || ""} onValueChange={v => setDraft({ ...draft, metalColor: v })}>
                          <SelectTrigger><SelectValue placeholder="Select Metal Color" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Yellow">Yellow Gold</SelectItem>
                            <SelectItem value="White">White Gold</SelectItem>
                            <SelectItem value="Rose">Rose Gold</SelectItem>
                            <SelectItem value="Dual Tone">Dual Tone</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Gender</Label>
                        <Select value={draft.gender || ""} onValueChange={v => setDraft({ ...draft, gender: v })}>
                          <SelectTrigger><SelectValue placeholder="Select Gender" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Women">Women</SelectItem>
                            <SelectItem value="Men">Men</SelectItem>
                            <SelectItem value="Kids">Kids</SelectItem>
                            <SelectItem value="Unisex">Unisex</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: WEIGHT DETAILS */}
                  {activeFormTab === "weight" && (
                    <div className="space-y-4">
                      <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center justify-between text-xs">
                        <span className="font-semibold text-emerald-800">Formula: Net Weight = Gross Wt - Stone Wt - Diamond Wt - Other Wt</span>
                        <Badge className="bg-emerald-600 text-white font-mono">{draft.netWeight || 0} g Pure Net</Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Gross Weight (g) *</Label>
                          <Input type="number" step="0.001" value={draft.grossWeight || ""} onChange={e => setDraft({ ...draft, grossWeight: parseFloat(e.target.value) || 0 })} placeholder="0.000" required />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Stone Weight (g)</Label>
                          <Input type="number" step="0.001" value={draft.stoneWeight || ""} onChange={e => setDraft({ ...draft, stoneWeight: parseFloat(e.target.value) || 0 })} placeholder="0.000" />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Diamond Wt (g)</Label>
                          <Input type="number" step="0.001" value={draft.diamondWeight || ""} onChange={e => setDraft({ ...draft, diamondWeight: parseFloat(e.target.value) || 0 })} placeholder="0.000" />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Other Wt (g)</Label>
                          <Input type="number" step="0.001" value={draft.otherWeight || ""} onChange={e => setDraft({ ...draft, otherWeight: parseFloat(e.target.value) || 0 })} placeholder="0.000" />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-emerald-700">Calculated Net Wt (g)</Label>
                          <Input type="number" step="0.001" value={draft.netWeight || 0} readOnly placeholder="0.000" className="bg-emerald-50/60 font-bold text-emerald-800" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: STONE DETAILS */}
                  {activeFormTab === "stone" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">Precious & Semi-Precious Stones Embedded</Label>
                        <Button type="button" size="sm" variant="outline" onClick={addStoneRow}>
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add Stone Row
                        </Button>
                      </div>

                      {(draft.stones || []).length === 0 ? (
                        <div className="py-6 text-center text-xs text-muted-foreground border rounded-lg">No stones added yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {(draft.stones || []).map((s, idx) => (
                            <div key={idx} className="grid grid-cols-6 gap-2 items-center border p-2 rounded-md bg-card">
                              <Input placeholder="Stone Name" value={s.name} onChange={e => {
                                const newStones = [...(draft.stones || [])];
                                newStones[idx].name = e.target.value;
                                setDraft({ ...draft, stones: newStones });
                              }} className="text-xs h-8" />
                              <Input type="number" placeholder="Pcs" value={s.pcs || ""} onChange={e => {
                                const newStones = [...(draft.stones || [])];
                                newStones[idx].pcs = parseInt(e.target.value) || 0;
                                setDraft({ ...draft, stones: newStones });
                              }} className="text-xs h-8" />
                              <Input type="number" step="0.01" placeholder="Wt (ct/g)" value={s.weight || ""} onChange={e => {
                                const newStones = [...(draft.stones || [])];
                                newStones[idx].weight = parseFloat(e.target.value) || 0;
                                newStones[idx].amount = newStones[idx].weight * newStones[idx].rate;
                                setDraft({ ...draft, stones: newStones });
                              }} className="text-xs h-8" />
                              <Input type="number" placeholder="Rate" value={s.rate || ""} onChange={e => {
                                const newStones = [...(draft.stones || [])];
                                newStones[idx].rate = parseFloat(e.target.value) || 0;
                                newStones[idx].amount = newStones[idx].weight * newStones[idx].rate;
                                setDraft({ ...draft, stones: newStones });
                              }} className="text-xs h-8" />
                              <Input type="number" placeholder="Amount" value={s.amount || 0} readOnly className="text-xs h-8 bg-muted font-semibold" />
                              <Button type="button" size="sm" variant="ghost" className="h-8 text-rose-600" onClick={() => removeStoneRow(idx)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 5: DIAMOND DETAILS */}
                  {activeFormTab === "diamond" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">Certified Diamonds Embedded</Label>
                        <Button type="button" size="sm" variant="outline" onClick={addDiamondRow}>
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add Diamond Row
                        </Button>
                      </div>

                      {(draft.diamonds || []).length === 0 ? (
                        <div className="py-6 text-center text-xs text-muted-foreground border rounded-lg">No diamonds added yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {(draft.diamonds || []).map((d, idx) => (
                            <div key={idx} className="grid grid-cols-7 gap-2 items-center border p-2 rounded-md bg-card">
                              <Input placeholder="Shape (Round)" value={d.shape} onChange={e => {
                                const arr = [...(draft.diamonds || [])];
                                arr[idx].shape = e.target.value;
                                setDraft({ ...draft, diamonds: arr });
                              }} className="text-xs h-8" />
                              <Input placeholder="Color/Clarity" value={`${d.color}/${d.clarity}`} onChange={e => {
                                const parts = e.target.value.split("/");
                                const arr = [...(draft.diamonds || [])];
                                arr[idx].color = parts[0] || "G";
                                arr[idx].clarity = parts[1] || "VS1";
                                setDraft({ ...draft, diamonds: arr });
                              }} className="text-xs h-8" />
                              <Input type="number" step="0.01" placeholder="Carat Wt" value={d.weight || ""} onChange={e => {
                                const arr = [...(draft.diamonds || [])];
                                arr[idx].weight = parseFloat(e.target.value) || 0;
                                arr[idx].amount = arr[idx].weight * arr[idx].rate;
                                setDraft({ ...draft, diamonds: arr });
                              }} className="text-xs h-8" />
                              <Input type="number" placeholder="Rate/Ct" value={d.rate || ""} onChange={e => {
                                const arr = [...(draft.diamonds || [])];
                                arr[idx].rate = parseFloat(e.target.value) || 0;
                                arr[idx].amount = arr[idx].weight * arr[idx].rate;
                                setDraft({ ...draft, diamonds: arr });
                              }} className="text-xs h-8" />
                              <Input placeholder="Cert #" value={d.certNo || ""} onChange={e => {
                                const arr = [...(draft.diamonds || [])];
                                arr[idx].certNo = e.target.value;
                                setDraft({ ...draft, diamonds: arr });
                              }} className="text-xs h-8" />
                              <Input type="number" placeholder="Amount" value={d.amount || 0} readOnly className="text-xs h-8 bg-muted font-semibold" />
                              <Button type="button" size="sm" variant="ghost" className="h-8 text-rose-600" onClick={() => removeDiamondRow(idx)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 6: PRICING & COST */}
                  {activeFormTab === "pricing" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Metal Rate (₹/g)</Label>
                        <Input type="number" value={draft.metalRate || ""} onChange={e => setDraft({ ...draft, metalRate: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Making Charge Type</Label>
                        <Select value={draft.makingChargeType || "fixed"} onValueChange={(v: any) => setDraft({ ...draft, makingChargeType: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                            <SelectItem value="per_gram">Per Gram (₹/g)</SelectItem>
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">
                          {draft.makingChargeType === "percentage" ? "Making Charge (%)" : draft.makingChargeType === "per_gram" ? "Making Charge (₹/g)" : "Making Charge Value (₹)"}
                        </Label>
                        <Input type="number" step="0.01" value={draft.makingCharge || ""} onChange={e => setDraft({ ...draft, makingCharge: parseFloat(e.target.value) || 0 })} placeholder={draft.makingChargeType === "percentage" ? "e.g. 8 for 8%" : "0.00"} />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Wastage (%) (Optional)</Label>
                        <Input type="number" step="0.01" value={draft.wastagePct || ""} onChange={e => setDraft({ ...draft, wastagePct: parseFloat(e.target.value) || 0 })} placeholder="e.g. 2.5" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Cost Price (₹)</Label>
                        <Input type="number" value={draft.costPrice || ""} onChange={e => setDraft({ ...draft, costPrice: parseFloat(e.target.value) || 0 })} placeholder="0.00" className="font-bold text-blue-700" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Selling Price (₹) *</Label>
                        <Input type="number" value={draft.sellingPrice || ""} onChange={e => setDraft({ ...draft, sellingPrice: parseFloat(e.target.value) || 0 })} placeholder="0.00" className="font-bold text-emerald-700" required />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Min Selling Price (₹)</Label>
                        <Input type="number" value={draft.minSellingPrice || ""} onChange={e => setDraft({ ...draft, minSellingPrice: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
                      </div>
                    </div>
                  )}

                  {/* TAB 7: GST */}
                  {activeFormTab === "gst" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">HSN Code (Optional)</Label>
                        <Input value={draft.hsnCode || ""} onChange={e => setDraft({ ...draft, hsnCode: e.target.value })} placeholder="e.g. 7113" />
                      </div>

                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-xs font-semibold">GST Rate (%) — Manual Entry &amp; Quick Presets</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={draft.gstPct !== undefined && draft.gstPct !== null ? draft.gstPct : ""}
                            onChange={e => setDraft({ ...draft, gstPct: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                            placeholder="Enter manual % (e.g. 3, 1.5, 18)"
                            className="w-48 font-bold"
                          />
                          <span className="text-xs font-bold text-slate-500">%</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground mt-1.5">
                          <span className="font-medium mr-1 text-slate-600">Quick Presets:</span>
                          {[0, 0.25, 1.5, 3, 5, 12, 18].map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setDraft({ ...draft, gstPct: p })}
                              className={`px-2 py-0.5 rounded border text-xs font-medium transition-colors ${draft.gstPct === p ? "bg-amber-600 text-white border-amber-600" : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"}`}
                            >
                              {p}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 8: INVENTORY & LOCATION */}
                  {activeFormTab === "inventory-tab" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Current Stock Qty *</Label>
                        <Input type="number" value={draft.stock || ""} onChange={e => setDraft({ ...draft, stock: parseInt(e.target.value) || 0 })} placeholder="0" required />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Reorder Alert Level</Label>
                        <Input type="number" value={draft.reorderLevel || ""} onChange={e => setDraft({ ...draft, reorderLevel: parseInt(e.target.value) || 0 })} placeholder="0" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Store Branch</Label>
                        <Input value={draft.branch || ""} onChange={e => setDraft({ ...draft, branch: e.target.value })} placeholder="e.g. Main Store" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Godown / Vault Location</Label>
                        <Input value={draft.godown || ""} onChange={e => setDraft({ ...draft, godown: e.target.value })} placeholder="e.g. Main Vault" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Locker / Tray Number</Label>
                        <Input value={draft.tray || ""} onChange={e => setDraft({ ...draft, tray: e.target.value })} placeholder="e.g. T-1 / Locker 4" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Action Bar */}
            {formViewMode !== "openstock" && (
              <DialogFooter className="p-4 border-t bg-muted/10 flex items-center justify-between gap-3">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>

                <Button type="submit" className="bg-amber-800 hover:bg-amber-900 text-white font-bold px-6 shadow">
                  {editingId ? "Update Item Master" : "Save Item to Inventory"}
                </Button>
              </DialogFooter>
            )}
          </form>
        </DialogContent>
      </Dialog>



      {/* ======================================================== */}
      {/* STOCK ADJUSTMENT MODAL */}
      {/* ======================================================== */}
      <Dialog open={adjModalOpen} onOpenChange={setAdjModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Record Stock Adjustment</DialogTitle>
            <DialogDescription className="text-xs">Adjust stock quantity for physical verification or damage</DialogDescription>
          </DialogHeader>

          {selectedItemForAction && (
            <div className="space-y-3 text-xs">
              <div className="font-semibold">{selectedItemForAction.name} ({selectedItemForAction.category})</div>
              <div>Current Stock: <strong>{selectedItemForAction.stock} Pcs</strong></div>

              <div className="space-y-1">
                <Label>Adjustment Type</Label>
                <Select value={adjForm.type} onValueChange={(v: any) => setAdjForm({ ...adjForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCREASE">Stock Increase (+)</SelectItem>
                    <SelectItem value="DECREASE">Stock Decrease (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Quantity to Adjust</Label>
                <Input type="number" min="1" value={adjForm.qty} onChange={e => setAdjForm({ ...adjForm, qty: parseInt(e.target.value) || 1 })} />
              </div>

              <div className="space-y-1">
                <Label>Reason</Label>
                <Input value={adjForm.reason} onChange={e => setAdjForm({ ...adjForm, reason: e.target.value })} placeholder="Physical Verification Audit" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjModalOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (selectedItemForAction) {
                createAdjustmentMutation.mutate({
                  itemId: selectedItemForAction._id || selectedItemForAction.id,
                  type: adjForm.type,
                  qty: adjForm.qty,
                  reason: adjForm.reason,
                });
              }
            }}>
              Record Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* OPENING STOCK MODAL */}
      {/* ======================================================== */}
      <Dialog open={opnModalOpen} onOpenChange={setOpnModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Set Opening Stock</DialogTitle>
            <DialogDescription className="text-xs">Initialize physical stock and cost rate</DialogDescription>
          </DialogHeader>

          {selectedItemForAction && (
            <div className="space-y-3 text-xs">
              <div className="font-semibold">{selectedItemForAction.name} ({selectedItemForAction.category})</div>

              <div className="space-y-1">
                <Label>Opening Quantity</Label>
                <Input type="number" min="1" value={opnForm.qty} onChange={e => setOpnForm({ ...opnForm, qty: parseInt(e.target.value) || 1 })} />
              </div>

              <div className="space-y-1">
                <Label>Gross Weight (g)</Label>
                <Input type="number" step="0.001" value={opnForm.grossWeight} onChange={e => setOpnForm({ ...opnForm, grossWeight: parseFloat(e.target.value) || 0 })} />
              </div>

              <div className="space-y-1">
                <Label>Net Weight (g)</Label>
                <Input type="number" step="0.001" value={opnForm.netWeight} onChange={e => setOpnForm({ ...opnForm, netWeight: parseFloat(e.target.value) || 0 })} />
              </div>

              <div className="space-y-1">
                <Label>Cost Rate (₹)</Label>
                <Input type="number" value={opnForm.rate} onChange={e => setOpnForm({ ...opnForm, rate: parseFloat(e.target.value) || 0 })} />
              </div>

              <div className="space-y-1">
                <Label>Remarks</Label>
                <Input value={opnForm.remarks} onChange={e => setOpnForm({ ...opnForm, remarks: e.target.value })} placeholder="Initial Opening Stock" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpnModalOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (selectedItemForAction) {
                api.openingStock.create({
                  itemId: selectedItemForAction._id || selectedItemForAction.id,
                  qty: opnForm.qty,
                  grossWeight: opnForm.grossWeight,
                  netWeight: opnForm.netWeight,
                  rate: opnForm.rate,
                  totalValue: opnForm.rate * opnForm.qty,
                  remarks: opnForm.remarks,
                }).then(() => {
                  queryClient.invalidateQueries({ queryKey: ["inventory"] });
                  queryClient.invalidateQueries({ queryKey: ["stockLedger"] });
                  toast.success("Opening stock initialized!");
                  setOpnModalOpen(false);
                }).catch((err: any) => toast.error(err.message));
              }
            }}>
              Save Opening Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BarcodeTagModal product={selectedTagItem} open={tagModalOpen} onOpenChange={setTagModalOpen} />

      {/* ======================================================== */}
      {/* INDIVIDUAL ITEM AUDIT LEDGER MODAL                       */}
      {/* ======================================================== */}
      <Dialog open={!!ledgerSelectedItem} onOpenChange={(open) => !open && setLedgerSelectedItem(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-display flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600" />
                <span>Stock Audit Ledger: <strong className="text-foreground">{ledgerSelectedItem?.name}</strong></span>
              </div>
              <Badge variant="outline" className="font-mono text-xs bg-purple-50 text-purple-700 border-purple-200">
                SKU: {ledgerSelectedItem?.sku || (ledgerSelectedItem as any)?.tagNo || ledgerSelectedItem?.barcode || "NO-SKU"}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Complete movement audit history, sales deductions, buyer details, and running stock balance for this item.
            </DialogDescription>
          </DialogHeader>

          {ledgerSelectedItem && (
            <div className="space-y-4 my-2">
              {/* Item Details Ribbon */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-muted/30 p-3 rounded-lg border text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Category & Metal</span>
                  <span className="font-semibold">{ledgerSelectedItem.category || "Jewellery"} ({ledgerSelectedItem.metalType || "Gold"})</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Purity & HUID</span>
                  <span className="font-semibold">{ledgerSelectedItem.purity || "22K"} {ledgerSelectedItem.huid ? `• ${ledgerSelectedItem.huid}` : ""}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Gross / Net Wt</span>
                  <span className="font-semibold">{ledgerSelectedItem.grossWeight || 0}g / <span className="text-emerald-700">{ledgerSelectedItem.netWeight || 0}g</span></span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Selling Price / Cost</span>
                  <span className="font-semibold text-emerald-700">{inr(ledgerSelectedItem.sellingPrice || 0)} <span className="text-muted-foreground font-normal">({inr(ledgerSelectedItem.costPrice || 0)})</span></span>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3">
                  <div className="text-[11px] text-emerald-800 font-medium flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" /> Total Received / Inward
                  </div>
                  <div className="text-xl font-bold font-mono text-emerald-900 mt-1">
                    +{itemLedgerSummary.totalInward} Pcs
                  </div>
                </div>

                <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-3">
                  <div className="text-[11px] text-rose-800 font-medium flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" /> Total Sold / Deducted
                  </div>
                  <div className="text-xl font-bold font-mono text-rose-900 mt-1">
                    -{itemLedgerSummary.totalSold} Pcs
                  </div>
                </div>

                <div className="bg-purple-50/70 border border-purple-200 rounded-lg p-3">
                  <div className="text-[11px] text-purple-800 font-medium flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-purple-600" /> Sales Revenue Generated
                  </div>
                  <div className="text-xl font-bold font-mono text-purple-900 mt-1">
                    {inr(itemLedgerSummary.totalSalesRevenue)}
                  </div>
                </div>

                <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3">
                  <div className="text-[11px] text-amber-800 font-medium flex items-center gap-1">
                    <Boxes className="w-3.5 h-3.5 text-amber-600" /> Current Available Stock
                  </div>
                  <div className="text-xl font-bold font-mono text-amber-900 mt-1">
                    {itemLedgerSummary.currentStock} Pcs
                  </div>
                </div>
              </div>

              {/* Movement History Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/40 p-3 border-b flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <History className="w-4 h-4 text-purple-600" /> Movement Audit & Buyer Log ({itemLedgerEntries.length} Transactions)
                  </h4>
                </div>

                {itemLedgerEntries.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    No movement records found for this item yet. Movements auto-record on sales, purchases, or adjustments.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                      <thead className="bg-muted/60 text-muted-foreground text-[10px] uppercase border-b">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th>Transaction Type</th>
                          <th>Ref #</th>
                          <th>Buyer / Customer / Supplier</th>
                          <th>Rate & Value</th>
                          <th className="text-right">Qty Change</th>
                          <th className="text-right px-3">Stock Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {itemLedgerEntries.map((rec: any) => (
                          <tr key={rec.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-medium text-foreground">{rec.date}</td>
                            <td>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0.5 font-semibold ${
                                  rec.qtyChange < 0
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : rec.txnCategory === "PURCHASE"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}
                              >
                                {rec.transactionType}
                              </Badge>
                            </td>
                            <td className="font-mono font-bold text-primary">{rec.referenceNo}</td>
                            <td>
                              <div className="font-semibold text-foreground">{rec.partyName}</div>
                              {rec.partyMobile && (
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                                  <PhoneCall className="w-2.5 h-2.5 text-muted-foreground" /> {rec.partyMobile}
                                </div>
                              )}
                            </td>
                            <td>
                              <div className="font-medium">{inr(rec.unitPrice || 0)}/pc</div>
                              {rec.totalAmount > 0 && (
                                <div className="text-[10px] text-muted-foreground font-mono">Total: {inr(rec.totalAmount)}</div>
                              )}
                            </td>
                            <td className={`text-right font-bold font-mono text-xs ${rec.qtyChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              {rec.qtyChange >= 0 ? `+${rec.qtyChange}` : rec.qtyChange} Pcs
                            </td>
                            <td className="text-right px-3 font-bold font-mono text-xs text-foreground">
                              {rec.balanceQty} Pcs
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLedgerSelectedItem(null)}>
              Close Audit View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
