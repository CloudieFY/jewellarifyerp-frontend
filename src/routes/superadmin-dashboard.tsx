import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Store,
  Copy,
  Check,
  Pause,
  Play,
  RefreshCw,
  Pencil,
  KeyRound,
  Trash2,
  Gem,
  User,
  Users,
  Phone,
  CalendarDays,
  MoreVertical,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { superAdminAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Shop = {
  id: string; // master DB ObjectId as string (set by backend toJSON)
  _id: string; // The raw _id from MongoDB
  slug: string;

  shopName: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  plan: string;
  status: "active" | "suspended" | "expired";
  subscriptionStartDate: string;
  subscriptionEndDate: string;
  dbName: string;
  userCount?: number;
  initialAdminUsername?: string;
  initialOperatorUsername?: string;
  createdAt: string;
};

const emptyForm = {
  slug: "",
  shopName: "",
  ownerName: "",
  email: "",
  phone: "",
  logoUrl: "",
  address: "",
  gstNumber: "",
  plan: "trial",
  subscriptionEndDate: "",
  gstAdminUsername: "owner",
  gstAdminPassword: "",
  nonGstAdminUsername: "operator",
  nonGstAdminPassword: "",
};

export default function SuperAdminDashboardPage() {
  const { superAdminSession } = useAuth();
  const navigate = useNavigate();

  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false); // For editing existing shop
  const [form, setForm] = useState({ ...emptyForm });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [credentialsResult, setCredentialsResult] = useState<{
    loginId: string; // shop slug
    credentials: Array<{ label: string; username: string; password: string }>;
    shopName: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [shopsPage, setShopsPage] = useState(1);
  const [editingShop, setEditingShop] = useState<Shop | null>(null); // For pre-populating edit form
  const [revealedPasswords, setRevealedPasswords] = useState<{ owner?: string; operator?: string }>({});
  const [revealingRole, setRevealingRole] = useState<'owner' | 'operator' | null>(null);
  const [renewTarget, setRenewTarget] = useState<Shop | null>(null);
  const [renewDate, setRenewDate] = useState("");
  
  const [resetUserTarget, setResetUserTarget] = useState<{ shop: Shop, userRole: 'owner' | 'operator' } | null>(null);
  const [resetUserPasswordForm, setResetUserPasswordForm] = useState({
    username: '',
    role: '',
    newPassword: '',
    generatedPassword: '',
  });

  useEffect(() => {
    console.log("[SuperAdminDashboard] session", {
      hasSession: !!superAdminSession,
      adminName: superAdminSession?.admin?.name,
    });
    if (!superAdminSession) {
      navigate("/superadmin/login");
      return;
    }
    loadShops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [superAdminSession]);

  // Defensive: if API is unreachable or throws, show something instead of a blank screen.
  // This avoids the “white page” symptom when backend URL/CORS is misconfigured.
  // (We keep the existing toast behavior in api.ts for non-200 responses.)


  async function loadShops() {
    setIsLoading(true);
    try {
      console.log("[SuperAdminDashboard] loadShops start");
      const data = await superAdminAPI.shops.getAll();
      console.log("[SuperAdminDashboard] loadShops success", { count: data?.length });
      setShops(data);
    } catch (err: any) {
      console.error("[SuperAdminDashboard] loadShops failed", err);
      // Show a visible error rather than leaving the page blank.
      toast.error(err?.message || "Failed to load shops");
      setShops([]);
    } finally {
      setIsLoading(false);
    }
  }

  const handleLogoUpload = (file?: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 300;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/webp", 0.8);
        setForm(prev => ({ ...prev, logoUrl: compressed }));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  async function handleCreateShop(e: React.FormEvent) {
    e.preventDefault();
    console.log("[SuperAdminDashboard] createShop submit", {
      // Added for better debugging in the console
      gstAdminUsername: form.gstAdminUsername,
      nonGstAdminUsername: form.nonGstAdminUsername,
      // End debugging additions

      shopName: form.shopName,
      slug: form.slug,
      plan: form.plan,
    });
    setIsSubmitting(true);
    // Client-side validation to prevent identical usernames
    if (form.gstAdminUsername.toLowerCase().trim() === form.nonGstAdminUsername.toLowerCase().trim()) {
      toast.error('GST Owner and Non-GST Operator usernames must be different.');
      setIsSubmitting(false); // Stop loading state
      return; // Prevent API call
    }
    try {
      const result = await superAdminAPI.shops.create(form);
      console.log("[SuperAdminDashboard] createShop success", {
        shopId: result.shop?.id,
        shopName: result.shop?.shopName,
      });
      toast.success(`Shop "${result.shop.shopName}" created successfully!`);
      setCredentialsResult({
        loginId: result.shop.slug,
        credentials: result.loginCredentials,
        shopName: result.shop.shopName,
      });
      setCreateOpen(false);
      setForm({ ...emptyForm });
      loadShops();
    } catch (err) {
      console.error("[SuperAdminDashboard] createShop failed", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateShop(e: React.FormEvent) {
    e.preventDefault();
    const shopId = editingShop?._id || editingShop?.id;
    if (!shopId) return;

    const requestedSlug = String(form.slug || "").trim().toLowerCase().replace(/\s+/g, '-');
    const slugChanged = requestedSlug && requestedSlug !== editingShop?.slug;

    console.log("[SuperAdminDashboard] updateShop submit", {
      shopId: editingShop.id,
      shopName: form.shopName,
      plan: form.plan,
      slugChanged,
      requestedSlug,
    });

    setIsSubmitting(true);
    try {
      // 1) Update the non-slug fields
      await superAdminAPI.shops.update(shopId, {
        shopName: form.shopName,
        ownerName: form.ownerName,
        email: form.email,
        phone: form.phone,
        logoUrl: form.logoUrl,
        address: form.address,
        gstNumber: form.gstNumber,
        plan: form.plan,
        subscriptionEndDate: form.subscriptionEndDate,
      });

      // 2) If slug changed, call dedicated endpoint
      if (slugChanged) {
        await superAdminAPI.shops.updateSlug(shopId, { slug: requestedSlug });
      }

      toast.success(`Shop "${form.shopName}" updated successfully!`);
      setEditOpen(false);
      loadShops();
    } catch (err) {
      console.error("[SuperAdminDashboard] updateShop failed", err);
      toast.error((err as Error).message || "Failed to update shop");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSuspend(shop: Shop) {
    try {
      await superAdminAPI.shops.suspend(shop.id);
      toast.success(`${shop.shopName} suspended`);
      loadShops();
    } catch (err) {
      console.error("[SuperAdminDashboard] suspend failed", err);
      toast.error((err as Error).message || `Failed to suspend ${shop.shopName}`);
    }
  }

  async function handleActivate(shop: Shop) {
    try {
      await superAdminAPI.shops.activate(shop.id);
      toast.success(`${shop.shopName} activated`);
      loadShops();
    } catch (err) {
      console.error("[SuperAdminDashboard] activate failed", err);
      toast.error((err as Error).message || `Failed to activate ${shop.shopName}`);
    }
  }

  async function handleRenew(e: React.FormEvent) {
    e.preventDefault();
    if (!renewTarget || !renewDate) return;
    try {
      await superAdminAPI.shops.renew(renewTarget.id, { newEndDate: renewDate });
      toast.success(`Subscription renewed for ${renewTarget.shopName}`);
      setRenewTarget(null);
      setRenewDate("");
      loadShops();
    } catch (err) {
      console.error("[SuperAdminDashboard] renew failed", err);
      toast.error((err as Error).message || `Failed to renew subscription for ${renewTarget.shopName}`);
    }
  }

  async function toggleRevealPassword(role: 'owner' | 'operator') {
    if (revealedPasswords[role] !== undefined) {
      // Already revealed — hide it again rather than re-fetching.
      setRevealedPasswords(prev => ({ ...prev, [role]: undefined }));
      return;
    }
    const shopId = editingShop?._id || editingShop?.id;
    if (!shopId) return;
    setRevealingRole(role);
    try {
      const result = await superAdminAPI.shops.getUserPassword(shopId, role);
      setRevealedPasswords(prev => ({ ...prev, [role]: result.password }));
    } catch (err) {
      toast.error((err as Error).message || `Failed to load ${role} password.`);
    } finally {
      setRevealingRole(null);
    }
  }

  async function handleResetUserPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUserTarget) return;
    if (resetUserPasswordForm.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    try {
      const result = await superAdminAPI.shops.resetUserPassword(resetUserTarget.shop.id, {
        username: resetUserPasswordForm.username,
        role: resetUserPasswordForm.role,
        newPassword: resetUserPasswordForm.newPassword,
      });
      toast.success(`Password reset for ${resetUserTarget.shop.shopName}`);
      setResetUserPasswordForm(prev => ({ ...prev, generatedPassword: result.newPassword }));
    } catch (err) {
      console.error(err);
      toast.error((err as Error).message || "Failed to reset password.");
    }
  }

  async function handleDelete(shop: Shop) {
    if (!window.confirm(`Delete "${shop.shopName}" from the platform registry? Their data will NOT be erased automatically.`)) return;

    // Optimistic update: remove the shop from the UI immediately.
    const originalShops = shops;
    setShops(shops.filter(s => s.id !== shop.id));

    try {
      await superAdminAPI.shops.remove(shop.id);
      toast.success(`"${shop.shopName}" has been deleted from the registry.`);
      // No need to call loadShops() on success as the UI is already updated.
    } catch (err) {
      console.error(err);
      toast.error(`Failed to delete ${shop.shopName}. Restoring view.`);
      setShops(originalShops); // Revert on error
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  function statusBadge(shop: Shop) {
    const expired = new Date(shop.subscriptionEndDate) < new Date();
    if (shop.status === "suspended") {
      return <Badge variant="destructive">Suspended</Badge>;
    }
    if (shop.status === "expired" || expired) {
      return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">Expired</Badge>;
    }
    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>;
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const filteredShops = useMemo(() => {
    return shops.filter((shop) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        (shop.shopName || "").toLowerCase().includes(q) ||
        (shop.slug || "").toLowerCase().includes(q) ||
        (shop.ownerName || "").toLowerCase().includes(q) ||
        (shop.email || "").toLowerCase().includes(q) ||
        (shop.phone || "").toLowerCase().includes(q)
      );

      const matchesPlan = planFilter === "All" || (shop.plan || "trial").toLowerCase() === planFilter.toLowerCase();
      
      const expired = new Date(shop.subscriptionEndDate) < new Date();
      const currentStatus = shop.status === "suspended" ? "suspended" : (shop.status === "expired" || expired ? "expired" : "active");
      const matchesStatus = statusFilter === "All" || currentStatus === statusFilter;

      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [shops, searchQuery, planFilter, statusFilter]);

  const estimatedMRR = useMemo(() => {
    return shops.filter(s => s.status === "active").reduce((sum, s) => {
      const plan = (s.plan || "").toLowerCase();
      if (plan.includes("enterprise")) return sum + 5999;
      if (plan.includes("pro")) return sum + 2999;
      if (plan.includes("basic")) return sum + 1499;
      return sum;
    }, 0);
  }, [shops]);

  const shopsTotalPages = Math.ceil(filteredShops.length / 9) || 1;
  const shopsCurrentPage = Math.min(shopsPage, shopsTotalPages);
  const paginatedShops = filteredShops.slice((shopsCurrentPage - 1) * 9, shopsCurrentPage * 9);

  return (
    <>
      {/* SAAS PLATFORM METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Total Onboarded Shops</CardTitle>
            <Store className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display">{shops.length}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Active Tenant Databases</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Active Subscriptions</CardTitle>
            <Play className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display text-emerald-600">
              {shops.filter(s => s.status === 'active' && new Date(s.subscriptionEndDate) >= new Date()).length}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Live Operational Shops</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Est. Monthly MRR</CardTitle>
            <Gem className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display text-purple-600">
              ₹{estimatedMRR.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Recurring Revenue</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Total Active Staff</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-display text-blue-600">
              {shops.reduce((sum, shop) => sum + (shop.userCount || 2), 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Registered Users</p>
          </CardContent>
        </Card>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Jewellery SaaS Tenants</h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Showing {filteredShops.length} of {shops.length} registered jewellery showrooms.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Input
            placeholder="Search shop, owner, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-52 h-9 text-xs bg-background"
          />

          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="h-9 text-xs w-32 bg-background">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Plans</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs w-32 bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => { setCreateOpen(true); setForm({ ...emptyForm }); }} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm h-9 text-xs">
            <Plus className="w-4 h-4 mr-1.5" /> Register New Shop
          </Button>
        </div>
      </div>

        {isLoading ? (
          <div className="text-slate-500 text-center py-16">Loading shops...</div>
        ) : shops.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-16 text-center">
              <Store className="w-12 h-12 mx-auto text-slate-400 mb-4" />
              <p className="text-slate-500">No shops yet. Create your first shop to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {paginatedShops.map((shop) => (
              <Card key={shop._id || shop.id} className="bg-card border-border hover:border-primary/20 hover:shadow-lg transition-all duration-300 flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center border">
                        <Gem className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base leading-tight font-semibold text-foreground">{shop.shopName}</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground font-mono">{shop.slug}</CardDescription>
                      </div>
                    </div>
                    {statusBadge(shop)}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-4 pt-0 text-xs">
                  <div className="grid grid-cols-2 gap-4 border-t border-b border-border py-3">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Users className="w-3 h-3"/> Total Users</span>
                      <span className="font-bold text-lg text-foreground">{shop.userCount ?? 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground flex items-center gap-1.5"><CalendarDays className="w-3 h-3"/> Expires In</span>
                      <span className="font-bold text-lg text-foreground">{(() => { const days = Math.round((new Date(shop.subscriptionEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)); return days > 0 ? `${days} days` : 'Expired'; })()}</span>
                    </div>
                  </div>
                  <div className="space-y-2 text-muted-foreground pt-3">
                    {shop.ownerName && <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-muted-foreground"/> <span className="font-medium text-foreground">{shop.ownerName}</span></div>}
                    {shop.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground"/> <span className="font-medium text-foreground">{shop.phone}</span></div>}
                    <div className="border-t pt-2 mt-2 space-y-1.5 text-xs">
                      {shop.initialAdminUsername && <p>GST Owner: <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{shop.initialAdminUsername}</span></p>}
                      {shop.initialOperatorUsername && <p>Operator: <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{shop.initialOperatorUsername}</span></p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-4 border-t border-border mt-auto">
                    <Button size="sm" variant="outline" className="border-border text-foreground hover:bg-muted" onClick={() => {
                      // Ensure we use master shop ObjectId from backend response.
                      const shopId = shop._id || shop.id;
                      if (!shopId) {
                        toast.error("Invalid shop id from server. Cannot edit.");
                        return;
                      }

                      setEditingShop(shop);
                      setRevealedPasswords({});
                      setForm({
                        ...emptyForm, // Start with empty to ensure all fields are covered
                        ...shop, // Overlay existing shop data
                        subscriptionEndDate: shop.subscriptionEndDate?.slice(0, 10) || "", // Format date for input
                      } as any);
                      setEditOpen(true);

                    }}>
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                    </Button>
                    <div className="ml-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                    {shop.status === "suspended" ? (
                            <DropdownMenuItem onClick={() => handleActivate(shop)}>
                              <Play className="w-3.5 h-3.5 mr-2" /> Activate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleSuspend(shop)}>
                              <Pause className="w-3.5 h-3.5 mr-2" /> Suspend
                            </DropdownMenuItem>
                          )}


                          <DropdownMenuItem
                            onClick={() => {
                              setRenewTarget(shop);
                              setRenewDate(shop.subscriptionEndDate?.slice(0, 10) || "");
                            }}
                          >
                            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Renew
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => {
                              setResetUserTarget({ shop, userRole: "owner" }); // Default to owner
                              setResetUserPasswordForm({
                                username: shop.initialAdminUsername || "owner",
                                role: "owner",
                                newPassword: "",
                                generatedPassword: "",
                              });
                            }}
                          >
                            <KeyRound className="w-3.5 h-3.5 mr-2" /> Reset Password
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className="text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                            onClick={() => handleDelete(shop)}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {shopsTotalPages > 1 && (
          <div className="flex items-center justify-between px-1 py-3">
            <div className="text-xs text-muted-foreground">
              Showing {(shopsCurrentPage - 1) * 10 + 1} to {Math.min(shopsCurrentPage * 10, shops.length)} of {shops.length} entries
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setShopsPage((p) => Math.max(1, p - 1))} disabled={shopsCurrentPage === 1}>Prev</Button>
              <Button size="sm" variant="outline" onClick={() => setShopsPage((p) => Math.min(shopsTotalPages, p + 1))} disabled={shopsCurrentPage === shopsTotalPages}>Next</Button>
            </div>
          </div>
        )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Shop</DialogTitle>
            <DialogDescription>
              This provisions a brand new, fully isolated database for this shop automatically.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateShop} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Shop Name *</Label>
                <Input required value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} placeholder="Arihant Jewellers" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Shop ID (slug) *</Label>
                <Input
                  required
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                  placeholder="arihant-jewellers"
                />
                <p className="text-xs text-muted-foreground">Used by the shop to log in. Lowercase, no spaces.</p>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Shop Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 bg-muted/50 rounded-md border border-dashed flex items-center justify-center">
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="Logo Preview" className="max-h-full max-w-full object-contain p-1" />
                    ) : (
                      <span className="text-xs text-muted-foreground">Preview</span>
                    )}
                  </div>
                  <Input type="file" accept="image/*" className="flex-1" onChange={(e) => handleLogoUpload(e.target.files?.[0])} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Owner Name</Label>
                <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>GST Number</Label>
                <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Subscription End Date</Label>
                <Input type="date" value={form.subscriptionEndDate} onChange={(e) => setForm({ ...form, subscriptionEndDate: e.target.value })} />
                <p className="text-xs text-muted-foreground">Leave blank for a 30-day trial.</p>
              </div>
              <div className="col-span-2 border-t pt-4 mt-2">
                <p className="text-sm font-medium mb-3">GST Owner Login (role: owner)</p>
              </div>
              <div className="space-y-1.5">
                <Label>Admin Username *</Label>
                <Input required value={form.gstAdminUsername} onChange={(e) => setForm({ ...form, gstAdminUsername: e.target.value })} placeholder="owner" />
              </div>
              <div className="space-y-1.5">
                <Label>Admin Password *</Label>
                <Input required type="text" minLength={6} value={form.gstAdminPassword} onChange={(e) => setForm({ ...form, gstAdminPassword: e.target.value })} placeholder="min. 6 characters" />
              </div>
              <div className="col-span-2 border-t pt-4 mt-2">
                <p className="text-sm font-medium mb-3">Non-GST Operator Login (role: operator)</p>
              </div>
              <div className="space-y-1.5">
                <Label>Admin Username *</Label>
                <Input required value={form.nonGstAdminUsername} onChange={(e) => setForm({ ...form, nonGstAdminUsername: e.target.value })} placeholder="operator" />
              </div>
              <div className="space-y-1.5">
                <Label>Admin Password *</Label>
                <Input required type="text" minLength={6} value={form.nonGstAdminPassword} onChange={(e) => setForm({ ...form, nonGstAdminPassword: e.target.value })} placeholder="min. 6 characters" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create Shop"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Shop Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Shop: {editingShop?.shopName}</DialogTitle>
            <DialogDescription>
              Update details for {editingShop?.shopName}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateShop} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Shop Name *</Label>
                <Input required value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} placeholder="Arihant Jewellers" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Shop ID (slug)</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="arihant-jewellers"
                />
                <p className="text-xs text-muted-foreground">Used by the shop to log in. Changing slug updates login immediately.</p>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Shop Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 bg-muted/50 rounded-md border border-dashed flex items-center justify-center">
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="Logo Preview" className="max-h-full max-w-full object-contain p-1" />
                    ) : (
                      <span className="text-xs text-muted-foreground">Preview</span>
                    )}
                  </div>
                  <Input type="file" accept="image/*" className="flex-1" onChange={(e) => handleLogoUpload(e.target.files?.[0])} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Owner Name</Label>
                <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>GST Number</Label>
                <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Subscription End Date</Label>
                <Input type="date" value={form.subscriptionEndDate} onChange={(e) => setForm({ ...form, subscriptionEndDate: e.target.value })} />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div>
                <Label>Login Credentials</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Passwords set or reset from now on can be viewed here anytime. Older passwords (set before this feature existed) have no recoverable copy — use Reset instead.
                </p>
              </div>

              {([
                { role: "owner" as const, label: "GST Owner", username: editingShop?.initialAdminUsername },
                { role: "operator" as const, label: "Non-GST Operator", username: editingShop?.initialOperatorUsername },
              ]).map(({ role, label, username }) => (
                <div key={role} className="bg-muted rounded-lg px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">{label} Username</div>
                      <div className="font-mono font-medium">{username || "—"}</div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!editingShop) return;
                        setResetUserTarget({ shop: editingShop, userRole: role });
                        setResetUserPasswordForm({ username: username || role, role, newPassword: "", generatedPassword: "" });
                      }}
                    >
                      Reset Password
                    </Button>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/60 pt-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Password</div>
                      <div className="font-mono font-medium">
                        {revealedPasswords[role] !== undefined ? revealedPasswords[role] : "••••••••"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {revealedPasswords[role] !== undefined && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => copyToClipboard(revealedPasswords[role]!, `${label} Password`)}
                        >
                          {copied === `${label} Password` ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={!username || revealingRole === role}
                        onClick={() => toggleRevealPassword(role)}
                        title={!username ? "No username on record" : revealedPasswords[role] !== undefined ? "Hide password" : "Show password"}
                      >
                        {revealedPasswords[role] !== undefined ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset User Password Dialog */}
      <Dialog open={!!resetUserTarget} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setResetUserTarget(null);
          setResetUserPasswordForm({ username: '', role: '', newPassword: '', generatedPassword: '' });
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password for {resetUserTarget?.shop.shopName}</DialogTitle>
            <DialogDescription>Select user and enter new password.</DialogDescription>
          </DialogHeader>
          {resetUserPasswordForm.generatedPassword ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Password has been reset. Share the new password with the user.</p>
              <div className="flex items-center justify-between bg-muted rounded-lg px-4 py-3">
                <div>
                  <div className="text-xs text-muted-foreground">New Password</div>
                  <div className="font-mono font-medium">{resetUserPasswordForm.generatedPassword}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => copyToClipboard(resetUserPasswordForm.generatedPassword, "New Password")}>
                  {copied === "New Password" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setResetUserTarget(null)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleResetUserPassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label>User Role</Label>
                <Select value={resetUserPasswordForm.role} onValueChange={(v) => {
                  const selectedShop = resetUserTarget?.shop;
                  if (selectedShop) {
                    setResetUserPasswordForm({ ...resetUserPasswordForm, role: v, username: v === 'owner' ? selectedShop.initialAdminUsername || 'owner' : 'operator' });
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="Select user role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">GST Admin (Owner)</SelectItem>
                    <SelectItem value="operator">Non-GST Operator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <Input
                  required
                  minLength={6}
                  type="text"
                  value={resetUserPasswordForm.newPassword}
                  onChange={(e) => setResetUserPasswordForm({ ...resetUserPasswordForm, newPassword: e.target.value })}
                  placeholder="min. 6 characters"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setResetUserTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={!resetUserPasswordForm.role}>Reset Password</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!credentialsResult} onOpenChange={() => setCredentialsResult(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Shop Created Successfully</DialogTitle>
            <DialogDescription>
              Share these login details with {credentialsResult?.shopName}. The password is shown only once.
            </DialogDescription>
          </DialogHeader>
          {credentialsResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-muted rounded-lg px-4 py-3">
                <div>
                  <div className="text-xs text-muted-foreground">Shop ID</div>
                  <div className="font-mono font-medium">{credentialsResult.loginId}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => copyToClipboard(credentialsResult.loginId, "Shop ID")}>
                  {copied === "Shop ID" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              {credentialsResult.credentials.map((cred) => ( 
                <div key={cred.label} className="border-t pt-3">
                  <p className="text-sm font-medium mb-2">{cred.label}</p>
                  <p>Username: <span className="font-mono">{cred.username}</span></p>
                  <p>Password: <span className="font-mono">{cred.password}</span></p>
                </div>
              ))}
            </div> 
          )}
          <DialogFooter>
            <Button onClick={() => setCredentialsResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renewTarget} onOpenChange={() => setRenewTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renew Subscription</DialogTitle>
            <DialogDescription>{renewTarget?.shopName}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenew} className="space-y-4">
            <div className="space-y-1.5">
              <Label>New End Date</Label>
              <Input type="date" required value={renewDate} onChange={(e) => setRenewDate(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenewTarget(null)}>Cancel</Button>
              <Button type="submit">Renew</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </>
  );
}
