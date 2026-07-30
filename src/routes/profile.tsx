import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth, type TenantShopInfo } from "@/lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Facebook,
  FileText,
  ImagePlus,
  Save,
  Keyboard,
  ArrowRight,
  Hash,
  Users,
  ShieldCheck,
  Zap,
  ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTenantAPI } from "@/lib/api";
import { useFormKeyboardNav } from "@/lib/useFormKeyboardNav";
import { GLOBAL_SHORTCUTS } from "@/hooks/useGlobalKeyboard";

type ShopProfile = Omit<TenantShopInfo, "id" | "slug" | "plan" | "subscriptionEndDate"> & {
  numberOfShopOwner?: string;
  instaId?: string;
  fbId?: string;
};

interface ProfileApiResponse {
  shop: ShopProfile;
}

// ─── Keyboard badge helper ───────────────────────────────────────────────────
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono font-bold shadow-[0_1px_0_hsl(var(--border))]">
      {children}
    </kbd>
  );
}

function ShortcutRow({
  keys,
  label,
  highlight,
}: {
  keys: string[];
  label: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-2 px-3 rounded-lg transition-colors ${
        highlight ? "bg-primary/5 border border-primary/20" : "hover:bg-muted/60"
      }`}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 shrink-0">
        {keys.map((part, i) => (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && <span className="text-muted-foreground text-[10px] mx-0.5">+</span>}
            <Kbd>{part}</Kbd>
          </span>
        ))}
      </span>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { tenantSession, setTenantSession } = useAuth();
  const api = useTenantAPI();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"shop" | "social" | "invoice" | "shortcuts">("shop");

  const { data, isLoading, error } = useQuery<ProfileApiResponse>({
    queryKey: ["tenantProfile"],
    queryFn: api.profile.get,
    enabled: !!tenantSession?.token,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [form, setForm] = useState({
    shopName: "",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
    gstNumber: "",
    logoUrl: "",
    termsAndConditions: "",
    numberOfShopOwner: "",
    instaId: "",
    fbId: "",
  });

  useEffect(() => {
    if (data?.shop) {
      setForm({
        shopName: data.shop.shopName || "",
        ownerName: data.shop.ownerName || "",
        phone: data.shop.phone || "",
        email: data.shop.email || "",
        address: data.shop.address || "",
        gstNumber: data.shop.gstNumber || "",
        logoUrl: data.shop.logoUrl || "",
        termsAndConditions: data.shop.termsAndConditions || "",
        numberOfShopOwner: data.shop.numberOfShopOwner || "",
        instaId: data.shop.instaId || "",
        fbId: data.shop.fbId || "",
      });
    }
  }, [data]);

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: (updatedForm: typeof form) => api.profile.update(updatedForm),
    onSuccess: (data) => {
      if (data.shop && tenantSession) {
        setTenantSession({ ...tenantSession, shop: data.shop });
      }
      queryClient.setQueryData<ProfileApiResponse>(["tenantProfile"], (old) =>
        old ? { ...old, shop: data.shop } : old
      );
      toast.success("Shop profile updated successfully!");
    },
    onError: (error: any) => {
      console.error("Failed to update profile:", error);
    },
  });

  const handleSave = () => save(form);
  const formKeyboardNav = useFormKeyboardNav(handleSave);

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

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
        updateField("logoUrl", canvas.toDataURL("image/webp", 0.8));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!tenantSession) return <div className="p-6">No tenant session found</div>;
  if (isLoading && !data) return <Layout><div className="p-6">Loading profile...</div></Layout>;
  if (error) return <Layout><div className="p-6 text-red-500">Error: {(error as Error).message}</div></Layout>;
  if (!data?.shop) return <Layout><div className="p-6 text-muted-foreground">No shop profile found.</div></Layout>;

  const initials = form.shopName.slice(0, 2).toUpperCase() || "SH";

  const tabs = [
    { key: "shop",      label: "Shop Details",  icon: Building2 },
    { key: "social",    label: "Social & GST",  icon: Instagram },
    { key: "invoice",   label: "Invoice & Logo", icon: FileText },
    { key: "shortcuts", label: "Keyboard Shortcuts", icon: Keyboard },
  ] as const;

  // Group global shortcuts by group
  const shortcutGroups = GLOBAL_SHORTCUTS.reduce<Record<string, typeof GLOBAL_SHORTCUTS>>((acc, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  }, {});

  return (
    <Layout>
      {/* Page header */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          {/* Shop avatar */}
          <div className="relative">
            {form.logoUrl ? (
              <img
                src={form.logoUrl}
                alt="Shop Logo"
                className="w-16 h-16 rounded-2xl object-contain border border-border bg-muted p-1 shadow-sm"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-sm">
                {initials}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-background flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-white" />
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">
              {form.shopName || "Shop Profile"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {form.ownerName && <span>{form.ownerName} · </span>}
              Shop Settings &amp; Keyboard Shortcuts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs hidden sm:flex items-center gap-1.5">
            <Kbd>Ctrl</Kbd><span className="text-muted-foreground">+</span><Kbd>Enter</Kbd>
            <span className="text-muted-foreground ml-1">to save</span>
          </Badge>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2 min-w-[120px]">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted/80 border border-border p-1 rounded-xl w-fit mb-6 flex-wrap">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === t.key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab: Shop Details ── */}
      {activeTab === "shop" && (
        <div onKeyDown={formKeyboardNav}>
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 font-display">
                <Building2 className="w-5 h-5 text-primary" />
                Shop &amp; Owner Information
              </CardTitle>
              <CardDescription>
                Displayed on all invoices and receipts. Press <Kbd>Enter</Kbd> or <Kbd>↓</Kbd> to jump to next field.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-muted-foreground" />Shop Name</Label>
                  <Input value={form.shopName} onChange={(e) => updateField("shopName", e.target.value)} placeholder="My Jewellery Shop" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-muted-foreground" />Owner Name</Label>
                  <Input value={form.ownerName} onChange={(e) => updateField("ownerName", e.target.value)} placeholder="Full name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-muted-foreground" />Phone</Label>
                  <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-muted-foreground" />Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="shop@email.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5 text-muted-foreground" />Number of Shop Owners</Label>
                  <Input value={form.numberOfShopOwner} onChange={(e) => updateField("numberOfShopOwner", e.target.value)} placeholder="1" />
                </div>
              </div>
              <div className="space-y-1.5 mt-5">
                <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-muted-foreground" />Address</Label>
                <Textarea rows={3} value={form.address} onChange={(e) => updateField("address", e.target.value)} placeholder="Shop address for invoices…" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Social & GST ── */}
      {activeTab === "social" && (
        <div onKeyDown={formKeyboardNav}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 font-display">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  Tax Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>GST Number</Label>
                  <Input
                    value={form.gstNumber}
                    onChange={(e) => updateField("gstNumber", e.target.value.toUpperCase())}
                    placeholder="22AAAAA0000A1Z5"
                    className="font-mono tracking-wider"
                  />
                  <p className="text-xs text-muted-foreground">15-character GSTIN. Printed on GST invoices.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 font-display">
                  <Instagram className="w-5 h-5 text-pink-500" />
                  Social Media
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Instagram className="w-3.5 h-3.5 text-pink-500" />Instagram</Label>
                  <Input value={form.instaId} onChange={(e) => updateField("instaId", e.target.value)} placeholder="@your_insta_handle" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Facebook className="w-3.5 h-3.5 text-blue-500" />Facebook Page</Label>
                  <Input value={form.fbId} onChange={(e) => updateField("fbId", e.target.value)} placeholder="your_facebook_page" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Tab: Invoice & Logo ── */}
      {activeTab === "invoice" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 font-display">
                <ImagePlus className="w-5 h-5 text-indigo-500" />
                Shop Logo
              </CardTitle>
              <CardDescription>Shown on invoice headers. Max 300px wide, auto-compressed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="w-full aspect-video bg-muted/30 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo preview" className="max-h-full max-w-full object-contain p-4" />
                ) : (
                  <div className="text-center space-y-2">
                    <ImagePlus className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                    <p className="text-sm text-muted-foreground">Upload a logo to preview</p>
                  </div>
                )}
              </div>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                className="cursor-pointer"
              />
              {form.logoUrl && (
                <Button variant="outline" size="sm" className="w-full text-rose-500 hover:text-rose-600" onClick={() => updateField("logoUrl", "")}>
                  Remove Logo
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 font-display">
                <FileText className="w-5 h-5 text-amber-500" />
                Terms &amp; Conditions
              </CardTitle>
              <CardDescription>Printed at the bottom of every invoice.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={10}
                value={form.termsAndConditions}
                onChange={(e) => updateField("termsAndConditions", e.target.value)}
                placeholder="e.g., All goods once sold will not be taken back or exchanged without original invoice. Subject to local jurisdiction."
                className="resize-none font-mono text-xs"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab: Keyboard Shortcuts ── */}
      {activeTab === "shortcuts" && (
        <div className="space-y-6">
          {/* Hero card */}
          <Card className="shadow-sm border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Keyboard className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Work faster with keyboard shortcuts</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Navigate the entire software without touching the mouse. Press <Kbd>?</Kbd> from any page to open this panel instantly.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Object.entries(shortcutGroups).map(([group, shortcuts]) => {
              const icons: Record<string, typeof Zap> = {
                Navigation: ArrowRight,
                "Page Actions": Zap,
                Forms: Save,
                Tables: ChevronRight,
                Help: Keyboard,
              };
              const GroupIcon = icons[group] || Keyboard;

              return (
                <Card key={group} className="shadow-sm">
                  <CardHeader className="pb-3 pt-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      <GroupIcon className="w-4 h-4 text-primary" />
                      {group}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-0.5">
                    {shortcuts.map((s, i) => {
                      const parts: string[] = [];
                      if (s.ctrl) parts.push("Ctrl");
                      if (s.alt) parts.push("Alt");
                      if (s.shift) parts.push("Shift");
                      parts.push(s.key);
                      const isForm = s.ctrl && s.key === "Enter";
                      return (
                        <ShortcutRow
                          key={i}
                          keys={parts}
                          label={s.description}
                          highlight={isForm}
                        />
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick tip banner */}
          <Card className="shadow-sm border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="flex items-start gap-3 pt-5">
              <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <span className="font-semibold">Pro tip — </span>
                Use <Kbd>Alt+2</Kbd> to jump straight to Billing/POS, <Kbd>N</Kbd> to open the Add New dialog, and <Kbd>F</Kbd> to focus the search bar — all without touching the mouse.
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer save bar */}
      <footer className="mt-8 pt-5 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground hidden sm:block">
          <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> &nbsp;or&nbsp; <Kbd>Alt</Kbd> + <Kbd>S</Kbd> to save from anywhere on this page.
        </p>
        <Button onClick={handleSave} disabled={isSaving} size="lg" className="gap-2 min-w-[160px]">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isSaving ? "Saving…" : "Save Changes"}
        </Button>
      </footer>
    </Layout>
  );
}