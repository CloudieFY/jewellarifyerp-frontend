import { useState, useMemo, useEffect } from "react";
import { handleGridArrowNav } from "@/hooks/useGlobalKeyboard";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { inr, type Order, type Karigar } from "@/lib/storage";
import { useDebounce, triggerPrint } from "@/lib/utils";
import { useTenantAPI } from "@/lib/api";
import { Plus, Trash2, Pencil, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { InvoiceTerms, ShopHeader } from "@/components/InvoiceBranding";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const formatDate = (date: string | Date) => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return isNaN(d.getTime()) ? "" : format(d, "dd/MM/yyyy");
};

export default function OrdersPage() {
  const api = useTenantAPI();
  const queryClient = useQueryClient();

  const useApiMutation = (mutationFn: (...args: any[]) => Promise<any>, queryKey: string[]) => {
    return useMutation({
      mutationFn,
      onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });
  };

  const { data: list = [], isLoading } = useQuery({ queryKey: ["orders"], queryFn: api.orders.getAll });
  const { data: customers = [] } = useQuery<any[]>({ queryKey: ["customers"], queryFn: api.customers.getAll });
  const { data: karigars = [] } = useQuery<Karigar[]>({ queryKey: ["karigars"], queryFn: api.karigars.getAll });
  const { data: inventoryList = [] } = useQuery<any[]>({ queryKey: ["inventory"], queryFn: api.inventory.getAll });

  const createMutation = useApiMutation((data: Order) => api.orders.create(data), ["orders"]);
  const updateMutation = useApiMutation((data: { id: string; body: Order }) => api.orders.update(data.id, data.body), ["orders"]);
  const deleteMutation = useApiMutation((id: string) => api.orders.remove(id), ["orders"]);
  const createCustomerMutation = useApiMutation((data: any) => api.customers.create(data), ["customers"]);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchCust, setSearchCust] = useState("");
  const debouncedSearchCust = useDebounce(searchCust, 300);
  const [searchKar, setSearchKar] = useState("");
  const debouncedSearchKar = useDebounce(searchKar, 300);
  const [_selectedCatalogItem, setSelectedCatalogItem] = useState<any | null>(null);

  // Auto-open modal if navigated from catalog with ?createForItem=...
  useEffect(() => {
    if (inventoryList.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get("createForItem");
    if (itemId) {
      const match = inventoryList.find((i: any) => (i._id || i.id) === itemId);
      if (match) {
        handleSelectCatalogItem(match);
        setOpen(true);
      }
    }
  }, [inventoryList]);

  const handleSelectCatalogItem = (item: any) => {
    const metalVal = (item.metalType || item.category || "Gold") as Order["metal"];
    const purityVal = item.purity || "22K";
    const desc = `${item.name} (${item.category} ${purityVal}) - Net Wt: ${item.netWeight || 0}g${item.huid ? ` [HUID: ${item.huid}]` : ''}`;
    const price = item.sellingPrice || Math.round((item.netWeight || 0) * (item.ratePerGram || 7200));

    setForm((prev) => ({
      ...prev,
      itemDescription: desc,
      metal: metalVal,
      purity: purityVal,
      expectedGrossWeight: item.grossWeight || item.netWeight || 0,
      expectedNetWeight: item.netWeight || 0,
      fixedPrice: price,
      estimatedTotalAmount: price,
      makingCharge: item.makingCharge || 0,
      lockedGoldRate: item.ratePerGram || 7200,
      sampleImageUrl: item.imageUrl || prev.sampleImageUrl || "",
    }));
    toast.success(`Catalog item "${item.name}" attached to Order!`);
  };

  const [newCust, setNewCust] = useState({ name: "", phone: "", phone2: "", address: "" });
  const [viewingReceipt, setViewingReceipt] = useState<Order | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [filter, setFilter] = useState<"All" | Order["status"]>("All");

  const empty: Order = {
    id: "",
    orderNo: "",
    date: new Date().toISOString().slice(0, 10),
    customerName: "",
    customerMobile: "",
    customerAddress: "",
    itemDescription: "",
    metal: "Gold",
    purity: "22K",
    expectedGrossWeight: 0,
    expectedNetWeight: 0,
    sizeLength: "",
    hallmarkRequired: true,
    rateLockStatus: "Locked",
    lockedGoldRate: 7200,
    oldGoldWeight: 0,
    oldGoldPurity: "22K",
    oldGoldValuation: 0,
    makingCharge: 0,
    wastagePct: 0,
    estimatedTotalAmount: 0,
    fixedPrice: 0,
    advancePaid: 0,
    karigarId: "",
    dueDate: "",
    status: "Pending",
    note: "",
    sampleImageUrl: "",
    customerSignature: "",
    authorizedSignatory: "",
  };
  const [form, setForm] = useState<Order>(empty);

  const save = async () => {
    if (!form.itemDescription) return toast.error("Item Description is required!");
    if (form.customerMobile !== "NEW" && !form.customerName) return toast.error("Customer name is required!");

    let custName = form.customerName;
    let custMobile = form.customerMobile;
    let custAddress = form.customerAddress;

    if (form.customerMobile === "NEW") {
      if (!newCust.name) {
        toast.error("Customer name is required for a new customer.");
        return;
      }
      if (!newCust.address) {
        toast.error("Customer address is required for a new customer.");
        return;
      }
      try {
        const created = await createCustomerMutation.mutateAsync(newCust);
        custName = created.name;
        custMobile = created.phone || created.mobile || "";
        custAddress = created.address || "";
      } catch (e) {
        toast.error("Failed to create new customer");
        return;
      }
    }

    const orderNo = form.orderNo || `ORD-${(list.length + 1).toString().padStart(4, "0")}`;
    const finalKarigarId = form.karigarId === "unassigned" ? "" : form.karigarId;

    let safeNote = form.note || "";
    if (finalKarigarId) {
      const kName = karigars.find((k) => (k._id || k.id) === finalKarigarId)?.name;
      if (kName && !safeNote.includes(`[Assigned: ${kName}]`)) {
        safeNote = safeNote.replace(/\[Assigned:.*?\]/g, "").trim() + ` [Assigned: ${kName}]`;
      }
    } else {
      safeNote = safeNote.replace(/\[Assigned:.*?\]/g, "").trim();
    }

    try {
      const orderData: Order = {
        ...form,
        orderNo,
        customerName: custName,
        customerMobile: custMobile,
        customerAddress: custAddress,
        karigarId: finalKarigarId,
        note: safeNote,
        estimatedTotalAmount: form.estimatedTotalAmount || form.fixedPrice || 0,
      };

      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: orderData });
        toast.success("Customer Order updated successfully!");
      } else {
        await createMutation.mutateAsync(orderData);
        toast.success("Customer Order created successfully!");
      }
      setForm(empty);
      setEditingId(null);
      setSelectedCatalogItem(null);
      setOpen(false);
    } catch (error) {
      console.error("[Orders] Error saving to DB:", error);
      toast.error("Failed to connect to backend server.");
    }
  };

  const setStatus = async (id: string, status: Order["status"]) => {
    const order = list.find(r => r.id === id || (r as any)._id === id);
    if (order) {
      await updateMutation.mutateAsync({ id, body: { ...order, status } });
    }
  };

  const remove = async (id: string) => {
    if (confirm("Are you sure you want to delete this customer order?")) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const activeOrders = list.filter(r => r.status === "Pending" || r.status === "In Progress" || r.status === "Ready").length;
  const totalAdvance = list.reduce((s, r) => s + (r.advancePaid || 0), 0);
  const totalOldGoldValuation = list.reduce((s, r) => s + (r.oldGoldValuation || 0), 0);

  const filtered = useMemo(() => {
    let result = filter === "All" ? list : list.filter(o => o.status === filter);
    if (debouncedQ.trim()) {
      const lowerQ = debouncedQ.toLowerCase().trim();
      result = result.filter(o =>
        o.customerName.toLowerCase().includes(lowerQ) ||
        o.orderNo.toLowerCase().includes(lowerQ) ||
        o.customerMobile.includes(lowerQ) ||
        o.itemDescription.toLowerCase().includes(lowerQ) ||
        (o.customerAddress || "").toLowerCase().includes(lowerQ)
      );
    }
    return [...result].sort((a, b) => (a.customerName || "").localeCompare(b.customerName || ""));
  }, [list, debouncedQ, filter]);

  const totalPages = Math.ceil(filtered.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <Layout>
      <div className="print:hidden">
        <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold">Jewellery Customer Orders</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage Custom Booking, Rate Lock, Old Gold Deposit & Karigar Assignment.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-new-button="true" size="lg" className="w-full sm:w-auto bg-primary text-white" onClick={() => { setForm(empty); setNewCust({ name: "", phone: "", phone2: "", address: "" }); setEditingId(null); setSearchCust(""); setSearchKar(""); setSelectedCatalogItem(null); }}>
                <Plus className="w-4 h-4 mr-2" /> New Custom Order
              </Button>
            </DialogTrigger>
            <DialogContent className="fixed inset-0 z-[100] w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 top-0 left-0 rounded-none border-0 p-3 sm:p-5 bg-slate-100 dark:bg-slate-950 flex flex-col overflow-y-auto shadow-none" aria-describedby={undefined} onInteractOutside={(e) => e.preventDefault()} onKeyDown={handleGridArrowNav}>
              {/* Header Banner - Matches Software Theme */}
              <DialogHeader className="p-3 sm:p-4 bg-white dark:bg-slate-950 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-base sm:text-xl font-bold font-display text-slate-900 dark:text-slate-100 uppercase tracking-wide flex items-center gap-2">
                    <span>CUSTOM JEWELLERY ORDER ERP MASTER</span>
                  </DialogTitle>
                  <Badge className="bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300 text-[10px] uppercase tracking-wider font-bold">
                    FULL DESKTOP SUITE
                  </Badge>
                </div>
                <Badge className="hidden sm:inline-flex bg-amber-600 text-white font-bold text-xs uppercase px-3 py-1 shadow-sm">
                  Desktop ERP View
                </Badge>
              </DialogHeader>

              <div className="p-3 sm:p-5 space-y-4 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-900">
                {/* 1. TOP ERP CONTROL HEADER PANEL */}
                <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 p-3 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm shadow-2xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Date:</span>
                      <Input
                        type="date"
                        value={form.date}
                        onChange={e => setForm({ ...form, date: e.target.value })}
                        className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 w-32 font-mono font-bold text-center"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Order No.:</span>
                      <Input
                        readOnly
                        value={form.orderNo || "Auto"}
                        className="h-8 text-xs bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 w-24 font-mono font-bold text-center"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Due Date:</span>
                      <Input
                        type="date"
                        value={form.dueDate || ""}
                        onChange={e => setForm({ ...form, dueDate: e.target.value })}
                        className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 w-32 font-mono font-bold text-center"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Customer:</span>
                      <select
                        value={form.customerMobile || form.customerName || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "NEW") {
                            setForm({ ...form, customerMobile: "NEW", customerName: "", customerAddress: "" });
                          } else {
                            const match = customers.find(c => (c.mobile || (c as any).phone || c.name) === val);
                            if (match) setForm({ ...form, customerName: match.name, customerMobile: match.mobile || (match as any).phone || "", customerAddress: match.address || "" });
                          }
                        }}
                        className="h-8 w-56 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold rounded-md px-2 text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                      >
                        <option value="" disabled>Select Party / Customer</option>
                        <option value="NEW" className="font-bold text-amber-600">+ Create New Customer</option>
                        {customers.filter(c => c.name.toLowerCase().includes(debouncedSearchCust.toLowerCase()) || (c.mobile || (c as any).phone || "").includes(debouncedSearchCust) || (c.address || "").toLowerCase().includes(debouncedSearchCust.toLowerCase())).sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((c) => (
                          <option key={c._id || c.id} value={c.mobile || (c as any).phone || c.name}>{c.name} {c.mobile || (c as any).phone ? `· ${c.mobile || (c as any).phone}` : ""}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Karigar:</span>
                      <select
                        value={form.karigarId || ""}
                        onChange={(e) => setForm({ ...form, karigarId: e.target.value })}
                        className="h-8 w-44 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold rounded-md px-2 text-slate-900 dark:text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                      >
                        <option value="unassigned">Unassigned</option>
                        {karigars.filter(k => k.name.toLowerCase().includes(debouncedSearchKar.toLowerCase()) || (k.mobile || "").includes(debouncedSearchKar) || (k.address || "").toLowerCase().includes(debouncedSearchKar.toLowerCase())).sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(k => (
                          <option key={k._id || k.id} value={k._id || k.id}>{k.name} ({k.specialty || "Artisan"})</option>
                        ))}
                      </select>
                    </div>

                    <Input
                      placeholder="Special order booking narration..."
                      value={form.note || ""}
                      onChange={e => setForm({ ...form, note: e.target.value })}
                      className="h-8 w-60 bg-white dark:bg-slate-900 text-xs sm:text-sm font-semibold border-slate-300 dark:border-slate-700"
                    />
                  </div>
                </div>

                {/* 2. MAIN CUSTOM ORDER ITEMS GRID TABLE (MATCHING DESKTOP ERP SPREADSHEET SCREENSHOT) */}
                <div className="overflow-x-auto border-2 border-slate-400 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-md">
                  <table className="w-full text-xs sm:text-sm border-collapse min-w-[1400px]">
                    <thead className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 uppercase font-black border-b-2 border-slate-400 dark:border-slate-700">
                      <tr>
                        <th className="p-1.5 border border-slate-300 dark:border-slate-700 text-left min-w-44">Item Description / Title</th>
                        <th className="p-1.5 border border-slate-300 dark:border-slate-700 w-24 text-center">Metal</th>
                        <th className="p-1.5 border border-slate-300 dark:border-slate-700 w-20 text-center">Purity</th>
                        <th className="p-1.5 border border-slate-300 dark:border-slate-700 w-24 text-center">Size</th>
                        <th className="p-1.5 border border-slate-300 dark:border-slate-700 w-24 text-right">Est.Gr.Wt</th>
                        <th className="p-1.5 border border-slate-300 dark:border-slate-700 w-24 text-right">Est.Net.Wt</th>
                        <th className="p-1.5 border border-slate-300 dark:border-slate-700 w-24 text-right">Booked Rate</th>
                        <th className="p-1.5 border border-slate-300 dark:border-slate-700 w-24 text-right">Old Gold Wt</th>
                        <th className="p-1.5 border border-slate-300 dark:border-slate-700 w-28 text-right">Old Gold Cr.</th>
                        <th className="p-1.5 border border-slate-300 dark:border-slate-700 w-28 text-right bg-amber-100 dark:bg-amber-950/80 font-bold">Est. Total ₹</th>
                        <th className="p-1.5 border border-slate-300 dark:border-slate-700 w-28 text-right">Adv. Cash ₹</th>
                        <th className="p-1.5 border border-slate-300 dark:border-slate-700 w-32 text-right bg-amber-200 dark:bg-amber-900/90 font-black">Est. Balance ₹</th>
                        <th className="p-1.5 border border-slate-300 dark:border-slate-700 w-20 text-center">HUID</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-xs sm:text-sm">
                      <tr className="hover:bg-sky-50/50 dark:hover:bg-slate-800/60 border-b border-slate-300 dark:border-slate-700">
                        <td className="p-0 border border-slate-300 dark:border-slate-700">
                          <input
                            value={form.itemDescription}
                            onChange={e => setForm({ ...form, itemDescription: e.target.value })}
                            placeholder="e.g. Traditional Gold Bridal Necklace 22K"
                            className="w-full h-9 px-2 text-xs sm:text-sm font-bold font-sans bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80"
                          />
                        </td>
                        <td className="p-0 border border-slate-300 dark:border-slate-700 text-center">
                          <select
                            className="w-full h-9 px-1 text-xs sm:text-sm font-bold text-center bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80 cursor-pointer"
                            value={form.metal}
                            onChange={e => setForm({ ...form, metal: e.target.value as Order["metal"] })}
                          >
                            <option value="Gold">Gold</option>
                            <option value="Silver">Silver</option>
                            <option value="Diamond">Diamond</option>
                            <option value="Platinum">Platinum</option>
                            <option value="Other">Other</option>
                          </select>
                        </td>
                        <td className="p-0 border border-slate-300 dark:border-slate-700">
                          <input
                            value={form.purity}
                            onChange={e => setForm({ ...form, purity: e.target.value })}
                            className="w-full h-9 px-1 text-xs sm:text-sm font-bold text-center bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80"
                            placeholder="22K"
                          />
                        </td>
                        <td className="p-0 border border-slate-300 dark:border-slate-700">
                          <input
                            value={form.sizeLength || ""}
                            onChange={e => setForm({ ...form, sizeLength: e.target.value })}
                            className="w-full h-9 px-1 text-xs sm:text-sm font-bold text-center bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80"
                            placeholder="Ring 14"
                          />
                        </td>
                        <td className="p-0 border border-slate-300 dark:border-slate-700">
                          <input
                            type="number"
                            step="0.001"
                            value={String(form.expectedGrossWeight || "")}
                            onChange={e => setForm({ ...form, expectedGrossWeight: +e.target.value })}
                            className="w-full h-9 px-1.5 text-right font-mono text-xs sm:text-sm font-black bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80"
                          />
                        </td>
                        <td className="p-0 border border-slate-300 dark:border-slate-700">
                          <input
                            type="number"
                            step="0.001"
                            value={String(form.expectedNetWeight || "")}
                            onChange={e => setForm({ ...form, expectedNetWeight: +e.target.value })}
                            className="w-full h-9 px-1.5 text-right font-mono text-xs sm:text-sm font-black bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80"
                          />
                        </td>
                        <td className="p-0 border border-slate-300 dark:border-slate-700">
                          <input
                            type="number"
                            value={String(form.lockedGoldRate || 7200)}
                            onChange={e => setForm({ ...form, lockedGoldRate: +e.target.value })}
                            className="w-full h-9 px-1.5 text-right font-mono text-xs sm:text-sm font-bold bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80"
                          />
                        </td>
                        <td className="p-0 border border-slate-300 dark:border-slate-700">
                          <input
                            type="number"
                            step="0.001"
                            value={String(form.oldGoldWeight || "")}
                            onChange={e => setForm({ ...form, oldGoldWeight: +e.target.value })}
                            className="w-full h-9 px-1.5 text-right font-mono text-xs sm:text-sm font-bold bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80"
                          />
                        </td>
                        <td className="p-0 border border-slate-300 dark:border-slate-700">
                          <input
                            type="number"
                            value={String(form.oldGoldValuation || "")}
                            onChange={e => setForm({ ...form, oldGoldValuation: +e.target.value })}
                            className="w-full h-9 px-1.5 text-right font-mono text-xs sm:text-sm font-bold bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80 text-emerald-600"
                          />
                        </td>
                        <td className="p-0 border border-slate-300 dark:border-slate-700">
                          <input
                            type="number"
                            value={String(form.estimatedTotalAmount || form.fixedPrice || "")}
                            onChange={e => setForm({ ...form, estimatedTotalAmount: +e.target.value, fixedPrice: +e.target.value })}
                            className="w-full h-9 px-1.5 text-right font-mono text-xs sm:text-sm font-black bg-amber-100/80 dark:bg-amber-950/50 border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </td>
                        <td className="p-0 border border-slate-300 dark:border-slate-700">
                          <input
                            type="number"
                            value={String(form.advancePaid || "")}
                            onChange={e => setForm({ ...form, advancePaid: +e.target.value })}
                            className="w-full h-9 px-1.5 text-right font-mono text-xs sm:text-sm font-bold bg-transparent border-0 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-sky-100 dark:focus:bg-blue-950/80"
                          />
                        </td>
                        <td className="p-2 border border-slate-300 dark:border-slate-700 text-right bg-amber-200/80 dark:bg-amber-900/70 font-black text-sm sm:text-base text-slate-950 dark:text-white">
                          {inr(Math.max(0, (form.estimatedTotalAmount || form.fixedPrice || 0) - (form.advancePaid || 0) - (form.oldGoldValuation || 0)))}
                        </td>
                        <td className="p-1 border border-slate-300 dark:border-slate-700 text-center">
                          <input
                            type="checkbox"
                            checked={form.hallmarkRequired ?? true}
                            onChange={e => setForm({ ...form, hallmarkRequired: e.target.checked })}
                            className="w-4 h-4 rounded text-amber-600 cursor-pointer"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. ATTACHMENT & DESIGN REFERENCE PANEL */}
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-300 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                    <span className="font-bold text-slate-800 dark:text-slate-200">Sample Design Sketch:</span>
                    <Input type="file" accept="image/*" className="bg-white dark:bg-slate-900 text-xs border-slate-300 dark:border-slate-700 h-8 flex-1" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setForm({ ...form, sampleImageUrl: reader.result as string });
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </div>
                  {form.sampleImageUrl && (
                    <img src={form.sampleImageUrl} alt="Sketch" className="h-9 w-9 object-cover rounded border border-amber-500" />
                  )}
                </div>
              </div>

              {/* Bottom Desktop Control Action Bar - Matching Software Theme */}
              <div className="border-t border-slate-300 dark:border-slate-800 p-3 bg-slate-200/90 dark:bg-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    onClick={save}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs sm:text-sm uppercase px-4 h-8.5 shadow-sm"
                  >
                    {editingId ? "Save Changes" : "Save Order"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    className="h-8.5 text-xs sm:text-sm font-bold uppercase border-slate-300 bg-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setForm(empty); setSearchCust(""); setSearchKar(""); setSelectedCatalogItem(null); }}
                    className="h-8.5 text-xs sm:text-sm font-bold uppercase text-red-700 border-slate-300 bg-white hover:bg-red-50"
                  >
                    Delete / Clear
                  </Button>
                </div>

                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-1.5 rounded-lg border-2 border-amber-500 font-mono font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                  <span>Est Total: <strong className="text-slate-900 dark:text-white">{inr(form.estimatedTotalAmount || form.fixedPrice || 0)}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>Adv: <strong className="text-emerald-600">{inr((form.advancePaid || 0) + (form.oldGoldValuation || 0))}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>Balance Due: <strong className="text-amber-600 text-sm sm:text-lg">{inr(Math.max(0, (form.estimatedTotalAmount || form.fixedPrice || 0) - (form.advancePaid || 0) - (form.oldGoldValuation || 0)))}</strong></span>
                </div>
              </div>

            </DialogContent>
          </Dialog>
        </header>

        {/* METRIC CARDS */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-5">
          <Card className="shadow-2xs border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50">
            <CardContent className="p-2.5 sm:p-4">
              <div className="text-[10px] sm:text-xs font-semibold text-amber-700/90 uppercase tracking-wider truncate">Total Orders</div>
              <div className="text-xl sm:text-3xl font-display font-bold text-amber-950 mt-0.5 sm:mt-1">{list.length}</div>
            </CardContent>
          </Card>
          <Card className="shadow-2xs border-blue-200/60 bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardContent className="p-2.5 sm:p-4">
              <div className="text-[10px] sm:text-xs font-semibold text-blue-700/90 uppercase tracking-wider truncate">Active Pending</div>
              <div className="text-xl sm:text-3xl font-display font-bold text-blue-950 mt-0.5 sm:mt-1">{activeOrders}</div>
            </CardContent>
          </Card>
          <Card className="shadow-2xs border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-green-50">
            <CardContent className="p-2.5 sm:p-4">
              <div className="text-[10px] sm:text-xs font-semibold text-emerald-700/90 uppercase tracking-wider truncate">Total Advance</div>
              <div className="text-base sm:text-2xl font-display font-bold text-emerald-950 mt-0.5 sm:mt-1 font-mono truncate">{inr(totalAdvance + totalOldGoldValuation)}</div>
            </CardContent>
          </Card>
        </div>

        {/* SEARCH & FILTER BAR */}
        <Card className="shadow-2xs mb-5 border-border/70">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search order #, customer, mobile, item..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 w-full sm:w-auto">
                {["All", "Pending", "In Progress", "Ready", "Delivered", "Cancelled"].map((st) => (
                  <Button
                    key={st}
                    size="sm"
                    variant={filter === st ? "default" : "outline"}
                    className="h-8 text-xs px-2 sm:px-3 text-center"
                    onClick={() => setFilter(st as any)}
                  >
                    {st}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ORDERS TABLE */}
        <Card className="shadow-sm">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Loading orders...</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No customer orders found.</div>
            ) : (
              <div>
                {/* Mobile Order Cards (Visible on screens < md) */}
                <div className="block md:hidden divide-y divide-border">
                  {paginated.map((r) => {
                    const statusColors: any = {
                      "Pending": "bg-slate-100 text-slate-700 border-slate-200",
                      "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
                      "Ready": "bg-green-50 text-green-700 border-green-200",
                      "Delivered": "bg-slate-100 text-slate-500 border-slate-200",
                      "Cancelled": "bg-rose-50 text-rose-700 border-rose-200"
                    };
                    const karigarName = karigars.find(k => k._id === r.karigarId || k.id === r.karigarId)?.name || r.note?.match(/\[Assigned:\s*(.*?)\]/)?.[1] || "Unassigned";

                    return (
                      <div key={(r as any)._id || r.id} className="p-3.5 space-y-2.5 hover:bg-muted/20">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-primary text-xs">{r.orderNo}</span>
                            <span className="text-xs text-muted-foreground font-mono">{formatDate(r.date)}</span>
                          </div>
                          <Select value={r.status} onValueChange={(v) => setStatus((r as any)._id || r.id, v as Order["status"])} disabled={r.status === 'Delivered'}>
                            <SelectTrigger className={`h-6 w-24 text-[9px] font-bold uppercase tracking-wider ${statusColors[r.status] || ""}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["Pending", "In Progress", "Ready", "Delivered", "Cancelled"].filter(s => s !== "Delivered" || r.status === "Delivered").map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-foreground text-sm">{r.customerName}</div>
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">{r.customerMobile}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-muted-foreground uppercase font-semibold">Est Total</div>
                            <div className="font-mono font-bold text-foreground text-sm">{inr(r.estimatedTotalAmount || r.fixedPrice || 0)}</div>
                          </div>
                        </div>

                        <div className="bg-muted/30 p-2 rounded-md text-xs space-y-1">
                          <div className="font-medium text-foreground">{r.itemDescription}</div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground font-mono">
                            <span>{r.metal} · {r.purity} {r.expectedNetWeight ? `(${r.expectedNetWeight}g Net)` : ''}</span>
                            <span>Karigar: <strong className="text-foreground">{karigarName}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs bg-emerald-50/50 p-2 rounded-md font-mono border border-emerald-100">
                          <div>
                            Advance Deposit: <strong className="text-emerald-700">{inr((r.advancePaid || 0) + (r.oldGoldValuation || 0))}</strong>
                          </div>
                          {r.dueDate && (
                            <div className="text-[10px] text-slate-500">
                              Due: {formatDate(r.dueDate)}
                            </div>
                          )}
                        </div>

                        {/* Mobile Actions Toolbar */}
                        <div className="flex items-center justify-end gap-1 pt-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => setViewingReceipt(r)}>
                            <Printer className="w-3.5 h-3.5 mr-1" /> Receipt
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => { setForm(r); setEditingId((r as any)._id || r.id || null); setOpen(true); }}>
                            <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50" onClick={() => remove((r as any)._id || r.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Orders Table (Visible on screens >= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse min-w-[950px]">
                    <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                      <tr>
                        <th className="py-3 px-4">Order # / Date</th>
                        <th className="py-3 px-4">Customer Details</th>
                        <th className="py-3 px-4">Item &amp; Specifications</th>
                        <th className="py-3 px-4">Karigar</th>
                        <th className="py-3 px-4 text-right">Est Amount</th>
                        <th className="py-3 px-4 text-right">Advance Paid</th>
                        <th className="py-3 px-4">Due Date</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((r) => {
                        const statusColors: any = {
                          "Pending": "bg-slate-100 text-slate-700 border-slate-200",
                          "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
                          "Ready": "bg-green-50 text-green-700 border-green-200",
                          "Delivered": "bg-slate-100 text-slate-500 border-slate-200",
                          "Cancelled": "bg-rose-50 text-rose-700 border-rose-200"
                        };
                        return (
                          <tr key={(r as any)._id || r.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="py-3 px-4 font-mono font-bold text-primary">
                              <div>{r.orderNo}</div>
                              <div className="text-xs font-normal text-muted-foreground">{formatDate(r.date)}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-foreground">{r.customerName}</div>
                              <div className="text-xs text-muted-foreground">{r.customerMobile}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-foreground">{r.itemDescription}</div>
                              <div className="text-xs text-muted-foreground">
                                {r.metal} {r.purity} {r.expectedNetWeight ? `(${r.expectedNetWeight}g Net)` : ''}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {karigars.find(k => k._id === r.karigarId || k.id === r.karigarId)?.name || r.note?.match(/\[Assigned:\s*(.*?)\]/)?.[1] || "—"}
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-foreground">
                              {inr(r.estimatedTotalAmount || r.fixedPrice || 0)}
                            </td>
                            <td className="py-3 px-4 text-right text-emerald-600 font-medium">
                              <div>{inr((r.advancePaid || 0) + (r.oldGoldValuation || 0))}</div>
                              {r.oldGoldValuation ? <div className="text-[10px] text-amber-700">Incl Old Gold: {inr(r.oldGoldValuation)}</div> : null}
                            </td>
                            <td className="py-3 px-4 font-medium">
                              {r.dueDate ? formatDate(r.dueDate) : "—"}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Select value={r.status} onValueChange={(v) => setStatus((r as any)._id || r.id, v as Order["status"])} disabled={r.status === 'Delivered'}>
                                <SelectTrigger className={`mx-auto h-7 w-28 text-[10px] font-bold uppercase tracking-wider shadow-none border-transparent ${statusColors[r.status] || ""}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {["Pending", "In Progress", "Ready", "Delivered", "Cancelled"].filter(s => s !== "Delivered" || r.status === "Delivered").map(s => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewingReceipt(r)} title="Print Receipt">
                                  <Printer className="w-4 h-4 text-muted-foreground hover:text-primary" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setForm(r); setEditingId((r as any)._id || r.id || null); setOpen(true); }} title="Edit Order">
                                  <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => remove((r as any)._id || r.id)} title="Delete Order">
                                  <Trash2 className="w-4 h-4 text-rose-500 hover:text-rose-600" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
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
      </div>

      {viewingReceipt && <OrderInvoiceModal order={viewingReceipt} onClose={() => setViewingReceipt(null)} />}
    </Layout>
  );
}

function OrderInvoiceModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const totalValuation = order.estimatedTotalAmount || order.fixedPrice || 0;
  const oldGoldVal = order.oldGoldValuation || 0;
  const cashAdv = order.advancePaid || 0;
  const totalDeposit = cashAdv + oldGoldVal;
  const balanceDue = Math.max(0, totalValuation - totalDeposit);

  return (
    <div className="print-section fixed inset-0 z-100 bg-black/50 flex justify-center items-start p-2 sm:p-4 print:static print:block print:bg-white print:p-0 print:overflow-visible print:h-auto overflow-y-auto pointer-events-auto">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-xl print:shadow-none print:max-w-none text-slate-900 my-auto relative flex flex-col max-h-[95vh] print:my-0 print:max-h-none print:block">
        <style>{`@media print { @page { margin: 4mm; } body { zoom: 0.9; } }`}</style>
        <div className="p-6 sm:p-10 print:p-2 border-2 border-transparent print:border-none m-2 print:m-0 bg-white overflow-y-auto flex-1 print:overflow-visible">

          <ShopHeader documentLabel="Custom Jewellery Order Receipt" compact />

          {/* Customer & Order Meta */}
          <div className="flex justify-between items-start mb-6 text-sm">
            <div>
              <div className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-1">Customer Details:</div>
              <div className="font-bold text-lg">{order.customerName}</div>
              <div className="text-slate-700">{order.customerMobile}</div>
              {order.customerAddress && <div className="text-slate-700 mt-0.5 max-w-xs"><span className="font-medium">Address:</span> {order.customerAddress}</div>}
            </div>
            <div className="text-right">
              <div className="text-2xl font-display font-bold mb-2 text-slate-900">CUSTOM ORDER RECEIPT</div>
              <table className="ml-auto text-left text-slate-700 text-xs">
                <tbody>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Order No:</td><td className="font-semibold text-slate-900">{order.orderNo}</td></tr>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Booking Date:</td><td className="font-semibold text-slate-900">{formatDate(order.date)}</td></tr>
                  {order.dueDate && <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Expected Delivery:</td><td className="font-semibold text-slate-900">{formatDate(order.dueDate)}</td></tr>}
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Rate Lock:</td><td className="font-semibold text-amber-800">{order.rateLockStatus || "Locked"} (@ {inr(order.lockedGoldRate || 7200)}/g)</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Items & Specifications Table */}
          <div className="overflow-x-auto w-full mb-6">
            <table className="w-full text-xs border-collapse border border-slate-300">
              <thead className="bg-slate-100 text-slate-700 uppercase">
                <tr>
                  <th className="border border-slate-300 py-2 px-3 text-left">Item Description</th>
                  <th className="border border-slate-300 py-2 px-3 text-left">Metal & Purity</th>
                  <th className="border border-slate-300 py-2 px-3 text-center">Exp. Wt (Gross / Net)</th>
                  <th className="border border-slate-300 py-2 px-3 text-center">Size / Length</th>
                  <th className="border border-slate-300 py-2 px-3 text-center">Hallmark</th>
                  <th className="border border-slate-300 py-2 px-3 text-right">Est. Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="border border-slate-300 py-2.5 px-3 font-semibold">{order.itemDescription}</td>
                  <td className="border border-slate-300 py-2.5 px-3">{order.metal} - {order.purity}</td>
                  <td className="border border-slate-300 py-2.5 px-3 text-center font-mono">
                    G: {order.expectedGrossWeight || 0}g | N: {order.expectedNetWeight || 0}g
                  </td>
                  <td className="border border-slate-300 py-2.5 px-3 text-center">{order.sizeLength || "Standard"}</td>
                  <td className="border border-slate-300 py-2.5 px-3 text-center">
                    {order.hallmarkRequired !== false ? "HUID Hallmark" : "Standard"}
                  </td>
                  <td className="border border-slate-300 py-2.5 px-3 text-right font-bold text-slate-900">{inr(totalValuation)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Old Gold & Advance Breakdown Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 text-xs">
            <div className="border border-slate-200 rounded-md p-3 bg-slate-50">
              <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-2">Deposits & Advances Received</h4>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">Cash / UPI Advance Paid:</span>
                  <span className="font-semibold text-emerald-700">{inr(cashAdv)}</span>
                </div>
                {oldGoldVal > 0 && (
                  <div className="flex justify-between border-t border-slate-200 pt-1">
                    <span className="text-slate-600">Old Gold Trade-in Credit ({order.oldGoldWeight}g {order.oldGoldPurity}):</span>
                    <span className="font-semibold text-amber-800">{inr(oldGoldVal)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-300 pt-1 font-bold text-slate-900">
                  <span>Total Advance Deposit:</span>
                  <span>{inr(totalDeposit)}</span>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-md p-3 bg-slate-50">
              <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-2">Order Valuation Summary</h4>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">Estimated Total Order Value:</span>
                  <span className="font-semibold">{inr(totalValuation)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Advance Credited:</span>
                  <span className="font-semibold text-emerald-700">- {inr(totalDeposit)}</span>
                </div>
                <div className="flex justify-between border-t-2 border-slate-400 pt-1.5 font-bold text-base text-rose-700">
                  <span>Balance Due at Delivery:</span>
                  <span>{inr(balanceDue)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sample Image Preview if uploaded */}
          {order.sampleImageUrl && (
            <div className="mb-6 border p-3 rounded-md bg-slate-50">
              <div className="text-xs font-bold text-slate-600 uppercase mb-2">Sample Reference Sketch / Photo</div>
              <img src={order.sampleImageUrl} alt="Sample Design" className="h-28 object-contain rounded border bg-white" />
            </div>
          )}

          {/* Signatures */}
          <div className="mt-12 print:mt-6 grid grid-cols-1 sm:grid-cols-2 gap-8 items-end text-xs font-bold text-slate-500 uppercase tracking-wider print:break-inside-avoid">
            <div className="text-center">
              {order.customerSignature ? (
                <img src={order.customerSignature} alt="Customer Signature" className="h-16 mx-auto mb-2 object-contain" />
              ) : (
                <div className="w-48 border-t-2 border-slate-300 mb-2 mx-auto"></div>
              )}
              Customer Signature
            </div>
            <div className="text-center">
              {order.authorizedSignatory ? (
                <img src={order.authorizedSignatory} alt="Authorized Signatory" className="h-16 mx-auto mb-2 object-contain" />
              ) : (
                <div className="w-48 border-t-2 border-slate-300 mb-2 mx-auto"></div>
              )}
              Authorized Signatory
            </div>
          </div>
          <div className="mt-8 print:mt-2 border-t border-slate-200 pt-4 print:pt-2 text-center text-xs normal-case tracking-normal font-normal text-slate-600 print:break-inside-avoid">
            <InvoiceTerms compact />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="shrink-0 bg-slate-100 p-4 border-t border-slate-200 rounded-b-lg flex justify-end gap-3 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={triggerPrint}>
            <Printer className="w-4 h-4 mr-2" /> Print Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}
