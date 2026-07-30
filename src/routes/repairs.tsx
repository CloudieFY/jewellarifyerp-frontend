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
import { Plus, Trash2, Wrench, Pencil, Printer, Search, Scale, Image as ImageIcon } from "lucide-react";
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
  const [searchKar, setSearchKar] = useState("");
  const debouncedSearchKar = useDebounce(searchKar, 300);

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

  const save = async () => {
    if (form.customerMobile !== "NEW" && !form.customerName) return;

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
              <Button size="lg" className="w-full sm:w-auto bg-primary text-white hover:bg-primary/90" onClick={() => { setForm(empty); setNewCust({ name: "", phone: "", phone2: "", address: "" }); setEditingId(null); setSearchCust(""); setSearchKar(""); }}>
                <Plus className="w-4 h-4 mr-2" /> New Repair Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6" aria-describedby={undefined} onInteractOutside={(e) => e.preventDefault()} onKeyDown={handleKeyNav}>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">{editingId ? "Edit Repair Ticket" : "New Repair Ticket"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">

                {/* Customer Selection */}
                <div className="col-span-1 sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Search Customer</Label>
                    <Input
                      placeholder="Search name, mobile, or address..."
                      value={searchCust}
                      onChange={(e) => {
                        setSearchCust(e.target.value);
                        const match = customers.find(c => c.mobile === e.target.value || (c as any).phone === e.target.value || c.name.toLowerCase() === e.target.value.toLowerCase() || (c.address || "").toLowerCase().includes(e.target.value.toLowerCase()));
                        if (match) setForm({ ...form, customerName: match.name, customerMobile: match.mobile || (match as any).phone || "", customerAddress: match.address || "" });
                      }}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Customer *</Label>
                    <Select value={form.customerMobile || form.customerName || ""} onValueChange={(val) => {
                      if (val === "NEW") {
                        setForm({ ...form, customerMobile: "NEW", customerName: "", customerAddress: "" });
                      } else {
                        const match = customers.find(c => (c.mobile || (c as any).phone || c.name) === val);
                        if (match) setForm({ ...form, customerName: match.name, customerMobile: match.mobile || (match as any).phone || "", customerAddress: match.address || "" });
                      }
                    }}>
                      <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NEW" className="font-semibold text-primary">+ Create New Customer</SelectItem>
                        {customers.filter(c => c.name.toLowerCase().includes(debouncedSearchCust.toLowerCase()) || (c.mobile || (c as any).phone || "").includes(debouncedSearchCust) || (c.address || "").toLowerCase().includes(debouncedSearchCust.toLowerCase())).sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((c) => (
                          <SelectItem key={c._id || c.id} value={c.mobile || (c as any).phone || c.name}>{c.name} {c.mobile || (c as any).phone ? `· ${c.mobile || (c as any).phone}` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {form.customerMobile === "NEW" && (
                  <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-sm space-y-3 col-span-2">
                    <div className="space-y-1.5"><Label className="text-xs">Full Name *</Label><Input value={newCust.name} onChange={e => setNewCust({ ...newCust, name: e.target.value })} className="h-8 bg-background" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Mobile No (optional)</Label><Input value={newCust.phone} onChange={e => setNewCust({ ...newCust, phone: e.target.value })} className="h-8 bg-background" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Mobile No 2 (optional)</Label><Input value={newCust.phone2} onChange={e => setNewCust({ ...newCust, phone2: e.target.value })} className="h-8 bg-background" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Address *</Label><Input value={newCust.address} onChange={e => setNewCust({ ...newCust, address: e.target.value })} className="h-8 bg-background" /></div>
                  </div>
                )}

                <div className="col-span-2">
                  <Field label="Customer Address" v={form.customerAddress || ""} on={(v) => setForm({ ...form, customerAddress: v })} />
                </div>

                {/* Metal & Purity */}
                <div>
                  <Label className="text-xs">Metal Type</Label>
                  <Select value={form.metal || "Gold"} onValueChange={(val: any) => setForm({ ...form, metal: val })}>
                    <SelectTrigger className="h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Gold">Gold</SelectItem>
                      <SelectItem value="Silver">Silver</SelectItem>
                      <SelectItem value="Diamond">Diamond</SelectItem>
                      <SelectItem value="Platinum">Platinum</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Field label="Purity (e.g. 22K 916)" v={form.purity || "22K (916)"} on={(v) => setForm({ ...form, purity: v })} />

                {/* Description & Problem */}
                <div className="col-span-2">
                  <Field label="Item Description / Title *" v={form.itemDescription} on={(v) => setForm({ ...form, itemDescription: v })} />
                </div>

                <div className="col-span-2">
                  <Field label="Repair Problem / Work Required *" v={form.problem} on={(v) => setForm({ ...form, problem: v })} />
                </div>

                {/* WEIGHT AUDIT TRACKING */}
                <div className="col-span-2 p-3 bg-amber-500/5 rounded-lg border border-amber-500/20 space-y-2">
                  <Label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-amber-600" /> Jewellery Weight Audit (g)
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Received Wt (g) *" type="number" v={String(form.receivedWeight || form.itemWeight || 0)} on={(v) => setForm({ ...form, receivedWeight: +v, itemWeight: +v })} />
                    <Field label="Delivered Wt (g)" type="number" v={String(form.deliveredWeight || 0)} on={(v) => setForm({ ...form, deliveredWeight: +v })} />
                    <Field label="Gold Added Wt (g)" type="number" v={String(form.goldAddedWeight || 0)} on={(v) => setForm({ ...form, goldAddedWeight: +v })} />
                  </div>
                </div>

                {/* FINANCIALS */}
                <Field label="Estimated Cost ₹" type="number" v={String(form.estimatedCost || form.estimate || 0)} on={(v) => setForm({ ...form, estimatedCost: +v, estimate: +v })} />
                <Field label="Actual Repair Cost ₹" type="number" v={String(form.actualCost || form.estimatedCost || 0)} on={(v) => setForm({ ...form, actualCost: +v })} />
                <Field label="Advance Paid ₹" type="number" v={String(form.advance || 0)} on={(v) => setForm({ ...form, advance: +v })} />
                <Field label="Karigar Labour Fee ₹" type="number" v={String(form.karigarLabourCharge || 0)} on={(v) => setForm({ ...form, karigarLabourCharge: +v })} />

                <Field label="Intake Date" type="date" v={form.date} on={(v) => setForm({ ...form, date: v })} />
                <Field label="Expected Delivery Date" type="date" v={form.deliveryDate || ""} on={(v) => setForm({ ...form, deliveryDate: v })} />

                {/* KARIGAR SELECTION */}
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Search Karigar</Label>
                    <Input placeholder="Search name, mobile, address..." value={searchKar} onChange={e => {
                      setSearchKar(e.target.value);
                      const match = karigars.find(k => k.name.toLowerCase() === e.target.value.toLowerCase() || (k.mobile || "").includes(e.target.value) || (k.address || "").toLowerCase().includes(e.target.value.toLowerCase()));
                      if (match) setForm({ ...form, karigarId: match._id || match.id });
                    }} className="h-8 text-xs bg-background" />
                  </div>
                  <div>
                    <Label className="text-xs">Karigar Assigned</Label>
                    <Select value={form.karigarId || ""} onValueChange={val => setForm({ ...form, karigarId: val })}>
                      <SelectTrigger className="h-8 text-xs bg-background"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {karigars.filter(k => k.name.toLowerCase().includes(debouncedSearchKar.toLowerCase()) || (k.mobile || "").includes(debouncedSearchKar) || (k.address || "").toLowerCase().includes(debouncedSearchKar.toLowerCase())).sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(k => (
                          <SelectItem key={k._id || k.id} value={k._id || k.id}>{k.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* ITEM DAMAGE REFERENCE PHOTO */}
                <div className="col-span-2 p-3 bg-muted/40 rounded-lg border space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-primary" /> Item Damage Photo (Initial Condition)
                  </Label>
                  <Input type="file" accept="image/*" className="bg-background h-8 text-xs" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => setForm({ ...form, beforePhotoUrl: reader.result as string });
                      reader.readAsDataURL(file);
                    }
                  }} />
                  {form.beforePhotoUrl && <img src={form.beforePhotoUrl} alt="Damaged Item" className="h-20 rounded border object-contain" />}
                </div>

                <div className="col-span-2">
                  <Field label="Special Repair Notes" v={form.note || ""} on={(v) => setForm({ ...form, note: v })} />
                </div>

                {/* SIGNATURES */}
                <div className="col-span-2 bg-muted/40 p-3 rounded-lg border border-border">
                  <Label className="text-muted-foreground font-normal block mb-2 text-xs">Signatures (Optional)</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Customer Signature</Label>
                      <Input type="file" accept="image/*" className="bg-background h-8 text-xs mt-1" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => setForm({ ...form, customerSignature: reader.result as string });
                          reader.readAsDataURL(file);
                        }
                      }} />
                      {form.customerSignature && <img src={form.customerSignature} alt="Customer Signature" className="mt-1 h-12 object-contain" />}
                    </div>
                    <div>
                      <Label className="text-xs">Authorized Signatory</Label>
                      <Input type="file" accept="image/*" className="bg-background h-8 text-xs mt-1" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => setForm({ ...form, authorizedSignatory: reader.result as string });
                          reader.readAsDataURL(file);
                        }
                      }} />
                      {form.authorizedSignatory && <img src={form.authorizedSignatory} alt="Authorized Signatory" className="mt-1 h-12 object-contain" />}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} className="bg-primary text-white">
                  {editingId ? "Update Repair Ticket" : "Create Repair Ticket"}
                </Button>
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

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  const [focused, setFocused] = useState(false);
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    if (type === "number") e.target.select();
  };
  const handleBlur = () => setFocused(false);

  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={type === "number" && v === "0" && !focused ? "" : v}
        onChange={(e) => on(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="mt-1 h-8 text-xs bg-background"
      />
    </div>
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
