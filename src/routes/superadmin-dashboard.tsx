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
  ShieldCheck,
  Zap,
  Crown,
  Layers,
  X,
  Share2,
  Send,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { toast } from "sonner";
import { superAdminAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  getDefaultPagesForPlan,
  getDefaultModulesForPlan,
  PLAN_METADATA
} from "@/lib/subscriptionModules";
import { ModuleSelectorTree } from "@/components/ModuleSelectorTree";

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
  allowedModules?: string[];
  allowedPages?: string[];
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
  plan: "spark",
  subscriptionEndDate: "",
  allowedModules: getDefaultModulesForPlan("spark"),
  allowedPages: getDefaultPagesForPlan("spark"),
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
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");

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

  const [shareCredentialsShop, setShareCredentialsShop] = useState<Shop | null>(null);
  const [fetchingShareCredentials, setFetchingShareCredentials] = useState(false);
  const [shareCredentialsData, setShareCredentialsData] = useState<{
    shopName: string;
    slug: string;
    loginUrl: string;
    ownerUsername: string;
    ownerPassword?: string;
    operatorUsername: string;
    operatorPassword?: string;
  } | null>(null);
  const [showPasswordOwner, setShowPasswordOwner] = useState(true);
  const [showPasswordOperator, setShowPasswordOperator] = useState(true);

  const [createActiveTab, setCreateActiveTab] = useState<'profile' | 'permissions'>('profile');
  const [editActiveTab, setEditActiveTab] = useState<'profile' | 'permissions'>('profile');

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

  const handlePlanSelection = (newPlan: string) => {
    const pages = getDefaultPagesForPlan(newPlan);
    const modules = getDefaultModulesForPlan(newPlan);
    const isTrial = newPlan.toLowerCase() === "trial";
    const trialEndDate = isTrial
      ? (() => {
          const d = new Date();
          d.setDate(d.getDate() + 30);
          return d.toISOString().slice(0, 10);
        })()
      : undefined;

    setForm((prev) => ({
      ...prev,
      plan: newPlan,
      allowedPages: pages,
      allowedModules: modules,
      ...(isTrial ? { subscriptionEndDate: trialEndDate } : {}),
    }));
  };

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
        allowedModules: form.allowedModules,
        allowedPages: form.allowedPages,
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

  async function handleOpenShareCredentials(shop: Shop) {
    setShareCredentialsShop(shop);
    setFetchingShareCredentials(true);
    setShareCredentialsData(null);
    setShowPasswordOwner(true);
    setShowPasswordOperator(true);

    const shopId = shop.id || shop._id;
    const loginUrl = `${window.location.origin}/login`;

    let ownerPassword: string | undefined;
    let operatorPassword: string | undefined;

    try {
      const results = await Promise.allSettled([
        superAdminAPI.shops.getUserPassword(shopId, 'owner'),
        superAdminAPI.shops.getUserPassword(shopId, 'operator'),
      ]);

      if (results[0].status === 'fulfilled') {
        ownerPassword = results[0].value.password;
      }
      if (results[1].status === 'fulfilled') {
        operatorPassword = results[1].value.password;
      }

      setShareCredentialsData({
        shopName: shop.shopName,
        slug: shop.slug,
        loginUrl,
        ownerUsername: shop.initialAdminUsername || 'owner',
        ownerPassword,
        operatorUsername: shop.initialOperatorUsername || 'operator',
        operatorPassword,
      });
    } catch (err) {
      toast.error("Failed to retrieve showroom login passwords.");
    } finally {
      setFetchingShareCredentials(false);
    }
  }

  function generateWhatsAppShareText(data: {
    shopName: string;
    slug: string;
    loginUrl: string;
    ownerUsername: string;
    ownerPassword?: string;
    operatorUsername: string;
    operatorPassword?: string;
  }) {
    return `💎 *Jewellery ERP - Login Credentials*
🏪 *Showroom:* ${data.shopName}
🆔 *Shop Login ID:* ${data.slug}
🌐 *Login Link:* ${data.loginUrl}

👤 *GST Owner Account:*
• Username: ${data.ownerUsername}
• Password: ${data.ownerPassword || '••••••••'}

👤 *Non-GST Operator Account:*
• Username: ${data.operatorUsername}
• Password: ${data.operatorPassword || '••••••••'}`;
  }

  function handleShareWhatsApp(data: NonNullable<typeof shareCredentialsData>) {
    const text = generateWhatsAppShareText(data);
    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  }

  function handleCopyAllShareDetails(data: NonNullable<typeof shareCredentialsData>) {
    const text = generateWhatsAppShareText(data);
    copyToClipboard(text, "All Credentials & Login Link");
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
                    <SelectItem value="spark">Spark Plan</SelectItem>
                    <SelectItem value="hero">Hero Plan</SelectItem>
                    <SelectItem value="prime">Prime Plan</SelectItem>
                    <SelectItem value="custom">Custom Plan</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
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
                  <div className="rounded-xl bg-amber-50/80 p-3 border border-amber-200/80 flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 shrink-0">
                      <CalendarDays className="h-4 w-4 text-[#FA8112]" />
                      <span>
                        {(() => {
                          const days = Math.round((new Date(shop.subscriptionEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                          return days > 0 ? `${days} Days Left` : 'Expired';
                        })()}
                      </span>
                    </div>
                    {(() => {
                      const pKey = (shop.plan || "spark").toLowerCase();
                      const meta = PLAN_METADATA[pKey] || PLAN_METADATA.spark;
                      return (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${meta.color}`}>
                          {pKey === "spark" && <Zap className="w-3 h-3 text-amber-600 fill-amber-500/30" />}
                          {pKey === "hero" && <Sparkles className="w-3 h-3 text-indigo-600" />}
                          {pKey === "prime" && <Crown className="w-3 h-3 text-emerald-600" />}
                          {pKey === "custom" && <Layers className="w-3 h-3 text-purple-600" />}
                          {pKey === "trial" && <Clock className="w-3 h-3 text-blue-600" />}
                          <span>{meta.badge}</span>
                        </span>
                      );
                    })()}
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
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => {
                      const shopId = shop._id || shop.id;
                      if (!shopId) {
                        toast.error("Invalid shop id from server.");
                        return;
                      }
                      setEditingShop(shop);
                      const shopPlan = (shop.plan || "spark").toLowerCase();
                      const currentPages = (shopPlan === "prime" || shopPlan === "premium")
                        ? getDefaultPagesForPlan("prime")
                        : (shop.allowedPages && shop.allowedPages.length > 0
                          ? shop.allowedPages
                          : getDefaultPagesForPlan(shopPlan));
                      const currentModules = (shopPlan === "prime" || shopPlan === "premium")
                        ? getDefaultModulesForPlan("prime")
                        : (shop.allowedModules && shop.allowedModules.length > 0
                          ? shop.allowedModules
                          : getDefaultModulesForPlan(shopPlan));
                      setForm({
                        ...emptyForm,
                        ...shop,
                        plan: shop.plan || "spark",
                        allowedPages: currentPages,
                        allowedModules: currentModules,
                        subscriptionEndDate: shop.subscriptionEndDate?.slice(0, 10) || "",
                      } as any);
                      setEditOpen(true);
                    }}
                    className="bg-[#FA8112] hover:bg-[#FA8112]/90 text-white font-bold h-9 px-3 text-xs rounded-xl shadow-xs"
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleOpenShareCredentials(shop)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 px-3 text-xs rounded-xl shadow-xs"
                    title="View & Share Login Credentials"
                  >
                    <Share2 className="w-3.5 h-3.5 mr-1" /> Share
                  </Button>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 text-xs font-bold border-slate-300 text-slate-700 bg-white">
                      Actions <MoreVertical className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 bg-white border-slate-200 shadow-xl">
                    <DropdownMenuItem onClick={() => handleOpenShareCredentials(shop)} className="text-emerald-700 font-bold">
                      <Share2 className="w-4 h-4 mr-2 text-emerald-600" /> Share Credentials
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

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

        /* HIGH-CONTRAST DATA MANAGEMENT TABLE VIEW */
        <Card className="bg-white border-slate-200 shadow-md rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="text-left text-slate-800 border-b border-slate-200 bg-slate-100/80 font-black tracking-wider uppercase text-xs">
                  <tr>
                    <th className="p-4 w-12 text-center text-slate-500">#</th>
                    <th className="p-4">Showroom & Slug ID</th>
                    <th className="p-4">Owner & Contact</th>
                    <th className="p-4">Subscription Plan</th>
                    <th className="p-4">Default Usernames</th>
                    <th className="p-4">Expiry Date</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Data Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedShops.map((shop, index) => {
                    const daysLeft = Math.round((new Date(shop.subscriptionEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    const pKey = (shop.plan || "spark").toLowerCase();
                    const meta = PLAN_METADATA[pKey] || PLAN_METADATA.spark;

                    return (
                      <tr key={shop._id || shop.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="p-4 text-center text-xs font-mono font-bold text-slate-400">
                          {(shopsCurrentPage - 1) * 9 + index + 1}
                        </td>
                        
                        {/* Showroom & Slug */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                              {shop.logoUrl ? (
                                <img src={shop.logoUrl} alt={shop.shopName} className="w-full h-full object-contain p-0.5" />
                              ) : (
                                <Gem className="w-5 h-5 text-[#FA8112]" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-base leading-snug">{shop.shopName}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <code className="text-[11px] font-mono font-bold bg-slate-100 text-amber-900 border border-slate-200 px-1.5 py-0.5 rounded">
                                  {shop.slug}
                                </code>
                                <button
                                  onClick={() => copyToClipboard(shop.slug, "Shop ID")}
                                  className="text-slate-400 hover:text-[#FA8112] transition"
                                  title="Copy Login Slug ID"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Owner & Contact */}
                        <td className="p-4">
                          <div className="font-bold text-slate-900">{shop.ownerName || "—"}</div>
                          <div className="text-xs text-[#FA8112] font-bold mt-0.5 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <a href={`tel:${shop.phone}`} className="hover:underline">{shop.phone || "—"}</a>
                          </div>
                          {shop.email && <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{shop.email}</div>}
                        </td>

                        {/* Plan & Features */}
                        <td className="p-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-lg border ${meta.color}`}>
                            {pKey === "spark" && <Zap className="w-3 h-3 text-amber-600 fill-amber-500/30" />}
                            {pKey === "hero" && <Sparkles className="w-3 h-3 text-indigo-600" />}
                            {pKey === "prime" && <Crown className="w-3 h-3 text-emerald-600" />}
                            {pKey === "custom" && <Layers className="w-3 h-3 text-purple-600" />}
                            {pKey === "trial" && <Clock className="w-3 h-3 text-blue-600" />}
                            <span>{meta.badge}</span>
                          </span>
                          <div className="text-[11px] text-slate-500 mt-1 font-medium">
                            {shop.allowedModules?.length || 0} Modules Active
                          </div>
                        </td>

                        {/* User Accounts */}
                        <td className="p-4 whitespace-nowrap">
                          <div className="text-xs space-y-0.5">
                            <div><span className="text-slate-400 font-medium">Owner:</span> <code className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">{shop.initialAdminUsername || "owner"}</code></div>
                            <div><span className="text-slate-400 font-medium">Operator:</span> <code className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">{shop.initialOperatorUsername || "operator"}</code></div>
                          </div>
                        </td>

                        {/* Expiry Date */}
                        <td className="p-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900 text-xs">
                            {new Date(shop.subscriptionEndDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                          <div className="mt-1">
                            {daysLeft > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                <CalendarDays className="w-3 h-3 text-[#FA8112]" /> {daysLeft} Days Left
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                                <Clock className="w-3 h-3 text-red-600" /> Expired
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="p-4 text-center whitespace-nowrap">
                          {statusBadge(shop)}
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => {
                                setEditingShop(shop);
                                setRevealedPasswords({});
                                const shopPlan = (shop.plan || "spark").toLowerCase();
                                const currentPages = (shopPlan === "prime" || shopPlan === "premium")
                                  ? getDefaultPagesForPlan("prime")
                                  : (shop.allowedPages && shop.allowedPages.length > 0
                                    ? shop.allowedPages
                                    : getDefaultPagesForPlan(shopPlan));
                                const currentModules = (shopPlan === "prime" || shopPlan === "premium")
                                  ? getDefaultModulesForPlan("prime")
                                  : (shop.allowedModules && shop.allowedModules.length > 0
                                    ? shop.allowedModules
                                    : getDefaultModulesForPlan(shopPlan));
                                setForm({
                                  ...emptyForm,
                                  ...shop,
                                  plan: shop.plan || "spark",
                                  allowedPages: currentPages,
                                  allowedModules: currentModules,
                                  subscriptionEndDate: shop.subscriptionEndDate?.slice(0, 10) || "",
                                } as any);
                                setEditOpen(true);
                              }}
                              className="h-8 px-3 text-xs bg-[#FA8112] text-white font-bold hover:bg-[#FA8112]/90 rounded-xl shadow-2xs"
                              title="Edit Showroom Data"
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => handleOpenShareCredentials(shop)}
                              className="h-8 px-2.5 text-xs bg-emerald-600 text-white font-bold hover:bg-emerald-700 rounded-xl shadow-2xs"
                              title="View & Share Login Credentials"
                            >
                              <Share2 className="h-3.5 w-3.5 mr-1" /> Share
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRenewTarget(shop);
                                setRenewDate(shop.subscriptionEndDate?.slice(0, 10) || "");
                              }}
                              className="h-8 px-2.5 text-xs border-slate-300 font-bold text-blue-700 hover:bg-blue-50 rounded-xl"
                              title="Renew Subscription"
                            >
                              <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setResetUserTarget({ shop, userRole: "owner" });
                                setResetUserPasswordForm({
                                  username: shop.initialAdminUsername || "owner",
                                  role: "owner",
                                  newPassword: "",
                                  generatedPassword: "",
                                });
                              }}
                              className="h-8 px-2.5 text-xs border-slate-300 font-bold text-purple-700 hover:bg-purple-50 rounded-xl"
                              title="Reset Password"
                            >
                              <KeyRound className="h-3.5 w-3.5 text-purple-600" />
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-300 rounded-xl">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52 bg-white border-slate-200 shadow-xl">
                                <DropdownMenuItem onClick={() => handleOpenShareCredentials(shop)} className="text-emerald-700 font-bold">
                                  <Share2 className="w-4 h-4 mr-2 text-emerald-600" /> Share Credentials
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                {shop.status === "suspended" ? (
                                  <DropdownMenuItem onClick={() => handleActivate(shop)} className="text-emerald-700 font-bold">
                                    <Play className="w-4 h-4 mr-2 text-emerald-600" /> Activate Showroom
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleSuspend(shop)} className="text-amber-700 font-bold">
                                    <Pause className="w-4 h-4 mr-2 text-amber-600" /> Suspend Showroom
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDelete(shop)} className="text-red-600 font-bold focus:bg-red-50">
                                  <Trash2 className="w-4 h-4 mr-2 text-red-500" /> Delete Showroom
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
      )}

      {/* PAGINATION BAR */}
      {shopsTotalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-xs text-slate-600 font-bold">
            Showing {(shopsCurrentPage - 1) * 9 + 1} to {Math.min(shopsCurrentPage * 9, filteredShops.length)} of {filteredShops.length} showrooms
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShopsPage((p) => Math.max(1, p - 1))} disabled={shopsCurrentPage === 1} className="font-bold border-slate-300 rounded-xl">
              Prev
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShopsPage((p) => Math.min(shopsTotalPages, p + 1))} disabled={shopsCurrentPage === shopsTotalPages} className="font-bold border-slate-300 rounded-xl">
              Next
            </Button>
          </div>
        </div>
      )}      {/* CREATE NEW SHOP MODAL - 1-PAGE TABBED FORM */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        setCreateOpen(open);
        if (open) setCreateActiveTab('profile');
      }}>
        <DialogContent className="fixed inset-0 top-0 left-0 translate-x-0 translate-y-0 z-50 w-screen h-screen max-w-none max-h-none rounded-none border-none p-0 m-0 bg-slate-100 flex flex-col overflow-hidden [&>button[class*='absolute']]:hidden">
          
          {/* HEADER NAVBAR WITH TABS */}
          <div className="bg-slate-900 text-white px-6 py-3 flex flex-wrap items-center justify-between shrink-0 shadow-md gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-[#FA8112] text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                  Provision New Jewellery Showroom
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">
                  Configure showroom profile, subscription tier, staff credentials & module permissions.
                </p>
              </div>
            </div>

            {/* TAB SWITCHER */}
            <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setCreateActiveTab('profile')}
                className={`px-3.5 py-1.5 rounded-lg font-extrabold text-xs transition flex items-center gap-1.5 ${
                  createActiveTab === 'profile'
                    ? "bg-[#FA8112] text-white shadow-md"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                <Store className="w-3.5 h-3.5" /> 1. Showroom & Credentials
              </button>
              <button
                type="button"
                onClick={() => setCreateActiveTab('permissions')}
                className={`px-3.5 py-1.5 rounded-lg font-extrabold text-xs transition flex items-center gap-1.5 ${
                  createActiveTab === 'permissions'
                    ? "bg-[#FA8112] text-white shadow-md"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> 2. Module Permissions ({form.allowedPages?.length || 0}/26 Pages)
              </button>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateOpen(false)}
              className="text-slate-300 hover:text-white hover:bg-slate-800 font-bold text-xs h-8 px-3 rounded-xl border border-slate-700"
            >
              <X className="w-4 h-4 mr-1" /> Close (Esc)
            </Button>
          </div>

          {/* FORM BODY */}
          <form onSubmit={handleCreateShop} className="flex-1 flex flex-col justify-between overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto w-full">
              
              {createActiveTab === 'profile' ? (
                /* TAB 1: 1-PAGE VIEW FOR PROFILE, SUBSCRIPTION & STAFF PASSWORDS */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  
                  {/* LEFT COLUMN: Showroom Profile Details (7 Cols) */}
                  <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
                    <div className="bg-slate-50 p-3.5 border-b border-slate-200 font-extrabold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <Store className="w-4 h-4 text-[#FA8112]" /> 1. Showroom Profile & Contact Details
                    </div>
                    <div className="p-4 sm:p-5 space-y-3.5 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Showroom Name <span className="text-red-500">*</span></label>
                          <Input
                            required
                            value={form.shopName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setForm((prev) => ({
                                ...prev,
                                shopName: val,
                                slug: prev.slug || val.toLowerCase().trim().replace(/[^a-z0-9]/g, "-"),
                              }));
                            }}
                            placeholder="e.g. Soni Jewellers"
                            className="h-9 text-xs font-bold bg-white border-slate-300 focus:bg-white mt-1"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Shop Login ID (Slug) <span className="text-red-500">*</span></label>
                          <Input
                            required
                            value={form.slug}
                            onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                            placeholder="soni-jewellers"
                            className="h-9 text-xs font-mono font-bold text-amber-900 bg-white border-slate-300 mt-1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Owner Name</label>
                          <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} placeholder="Rajesh Soni" className="h-9 text-xs font-semibold bg-white border-slate-300 mt-1" />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Showroom Logo</label>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-8 h-8 bg-slate-50 rounded-lg border border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
                              {form.logoUrl ? <img src={form.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-[9px] text-slate-400 font-medium">Logo</span>}
                            </div>
                            <Input type="file" accept="image/*" className="flex-1 text-[11px] h-8 bg-white border-slate-300" onChange={(e) => handleLogoUpload(e.target.files?.[0])} />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Phone Number</label>
                          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" className="h-9 text-xs font-semibold bg-white border-slate-300 mt-1" />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Email Address</label>
                          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="cloudiefyy@gmail.com" className="h-9 text-xs font-semibold bg-white border-slate-300 mt-1" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Showroom Address</label>
                          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Jaipur, Rajasthan" className="h-9 text-xs font-semibold bg-white border-slate-300 mt-1" />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">GSTIN Number</label>
                          <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} placeholder="08AAAAA0000A1Z5" className="h-9 text-xs font-mono font-bold bg-white border-slate-300 mt-1" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Subscription Tier & Staff Passwords (5 Cols) */}
                  <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
                    
                    {/* Subscription Plan & Expiry */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-3 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Crown className="w-4 h-4 text-amber-100" /> 2. Subscription Tier Plan & Expiry
                        </div>
                      </div>
                      <div className="p-4 space-y-3 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Subscription Tier <span className="text-red-500">*</span></label>
                          <Select value={form.plan} onValueChange={handlePlanSelection}>
                            <SelectTrigger className="h-9 text-xs font-extrabold bg-white border-slate-300 mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="spark" className="font-bold text-xs">⚡ Spark Plan (Essential Retail)</SelectItem>
                              <SelectItem value="hero" className="font-bold text-xs">✨ Hero Plan (Advanced Operations)</SelectItem>
                              <SelectItem value="prime" className="font-bold text-xs">👑 Prime Plan (All-Inclusive Enterprise)</SelectItem>
                              <SelectItem value="custom" className="font-bold text-xs">🛠️ Custom Plan (Tailored Selection)</SelectItem>
                              <SelectItem value="trial" className="text-xs">Free Trial (30 Days)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Subscription Expiry Date</label>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Input type="date" value={form.subscriptionEndDate} onChange={(e) => setForm({ ...form, subscriptionEndDate: e.target.value })} className="h-9 text-xs font-bold bg-white border-slate-300 flex-1" />
                            <button type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() + 30); setForm(f => ({ ...f, subscriptionEndDate: d.toISOString().slice(0, 10) })); }} className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1.5 rounded hover:bg-amber-200">
                              +30D
                            </button>
                            <button type="button" onClick={() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); setForm(f => ({ ...f, subscriptionEndDate: d.toISOString().slice(0, 10) })); }} className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1.5 rounded hover:bg-amber-200">
                              +1Yr
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Staff Login Passwords */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col justify-between">
                      <div className="bg-slate-50 p-3 border-b border-slate-200 font-extrabold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-purple-600" /> 3. Default Staff Login Passwords
                      </div>
                      <div className="p-4 space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <div>
                            <label className="font-bold text-slate-700 uppercase text-[10px]">GST Owner Username <span className="text-red-500">*</span></label>
                            <Input required value={form.gstAdminUsername} onChange={(e) => setForm({ ...form, gstAdminUsername: e.target.value })} placeholder="owner" className="h-8 text-xs font-mono font-bold bg-white border-slate-300 mt-0.5" />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 uppercase text-[10px]">GST Owner Password <span className="text-red-500">*</span></label>
                            <Input required type="text" minLength={6} value={form.gstAdminPassword} onChange={(e) => setForm({ ...form, gstAdminPassword: e.target.value })} placeholder="min 6 chars" className="h-8 text-xs font-mono font-bold bg-white border-slate-300 mt-0.5" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <div>
                            <label className="font-bold text-slate-700 uppercase text-[10px]">Operator Username <span className="text-red-500">*</span></label>
                            <Input required value={form.nonGstAdminUsername} onChange={(e) => setForm({ ...form, nonGstAdminUsername: e.target.value })} placeholder="operator" className="h-8 text-xs font-mono font-bold bg-white border-slate-300 mt-0.5" />
                          </div>
                          <div>
                            <label className="font-bold text-slate-700 uppercase text-[10px]">Operator Password <span className="text-red-500">*</span></label>
                            <Input required type="text" minLength={6} value={form.nonGstAdminPassword} onChange={(e) => setForm({ ...form, nonGstAdminPassword: e.target.value })} placeholder="min 6 chars" className="h-8 text-xs font-mono font-bold bg-white border-slate-300 mt-0.5" />
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                /* TAB 2: MODULE & PAGE PERMISSIONS TREE */
                <div className="space-y-4">
                  <ModuleSelectorTree
                    selectedPages={form.allowedPages}
                    selectedModules={form.allowedModules}
                    onPagesChange={(pages) => setForm((prev) => ({ ...prev, allowedPages: pages }))}
                    onModulesChange={(modules) => setForm((prev) => ({ ...prev, allowedModules: modules }))}
                    onPlanQuickSelect={handlePlanSelection}
                    currentPlan={form.plan}
                  />
                </div>
              )}

            </div>

            {/* FIXED BOTTOM ACTION BAR */}
            <div className="bg-white border-t border-slate-200 p-4 sm:p-5 flex items-center justify-between shadow-xl shrink-0">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                {createActiveTab === 'profile' ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateActiveTab('permissions')}
                    className="h-9 px-4 text-xs font-bold border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-xl flex items-center gap-1.5"
                  >
                    Customize Module Permissions ({form.allowedPages?.length || 0}/26 Pages) <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateActiveTab('profile')}
                    className="h-9 px-4 text-xs font-bold border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-xl flex items-center gap-1.5"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back to Showroom Profile
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="h-10 px-5 font-bold rounded-xl border-slate-300 text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-[#FA8112] hover:bg-[#FA8112]/90 text-white font-bold h-10 px-7 rounded-xl shadow-md text-xs">
                  {isSubmitting ? "Provisioning Database..." : "Provision Showroom"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT SHOP MODAL - 1-PAGE TABBED FORM */}
      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open);
        if (open) setEditActiveTab('profile');
      }}>
        <DialogContent className="fixed inset-0 top-0 left-0 translate-x-0 translate-y-0 z-50 w-screen h-screen max-w-none max-h-none rounded-none border-none p-0 m-0 bg-slate-100 flex flex-col overflow-hidden [&>button[class*='absolute']]:hidden">
          
          {/* HEADER NAVBAR WITH TABS */}
          <div className="bg-slate-900 text-white px-6 py-3 flex flex-wrap items-center justify-between shrink-0 shadow-md gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-[#FA8112] text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                <Pencil className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                  Edit Showroom: {editingShop?.shopName}
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">
                  Update showroom details, subscription tier, end date, staff passwords & page permissions.
                </p>
              </div>
            </div>

            {/* TAB SWITCHER */}
            <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setEditActiveTab('profile')}
                className={`px-3.5 py-1.5 rounded-lg font-extrabold text-xs transition flex items-center gap-1.5 ${
                  editActiveTab === 'profile'
                    ? "bg-[#FA8112] text-white shadow-md"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                <Store className="w-3.5 h-3.5" /> 1. Showroom & Credentials
              </button>
              <button
                type="button"
                onClick={() => setEditActiveTab('permissions')}
                className={`px-3.5 py-1.5 rounded-lg font-extrabold text-xs transition flex items-center gap-1.5 ${
                  editActiveTab === 'permissions'
                    ? "bg-[#FA8112] text-white shadow-md"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> 2. Module Permissions ({form.allowedPages?.length || 0}/26 Pages)
              </button>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditOpen(false)}
              className="text-slate-300 hover:text-white hover:bg-slate-800 font-bold text-xs h-8 px-3 rounded-xl border border-slate-700"
            >
              <X className="w-4 h-4 mr-1" /> Close (Esc)
            </Button>
          </div>

          {/* FORM BODY */}
          <form onSubmit={handleUpdateShop} className="flex-1 flex flex-col justify-between overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto w-full">
              
              {editActiveTab === 'profile' ? (
                /* TAB 1: 1-PAGE VIEW FOR PROFILE, SUBSCRIPTION & STAFF PASSWORDS */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  
                  {/* LEFT COLUMN: Showroom Profile Details (7 Cols) */}
                  <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
                    <div className="bg-slate-50 p-3.5 border-b border-slate-200 font-extrabold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <Store className="w-4 h-4 text-[#FA8112]" /> 1. Showroom Profile & Contact Details
                    </div>
                    <div className="p-4 sm:p-5 space-y-3.5 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Showroom Name <span className="text-red-500">*</span></label>
                          <Input required value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} className="h-9 text-xs font-bold bg-white border-slate-300 mt-1" />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Shop Login ID (Slug)</label>
                          <Input
                            value={form.slug}
                            onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                            className="h-9 text-xs font-mono font-bold text-amber-900 bg-white border-slate-300 mt-1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Owner Name</label>
                          <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} className="h-9 text-xs font-semibold bg-white border-slate-300 mt-1" />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Showroom Logo</label>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-8 h-8 bg-slate-50 rounded-lg border border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
                              {form.logoUrl ? <img src={form.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-[9px] text-slate-400 font-medium">Logo</span>}
                            </div>
                            <Input type="file" accept="image/*" className="flex-1 text-[11px] h-8 bg-white border-slate-300" onChange={(e) => handleLogoUpload(e.target.files?.[0])} />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Phone Number</label>
                          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-9 text-xs font-semibold bg-white border-slate-300 mt-1" />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Email Address</label>
                          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 text-xs font-semibold bg-white border-slate-300 mt-1" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Address</label>
                          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-9 text-xs font-semibold bg-white border-slate-300 mt-1" />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">GSTIN Number</label>
                          <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} className="h-9 text-xs font-mono font-bold bg-white border-slate-300 mt-1" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: Subscription Tier & Staff Passwords (5 Cols) */}
                  <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
                    
                    {/* Subscription Plan & Expiry */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-3 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Crown className="w-4 h-4 text-amber-100" /> 2. Subscription Tier Plan & Expiry
                        </div>
                      </div>
                      <div className="p-4 space-y-3 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Subscription Tier</label>
                          <Select value={form.plan} onValueChange={handlePlanSelection}>
                            <SelectTrigger className="h-9 text-xs font-extrabold bg-white border-slate-300 mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="spark" className="font-bold text-xs">⚡ Spark Plan (Essential Retail)</SelectItem>
                              <SelectItem value="hero" className="font-bold text-xs">✨ Hero Plan (Advanced Operations)</SelectItem>
                              <SelectItem value="prime" className="font-bold text-xs">👑 Prime Plan (All-Inclusive Enterprise)</SelectItem>
                              <SelectItem value="custom" className="font-bold text-xs">🛠️ Custom Plan (Tailored Selection)</SelectItem>
                              <SelectItem value="trial" className="text-xs">Free Trial</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="font-bold text-slate-700 uppercase text-[10.5px]">Subscription Expiry Date</label>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Input type="date" value={form.subscriptionEndDate} onChange={(e) => setForm({ ...form, subscriptionEndDate: e.target.value })} className="h-9 text-xs font-bold bg-white border-slate-300 flex-1" />
                            <button type="button" onClick={() => { const d = new Date(); d.setDate(d.getDate() + 30); setForm(f => ({ ...f, subscriptionEndDate: d.toISOString().slice(0, 10) })); }} className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1.5 rounded hover:bg-amber-200">
                              +30D
                            </button>
                            <button type="button" onClick={() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); setForm(f => ({ ...f, subscriptionEndDate: d.toISOString().slice(0, 10) })); }} className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1.5 rounded hover:bg-amber-200">
                              +1Yr
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Staff Account Credentials & Password Reveal */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col justify-between">
                      <div className="bg-slate-50 p-3 border-b border-slate-200 font-extrabold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-purple-600" /> 3. Staff Account Passwords
                      </div>
                      <div className="p-4 space-y-3 text-xs">
                        {([
                          { role: "owner" as const, label: "GST Owner Account", username: editingShop?.initialAdminUsername || "owner" },
                          { role: "operator" as const, label: "Non-GST Operator", username: editingShop?.initialOperatorUsername || "operator" },
                        ]).map(({ role, label, username }) => (
                          <div key={role} className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-500">{label}</span>
                                <div className="font-mono font-bold text-slate-900 text-xs mt-0.5">{username}</div>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] font-bold rounded-lg bg-white border-slate-300 px-2"
                                onClick={() => {
                                  if (!editingShop) return;
                                  setResetUserTarget({ shop: editingShop, userRole: role });
                                  setResetUserPasswordForm({ username, role, newPassword: "", generatedPassword: "" });
                                }}
                              >
                                Reset Pass
                              </Button>
                            </div>

                            <div className="flex items-center justify-between pt-1.5 border-t border-slate-200">
                              <span className="font-mono font-bold text-slate-900 text-xs">
                                {revealedPasswords[role] !== undefined ? revealedPasswords[role] : "••••••••"}
                              </span>
                              <div className="flex items-center gap-1">
                                {revealedPasswords[role] !== undefined && (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 rounded-lg"
                                    onClick={() => copyToClipboard(revealedPasswords[role]!, `${label} Password`)}
                                  >
                                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-lg"
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
                    </div>

                  </div>
                </div>
              ) : (
                /* TAB 2: MODULE & PAGE PERMISSIONS TREE */
                <div className="space-y-4">
                  <ModuleSelectorTree
                    selectedPages={form.allowedPages}
                    selectedModules={form.allowedModules}
                    onPagesChange={(pages) => setForm((prev) => ({ ...prev, allowedPages: pages }))}
                    onModulesChange={(modules) => setForm((prev) => ({ ...prev, allowedModules: modules }))}
                    onPlanQuickSelect={handlePlanSelection}
                    currentPlan={form.plan}
                  />
                </div>
              )}

            </div>

            {/* FIXED BOTTOM ACTION BAR */}
            <div className="bg-white border-t border-slate-200 p-4 sm:p-5 flex items-center justify-between shadow-xl shrink-0">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                {editActiveTab === 'profile' ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditActiveTab('permissions')}
                    className="h-9 px-4 text-xs font-bold border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-xl flex items-center gap-1.5"
                  >
                    Customize Module Permissions ({form.allowedPages?.length || 0}/26 Pages) <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditActiveTab('profile')}
                    className="h-9 px-4 text-xs font-bold border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-xl flex items-center gap-1.5"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back to Showroom Profile
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="h-10 px-5 font-bold rounded-xl border-slate-300 text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-[#FA8112] hover:bg-[#FA8112]/90 text-white font-bold h-10 px-7 rounded-xl shadow-md text-xs">
                  {isSubmitting ? "Saving Changes..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* PERSISTENT VIEW & SHARE CREDENTIALS MODAL */}
      <Dialog open={!!shareCredentialsShop} onOpenChange={(open) => { if (!open) setShareCredentialsShop(null); }}>
        <DialogContent className="max-w-md bg-white border-slate-200 shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-bold text-slate-900 flex items-center gap-2">
              <Share2 className="h-5 w-5 text-emerald-600" /> Showroom Login Credentials
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              View and share login credentials for <strong className="text-slate-800">{shareCredentialsShop?.shopName}</strong> anytime.
            </DialogDescription>
          </DialogHeader>

          {fetchingShareCredentials ? (
            <div className="py-12 text-center text-slate-500 text-xs font-semibold flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-[#FA8112]" />
              Fetching secure credentials...
            </div>
          ) : shareCredentialsData ? (
            <div className="space-y-4 py-2">
              {/* Shop Login ID & Link */}
              <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">Shop Login ID (Slug)</div>
                    <div className="font-mono font-extrabold text-slate-900 text-base">{shareCredentialsData.slug}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(shareCredentialsData.slug, "Shop Login ID")} className="bg-white border-amber-300 text-amber-900 font-bold text-xs h-8">
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copy ID
                  </Button>
                </div>
                <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs">
                  <span className="text-amber-900 font-medium truncate max-w-[220px]">Link: {shareCredentialsData.loginUrl}</span>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(shareCredentialsData.loginUrl, "Login Link")} className="text-amber-800 hover:text-amber-950 font-bold text-xs h-7 px-2">
                    <Copy className="w-3 h-3 mr-1" /> Copy Link
                  </Button>
                </div>
              </div>

              {/* Accounts Cards */}
              <div className="space-y-3">
                {/* GST Owner */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-[#FA8112] uppercase text-[11px] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#FA8112]" /> GST Owner Account
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(`Username: ${shareCredentialsData.ownerUsername}\nPassword: ${shareCredentialsData.ownerPassword || ''}`, "GST Owner Credentials")} className="h-6 text-[11px] font-bold text-slate-600 hover:text-slate-900">
                      <Copy className="w-3 h-3 mr-1" /> Copy Pair
                    </Button>
                  </div>
                  <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-medium">Username:</span>
                    <span className="font-mono font-bold text-slate-900">{shareCredentialsData.ownerUsername}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-medium">Password:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">
                        {showPasswordOwner ? (shareCredentialsData.ownerPassword || "••••••••") : "••••••••"}
                      </span>
                      <button type="button" onClick={() => setShowPasswordOwner(!showPasswordOwner)} className="text-slate-400 hover:text-slate-700">
                        {showPasswordOwner ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Non-GST Operator */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-blue-600 uppercase text-[11px] flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600" /> Non-GST Operator Account
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(`Username: ${shareCredentialsData.operatorUsername}\nPassword: ${shareCredentialsData.operatorPassword || ''}`, "Operator Credentials")} className="h-6 text-[11px] font-bold text-slate-600 hover:text-slate-900">
                      <Copy className="w-3 h-3 mr-1" /> Copy Pair
                    </Button>
                  </div>
                  <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-medium">Username:</span>
                    <span className="font-mono font-bold text-slate-900">{shareCredentialsData.operatorUsername}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-medium">Password:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">
                        {showPasswordOperator ? (shareCredentialsData.operatorPassword || "••••••••") : "••••••••"}
                      </span>
                      <button type="button" onClick={() => setShowPasswordOperator(!showPasswordOperator)} className="text-slate-400 hover:text-slate-700">
                        {showPasswordOperator ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Share Actions */}
              <div className="pt-2 grid grid-cols-2 gap-2">
                <Button
                  onClick={() => handleShareWhatsApp(shareCredentialsData)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
                >
                  <Send className="w-4 h-4" /> Share on WhatsApp
                </Button>
                <Button
                  onClick={() => handleCopyAllShareDetails(shareCredentialsData)}
                  variant="outline"
                  className="border-slate-300 font-bold text-slate-800 hover:bg-slate-100 h-10 text-xs rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-4 h-4 text-[#FA8112]" /> Copy All Details
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-slate-500 text-xs">Could not load credentials.</div>
          )}

          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button variant="ghost" onClick={() => setShareCredentialsShop(null)} className="w-full text-slate-600 font-bold">
              Close
            </Button>
          </DialogFooter>
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
              Share login credentials with {credentialsResult?.shopName}.
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

              {/* Share Actions */}
              <div className="pt-2 grid grid-cols-2 gap-2">
                <Button
                  onClick={() => {
                    const loginUrl = `${window.location.origin}/login`;
                    const ownerCred = credentialsResult.credentials.find(c => c.label.toLowerCase().includes('owner') || c.label.toLowerCase().includes('gst'));
                    const operatorCred = credentialsResult.credentials.find(c => c.label.toLowerCase().includes('operator') || c.label.toLowerCase().includes('non-gst'));
                    const text = `💎 *Jewellery ERP - Login Credentials*
🏪 *Showroom:* ${credentialsResult.shopName}
🆔 *Shop Login ID:* ${credentialsResult.loginId}
🌐 *Login Link:* ${loginUrl}

👤 *GST Owner Account:*
• Username: ${ownerCred?.username || 'owner'}
• Password: ${ownerCred?.password || ''}

👤 *Non-GST Operator Account:*
• Username: ${operatorCred?.username || 'operator'}
• Password: ${operatorCred?.password || ''}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
                >
                  <Send className="w-4 h-4" /> Share on WhatsApp
                </Button>
                <Button
                  onClick={() => {
                    const loginUrl = `${window.location.origin}/login`;
                    const ownerCred = credentialsResult.credentials.find(c => c.label.toLowerCase().includes('owner') || c.label.toLowerCase().includes('gst'));
                    const operatorCred = credentialsResult.credentials.find(c => c.label.toLowerCase().includes('operator') || c.label.toLowerCase().includes('non-gst'));
                    const text = `💎 *Jewellery ERP - Login Credentials*
🏪 *Showroom:* ${credentialsResult.shopName}
🆔 *Shop Login ID:* ${credentialsResult.loginId}
🌐 *Login Link:* ${loginUrl}

👤 *GST Owner Account:*
• Username: ${ownerCred?.username || 'owner'}
• Password: ${ownerCred?.password || ''}

👤 *Non-GST Operator Account:*
• Username: ${operatorCred?.username || 'operator'}
• Password: ${operatorCred?.password || ''}`;
                    copyToClipboard(text, "All Credentials & Login Link");
                  }}
                  variant="outline"
                  className="border-slate-300 font-bold text-slate-800 hover:bg-slate-100 h-10 text-xs rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-4 h-4 text-[#FA8112]" /> Copy All Details
                </Button>
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
