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
import { useState, useRef, useMemo, useEffect } from "react";
import {
  Plus, Trash2, Pencil, Image as ImageIcon, Printer,
  ScanBarcode, Award, Boxes, ArrowLeftRight,
  FileSpreadsheet, CheckCircle2, AlertTriangle, Search,
  Store, DollarSign, BarChart3, History, Scale
} from "lucide-react";
import { inr, type Product } from "@/lib/storage";
import { useDebounce } from "@/lib/utils";
import { useTenantAPI } from "@/lib/api";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import JsBarcode from "jsbarcode";
import { useAuth } from "@/lib/auth";

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
  const { tenantSession } = useAuth();

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

  const { data: summaryReport } = useQuery({
    queryKey: ["inventorySummaryReport"],
    queryFn: api.inventoryReports.getSummary
  });

  // Mutations
  const createItemMutation = useMutation({
    mutationFn: (data: ExtendedProduct) => api.inventory.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventorySummaryReport"] });
      toast.success("Item saved successfully!");
      setModalOpen(false);
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
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<ExtendedProduct>(emptyProduct);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [purityFilter, setPurityFilter] = useState("ALL");

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
        (p.name + p.barcode + (p.itemCode || "") + (p.huid || "") + (p.category || "") + (p.purity || ""))
          .toLowerCase()
          .includes(debouncedSearch.toLowerCase());

      const matchCat = categoryFilter === "ALL" || p.category === categoryFilter;
      const matchPur = purityFilter === "ALL" || p.purity === purityFilter;

      return matchQuery && matchCat && matchPur;
    });
  }, [allItems, debouncedSearch, categoryFilter, purityFilter]);

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
    setEditingId(item._id || item.id || null);
    setActiveFormTab("basic");
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

  // Barcode Generator Canvas Effect
  const barcodeCanvasRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!tagModalOpen || !selectedTagItem) return;
    const timer = setTimeout(() => {
      if (barcodeCanvasRef.current) {
        try {
          const barcodeVal =
            selectedTagItem.barcode ||
            selectedTagItem.itemCode ||
            selectedTagItem.sku ||
            selectedTagItem.huid ||
            (selectedTagItem as any)._id ||
            "890123456789";

          JsBarcode(barcodeCanvasRef.current, barcodeVal, {
            format: "CODE128",
            width: 1.5,
            height: 45,
            displayValue: true,
            fontSize: 12,
            margin: 5,
          });
        } catch (err) {
          console.error("Barcode generation error:", err);
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [tagModalOpen, selectedTagItem]);

  const handlePrintJewelleryTag = () => {
    if (!selectedTagItem) return;
    const printWin = window.open("", "_blank", "width=450,height=350");
    if (!printWin) {
      // Fallback to standard window print if popup blocked
      window.print();
      return;
    }

    const shopName = tenantSession?.shop?.shopName || "JEWELSHOP ERP";
    const barcodeVal =
      selectedTagItem.barcode ||
      selectedTagItem.itemCode ||
      selectedTagItem.sku ||
      selectedTagItem.huid ||
      (selectedTagItem as any)._id ||
      "890123456789";

    const svgContent = barcodeCanvasRef.current ? barcodeCanvasRef.current.outerHTML : `<div style="font-family:monospace;font-size:14px;font-weight:bold;margin:8px 0;">*${barcodeVal}*</div>`;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Jewellery Tag - ${selectedTagItem.name}</title>
          <style>
            @page {
              size: auto;
              margin: 0mm;
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0;
              padding: 12px;
              text-align: center;
              background: white;
              color: black;
              -webkit-print-color-adjust: exact;
            }
            .tag-card {
              border: 2px dashed #000;
              padding: 12px;
              border-radius: 8px;
              display: inline-block;
              width: 260px;
              background: #fff;
              margin: 0 auto;
            }
            .shop-title {
              font-weight: 800;
              font-size: 13px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .item-title {
              font-size: 12px;
              font-weight: 700;
              margin: 4px 0 2px 0;
            }
            .item-details {
              font-size: 10px;
              font-family: monospace;
              color: #222;
              margin-bottom: 4px;
            }
            .barcode-container {
              margin: 8px 0;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .barcode-container svg {
              max-width: 100%;
              height: auto;
            }
            .huid-tag {
              font-size: 10px;
              font-family: monospace;
              font-weight: bold;
              margin-top: 2px;
            }
            .price-tag {
              font-size: 14px;
              font-weight: bold;
              color: #000;
              margin-top: 4px;
            }
          </style>
        </head>
        <body>
          <div class="tag-card">
            <div class="shop-title">${shopName}</div>
            <div class="item-title">${selectedTagItem.name}</div>
            <div class="item-details">
              ${selectedTagItem.category} | ${selectedTagItem.purity} | G: ${selectedTagItem.grossWeight || 0}g | N: ${selectedTagItem.netWeight || 0}g
            </div>
            <div class="barcode-container">
              ${svgContent}
            </div>
            ${selectedTagItem.huid ? `<div class="huid-tag">HUID: ${selectedTagItem.huid}</div>` : ''}
            <div class="price-tag">${inr(selectedTagItem.sellingPrice || 0)}</div>
          </div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
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
          <Button onClick={handleOpenCreate} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-1.5" /> Add New Item
          </Button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="space-y-6">
        <TabsList className="flex flex-wrap w-full bg-muted/60 p-1 rounded-xl h-auto gap-1">
          <TabsTrigger value="dashboard" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="stock-list" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5">
            <Boxes className="w-3.5 h-3.5 text-emerald-600" /> Item Master & Stock
          </TabsTrigger>
          <TabsTrigger value="opening-stock" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-blue-600" /> Opening Stock
          </TabsTrigger>
          <TabsTrigger value="stock-adjustment" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-amber-600" /> Stock Adjustment
          </TabsTrigger>
          <TabsTrigger value="stock-transfer" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5">
            <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" /> Stock Transfer
          </TabsTrigger>
          <TabsTrigger value="stock-ledger" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-purple-600" /> Stock Ledger
          </TabsTrigger>
          <TabsTrigger value="barcode-mgr" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5">
            <ScanBarcode className="w-3.5 h-3.5 text-rose-600" /> Barcode & Tags
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600" /> Inventory Reports
          </TabsTrigger>
        </TabsList>

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
                    {(summaryReport?.totalNetWeight || filteredItems.filter(p => p.metalType === "Gold" || p.category === "Gold").reduce((sum, p) => sum + ((p.netWeight || 0) * (p.stock || 1)), 0)).toFixed(2)} g
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
                <div className="overflow-x-auto">
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 2: ITEM MASTER & STOCK LIST */}
        {/* ======================================================== */}
        <TabsContent value="stock-list" className="space-y-6">
          {/* Search & Filter Bar */}
          <Card className="shadow-sm bg-muted/20 border">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Search Item Name, Barcode, HUID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-xs bg-background"
                    />
                  </div>

                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-9 text-xs w-36 bg-background">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Categories</SelectItem>
                      <SelectItem value="Gold">Gold</SelectItem>
                      <SelectItem value="Silver">Silver</SelectItem>
                      <SelectItem value="Diamond">Diamond</SelectItem>
                      <SelectItem value="Platinum">Platinum</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={purityFilter} onValueChange={setPurityFilter}>
                    <SelectTrigger className="h-9 text-xs w-32 bg-background">
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

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs py-1 px-3">
                    Showing {filteredItems.length} of {allItems.length} Items
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Item List Table */}
          <Card className="shadow-sm">
            <CardContent className="p-0">
              {isLoadingItems ? (
                <div className="py-12 text-center text-muted-foreground">Loading jewellery catalog...</div>
              ) : filteredItems.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">No inventory items match your search.</div>
              ) : (
                <div className="overflow-x-auto">
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
                            <div className="font-medium text-foreground">{item.category}</div>
                            <div className="text-xs text-muted-foreground">{item.purity} ({item.metalType || 'Gold'})</div>
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
                                className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                                title="Print Jewellery Tag"
                                onClick={() => { setSelectedTagItem(item); setTagModalOpen(true); }}
                              >
                                <Printer className="w-4 h-4" />
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
              <div className="overflow-x-auto">
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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 6: STOCK LEDGER */}
        {/* ======================================================== */}
        <TabsContent value="stock-ledger" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600" /> Complete Stock Audit Ledger
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {stockLedger.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  Stock Ledger is empty. Movements will be recorded automatically during Sales, Purchases, Adjustments and Transfers.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th>Item</th>
                        <th>Txn Type</th>
                        <th>Qty Change</th>
                        <th>Running Balance</th>
                        <th>Reference #</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockLedger.map((led: any) => (
                        <tr key={led._id || led.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-3 px-4 font-mono">{led.date}</td>
                          <td className="font-medium">{led.itemName}</td>
                          <td>
                            <Badge variant="outline" className="font-semibold">
                              {led.transactionType}
                            </Badge>
                          </td>
                          <td className={`font-bold ${led.qtyChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {led.qtyChange >= 0 ? `+${led.qtyChange}` : led.qtyChange} Pcs
                          </td>
                          <td className="font-bold">{led.balanceQty} Pcs</td>
                          <td className="font-mono text-xs">{led.referenceNo || "-"}</td>
                          <td className="text-xs text-muted-foreground">{led.remarks || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
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
      {/* MULTI-TAB ITEM MASTER CREATE / EDIT DIALOG MODAL */}
      {/* ======================================================== */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-3 border-b bg-muted/10">
            <DialogTitle className="font-display text-xl">
              {editingId ? "Edit Item Master" : "Create New Jewellery Item Master"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Complete 12-section master fields with real-time net weight calculation & price validation.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveItem} className="flex-1 flex flex-col overflow-hidden">
            {/* Modal Form Sub-Tabs */}
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

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
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

            <DialogFooter className="p-4 border-t bg-muted/10 flex justify-between">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary text-white">
                {editingId ? "Update Item" : "Save Item to Inventory"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* BARCODE TAG PRINT MODAL */}
      {/* ======================================================== */}
      <Dialog open={tagModalOpen} onOpenChange={setTagModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Jewellery Tag Preview</DialogTitle>
            <DialogDescription className="text-xs">
              Print thermal tag label for item {selectedTagItem?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedTagItem && (
            <div id="printableTag" className="p-4 border-2 border-dashed rounded-lg bg-white text-black space-y-2 text-center">
              <div className="font-bold text-sm tracking-tight uppercase">{tenantSession?.shop?.shopName || "JewelShop ERP"}</div>
              <div className="text-xs font-semibold">{selectedTagItem.name}</div>
              <div className="text-[11px] font-mono">
                {selectedTagItem.category} | {selectedTagItem.purity} | G: {selectedTagItem.grossWeight}g | N: {selectedTagItem.netWeight}g
              </div>

              <div className="flex justify-center py-2">
                <svg ref={barcodeCanvasRef}></svg>
              </div>

              {selectedTagItem.huid && (
                <div className="text-[10px] font-mono font-bold">HUID: {selectedTagItem.huid}</div>
              )}
              <div className="text-sm font-bold text-emerald-800">{inr(selectedTagItem.sellingPrice || 0)}</div>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setTagModalOpen(false)}>Close</Button>
            <Button onClick={handlePrintJewelleryTag} className="bg-primary text-white">
              <Printer className="w-4 h-4 mr-1.5" /> Print Tag Label
            </Button>
          </DialogFooter>
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
    </Layout>
  );
}
