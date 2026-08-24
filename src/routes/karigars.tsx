import { useState } from "react";
import { useFormKeyboardNav } from "@/lib/useFormKeyboardNav";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Search, Loader2, User, KeyRound, Eye, EyeOff, Wrench, ShoppingBag, Hammer, Sparkles } from "lucide-react";
import { useLocalState, type Karigar, type Repair, type Order } from "@/lib/storage";
import { useDebounce, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useTenantAPI } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function Field({
  label,
  v,
  on,
  type = "text",
  autoComplete,
}: {
  label: string;
  v: string;
  on: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={v}
        onChange={(e) => on(e.target.value)}
        autoComplete={autoComplete}
      />
    </div>
  );
}

export default function KarigarsPage() {
  const api = useTenantAPI();
  const queryClient = useQueryClient();

  const useApiMutation = (
    mutationFn: (...args: any[]) => Promise<any>,
    queryKey: string[]
  ) => {
    return useMutation({
      mutationFn,
      onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });
  };

  const { data: list = [], isLoading, error } = useQuery<Karigar[]>({
    queryKey: ["karigars"],
    queryFn: api.karigars.getAll,
  });

  const { data: repairs = [] } = useQuery<Repair[]>({
    queryKey: ["repairs"],
    queryFn: api.repairs.getAll,
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: api.orders.getAll,
  });

  const createMutation = useApiMutation(
    (data: Karigar) => api.karigars.create(data),
    ["karigars"]
  );
  const updateMutation = useApiMutation(
    (data: { id: string; body: Karigar }) => api.karigars.update(data.id, data.body),
    ["karigars"]
  );
  const deleteMutation = useApiMutation(
    (id: string) => api.karigars.remove(id),
    ["karigars"]
  );

  const [open, setOpen] = useState(false);
  const [viewingKarigar, setViewingKarigar] = useState<Karigar | null>(null);
  const [showFormPass, setShowFormPass] = useState(false);
  const [showViewPass, setShowViewPass] = useState(false);
  const [tablePassVisible, setTablePassVisible] = useState<Record<string, boolean>>({});

  const empty: Karigar = {
    id: "",
    name: "",
    mobile: "",
    specialty: "",
    username: "",
    password: "",
    pendingWeight: 0,
    createdAt: "",
  };

  const [form, setForm] = useState<Karigar>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);

  const [page, setPage] = useState(1);

  const [categories] = useLocalState<string[]>(
    "ajms.karigarCategories",
    ["Goldsmith", "Polisher", "Stone Setter"]
  );

  const [specialties, setSpecialties] = useLocalState<string[]>(
    "ajms.karigarSpecialties",
    [
      "Goldsmith",
      "Polisher",
      "Stone Setter",
      "Diamond Setter",
      "Caster",
      "Chain Maker",
      "Engraver",
      "Repair Specialist",
      "Meenakari",
      "Jadau",
      "General",
    ]
  );
  const [addSpecOpen, setAddSpecOpen] = useState(false);
  const [newSpec, setNewSpec] = useState("");

  const addSpecialty = () => {
    const s = newSpec.trim();
    if (!s) return;
    if (!specialties.includes(s)) setSpecialties((p) => [...p, s]);
    setForm((d) => ({ ...d, specialty: s }));
    setNewSpec("");
    setAddSpecOpen(false);
    toast.success(`Added custom specialty "${s}"`);
  };

  const save = async () => {
    if (!form.name || !form.mobile) {
      toast.error("Name and mobile are required");
      return;
    }

    if (form.username?.trim()) {
      const existingKarigar = list.find((k) => (k._id || k.id) === editingId);
      const hasExistingLogin = Boolean(existingKarigar?.username);
      if (!hasExistingLogin && (!form.password || form.password.trim().length < 6)) {
        toast.error("Password (at least 6 characters) is required to enable Karigar Portal Login.");
        return;
      }
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: form });
        toast.success("Karigar updated successfully");
      } else {
        await createMutation.mutateAsync(form);
        toast.success("Karigar created successfully");
      }
      setForm(empty);
      setEditingId(null);
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save karigar");
    }
  };

  const handleKeyNav = useFormKeyboardNav(save);

  const remove = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Karigar deleted successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete karigar");
    }
  };

  const filtered = list
    .filter((s: Karigar) =>
      s.name.toLowerCase().includes(debouncedQ.toLowerCase()) ||
      s.mobile.includes(debouncedQ) ||
      (s.specialty || "").toLowerCase().includes(debouncedQ.toLowerCase()) ||
      (s.address || "").toLowerCase().includes(debouncedQ.toLowerCase())
    )
    .sort((a: Karigar, b: Karigar) => (a.name || "").localeCompare(b.name || ""));

  const isLoading_UI =
    isLoading || createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const totalPages = Math.ceil(filtered.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  const totalKarigars = list.length;
  const activeLogins = list.filter((k) => Boolean(k.username)).length;
  const totalPendingWeight = list.reduce((acc, k) => acc + (k.pendingWeight || 0), 0);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header & Primary Action */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-6 rounded-2xl text-white shadow-lg mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Hammer className="w-3.5 h-3.5" /> Craftsman &amp; Artisan Directory
              </span>
              <span className="text-xs text-slate-300">{totalKarigars} Craftsmen Registered</span>
            </div>
            <h1 className="text-3xl font-display font-bold">Karigars Directory</h1>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Manage craftsman profiles, specialty categories, metal ledgers &amp; portal login credentials.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                data-new-button="true"
                size="lg"
                className="bg-amber-800 hover:bg-amber-900 text-white font-medium shadow-sm w-full md:w-auto"
                onClick={() => {
                  setForm(empty);
                  setEditingId(null);
                }}
                disabled={isLoading_UI}
              >
                <Plus className="w-4 h-4 mr-2" /> Add New Karigar
              </Button>
            </DialogTrigger>

            <DialogContent
              className="w-[95vw] sm:max-w-2xl max-h-[92vh] overflow-y-auto p-0 border border-rose-300 dark:border-rose-950 bg-background shadow-2xl rounded-xl"
              onInteractOutside={(e) => e.preventDefault()}
              onKeyDown={handleKeyNav}
            >
              <DialogHeader className="p-3.5 sm:p-4 bg-rose-100/80 dark:bg-slate-900 border-b border-rose-300 dark:border-rose-950 flex items-center justify-between">
                <DialogTitle className="text-base sm:text-lg font-bold font-sans text-rose-950 dark:text-rose-100 uppercase tracking-wide flex items-center gap-2">
                  <Hammer className="w-5 h-5 text-rose-700 dark:text-rose-400" />
                  <span>{editingId ? "Edit Karigar Master" : "New Karigar Master"}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="p-4 sm:p-6">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Karigar Name *"
                  v={form.name}
                  on={(v) => setForm({ ...form, name: v })}
                  autoComplete="off"
                />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">Specialty</Label>
                    <button
                      type="button"
                      onClick={() => setAddSpecOpen(true)}
                      className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Custom
                    </button>
                  </div>
                  <Select
                    value={form.specialty || ""}
                    onValueChange={(v) => {
                      if (v === "ADD_NEW_SPECIALTY") {
                        setAddSpecOpen(true);
                      } else {
                        setForm({ ...form, specialty: v });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full bg-background">
                      <SelectValue placeholder="Select specialty" />
                    </SelectTrigger>
                    <SelectContent>
                      {specialties
                        .filter((s) => s && s.trim() !== "")
                        .map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      {form.specialty && !specialties.includes(form.specialty) && (
                        <SelectItem value={form.specialty}>{form.specialty}</SelectItem>
                      )}
                      <SelectItem value="ADD_NEW_SPECIALTY" className="font-semibold text-primary">
                        + Add Custom Specialty...
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Dialog open={addSpecOpen} onOpenChange={setAddSpecOpen}>
                    <DialogContent
                      className="w-[90vw] sm:max-w-md max-h-[60vh] overflow-y-auto p-4"
                      onInteractOutside={(e) => e.preventDefault()}
                    >
                      <DialogHeader>
                        <DialogTitle>Add Custom Specialty</DialogTitle>
                        <DialogDescription>
                          Add a new specialty option for your karigars.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-2">
                        <Label className="text-xs font-medium">Specialty Name</Label>
                        <Input
                          value={newSpec}
                          onChange={(e) => setNewSpec(e.target.value)}
                          placeholder="e.g. Meenakari, Laser Soldering, Jadau"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addSpecialty();
                            }
                          }}
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAddSpecOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={addSpecialty}>Add Specialty</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                <Field
                  label="Mobile No *"
                  v={form.mobile}
                  on={(v) => setForm({ ...form, mobile: v })}
                  autoComplete="off"
                />

                <div className="col-span-1 sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1 p-3 bg-muted/30 rounded-md border border-border">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Category</Label>
                    <Select
                      value={form.category || ""}
                      onValueChange={(v) => setForm({ ...form, category: v })}
                    >
                      <SelectTrigger className="w-full bg-background">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories
                          .filter((c) => c && c.trim() !== "")
                          .map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Field
                    label="Pending Weight (g)"
                    type="number"
                    v={String(form.pendingWeight)}
                    on={(v) => setForm({ ...form, pendingWeight: +v })}
                  />
                </div>

                <div className="col-span-1 sm:col-span-2 space-y-3">
                  <Field
                    label="Address"
                    v={form.address || ""}
                    on={(v) => setForm({ ...form, address: v })}
                  />
                </div>

                {/* Login Credentials for Karigar Portal */}
                <div className="col-span-1 sm:col-span-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wider">
                    <KeyRound className="w-4 h-4 text-amber-600" /> Karigar Portal Login Credentials
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field
                      label="Username (Login ID)"
                      v={form.username || ""}
                      on={(v) => setForm({ ...form, username: v })}
                      autoComplete="off"
                    />
                    <div className="space-y-1">
                      <label className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {editingId && list.find((k) => (k._id || k.id) === editingId)?.username
                          ? "New Password (leave blank to keep current)"
                          : "Password * (min 6 chars)"}
                      </label>
                      <div className="relative">
                        <Input
                          type={showFormPass ? "text" : "password"}
                          value={form.password || ""}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowFormPass(!showFormPass)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                          title={showFormPass ? "Hide password" : "Show password"}
                        >
                          {showFormPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-amber-600" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Karigar can log in using this Username & Password at the Shop Sign In screen to access their assigned work and task dashboard.
                  </p>
                </div>
              </div>

              <DialogFooter className="mt-4 gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading_UI}>
                  Cancel
                </Button>
                <Button
                  onClick={save}
                  disabled={isLoading_UI || !form.name || !form.mobile}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isLoading_UI ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save Karigar"
                  )}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
          </Dialog>
        </header>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border shadow-sm bg-card hover:shadow-md transition-all">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Karigars</div>
                <div className="text-2xl font-bold font-display text-indigo-600 mt-1">{totalKarigars}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Active Craftsmen</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 grid place-items-center">
                <Hammer className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-card hover:shadow-md transition-all">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Portal Logins</div>
                <div className="text-2xl font-bold font-display text-amber-600 mt-1">
                  {activeLogins} <span className="text-xs font-normal text-muted-foreground">({Math.round((activeLogins / (totalKarigars || 1)) * 100)}% active)</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Assigned Credentials</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 grid place-items-center">
                <KeyRound className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-card hover:shadow-md transition-all">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Pending Weight</div>
                <div className="text-2xl font-bold font-display text-amber-700 dark:text-amber-300 mt-1">{totalPendingWeight.toFixed(2)} g</div>
                <div className="text-xs text-muted-foreground mt-0.5">Unsettled Job Work</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 grid place-items-center">
                <Sparkles className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Counter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 bg-background"
              placeholder="Search by name, mobile, specialty, or username..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              name="search-karigars-query"
              autoComplete="off"
            />
          </div>
          <div className="text-xs text-muted-foreground self-end sm:self-center font-medium">
            Showing {paginated.length} of {filtered.length} karigars
          </div>
        </div>

        {/* Content Section: Desktop Table + Mobile Cards */}
        {isLoading ? (
          <p className="text-center text-muted-foreground py-12">Loading karigars...</p>
        ) : error ? (
          <p className="text-center text-red-500 py-12">Failed to load karigars</p>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 border border-dashed rounded-lg bg-muted/10">
            <Hammer className="w-10 h-10 mx-auto mb-2 opacity-40 text-amber-600" />
            <p className="font-medium text-base">No karigars found.</p>
            <p className="text-xs text-muted-foreground mt-1">Click "Add New Karigar" to create your first craftsman profile.</p>
          </div>
        ) : (
          <>
            {/* Mobile / Tablet Cards View */}
            <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {paginated.map((s) => (
                <Card key={s._id || s.id} className="p-4 space-y-3 relative hover:shadow-md transition-shadow border-border">
                  <div className="flex items-start justify-between gap-2 border-b pb-2.5">
                    <div>
                      <h3 className="font-bold text-base text-foreground font-display flex items-center gap-1.5">
                        <Hammer className="w-4 h-4 text-amber-600" /> {s.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {s.specialty && (
                          <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                            {s.specialty}
                          </span>
                        )}
                        {s.category && (
                          <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                            {s.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Pending Wt</span>
                      <span className="text-sm font-bold text-amber-900 font-display">{(s.pendingWeight || 0).toFixed(2)} g</span>
                    </div>
                  </div>

                  {/* Login Credentials Box */}
                  <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-md text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-800 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-amber-600" /> ID: {s.username || "No login set"}
                      </span>
                      {s.password && (
                        <button
                          type="button"
                          className="text-xs text-amber-700 hover:underline flex items-center gap-1 font-medium"
                          onClick={() =>
                            setTablePassVisible((prev) => ({
                              ...prev,
                              [s._id || s.id]: !prev[s._id || s.id],
                            }))
                          }
                        >
                          {tablePassVisible[s._id || s.id] ? (
                            <>
                              <EyeOff className="w-3 h-3" /> Hide
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" /> Show Pass
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    {s.password && (
                      <div className="text-muted-foreground font-mono text-[11px] pt-0.5">
                        Pass: <span className="font-bold text-foreground">{tablePassVisible[s._id || s.id] ? s.password : "••••••••"}</span>
                      </div>
                    )}
                  </div>

                  {/* Contact Details */}
                  <div className="text-xs text-muted-foreground space-y-0.5 pt-0.5">
                    <div><strong>Mobile:</strong> {s.mobile || "—"}</div>
                    {s.address && <div className="truncate"><strong>Address:</strong> {s.address}</div>}
                  </div>

                  {/* Mobile Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2.5 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1"
                      onClick={() => setViewingKarigar(s)}
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" /> Details
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1"
                      onClick={() => {
                        setForm({ ...s, password: s.password || "" });
                        setEditingId(s._id || null);
                        setOpen(true);
                      }}
                      disabled={isLoading_UI}
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => remove(s._id || "")}
                      disabled={isLoading_UI}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop Table View */}
            <Card className="hidden md:block border shadow-sm overflow-hidden bg-card">
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[600px] relative">
                  <table className="w-full text-sm min-w-[950px] border-collapse">
                    <thead className="text-left text-xs font-bold uppercase tracking-wider sticky top-0 bg-slate-900 text-slate-200 z-10 shadow-sm">
                      <tr>
                        <th className="p-3.5 pl-5 whitespace-nowrap">Name</th>
                        <th className="p-3.5 whitespace-nowrap">Login ID</th>
                        <th className="p-3.5 whitespace-nowrap">Mobile</th>
                        <th className="p-3.5 whitespace-nowrap">Specialty</th>
                        <th className="p-3.5 whitespace-nowrap">Category</th>
                        <th className="p-3.5 whitespace-nowrap">Address</th>
                        <th className="p-3.5 text-right whitespace-nowrap">Pending Wt</th>
                        <th className="p-3.5 text-right pr-5 whitespace-nowrap w-36">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 bg-card">
                      {paginated.map((s, idx) => {
                        const initials = (s.name || "K").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                        const colors = ["bg-amber-600", "bg-indigo-600", "bg-emerald-600", "bg-purple-600", "bg-blue-600"];
                        const avatarBg = colors[idx % colors.length];

                        return (
                          <tr key={s._id || s.id} className="group hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-all">
                            <td className="p-3.5 pl-5">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full ${avatarBg} text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0`}>
                                  {initials}
                                </div>
                                <div className="font-bold text-foreground text-sm group-hover:text-amber-900 dark:group-hover:text-amber-300 transition-colors">
                                  {s.name}
                                </div>
                              </div>
                            </td>
                            <td className="p-3.5">
                              {s.username ? (
                                <div className="inline-flex flex-col gap-1 p-2 rounded-lg bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/25 max-w-[200px]">
                                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-900 dark:text-amber-300">
                                    <User className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>ID: {s.username}</span>
                                  </div>
                                  {s.password && (
                                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-600 dark:text-slate-400 border-t border-amber-500/20 pt-1">
                                      <div className="flex items-center gap-1">
                                        <KeyRound className="w-3 h-3 text-amber-600 shrink-0" />
                                        <span className="font-semibold text-foreground font-mono">{tablePassVisible[s._id || s.id] ? s.password : "••••••••"}</span>
                                      </div>
                                      <button
                                        type="button"
                                        className="text-muted-foreground hover:text-amber-800 dark:hover:text-amber-300 transition-colors p-0.5"
                                        onClick={() =>
                                          setTablePassVisible((prev) => ({
                                            ...prev,
                                            [s._id || s.id]: !prev[s._id || s.id],
                                          }))
                                        }
                                        title={tablePassVisible[s._id || s.id] ? "Hide password" : "Show password"}
                                      >
                                        {tablePassVisible[s._id || s.id] ? (
                                          <EyeOff className="w-3.5 h-3.5" />
                                        ) : (
                                          <Eye className="w-3.5 h-3.5 text-amber-600" />
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">No Login Credentials</span>
                              )}
                            </td>
                            <td className="p-3.5 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">{s.mobile}</td>
                            <td className="p-3.5">
                              {s.specialty ? (
                                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-2xs">
                                  {s.specialty}
                                </Badge>
                              ) : "—"}
                            </td>
                            <td className="p-3.5">
                              {s.category ? (
                                <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 text-slate-800 px-2.5 py-0.5 text-xs font-semibold">
                                  {s.category}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="p-3.5 text-muted-foreground max-w-[180px] truncate" title={s.address}>
                              {s.address || "—"}
                            </td>
                            <td className="p-3.5 text-right">
                              <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-3 py-1 font-mono font-bold text-xs rounded-full shadow-2xs">
                                {(s.pendingWeight || 0).toFixed(2)} g
                              </span>
                            </td>
                            <td className="p-3.5 text-right pr-5">
                              <div className="flex gap-1.5 justify-end">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                                  title="View All Details & Workload"
                                  onClick={() => setViewingKarigar(s)}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 text-slate-700 hover:bg-slate-100"
                                  title="Edit Karigar"
                                  onClick={() => {
                                    setForm({ ...s, password: s.password || "" });
                                    setEditingId(s._id || null);
                                    setOpen(true);
                                  }}
                                  disabled={isLoading_UI}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 border-rose-200 text-rose-600 hover:bg-rose-50"
                                  title="Delete Karigar"
                                  onClick={() => remove((s._id || ""))}
                                  disabled={isLoading_UI}
                                >
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
              </CardContent>
            </Card>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-2">
                <div className="text-xs text-muted-foreground">
                  Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, filtered.length)} of {filtered.length} entries
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Karigar Full Details & Workload Modal */}
      <Dialog open={!!viewingKarigar} onOpenChange={(v) => !v && setViewingKarigar(null)}>
        <DialogContent className="fixed inset-0 z-[100] w-screen h-screen max-w-none max-h-none translate-x-0 translate-y-0 top-0 left-0 rounded-none border-0 p-3 sm:p-5 bg-neutral-50 dark:bg-slate-950 flex flex-col overflow-y-auto shadow-none" onInteractOutside={(e) => e.preventDefault()}>
          {viewingKarigar && (() => {
            const kId = viewingKarigar._id || viewingKarigar.id;
            const kName = viewingKarigar.name || "";

            const karigarRepairs = repairs.filter(r =>
              r.karigarId === kId || (kName && r.note?.includes(`[Assigned: ${kName}]`)) || ((r as any).karigarName && (r as any).karigarName.toLowerCase() === kName.toLowerCase())
            );

            const karigarOrders = orders.filter(o =>
              o.karigarId === kId || (kName && o.note?.includes(`[Assigned: ${kName}]`)) || ((o as any).karigarName && (o as any).karigarName.toLowerCase() === kName.toLowerCase())
            );

            const activeRepairs = karigarRepairs.filter(r => r.status !== "Delivered");
            const activeOrders = karigarOrders.filter(o => o.status !== "Delivered" && o.status !== "Cancelled");
            const repairsWeight = activeRepairs.reduce((sum, r) => sum + (Number(r.itemWeight) || 0), 0);

            return (
              <>
                <DialogHeader className="border-b pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <DialogTitle className="text-2xl font-display flex items-center gap-2">
                        <Hammer className="w-6 h-6 text-amber-600" /> {viewingKarigar.name}
                      </DialogTitle>
                      <DialogDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {viewingKarigar.specialty && (
                          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold">
                            Specialty: {viewingKarigar.specialty}
                          </span>
                        )}
                        {viewingKarigar.category && (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                            Category: {viewingKarigar.category}
                          </span>
                        )}
                        {viewingKarigar.username && (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                            <User className="w-3 h-3" /> Login ID: {viewingKarigar.username}
                          </span>
                        )}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                  {/* Key Metrics Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
                      <div className="text-[11px] text-amber-800 font-semibold uppercase tracking-wider">Pending Weight</div>
                      <div className="text-2xl font-bold font-display text-amber-900 mt-0.5">{(viewingKarigar.pendingWeight || 0).toFixed(2)} g</div>
                    </div>
                    <div className="bg-muted/40 border p-3 rounded-lg">
                      <div className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Active Repairs</div>
                      <div className="text-2xl font-bold font-display text-foreground mt-0.5">{activeRepairs.length} <span className="text-xs font-normal text-muted-foreground">({karigarRepairs.length} total)</span></div>
                    </div>
                    <div className="bg-muted/40 border p-3 rounded-lg">
                      <div className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Active Orders</div>
                      <div className="text-2xl font-bold font-display text-foreground mt-0.5">{activeOrders.length} <span className="text-xs font-normal text-muted-foreground">({karigarOrders.length} total)</span></div>
                    </div>
                    <div className="bg-muted/40 border p-3 rounded-lg">
                      <div className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Repairs Weight</div>
                      <div className="text-2xl font-bold font-display text-foreground mt-0.5">{repairsWeight.toFixed(2)} g</div>
                    </div>
                  </div>

                  {/* Karigar Portal Login Credentials Card */}
                  <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wider">
                      <KeyRound className="w-4 h-4 text-amber-600" /> Karigar Portal Access Credentials
                    </div>
                    {viewingKarigar.username ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <div className="bg-background p-3 rounded border text-sm">
                          <span className="text-xs text-muted-foreground block font-medium">Username (Login ID)</span>
                          <span className="font-bold text-foreground font-mono text-base">{viewingKarigar.username}</span>
                        </div>
                        <div className="bg-background p-3 rounded border text-sm flex items-center justify-between">
                          <div>
                            <span className="text-xs text-muted-foreground block font-medium">Password</span>
                            <span className="font-bold text-amber-700 font-mono text-base">
                              {showViewPass ? (viewingKarigar.password || "••••••••") : "••••••••"}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
                            onClick={() => setShowViewPass(!showViewPass)}
                          >
                            {showViewPass ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" /> Hide
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5 text-amber-600" /> Show Eye
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No login account created yet for this Karigar.</p>
                    )}
                  </div>

                  {/* Profile Info Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-muted/20 p-4 rounded-lg border">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block uppercase mb-1">Contact Details</span>
                      <div className="space-y-1">
                        <div><strong>Mobile:</strong> {viewingKarigar.mobile || "—"}</div>
                        <div><strong>Address:</strong> {viewingKarigar.address || "—"}</div>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block uppercase mb-1">Company & Notes</span>
                      <div className="space-y-1">
                        <div><strong>Company:</strong> {viewingKarigar.companyName || "—"}</div>
                        <div><strong>Note / Remarks:</strong> {viewingKarigar.note || "—"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Repairs Ledger Table */}
                  <div className="space-y-2">
                    <h3 className="font-display font-semibold text-base flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-primary" /> Assigned Repairs ({karigarRepairs.length})
                    </h3>
                    {karigarRepairs.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-3 text-center bg-muted/10 rounded border border-dashed">No repairs assigned to this karigar.</p>
                    ) : (
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted/40 text-muted-foreground uppercase border-b">
                            <tr>
                              <th className="py-2 px-3">Ticket #</th>
                              <th>Date</th>
                              <th>Customer</th>
                              <th>Item & Problem</th>
                              <th>Weight</th>
                              <th>Due Date</th>
                              <th className="px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {karigarRepairs.map((r) => (
                              <tr key={r._id || r.id} className="border-b last:border-0 hover:bg-muted/20">
                                <td className="py-2 px-3 font-semibold text-foreground">{r.ticketNo}</td>
                                <td>{formatDate(r.date)}</td>
                                <td>{r.customerName}</td>
                                <td>
                                  <div className="font-medium text-foreground">{r.itemDescription}</div>
                                  <div className="text-rose-500">{r.problem}</div>
                                </td>
                                <td>{r.itemWeight ? `${r.itemWeight} g` : "—"}</td>
                                <td>{r.deliveryDate ? formatDate(r.deliveryDate) : "—"}</td>
                                <td className="px-3 py-1.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${r.status === 'Ready' ? 'bg-green-50 text-green-700 border-green-200' : r.status === 'Delivered' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                    {r.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Assigned Custom Orders Ledger Table */}
                  <div className="space-y-2">
                    <h3 className="font-display font-semibold text-base flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-primary" /> Assigned Custom Orders ({karigarOrders.length})
                    </h3>
                    {karigarOrders.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-3 text-center bg-muted/10 rounded border border-dashed">No custom orders assigned to this karigar.</p>
                    ) : (
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted/40 text-muted-foreground uppercase border-b">
                            <tr>
                              <th className="py-2 px-3">Order #</th>
                              <th>Date</th>
                              <th>Customer</th>
                              <th>Item Specs</th>
                              <th>Metal & Purity</th>
                              <th>Due Date</th>
                              <th className="px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {karigarOrders.map((o) => (
                              <tr key={o._id || o.id} className="border-b last:border-0 hover:bg-muted/20">
                                <td className="py-2 px-3 font-semibold text-foreground">{o.orderNo}</td>
                                <td>{formatDate(o.date)}</td>
                                <td>{o.customerName}</td>
                                <td className="font-medium text-foreground">{o.itemDescription}</td>
                                <td>{o.metal} {o.purity}</td>
                                <td>{o.dueDate ? formatDate(o.dueDate) : "—"}</td>
                                <td className="px-3 py-1.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${o.status === 'Ready' ? 'bg-green-50 text-green-700 border-green-200' : o.status === 'Delivered' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                    {o.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter className="pt-4 border-t">
                  <Button variant="outline" onClick={() => setViewingKarigar(null)}>Close</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

