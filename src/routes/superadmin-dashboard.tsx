import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DropdownMenuSeparator,
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
  Search,
  Sparkles,
  LayoutGrid,
  ListFilter,
  CheckCircle2,
  Clock,
  Mail,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { superAdminAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Shop = {
  id: string;
  _id: string;
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
  logoUrl?: string;
  address?: string;
  gstNumber?: string;
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
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const [credentialsResult, setCredentialsResult] = useState<{
    loginId: string;
    credentials: Array<{ label: string; username: string; password: string }>;
    shopName: string;
  } | null>(null);

  const [shopsPage, setShopsPage] = useState(1);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<{ owner?: string; operator?: string }>({});
  const [revealingRole, setRevealingRole] = useState<'owner' | 'operator' | null>(null);
  const [renewTarget, setRenewTarget] = useState<Shop | null>(null);
  const [renewDate, setRenewDate] = useState("");

  const [resetUserTarget, setResetUserTarget] = useState<{ shop: Shop; userRole: 'owner' | 'operator' } | null>(null);
  const [resetUserPasswordForm, setResetUserPasswordForm] = useState({
    username: '',
    role: '',
    newPassword: '',
    generatedPassword: '',
  });

  useEffect(() => {
    if (!superAdminSession) {
      navigate("/superadmin/login");
      return;
    }
    loadShops();
  }, [superAdminSession]);

  async function loadShops() {
    setIsLoading(true);
    try {
      const data = await superAdminAPI.shops.getAll();
      setShops(data);
    } catch (err: any) {
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
    setIsSubmitting(true);
    if (form.gstAdminUsername.toLowerCase().trim() === form.nonGstAdminUsername.toLowerCase().trim()) {
      toast.error('GST Owner and Non-GST Operator usernames must be different.');
      setIsSubmitting(false);
      return;
    }
    try {
      const result = await superAdminAPI.shops.create(form);
      toast.success(`Showroom "${result.shop.shopName}" provisioned successfully!`);
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

    setIsSubmitting(true);
    try {
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

      if (slugChanged) {
        await superAdminAPI.shops.updateSlug(shopId, { slug: requestedSlug });
      }

      toast.success(`Showroom "${form.shopName}" updated successfully!`);
      setEditOpen(false);
      loadShops();
    } catch (err) {
      toast.error((err as Error).message || "Failed to update showroom");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSuspend(shop: Shop) {
    try {
      await superAdminAPI.shops.suspend(shop.id || shop._id);
      toast.success(`${shop.shopName} suspended`);
      loadShops();
    } catch (err) {
      toast.error((err as Error).message || `Failed to suspend ${shop.shopName}`);
    }
  }

  async function handleActivate(shop: Shop) {
    try {
      await superAdminAPI.shops.activate(shop.id || shop._id);
      toast.success(`${shop.shopName} activated`);
      loadShops();
    } catch (err) {
      toast.error((err as Error).message || `Failed to activate ${shop.shopName}`);
    }
  }

  async function handleRenew(e: React.FormEvent) {
    e.preventDefault();
    if (!renewTarget || !renewDate) return;
    try {
      await superAdminAPI.shops.renew(renewTarget.id || renewTarget._id, { newEndDate: renewDate });
      toast.success(`Subscription renewed for ${renewTarget.shopName}`);
      setRenewTarget(null);
      setRenewDate("");
      loadShops();
    } catch (err) {
      toast.error((err as Error).message || `Failed to renew subscription for ${renewTarget.shopName}`);
    }
  }

  async function toggleRevealPassword(role: 'owner' | 'operator') {
    if (revealedPasswords[role] !== undefined) {
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
      const result = await superAdminAPI.shops.resetUserPassword(resetUserTarget.shop.id || resetUserTarget.shop._id, {
        username: resetUserPasswordForm.username,
        role: resetUserPasswordForm.role,
        newPassword: resetUserPasswordForm.newPassword,
      });
      toast.success(`Password reset for ${resetUserTarget.shop.shopName}`);
      setResetUserPasswordForm(prev => ({ ...prev, generatedPassword: result.newPassword }));
    } catch (err) {
      toast.error((err as Error).message || "Failed to reset password.");
    }
  }

  async function handleDelete(shop: Shop) {
    if (!window.confirm(`Delete "${shop.shopName}" from the platform registry? Their data will NOT be erased automatically.`)) return;

    const originalShops = shops;
    setShops(shops.filter(s => (s.id || s._id) !== (shop.id || shop._id)));

    try {
      await superAdminAPI.shops.remove(shop.id || shop._id);
      toast.success(`"${shop.shopName}" has been deleted from the registry.`);
    } catch (err) {
      toast.error(`Failed to delete ${shop.shopName}. Restoring view.`);
      setShops(originalShops);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard!`);
  }

  function statusBadge(shop: Shop) {
    const expired = new Date(shop.subscriptionEndDate) < new Date();
    if (shop.status === "suspended") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 shadow-2xs">
          <Pause className="w-3.5 h-3.5" /> Suspended
        </span>
      );
    }
    if (shop.status === "expired" || expired) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-amber-700" /> Expired
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active
      </span>
    );
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

  const shopsTotalPages = Math.ceil(filteredShops.length / 9) || 1;
  const shopsCurrentPage = Math.min(shopsPage, shopsTotalPages);
  const paginatedShops = filteredShops.slice((shopsCurrentPage - 1) * 9, shopsCurrentPage * 9);

  return (
    <div className="space-y-6 pb-12">
      
      {/* CRISP EXECUTIVE HEADER CARD */}
      <div className="rounded-2xl bg-white border border-slate-200/80 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-100/80 px-3.5 py-1 text-xs font-bold text-[#FA8112] border border-orange-200/60 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-[#FA8112]" /> Superadmin Management Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Jewellery Showroom Registry
          </h1>
          <p className="mt-1 text-slate-600 text-xs sm:text-sm font-medium">
            Manage onboarded retail showrooms, isolated database provisioning, renewals & login access.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Button
            onClick={() => { setCreateOpen(true); setForm({ ...emptyForm }); }}
            size="lg"
            className="bg-[#FA8112] hover:bg-[#FA8112]/90 text-white font-bold rounded-xl shadow-md h-11 px-6 text-sm cursor-pointer"
          >
            <Plus className="w-5 h-5 mr-1.5" /> Provision New Showroom
          </Button>

          <Button
            onClick={loadShops}
            variant="outline"
            size="lg"
            className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl h-11 px-4 text-sm font-semibold"
          >
            <RefreshCw className={`w-4 h-4 mr-2 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* TELEMETRY METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* TOTAL SHOWROOMS */}
        <Card className="bg-white border-slate-200 shadow-xs hover:shadow-md transition duration-300 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Showrooms</span>
              <div className="h-11 w-11 rounded-xl bg-orange-50 text-[#FA8112] flex items-center justify-center border border-orange-200/60">
                <Store className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900">{shops.length}</div>
            <div className="mt-1.5 text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> 100% Isolated Tenant DBs
            </div>
          </CardContent>
        </Card>

        {/* ACTIVE SHOWROOMS */}
        <Card className="bg-white border-slate-200 shadow-xs hover:shadow-md transition duration-300 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Showrooms</span>
              <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60">
                <Play className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-emerald-600">
              {shops.filter(s => s.status === 'active' && new Date(s.subscriptionEndDate) >= new Date()).length}
            </div>
            <div className="mt-1.5 text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Live & Operational Daily
            </div>
          </CardContent>
        </Card>

        {/* REGISTERED STAFF */}
        <Card className="bg-white border-slate-200 shadow-xs hover:shadow-md transition duration-300 rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Registered Staff</span>
              <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/60">
                <Users className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-blue-600">
              {shops.reduce((sum, shop) => sum + (shop.userCount || 2), 0)}
            </div>
            <div className="mt-1.5 text-xs font-semibold text-slate-600">
              Active Billing & Staff Accounts
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SEARCH, FILTER & LAYOUT TOOLBAR */}
      <Card className="bg-white border-slate-200 shadow-xs rounded-2xl">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search showroom by name, slug ID, owner name, or phone number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 text-xs sm:text-sm bg-slate-50 border-slate-300 text-slate-900 rounded-xl focus:bg-white"
              />
            </div>

            {/* Filters & View Switcher */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase">Plan:</span>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="h-10 text-xs w-32 bg-slate-50 border-slate-300 text-slate-900 font-bold rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Plans</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase">Status:</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 text-xs w-32 bg-slate-50 border-slate-300 text-slate-900 font-bold rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* View Switcher */}
              <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition ${viewMode === "grid" ? "bg-white text-[#FA8112] shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                  title="Grid Cards View"
                >
                  <LayoutGrid className="h-4 w-4" /> Grid
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition ${viewMode === "table" ? "bg-white text-[#FA8112] shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                  title="Table List View"
                >
                  <ListFilter className="h-4 w-4" /> Table
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SHOWROOMS REGISTRY CONTENT */}
      {isLoading ? (
        <div className="text-slate-500 text-center py-20 font-semibold text-base">Loading showroom database registry...</div>
      ) : filteredShops.length === 0 ? (
        <Card className="bg-white border-slate-200 rounded-2xl">
          <CardContent className="py-20 text-center">
            <Store className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-bold text-slate-800">No Showrooms Found</h3>
            <p className="text-slate-500 text-sm mt-1">No registered showrooms match your search or filter options.</p>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (

        /* HIGH-CONTRAST GRID VIEW */
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {paginatedShops.map((shop) => (
            <Card
              key={shop._id || shop.id}
              className="bg-white border-slate-200 hover:border-amber-300 hover:shadow-xl transition-all duration-300 rounded-2xl flex flex-col justify-between overflow-hidden shadow-xs"
            >
              <div>
                {/* Header */}
                <div className="p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                        {shop.logoUrl ? (
                          <img src={shop.logoUrl} alt={shop.shopName} className="w-full h-full object-contain p-1" />
                        ) : (
                          <Gem className="w-6 h-6 text-[#FA8112]" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900 leading-tight line-clamp-1">{shop.shopName}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <code className="text-xs font-mono font-bold bg-slate-100 text-amber-900 border border-slate-200 px-2 py-0.5 rounded">
                            {shop.slug}
                          </code>
                          <button
                            onClick={() => copyToClipboard(shop.slug, "Shop ID")}
                            className="text-slate-400 hover:text-[#FA8112] transition"
                            title="Copy Shop Login Slug"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>{statusBadge(shop)}</div>
                  </div>
                </div>

                {/* Body Details */}
                <div className="p-6 space-y-4">
                  {/* Subscription Counter Bar */}
                  <div className="rounded-xl bg-amber-50/80 p-3 border border-amber-200/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <CalendarDays className="h-4 w-4 text-[#FA8112]" />
                      <span>
                        {(() => {
                          const days = Math.round((new Date(shop.subscriptionEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                          return days > 0 ? `${days} Days Remaining` : 'Subscription Expired';
                        })()}
                      </span>
                    </div>
                    <span className="text-[11px] font-extrabold uppercase bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded">
                      {shop.plan || "trial"}
                    </span>
                  </div>

                  {/* Owner & Contacts Box */}
                  <div className="space-y-2 text-xs text-slate-800 font-medium bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                    {shop.ownerName && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400 shrink-0" />
                        <span>Owner: <strong className="text-slate-900 font-bold">{shop.ownerName}</strong></span>
                      </div>
                    )}
                    {shop.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                        <span>Phone: <a href={`tel:${shop.phone}`} className="text-[#FA8112] hover:underline font-bold">{shop.phone}</a></span>
                      </div>
                    )}
                    {shop.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="truncate">{shop.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Account Usernames */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 text-slate-600">
                    <span>GST Owner: <code className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">{shop.initialAdminUsername || "owner"}</code></span>
                    <span>Operator: <code className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">{shop.initialOperatorUsername || "operator"}</code></span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const shopId = shop._id || shop.id;
                    if (!shopId) {
                      toast.error("Invalid shop id from server.");
                      return;
                    }
                    setEditingShop(shop);
                    setRevealedPasswords({});
                    setForm({
                      ...emptyForm,
                      ...shop,
                      subscriptionEndDate: shop.subscriptionEndDate?.slice(0, 10) || "",
                    } as any);
                    setEditOpen(true);
                  }}
                  className="bg-[#FA8112] hover:bg-[#FA8112]/90 text-white font-bold h-9 px-4 text-xs rounded-xl shadow-xs"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit Details
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 text-xs font-bold border-slate-300 text-slate-700 bg-white">
                      Actions <MoreVertical className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-white border-slate-200 shadow-xl">
                    {shop.status === "suspended" ? (
                      <DropdownMenuItem onClick={() => handleActivate(shop)} className="text-emerald-700 font-bold">
                        <Play className="w-4 h-4 mr-2 text-emerald-600" /> Activate Showroom
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => handleSuspend(shop)} className="text-amber-700 font-bold">
                        <Pause className="w-4 h-4 mr-2 text-amber-600" /> Suspend Showroom
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem
                      onClick={() => {
                        setRenewTarget(shop);
                        setRenewDate(shop.subscriptionEndDate?.slice(0, 10) || "");
                      }}
                      className="font-bold text-slate-800"
                    >
                      <RefreshCw className="w-4 h-4 mr-2 text-blue-600" /> Renew Subscription
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => {
                        setResetUserTarget({ shop, userRole: "owner" });
                        setResetUserPasswordForm({
                          username: shop.initialAdminUsername || "owner",
                          role: "owner",
                          newPassword: "",
                          generatedPassword: "",
                        });
                      }}
                      className="font-bold text-slate-800"
                    >
                      <KeyRound className="w-4 h-4 mr-2 text-purple-600" /> Reset Password
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      className="text-red-600 font-bold focus:bg-red-50"
                      onClick={() => handleDelete(shop)}
                    >
                      <Trash2 className="w-4 h-4 mr-2 text-red-500" /> Delete Showroom
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      ) : (

        /* HIGH-CONTRAST TABLE VIEW */
        <Card className="bg-white border-slate-200 shadow-xs rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-700 border-b border-slate-200 bg-slate-50 font-bold">
                  <tr>
                    <th className="p-4 font-extrabold">Showroom & Slug</th>
                    <th className="font-extrabold">Owner Contact</th>
                    <th className="font-extrabold">Plan</th>
                    <th className="font-extrabold text-center">Staff Users</th>
                    <th className="font-extrabold">Subscription Expiry</th>
                    <th className="text-center font-extrabold">Status</th>
                    <th className="text-center font-extrabold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedShops.map((shop) => (
                    <tr key={shop._id || shop.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 text-base">{shop.shopName}</div>
                        <code className="text-xs font-mono font-bold bg-slate-100 text-amber-900 border border-slate-200 px-1.5 py-0.5 rounded mt-1 inline-block">
                          {shop.slug}
                        </code>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{shop.ownerName || "—"}</div>
                        <div className="text-xs text-[#FA8112] font-bold mt-0.5">{shop.phone || "—"}</div>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-extrabold uppercase bg-amber-50 text-amber-900 px-2.5 py-1 rounded-md border border-amber-200">
                          {shop.plan || "trial"}
                        </span>
                      </td>
                      <td className="p-4 text-center font-bold text-slate-900">
                        {shop.userCount ?? 2}
                      </td>
                      <td className="p-4 whitespace-nowrap text-slate-800 font-bold">
                        {new Date(shop.subscriptionEndDate).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-center">
                        {statusBadge(shop)}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setEditingShop(shop);
                              setForm({ ...emptyForm, ...shop, subscriptionEndDate: shop.subscriptionEndDate?.slice(0, 10) || "" } as any);
                              setEditOpen(true);
                            }}
                            className="h-8 px-3 text-xs bg-[#FA8112] text-white font-bold hover:bg-[#FA8112]/90"
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-300">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {shop.status === "suspended" ? (
                                <DropdownMenuItem onClick={() => handleActivate(shop)}>
                                  <Play className="w-4 h-4 mr-2" /> Activate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleSuspend(shop)}>
                                  <Pause className="w-4 h-4 mr-2" /> Suspend
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => { setRenewTarget(shop); setRenewDate(shop.subscriptionEndDate?.slice(0, 10) || ""); }}>
                                <RefreshCw className="w-4 h-4 mr-2" /> Renew
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(shop)} className="text-red-600 font-bold">
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PAGINATION BAR */}
      {shopsTotalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-xs text-slate-600 font-bold">
            Showing {(shopsCurrentPage - 1) * 9 + 1} to {Math.min(shopsCurrentPage * 9, filteredShops.length)} of {filteredShops.length} showrooms
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShopsPage((p) => Math.max(1, p - 1))} disabled={shopsCurrentPage === 1} className="font-bold border-slate-300">
              Prev
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShopsPage((p) => Math.min(shopsTotalPages, p + 1))} disabled={shopsCurrentPage === shopsTotalPages} className="font-bold border-slate-300">
              Next
            </Button>
          </div>
        </div>
      )}

      {/* CREATE NEW SHOP MODAL */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-bold text-slate-900 flex items-center gap-2">
              <Store className="h-5 w-5 text-[#FA8112]" /> Provision New Jewellery Showroom
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Provisions an isolated multi-tenant database & sets up default staff login credentials automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateShop} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-700">Showroom Name *</Label>
                <Input
                  required
                  value={form.shopName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm(prev => ({
                      ...prev,
                      shopName: val,
                      slug: prev.slug || val.toLowerCase().trim().replace(/[^a-z0-9]/g, "-")
                    }));
                  }}
                  placeholder="e.g. Soni Jewellers"
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-700">Shop ID (Slug Login) *</Label>
                <Input
                  required
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                  placeholder="soni-jewellers"
                />
                <p className="text-[11px] text-slate-500">Used by showroom staff on login page. Lowercase, hyphenated.</p>
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-700">Showroom Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="Logo Preview" className="max-h-full max-w-full object-contain p-1" />
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">Logo</span>
                    )}
                  </div>
                  <Input type="file" accept="image/*" className="flex-1 text-xs" onChange={(e) => handleLogoUpload(e.target.files?.[0])} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-700">Owner Name</Label>
                <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} placeholder="Rajesh Soni" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-700">Phone Number</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9000000000" />
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-700">Email Address</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="cloudiefyy@gmail.com" />
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-700">Showroom Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Jaipur, Rajasthan" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-700">GSTIN Number</Label>
                <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} placeholder="08AAAAA0000A1Z5" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-700">SaaS Plan</Label>
                <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                  <SelectTrigger className="text-xs font-semibold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Free Trial (30 Days)</SelectItem>
                    <SelectItem value="basic">Basic Retail</SelectItem>
                    <SelectItem value="pro">Pro Multi-Branch</SelectItem>
                    <SelectItem value="enterprise">Enterprise Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-700">Subscription End Date</Label>
                <Input type="date" value={form.subscriptionEndDate} onChange={(e) => setForm({ ...form, subscriptionEndDate: e.target.value })} />
                <p className="text-[11px] text-slate-500">Leave empty to set auto 30-day trial expiry.</p>
              </div>

              {/* CREDENTIALS SECTION */}
              <div className="col-span-2 pt-4 border-t border-slate-200">
                <h4 className="text-xs font-bold uppercase text-[#FA8112] tracking-wider mb-2">1. GST Admin Login Account</h4>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-700">GST Username *</Label>
                <Input required value={form.gstAdminUsername} onChange={(e) => setForm({ ...form, gstAdminUsername: e.target.value })} placeholder="owner" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-700">GST Password *</Label>
                <Input required type="text" minLength={6} value={form.gstAdminPassword} onChange={(e) => setForm({ ...form, gstAdminPassword: e.target.value })} placeholder="min 6 chars" />
              </div>

              <div className="col-span-2 pt-2">
                <h4 className="text-xs font-bold uppercase text-slate-600 tracking-wider mb-2">2. Non-GST Operator Login Account</h4>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-700">Operator Username *</Label>
                <Input required value={form.nonGstAdminUsername} onChange={(e) => setForm({ ...form, nonGstAdminUsername: e.target.value })} placeholder="operator" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-700">Operator Password *</Label>
                <Input required type="text" minLength={6} value={form.nonGstAdminPassword} onChange={(e) => setForm({ ...form, nonGstAdminPassword: e.target.value })} placeholder="min 6 chars" />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-[#FA8112] hover:bg-[#FA8112]/90 text-white font-bold">
                {isSubmitting ? "Provisioning..." : "Provision Showroom"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT SHOP MODAL */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-bold text-slate-900 flex items-center gap-2">
              <Pencil className="h-5 w-5 text-[#FA8112]" /> Edit Showroom: {editingShop?.shopName}
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Update showroom profiles, logo, subscription end date, or view staff passwords.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateShop} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-700">Shop Name *</Label>
                <Input required value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} />
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-700">Shop ID (Slug)</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-700">Showroom Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-slate-50 rounded-xl border border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="Logo Preview" className="max-h-full max-w-full object-contain p-1" />
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">Logo</span>
                    )}
                  </div>
                  <Input type="file" accept="image/*" className="flex-1 text-xs" onChange={(e) => handleLogoUpload(e.target.files?.[0])} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-700">Owner Name</Label>
                <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-700">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-700">Email Address</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-700">Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-700">GSTIN</Label>
                <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-700">Plan</Label>
                <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                  <SelectTrigger className="text-xs font-semibold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold uppercase text-slate-700">Subscription End Date</Label>
                <Input type="date" value={form.subscriptionEndDate} onChange={(e) => setForm({ ...form, subscriptionEndDate: e.target.value })} />
              </div>
            </div>

            {/* PASSWORD REVEAL SECTION */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <Label className="text-xs font-bold uppercase text-slate-700">Staff Account Credentials</Label>
              {([
                { role: "owner" as const, label: "GST Admin (Owner)", username: editingShop?.initialAdminUsername },
                { role: "operator" as const, label: "Non-GST Operator", username: editingShop?.initialOperatorUsername },
              ]).map(({ role, label, username }) => (
                <div key={role} className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-500 font-medium">{label} Username</div>
                      <div className="font-mono font-bold text-slate-900 text-xs">{username || "—"}</div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs font-semibold"
                      onClick={() => {
                        if (!editingShop) return;
                        setResetUserTarget({ shop: editingShop, userRole: role });
                        setResetUserPasswordForm({ username: username || role, role, newPassword: "", generatedPassword: "" });
                      }}
                    >
                      Reset Password
                    </Button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                    <div>
                      <div className="text-[11px] text-slate-500 font-medium">Password</div>
                      <div className="font-mono font-bold text-slate-900 text-xs">
                        {revealedPasswords[role] !== undefined ? revealedPasswords[role] : "••••••••"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {revealedPasswords[role] !== undefined && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => copyToClipboard(revealedPasswords[role]!, `${label} Password`)}
                        >
                          <Copy className="w-3.5 h-3.5 text-slate-600" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={!username || revealingRole === role}
                        onClick={() => toggleRevealPassword(role)}
                      >
                        {revealedPasswords[role] !== undefined ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-[#FA8112] hover:bg-[#FA8112]/90 text-white font-bold">
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREDENTIALS SHEET UPON CREATION */}
      <Dialog open={!!credentialsResult} onOpenChange={() => setCredentialsResult(null)}>
        <DialogContent className="max-w-md bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Showroom Provisioned
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Share login credentials with {credentialsResult?.shopName}. Password is displayed only once.
            </DialogDescription>
          </DialogHeader>

          {credentialsResult && (
            <div className="space-y-4 py-2">
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-800 uppercase">Shop Login ID (Slug)</div>
                  <div className="font-mono font-extrabold text-slate-900 text-base mt-0.5">{credentialsResult.loginId}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(credentialsResult.loginId, "Shop Login ID")} className="bg-white">
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                </Button>
              </div>

              <div className="space-y-3">
                {credentialsResult.credentials.map((cred) => (
                  <div key={cred.label} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-xs">
                    <div className="font-bold text-[#FA8112] uppercase text-[11px]">{cred.label}</div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Username:</span>
                      <span className="font-mono font-bold text-slate-900">{cred.username}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Password:</span>
                      <span className="font-mono font-bold text-slate-900">{cred.password}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setCredentialsResult(null)} className="w-full bg-[#FA8112] text-white font-bold">
              Done & Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RENEW SUBSCRIPTION MODAL */}
      <Dialog open={!!renewTarget} onOpenChange={() => setRenewTarget(null)}>
        <DialogContent className="max-w-sm bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-600" /> Renew Subscription
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Extend end date for {renewTarget?.shopName}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRenew} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-slate-700">New End Date *</Label>
              <Input type="date" required value={renewDate} onChange={(e) => setRenewDate(e.target.value)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenewTarget(null)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">Renew</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* RESET PASSWORD MODAL */}
      <Dialog open={!!resetUserTarget} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setResetUserTarget(null);
          setResetUserPasswordForm({ username: '', role: '', newPassword: '', generatedPassword: '' });
        }
      }}>
        <DialogContent className="max-w-sm bg-white border-slate-200">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-purple-600" /> Reset Password
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Reset staff password for {resetUserTarget?.shop.shopName}
            </DialogDescription>
          </DialogHeader>

          {resetUserPasswordForm.generatedPassword ? (
            <div className="space-y-4 py-2">
              <p className="text-xs text-slate-600 font-medium">Password updated successfully! Copy the new password below.</p>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-500 font-bold uppercase">New Password</div>
                  <div className="font-mono font-extrabold text-slate-900 text-sm mt-0.5">{resetUserPasswordForm.generatedPassword}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => copyToClipboard(resetUserPasswordForm.generatedPassword, "New Password")}>
                  <Copy className="h-4 w-4 text-slate-600" />
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setResetUserTarget(null)} className="w-full">Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleResetUserPassword} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-700">Staff User Role</Label>
                <Select value={resetUserPasswordForm.role} onValueChange={(v) => {
                  const selectedShop = resetUserTarget?.shop;
                  if (selectedShop) {
                    setResetUserPasswordForm({ ...resetUserPasswordForm, role: v, username: v === 'owner' ? selectedShop.initialAdminUsername || 'owner' : 'operator' });
                  }
                }}>
                  <SelectTrigger className="text-xs font-semibold"><SelectValue placeholder="Select user role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">GST Admin (Owner)</SelectItem>
                    <SelectItem value="operator">Non-GST Operator</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-700">New Password *</Label>
                <Input
                  required
                  minLength={6}
                  type="text"
                  value={resetUserPasswordForm.newPassword}
                  onChange={(e) => setResetUserPasswordForm({ ...resetUserPasswordForm, newPassword: e.target.value })}
                  placeholder="min 6 characters"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setResetUserTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={!resetUserPasswordForm.role} className="bg-purple-600 hover:bg-purple-700 text-white font-bold">
                  Reset Password
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
