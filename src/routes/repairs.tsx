import { useState, useMemo } from "react";
import { useFormKeyboardNav } from "@/lib/useFormKeyboardNav";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, type Repair, type Karigar } from "@/lib/storage";
import { useDebounce, triggerPrint } from "@/lib/utils";
import { useTenantAPI } from "@/lib/api";
import { Plus, Trash2, Wrench, Pencil, Printer, Search, Image as ImageIcon, UserCheck, UserPlus } from "lucide-react";
import { InvoiceTerms, ShopHeader } from "@/components/InvoiceBranding";
import { toast } from "sonner";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const formatDate = (date: string | Date) => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return isNaN(d.getTime()) ? "" : format(d, "dd/MM/yyyy");
};

export default function RepairsPage() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchCust, setSearchCust] = useState("");
  const debouncedSearchCust = useDebounce(searchCust, 300);

  const empty: Repair = {
    ticketNo: "",
    date: new Date().toISOString().slice(0, 10),
    customerName: "",
    customerMobile: "",
    customerAddress: "",
    metal: "Gold",
    purity: "22K (916)",
    itemDescription: "",
    itemWeight: 0,
    receivedWeight: 0,
    deliveredWeight: 0,
    goldAddedWeight: 0,
    problem: "",
    estimatedCost: 0,
    actualCost: 0,
    karigarLabourCharge: 0,
    advance: 0,
    deliveryDate: "",
    karigarId: "",
    status: "Received",
    beforePhotoUrl: "",
    afterPhotoUrl: "",
    note: "",
    customerSignature: "",
    authorizedSignatory: "",
  };

  const [form, setForm] = useState<Repair>(empty);
  const [viewingReceipt, setViewingReceipt] = useState<Repair | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [filter, setFilter] = useState<"All" | Repair["status"]>("All");
  const api = useTenantAPI();
  const queryClient = useQueryClient();

  const useApiMutation = (mutationFn: (...args: any[]) => Promise<any>, queryKey: string[]) => {
    return useMutation({
      mutationFn,
      onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });
  };

  const { data = [], isLoading, error } = useQuery({ queryKey: ["repairs"], queryFn: api.repairs.getAll });
  const { data: karigars = [] } = useQuery<Karigar[]>({ queryKey: ["karigars"], queryFn: api.karigars.getAll });
  const { data: customers = [] } = useQuery<any[]>({ queryKey: ["customers"], queryFn: api.customers.getAll });
  const createMutation = useApiMutation((data: Repair) => api.repairs.create(data), ["repairs"]);
  const updateMutation = useApiMutation(
    (data: { id: string; body: Repair }) => api.repairs.update(data.id, data.body),
    ["repairs"]
  );
  const deleteMutation = useApiMutation((id: string) => api.repairs.remove(id), ["repairs"]);
  const createCustomerMutation = useApiMutation((data: any) => api.customers.create(data), ["customers"]);

  const list = (data || []).map((item) => ({
    ...item,
    id: item.id || item._id,
    date: item.date ? new Date(item.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    deliveryDate: item.deliveryDate ? new Date(item.deliveryDate).toISOString().slice(0, 10) : "",
  }));
  const [newCust, setNewCust] = useState({ name: "", phone: "", phone2: "", address: "" });
  const [showAddCustModal, setShowAddCustModal] = useState(false);
  const [newQuickCust, setNewQuickCust] = useState({ name: "", phone: "", phone2: "", address: "" });

  const handleSaveQuickCustomer = async () => {
    if (!newQuickCust.name.trim()) {
      toast.error("Customer Name is required");
      return;
    }
    try {
      const payload = {
        name: newQuickCust.name.trim(),
        mobile: newQuickCust.phone.trim() || "0000000000",
        phone: newQuickCust.phone.trim() || "0000000000",
        phone2: newQuickCust.phone2.trim() || "",
        address: newQuickCust.address.trim() || "Local",
        group: "CUSTOMER",
      };
      const created = await createCustomerMutation.mutateAsync(payload);
      setSearchCust(created.name);
      setForm(f => ({
        ...f,
        customerName: created.name,
        customerMobile: created.mobile || created.phone || "",
        customerAddress: created.address || "Local",
      }));
      setShowAddCustModal(false);
      setNewQuickCust({ name: "", phone: "", phone2: "", address: "" });
      toast.success(`Customer "${created.name}" created and selected!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create customer");
    }
  };

  const save = async () => {
    if (form.customerMobile !== "NEW" && !form.customerName) return;

    let custName = form.customerName;
    let custMobile = form.customerMobile;
    let custAddress = form.customerAddress;

    if (form.customerMobile === "NEW" || !form.customerMobile) {
      const activeName = (form.customerName || newCust.name || searchCust || "").trim();
      if (!activeName) {
        toast.error("Customer name is required.");
        return;
      }
      try {
        const payload = {
          name: activeName,
          phone: newCust.phone || (form.customerMobile !== "NEW" ? form.customerMobile : "") || "",
          address: newCust.address || form.customerAddress || "Local"
        };
        const created = await createCustomerMutation.mutateAsync(payload);
        custName = created.name;
        custMobile = created.phone || created.mobile || "";
        custAddress = created.address || "Local";
      } catch (e) {
        custName = activeName;
        custMobile = newCust.phone || "";
        custAddress = newCust.address || "Local";
      }
    }

    const ticketNo = form.ticketNo || `REP-${(list.length + 1).toString().padStart(4, "0")}`;
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

    const payload = {
      ...form,
      customerName: custName,
      customerMobile: custMobile,
      customerAddress: custAddress,
      ticketNo,
      status: form.status || "Received",
      karigarId: finalKarigarId,
      note: safeNote.trim(),
      itemWeight: form.receivedWeight || form.itemWeight || 0,
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: payload });
        toast.success("Repair ticket updated successfully.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Repair ticket created successfully.");
      }
      setForm(empty);
      setNewCust({ name: "", phone: "", phone2: "", address: "" });
      setEditingId(null);
      setOpen(false);
    } catch (error: any) {
      toast.error("Error saving repair ticket.");
    }
  };

  const handleKeyNav = useFormKeyboardNav(save);

  const setStatus = async (id: string, status: Repair["status"]) => {
    const repair = list.find((r) => r.id === id || r._id === id);
    if (!repair || !repair._id) return;
    await updateMutation.mutateAsync({ id: repair._id, body: { ...repair, status } });
  };

  const remove = async (id: string) => {
    const repair = list.find((r) => r.id === id || r._id === id);
    if (!repair || !repair._id) return;
    if (window.confirm("Are you sure you want to delete this repair ticket?")) {
      await deleteMutation.mutateAsync(repair._id);
      toast.success("Repair ticket deleted.");
    }
  };

  const pending = list.filter((r) => r.status !== "Delivered").length;
  const totalAdvance = list.filter((r) => r.status !== "Delivered").reduce((s, r) => s + (r.advance || 0), 0);

  const filtered = useMemo(() => {
    let result = filter === "All" ? list : list.filter(o => o.status === filter);
    if (debouncedQ.trim()) {
      const lowerQ = debouncedQ.toLowerCase().trim();
      result = result.filter(o =>
        o.customerName.toLowerCase().includes(lowerQ) ||
        o.ticketNo.toLowerCase().includes(lowerQ) ||
        (o.customerMobile || "").includes(lowerQ) ||
        (o.itemDescription || "").toLowerCase().includes(lowerQ) ||
        (o.customerAddress || "").toLowerCase().includes(lowerQ) ||
        (o.purity || "").toLowerCase().includes(lowerQ)
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
            <h1 className="text-3xl font-display font-bold">Jewellery Repairs & Services</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Track customer repairs, weights, karigar assignments & charges.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-new-button="true" size="lg" className="w-full sm:w-auto bg-primary text-white hover:bg-primary/90" onClick={() => { setForm(empty); setNewCust({ name: "", phone: "", phone2: "", address: "" }); setEditingId(null); setSearchCust(""); }}>
                <Plus className="w-4 h-4 mr-2" /> New Repair Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="fixed inset-0 z-[100] w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 top-0 left-0 rounded-none border-0 p-3 sm:p-5 bg-neutral-50 dark:bg-slate-950 flex flex-col overflow-y-auto shadow-none" aria-describedby={undefined} onInteractOutside={(e) => e.preventDefault()} onKeyDown={handleKeyNav}>
              {/* HEADER BANNER */}
              <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-amber-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <DialogTitle className="font-black text-lg sm:text-xl uppercase tracking-wide text-amber-950 dark:text-white flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-amber-600" />
                    {editingId ? "Edit Repair Ticket Master" : "New Repair Ticket Master"}
                  </DialogTitle>
                  <Badge variant="outline" className="bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border-amber-400 font-mono font-bold text-xs px-2.5 py-0.5">
                    {form.ticketNo || `REP-${(list.length + 1).toString().padStart(4, "0")}`}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 pr-8 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Intake Date:</span>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={e => setForm((f: any) => ({ ...f, date: e.target.value }))}
                      className="h-8 text-xs sm:text-sm w-38 sm:w-44 bg-white dark:bg-slate-900 font-mono font-bold border border-amber-300 dark:border-slate-700 rounded-md px-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 shadow-2xs cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Expected Delivery:</span>
                    <Input
                      type="date"
                      value={form.deliveryDate || ""}
                      onChange={e => setForm((f: any) => ({ ...f, deliveryDate: e.target.value }))}
                      className="h-8 text-xs sm:text-sm w-38 sm:w-44 bg-white dark:bg-slate-900 font-mono font-bold border border-amber-300 dark:border-slate-700 rounded-md px-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 shadow-2xs cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Status:</span>
                    <select
                      value={form.status || "Received"}
                      onChange={e => setForm((f: any) => ({ ...f, status: e.target.value as Repair["status"] }))}
                      className="h-8 w-32 text-xs bg-white dark:bg-slate-900 border border-slate-300 font-bold rounded-md px-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="Received">Received</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Ready">Ready</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-3 sm:p-4 space-y-4 overflow-y-auto flex-1 bg-white dark:bg-slate-900">
                {/* 1. TOP CONTROL PANEL: CUSTOMER & KARIGAR ASSIGNMENT */}
                <div className="bg-amber-50/50 dark:bg-slate-800 border border-amber-200 dark:border-slate-700 p-3 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm shadow-2xs">
                  <div className="flex flex-wrap items-center gap-3 flex-1">
                    {/* Search Customer Input */}
                    <div className="flex items-center gap-1.5 min-w-[220px]">
                      <span className="font-bold text-amber-950 dark:text-slate-200">Customer Name / Search:</span>
                      <Input
                        placeholder="Name, phone, address..."
                        value={form.customerName || searchCust}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSearchCust(val);
                          const cleanVal = val.trim().toLowerCase();
                          if (!cleanVal) {
                            setForm(prev => ({
                              ...prev,
                              customerName: "",
                              customerMobile: "",
                              customerAddress: ""
                            }));
                            setNewCust({ name: "", phone: "", phone2: "", address: "" });
                            return;
                          }
                          setForm(prev => ({ ...prev, customerName: val }));
                          const match = customers.find(c =>
                            (c.name || "").toLowerCase().trim() === cleanVal ||
                            ((c.mobile || (c as any).phone) || "").trim() === val.trim() ||
                            (c.address || "").toLowerCase().includes(cleanVal)
                          );
                          if (match) {
                            setForm(prev => ({
                              ...prev,
                              customerName: match.name,
                              customerMobile: match.mobile || (match as any).phone || "",
                              customerAddress: match.address || ""
                            }));
                          } else {
                            setForm(prev => ({
                              ...prev,
                              customerMobile: "NEW"
                            }));
                          }
                        }}
                        className="h-8 text-xs font-bold bg-white dark:bg-slate-900 border-amber-300 flex-1 focus:ring-amber-500"
                      />
                    </div>

                    {/* Customer Select Dropdown */}
                    <div className="flex items-center gap-1.5 min-w-[240px]">
                      <span className="font-bold text-amber-950 dark:text-slate-200">Customer *:</span>
                      <select
                        value={form.customerMobile || form.customerName || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "NEW") {
                            const activeName = searchCust || form.customerName || "";
                            setNewQuickCust({ name: activeName, phone: "", phone2: "", address: "" });
                            setShowAddCustModal(true);
                          } else {
                            const match = customers.find(c => (c.mobile || (c as any).phone || c.name) === val);
                            if (match) {
                              setSearchCust(match.name);
                              setForm({ ...form, customerName: match.name, customerMobile: match.mobile || (match as any).phone || "", customerAddress: match.address || "" });
                            }
                          }
                        }}
                        className="h-8 w-52 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-slate-700 font-bold rounded-md px-2 text-slate-900 dark:text-white cursor-pointer focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="" disabled>Select Customer</option>
                        <option value="NEW" className="font-bold text-amber-700">➕ Create / Add New Customer</option>
                        {customers.filter(c => c.name.toLowerCase().includes(debouncedSearchCust.toLowerCase()) || (c.mobile || (c as any).phone || "").includes(debouncedSearchCust) || (c.address || "").toLowerCase().includes(debouncedSearchCust.toLowerCase())).sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((c) => (
                          <option key={c._id || c.id} value={c.mobile || (c as any).phone || c.name}>{c.name} {c.mobile || (c as any).phone ? `· ${c.mobile || (c as any).phone}` : ""}</option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 flex items-center gap-1 shrink-0 cursor-pointer"
                        onClick={() => {
                          const activeName = searchCust || form.customerName || "";
                          setNewQuickCust({ name: activeName, phone: "", phone2: "", address: "" });
                          setShowAddCustModal(true);
                        }}
                      >
                        <UserPlus className="w-3.5 h-3.5" /> + New
                      </Button>
                    </div>

                    {/* Customer Info Preview */}
                    {form.customerName && (
                      <div className="bg-amber-100/60 dark:bg-slate-900 px-3 py-1 rounded border border-amber-300 text-xs flex items-center gap-1.5">
                        <span className="font-bold text-amber-950 dark:text-white">{form.customerName}</span>
                        {form.customerMobile && form.customerMobile !== "NEW" && <span className="text-amber-800 font-mono font-bold">Ph: {form.customerMobile}</span>}
                        {form.customerAddress && <span className="text-amber-700 truncate max-w-[200px] font-medium">({form.customerAddress})</span>}
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">✓ Active</span>
                      </div>
                    )}

                    {/* Karigar Assignment */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="font-bold text-amber-950 dark:text-slate-200">Karigar Assigned:</span>
                      <select
                        value={form.karigarId || "unassigned"}
                        onChange={e => setForm({ ...form, karigarId: e.target.value })}
                        className="h-8 w-44 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-slate-700 font-bold rounded-md px-2 text-slate-900 dark:text-white cursor-pointer focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="unassigned">Unassigned</option>
                        {karigars.sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(k => (
                          <option key={k._id || k.id} value={k._id || k.id}>{k.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Create New Customer Inline Form */}
                {form.customerMobile === "NEW" && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 text-xs grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div><Label className="text-xs font-bold text-amber-900">Full Name *</Label><Input value={newCust.name} onChange={e => setNewCust({ ...newCust, name: e.target.value })} className="h-8 bg-white dark:bg-slate-900 border-amber-300" /></div>
                    <div><Label className="text-xs font-bold text-amber-900">Mobile No</Label><Input value={newCust.phone} onChange={e => setNewCust({ ...newCust, phone: e.target.value })} className="h-8 bg-white dark:bg-slate-900 border-amber-300" /></div>
                    <div><Label className="text-xs font-bold text-amber-900">Mobile No 2</Label><Input value={newCust.phone2} onChange={e => setNewCust({ ...newCust, phone2: e.target.value })} className="h-8 bg-white dark:bg-slate-900 border-amber-300" /></div>
                    <div><Label className="text-xs font-bold text-amber-900">Address *</Label><Input value={newCust.address} onChange={e => setNewCust({ ...newCust, address: e.target.value })} className="h-8 bg-white dark:bg-slate-900 border-amber-300" /></div>
                  </div>
                )}

                {/* 2. SPREADSHEET MULTI-COLUMN REPAIR DETAILS TABLE */}
                <div className="border border-amber-300 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                  <div className="bg-amber-500/10 dark:bg-amber-950/40 px-3 py-1.5 font-black text-xs uppercase tracking-wider text-amber-950 dark:text-amber-200 border-b border-amber-300 dark:border-slate-700 flex items-center justify-between">
                    <span>Repair Item &amp; Financial Master Spreadsheet</span>
                    <span className="text-[11px] font-normal text-amber-800 dark:text-amber-400">Crisp 1px Desktop ERP Grid Layout</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border-amber-200 dark:border-slate-700 text-xs">
                      <thead className="bg-amber-100/70 dark:bg-slate-800 font-bold uppercase text-[11px] text-amber-950 dark:text-slate-200">
                        <tr>
                          <th className="p-2 border border-amber-200 dark:border-slate-700 text-left min-w-[180px]">Item Description / Title *</th>
                          <th className="p-2 border border-amber-200 dark:border-slate-700 text-left w-28">Metal</th>
                          <th className="p-2 border border-amber-200 dark:border-slate-700 text-left w-28">Purity</th>
                          <th className="p-2 border border-amber-200 dark:border-slate-700 text-left min-w-[200px]">Problem / Work Required *</th>
                          <th className="p-2 border border-amber-200 dark:border-slate-700 text-right w-24">Rec. Wt (g) *</th>
                          <th className="p-2 border border-amber-200 dark:border-slate-700 text-right w-24">Del. Wt (g)</th>
                          <th className="p-2 border border-amber-200 dark:border-slate-700 text-right w-24">Gold Added (g)</th>
                          <th className="p-2 border border-amber-200 dark:border-slate-700 text-right w-28">Est. Cost ₹</th>
                          <th className="p-2 border border-amber-200 dark:border-slate-700 text-right w-28">Actual Cost ₹</th>
                          <th className="p-2 border border-amber-200 dark:border-slate-700 text-right w-28">Karigar Fee ₹</th>
                          <th className="p-2 border border-amber-200 dark:border-slate-700 text-right w-28">Advance Paid ₹</th>
                          <th className="p-2 border border-amber-200 dark:border-slate-700 text-right w-28 bg-amber-200/80 dark:bg-amber-950/80">Balance Due ₹</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="hover:bg-amber-50/40 dark:hover:bg-slate-850">
                          <td className="p-0 border border-amber-200 dark:border-slate-700">
                            <input
                              placeholder="e.g. Gold Ring Repair / Chain Solder"
                              value={form.itemDescription}
                              onChange={e => setForm({ ...form, itemDescription: e.target.value })}
                              className="w-full h-9 px-2 text-xs font-semibold border-0 rounded-none bg-transparent focus:ring-2 focus:ring-amber-500 focus:bg-amber-50 dark:focus:bg-amber-950/80 outline-none"
                            />
                          </td>
                          <td className="p-0 border border-amber-200 dark:border-slate-700">
                            <select
                              value={form.metal || "Gold"}
                              onChange={e => setForm({ ...form, metal: e.target.value as any })}
                              className="w-full h-9 px-1 text-xs font-bold border-0 rounded-none bg-transparent focus:ring-2 focus:ring-amber-500 focus:bg-amber-50 dark:focus:bg-amber-950/80 cursor-pointer outline-none"
                            >
                              <option value="Gold">Gold</option>
                              <option value="Silver">Silver</option>
                              <option value="Diamond">Diamond</option>
                              <option value="Platinum">Platinum</option>
                              <option value="Other">Other</option>
                            </select>
                          </td>
                          <td className="p-0 border border-amber-200 dark:border-slate-700">
                            <input
                              value={form.purity || "22K (916)"}
                              onChange={e => setForm({ ...form, purity: e.target.value })}
                              className="w-full h-9 px-2 text-xs font-bold border-0 rounded-none bg-transparent focus:ring-2 focus:ring-amber-500 focus:bg-amber-50 dark:focus:bg-amber-950/80 outline-none"
                            />
                          </td>
                          <td className="p-0 border border-amber-200 dark:border-slate-700">
                            <input
                              placeholder="Describe work required..."
                              value={form.problem}
                              onChange={e => setForm({ ...form, problem: e.target.value })}
                              className="w-full h-9 px-2 text-xs border-0 rounded-none bg-transparent focus:ring-2 focus:ring-amber-500 focus:bg-amber-50 dark:focus:bg-amber-950/80 outline-none"
                            />
                          </td>
                          <td className="p-0 border border-amber-200 dark:border-slate-700">
                            <input
                              type="number"
                              value={form.receivedWeight || form.itemWeight || ""}
                              onChange={e => setForm({ ...form, receivedWeight: +e.target.value, itemWeight: +e.target.value })}
                              className="w-full h-9 px-2 text-xs font-mono font-bold text-right border-0 rounded-none bg-transparent focus:ring-2 focus:ring-amber-500 focus:bg-amber-50 dark:focus:bg-amber-950/80 outline-none"
                            />
                          </td>
                          <td className="p-0 border border-amber-200 dark:border-slate-700">
                            <input
                              type="number"
                              value={form.deliveredWeight || ""}
                              onChange={e => setForm({ ...form, deliveredWeight: +e.target.value })}
                              className="w-full h-9 px-2 text-xs font-mono font-bold text-right border-0 rounded-none bg-transparent focus:ring-2 focus:ring-amber-500 focus:bg-amber-50 dark:focus:bg-amber-950/80 outline-none"
                            />
                          </td>
                          <td className="p-0 border border-amber-200 dark:border-slate-700">
                            <input
                              type="number"
                              value={form.goldAddedWeight || ""}
                              onChange={e => setForm({ ...form, goldAddedWeight: +e.target.value })}
                              className="w-full h-9 px-2 text-xs font-mono font-bold text-right border-0 rounded-none bg-transparent focus:ring-2 focus:ring-amber-500 focus:bg-amber-50 dark:focus:bg-amber-950/80 outline-none"
                            />
                          </td>
                          <td className="p-0 border border-amber-200 dark:border-slate-700">
                            <input
                              type="number"
                              value={form.estimatedCost || form.estimate || ""}
                              onChange={e => setForm({ ...form, estimatedCost: +e.target.value, estimate: +e.target.value })}
                              className="w-full h-9 px-2 text-xs font-mono font-bold text-right border-0 rounded-none bg-transparent text-amber-800 dark:text-amber-400 focus:ring-2 focus:ring-amber-500 focus:bg-amber-50 dark:focus:bg-amber-950/80 outline-none"
                            />
                          </td>
                          <td className="p-0 border border-amber-200 dark:border-slate-700">
                            <input
                              type="number"
                              value={form.actualCost || ""}
                              onChange={e => setForm({ ...form, actualCost: +e.target.value })}
                              className="w-full h-9 px-2 text-xs font-mono font-bold text-right border-0 rounded-none bg-transparent text-emerald-700 dark:text-emerald-400 focus:ring-2 focus:ring-amber-500 focus:bg-amber-50 dark:focus:bg-amber-950/80 outline-none"
                            />
                          </td>
                          <td className="p-0 border border-amber-200 dark:border-slate-700">
                            <input
                              type="number"
                              value={form.karigarLabourCharge || ""}
                              onChange={e => setForm({ ...form, karigarLabourCharge: +e.target.value })}
                              className="w-full h-9 px-2 text-xs font-mono font-bold text-right border-0 rounded-none bg-transparent focus:ring-2 focus:ring-amber-500 focus:bg-amber-50 dark:focus:bg-amber-950/80 outline-none"
                            />
                          </td>
                          <td className="p-0 border border-amber-200 dark:border-slate-700">
                            <input
                              type="number"
                              value={form.advance || ""}
                              onChange={e => setForm({ ...form, advance: +e.target.value })}
                              className="w-full h-9 px-2 text-xs font-mono font-bold text-right border-0 rounded-none bg-transparent text-emerald-600 focus:ring-2 focus:ring-amber-500 focus:bg-amber-50 dark:focus:bg-amber-950/80 outline-none"
                            />
                          </td>
                          <td className="p-2 border border-amber-200 dark:border-slate-700 text-right font-mono font-black text-red-600 text-sm bg-amber-100/60 dark:bg-amber-950/40">
                            {inr(Math.max(0, ((form.actualCost || form.estimatedCost || 0) - (form.advance || 0))))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. MEDIA & NOTES PANEL (PHOTO, SIGNATURES, REPAIR NOTES) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Damage Photo */}
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-300 dark:border-slate-700 space-y-2">
                    <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-amber-600" /> Item Damage Photo (Initial Condition)
                    </Label>
                    <Input type="file" accept="image/*" className="bg-slate-50 dark:bg-slate-900 h-8 text-xs" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setForm({ ...form, beforePhotoUrl: reader.result as string });
                        reader.readAsDataURL(file);
                      }
                    }} />
                    {form.beforePhotoUrl && <img src={form.beforePhotoUrl} alt="Damaged Item" className="h-20 rounded border object-contain" />}
                  </div>

                  {/* Signatures */}
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-300 dark:border-slate-700 space-y-2">
                    <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Signatures (Optional)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-slate-500">Customer Sig</Label>
                        <Input type="file" accept="image/*" className="bg-slate-50 dark:bg-slate-900 h-7 text-[11px]" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => setForm({ ...form, customerSignature: reader.result as string });
                            reader.readAsDataURL(file);
                          }
                        }} />
                        {form.customerSignature && <img src={form.customerSignature} alt="Customer Signature" className="mt-1 h-10 object-contain" />}
                      </div>
                      <div>
                        <Label className="text-[11px] text-slate-500">Authorized Sig</Label>
                        <Input type="file" accept="image/*" className="bg-slate-50 dark:bg-slate-900 h-7 text-[11px]" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => setForm({ ...form, authorizedSignatory: reader.result as string });
                            reader.readAsDataURL(file);
                          }
                        }} />
                        {form.authorizedSignatory && <img src={form.authorizedSignatory} alt="Authorized Signatory" className="mt-1 h-10 object-contain" />}
                      </div>
                    </div>
                  </div>

                  {/* Repair Notes */}
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-300 dark:border-slate-700 space-y-1.5">
                    <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Special Repair Notes</Label>
                    <Input
                      placeholder="Add special repair instructions..."
                      value={form.note || ""}
                      onChange={e => setForm({ ...form, note: e.target.value })}
                      className="h-16 text-xs bg-slate-50 dark:bg-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* 4. BOTTOM DESKTOP ACTION FOOTER BAR */}
              <div className="border-t border-slate-300 dark:border-slate-800 p-3 bg-slate-200/90 dark:bg-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    onClick={save}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs sm:text-sm uppercase px-6 h-8.5 shadow-sm"
                  >
                    {createMutation.isPending || updateMutation.isPending ? "Saving..." : (editingId ? "Update Repair Ticket" : "Create Repair Ticket")}
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
                    onClick={() => {
                      if (form.customerName || form.itemDescription) window.print();
                    }}
                    className="h-8.5 text-xs sm:text-sm font-bold uppercase border-slate-300 bg-white"
                  >
                    Print Ticket
                  </Button>
                </div>

                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-1.5 rounded-lg border-2 border-amber-500 font-mono font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                  <span>Est. Cost: <strong>{inr(form.estimatedCost || form.actualCost || 0)}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>Advance: <strong className="text-emerald-600">{inr(form.advance || 0)}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>Balance Due: <strong className="text-red-600 text-sm sm:text-lg">{inr(Math.max(0, ((form.actualCost || form.estimatedCost || 0) - (form.advance || 0))))}</strong></span>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </header>

        {/* METRICS DASHBOARD */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Stat label="Total Repair Tickets" value={list.length} />
          <Stat label="Active Repairs Pending" value={pending} />
          <Stat label="Advance Deposits Collected" value={inr(totalAdvance)} />
        </div>

        {/* REPAIR TICKETS TABLE */}
        <Card className="shadow-sm border-border overflow-hidden flex flex-col">
          <CardHeader className="bg-muted/20 border-b border-border pb-3 pt-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="text-base font-semibold font-display flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" /> Jewellery Repair Orders Register
              </CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search ticket, customer, description..."
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    className="pl-9 h-8 bg-background text-xs border-border shadow-sm"
                  />
                </div>
                <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                  <SelectTrigger className="w-32 h-8 bg-background text-xs font-medium border-border shadow-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Status</SelectItem>
                    <SelectItem value="Received">Received</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Ready">Ready</SelectItem>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-12 text-sm">Loading repair tickets...</p>
            ) : error ? (
              <p className="text-center text-red-500 py-12 text-sm">Failed to load repair tickets.</p>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Search className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">No repair tickets found matching your search.</p>
              </div>
            ) : (
              <div>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse min-w-[750px]">
                    <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                      <tr>
                        <th className="py-3 px-4">Ticket # / Date</th>
                        <th className="py-3 px-4">Customer Details</th>
                        <th className="py-3 px-4">Item & Problem</th>
                        <th className="py-3 px-4 text-center">Rec. Wt (g)</th>
                        <th className="py-3 px-4 text-center">Karigar</th>
                        <th className="py-3 px-4 text-right">Actual Cost</th>
                        <th className="py-3 px-4 text-right">Advance Paid</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right pr-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((r) => {
                        const statusColors: any = {
                          "Received": "bg-slate-100 text-slate-700 border-slate-200",
                          "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
                          "Ready": "bg-green-50 text-green-700 border-green-200",
                          "Delivered": "bg-slate-100 text-slate-500 border-slate-200"
                        };
                        const recWt = r.receivedWeight || r.itemWeight || 0;
                        return (
                          <tr key={r._id || r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4 font-medium whitespace-nowrap">
                              <div className="font-mono font-bold text-primary">{r.ticketNo}</div>
                              <div className="text-xs text-muted-foreground">{formatDate(r.date)}</div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-semibold text-foreground">{r.customerName}</div>
                              <div className="text-xs text-muted-foreground">{r.customerMobile}</div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="font-medium text-foreground">{r.itemDescription}</div>
                              <div className="text-xs text-rose-600 line-clamp-1">{r.problem}</div>
                            </td>

                            <td className="py-3 px-4 text-center font-bold text-amber-700 whitespace-nowrap">
                              {recWt} g
                            </td>

                            <td className="py-3 px-4 text-center text-xs">
                              {karigars.find(k => k._id === r.karigarId || k.id === r.karigarId)?.name || r.note?.match(/\[Assigned:\s*(.*?)\]/)?.[1] || "—"}
                            </td>

                            <td className="py-3 px-4 text-right font-medium text-foreground whitespace-nowrap">
                              {inr(r.actualCost || r.estimatedCost || 0)}
                            </td>

                            <td className="py-3 px-4 text-right font-semibold text-emerald-600 whitespace-nowrap">
                              {inr(r.advance || 0)}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <Select value={r.status} onValueChange={(v) => setStatus((r as any)._id || r.id, v as Repair["status"])}>
                                <SelectTrigger className={`mx-auto h-7 w-28 text-[10px] font-bold uppercase tracking-wider shadow-none border-transparent ${statusColors[r.status] || ""}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Received">Received</SelectItem>
                                  <SelectItem value="In Progress">In Progress</SelectItem>
                                  <SelectItem value="Ready">Ready</SelectItem>
                                  <SelectItem value="Delivered">Delivered</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>

                            <td className="py-3 px-4 text-right whitespace-nowrap pr-4">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewingReceipt(r)} title="Print Repair Receipt">
                                  <Printer className="w-4 h-4 text-muted-foreground hover:text-primary" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setForm(r); setEditingId((r as any)._id || r.id || null); setOpen(true); }} title="Edit Ticket">
                                  <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => remove((r as any)._id || r.id)} title="Delete Ticket">
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

                {/* Mobile Cards View */}
                <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3 p-3">
                  {paginated.map((r) => (
                    <div key={r._id || r.id} className="p-3.5 rounded-xl border border-border bg-card shadow-sm space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-xs font-bold text-primary">{r.ticketNo}</div>
                          <div className="font-semibold text-base text-foreground mt-0.5">{r.customerName}</div>
                          <div className="text-xs text-muted-foreground">{r.customerMobile}</div>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase">{r.status}</Badge>
                      </div>

                      <div className="p-2.5 rounded-lg bg-muted/40 text-xs space-y-1">
                        <div className="font-medium text-foreground">{r.itemDescription} ({r.metal || 'Gold'} {r.purity || ''})</div>
                        <div className="text-rose-600 font-normal">Issue: {r.problem}</div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-lg bg-muted/30 text-center text-xs">
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase font-medium">Rec Wt</div>
                          <div className="font-bold text-amber-700 mt-0.5">{r.receivedWeight || r.itemWeight || 0}g</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase font-medium">Cost</div>
                          <div className="font-bold text-foreground mt-0.5">{inr(r.actualCost || r.estimatedCost || 0)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase font-medium">Advance</div>
                          <div className="font-bold text-emerald-600 mt-0.5">{inr(r.advance || 0)}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/60 text-xs">
                        <div className="text-[11px] text-muted-foreground">{formatDate(r.date)}</div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewingReceipt(r)}>
                            <Printer className="w-3.5 h-3.5 text-primary" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setForm(r); setEditingId((r as any)._id || r.id || null); setOpen(true); }}>
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-500" onClick={() => remove((r as any)._id || r.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
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

      {viewingReceipt && <RepairReceiptModal repair={viewingReceipt} karigars={karigars} onClose={() => setViewingReceipt(null)} />}

      {/* QUICK CREATE CUSTOMER MODAL */}
      <Dialog open={showAddCustModal} onOpenChange={setShowAddCustModal}>
        <DialogContent className="z-[200] pointer-events-auto max-w-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-5 rounded-xl border border-slate-300 dark:border-slate-800 shadow-2xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-600">
              <UserCheck className="w-5 h-5" /> Quick Create New Customer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 pt-2 text-xs">
            <div>
              <Label className="text-xs font-bold">Customer Full Name *</Label>
              <Input
                placeholder="e.g. Ramesh Sharma"
                value={newQuickCust.name}
                onChange={(e) => setNewQuickCust(prev => ({ ...prev, name: e.target.value }))}
                className="h-9 mt-1 text-xs font-bold bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">Mobile Phone Number</Label>
              <Input
                placeholder="e.g. 9876543210"
                value={newQuickCust.phone}
                onChange={(e) => setNewQuickCust(prev => ({ ...prev, phone: e.target.value }))}
                className="h-9 mt-1 text-xs font-mono bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">Alternate Phone (Optional)</Label>
              <Input
                placeholder="e.g. 9123456789"
                value={newQuickCust.phone2}
                onChange={(e) => setNewQuickCust(prev => ({ ...prev, phone2: e.target.value }))}
                className="h-9 mt-1 text-xs font-mono bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">City / Address</Label>
              <Input
                placeholder="e.g. Indore MP"
                value={newQuickCust.address}
                onChange={(e) => setNewQuickCust(prev => ({ ...prev, address: e.target.value }))}
                className="h-9 mt-1 text-xs bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setShowAddCustModal(false)} className="h-8 text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveQuickCustomer}
                disabled={createCustomerMutation.isPending || !newQuickCust.name.trim()}
                className="h-8 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
              >
                {createCustomerMutation.isPending ? "Saving..." : "Save & Select Customer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="pt-5">
        <div className="text-xs font-medium text-muted-foreground uppercase">{label}</div>
        <div className="text-2xl font-display font-bold mt-1 text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

function RepairReceiptModal({ repair, karigars, onClose }: { repair: Repair; karigars: Karigar[]; onClose: () => void }) {
  const karigarName = karigars.find(k => k._id === repair.karigarId || k.id === repair.karigarId)?.name || repair.note?.match(/\[Assigned:\s*(.*?)\]/)?.[1] || "—";
  const cost = repair.actualCost || repair.estimatedCost || 0;
  const balanceDue = Math.max(0, cost - (repair.advance || 0));

  return (
    <div className="print-section fixed inset-0 z-100 bg-black/50 flex justify-center items-start p-2 sm:p-4 print:static print:block print:bg-white print:p-0 print:overflow-visible print:h-auto overflow-y-auto pointer-events-auto">
      <div className="bg-white w-full max-w-2xl rounded-lg shadow-xl print:shadow-none print:max-w-none text-slate-900 my-auto relative flex flex-col max-h-[95vh] print:my-0 print:max-h-none print:block">
        <style>{`@media print { @page { margin: 4mm; } body { zoom: 0.9; } }`}</style>
        <div className="p-6 sm:p-8 print:p-2 border-2 border-transparent print:border-none m-2 print:m-0 bg-white overflow-y-auto flex-1 print:overflow-visible">

          <ShopHeader documentLabel="Jewellery Repair Receipt" compact />

          {/* Customer & Ticket Meta */}
          <div className="flex justify-between items-start mb-6 text-xs">
            <div>
              <div className="font-bold text-slate-500 uppercase tracking-wider mb-1">Customer Details:</div>
              <div className="font-bold text-base text-slate-900">{repair.customerName}</div>
              <div className="text-slate-700">{repair.customerMobile}</div>
              {repair.customerAddress && <div className="text-slate-700 mt-0.5 max-w-xs">{repair.customerAddress}</div>}
            </div>
            <div className="text-right">
              <div className="text-xl font-display font-bold mb-1 text-slate-900">REPAIR WORK ORDER</div>
              <table className="ml-auto text-left text-slate-700 text-xs">
                <tbody>
                  <tr><td className="pr-3 py-0.5 text-right font-medium text-slate-500">Ticket No:</td><td className="font-semibold text-slate-900">{repair.ticketNo}</td></tr>
                  <tr><td className="pr-3 py-0.5 text-right font-medium text-slate-500">Intake Date:</td><td className="font-semibold text-slate-900">{formatDate(repair.date)}</td></tr>
                  {repair.deliveryDate && <tr><td className="pr-3 py-0.5 text-right font-medium text-slate-500">Exp Delivery:</td><td className="font-semibold text-slate-900">{formatDate(repair.deliveryDate)}</td></tr>}
                  <tr><td className="pr-3 py-0.5 text-right font-medium text-slate-500">Karigar:</td><td className="font-semibold text-slate-900">{karigarName}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Items & Work Table */}
          <div className="overflow-x-auto w-full mb-6">
            <table className="w-full text-xs border-collapse border border-slate-300">
              <thead className="bg-slate-100 uppercase text-slate-700 font-semibold">
                <tr>
                  <th className="border border-slate-300 py-2 px-3 text-center w-10">#</th>
                  <th className="border border-slate-300 py-2 px-3 text-left">Item Description</th>
                  <th className="border border-slate-300 py-2 px-3 text-center">Metal / Purity</th>
                  <th className="border border-slate-300 py-2 px-3 text-center">Rec. Wt</th>
                  <th className="border border-slate-300 py-2 px-3 text-center">Del. Wt</th>
                  <th className="border border-slate-300 py-2 px-3 text-left">Problem / Work Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="border border-slate-300 py-2 px-3 text-center text-slate-600">1</td>
                  <td className="border border-slate-300 py-2 px-3 font-semibold">{repair.itemDescription}</td>
                  <td className="border border-slate-300 py-2 px-3 text-center">{repair.metal || 'Gold'} {repair.purity || ''}</td>
                  <td className="border border-slate-300 py-2 px-3 text-center font-bold text-amber-800">{repair.receivedWeight || repair.itemWeight || 0} g</td>
                  <td className="border border-slate-300 py-2 px-3 text-center font-bold text-slate-800">{repair.deliveredWeight ? `${repair.deliveredWeight} g` : 'Pending'}</td>
                  <td className="border border-slate-300 py-2 px-3 text-rose-700">{repair.problem}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Damage Photo Reference */}
          {repair.beforePhotoUrl && (
            <div className="mb-6 p-3 bg-slate-50 border rounded">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Initial Damaged Item Reference Photo:</div>
              <img src={repair.beforePhotoUrl} alt="Damaged Item Reference" className="h-24 object-contain rounded border" />
            </div>
          )}

          {/* Financial Breakdown */}
          <div className="flex flex-col sm:flex-row justify-between items-start text-xs gap-6 mb-6">
            <div className="w-full sm:w-1/2">
              {repair.note && (
                <div className="p-2.5 bg-slate-50 border rounded text-slate-700">
                  <span className="font-bold">Repair Notes:</span> {repair.note}
                </div>
              )}
            </div>

            <div className="w-full sm:w-1/2 max-w-sm ml-auto space-y-1.5 border-t-2 border-slate-300 pt-2">
              <div className="flex justify-between text-slate-700">
                <span>Repair Charge:</span>
                <span className="font-semibold">{inr(cost)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Advance Paid:</span>
                <span className="font-semibold text-emerald-700">- {inr(repair.advance || 0)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-300 pt-1.5 font-bold text-sm text-slate-900">
                <span>Balance Payable:</span>
                <span className={balanceDue > 0 ? "text-rose-600" : "text-emerald-700"}>
                  {inr(balanceDue)}
                </span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-10 print:mt-6 grid grid-cols-2 gap-8 items-end text-[10px] font-bold text-slate-500 uppercase tracking-wider print:break-inside-avoid">
            <div className="text-center">
              {repair.customerSignature ? (
                <img src={repair.customerSignature} alt="Customer Signature" className="h-12 mx-auto mb-1 object-contain" />
              ) : (
                <div className="w-36 border-t border-slate-300 mb-1 mx-auto"></div>
              )}
              Customer Signature
            </div>
            <div className="text-center">
              {repair.authorizedSignatory ? (
                <img src={repair.authorizedSignatory} alt="Authorized Signatory" className="h-12 mx-auto mb-1 object-contain" />
              ) : (
                <div className="w-36 border-t border-slate-300 mb-1 mx-auto"></div>
              )}
              Authorized Signatory
            </div>
          </div>

          <div className="mt-6 print:mt-2 border-t border-slate-200 pt-2 text-center text-[10px] text-slate-600 print:break-inside-avoid">
            <InvoiceTerms compact />
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 bg-slate-100 p-4 border-t border-slate-200 rounded-b-lg flex justify-end gap-3 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={triggerPrint} className="bg-primary text-white">
            <Printer className="w-4 h-4 mr-2" /> Print Work Order
          </Button>
        </div>
      </div>
    </div>
  );
}
