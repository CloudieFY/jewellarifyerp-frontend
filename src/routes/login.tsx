import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User, Store as StoreIcon, Eye, EyeOff, ArrowLeft, Hammer, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, Link } from "react-router-dom";
import { tenantAuthAPI } from "@/lib/api";
import { useAuth, type TenantSession } from "@/lib/auth";

export default function LoginPage() {
  const { setTenantSession } = useAuth();
  const navigate = useNavigate();
  const [isKarigarMode, setIsKarigarMode] = useState(false);
  const [shopSlug, setShopSlug] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await tenantAuthAPI.login({
        shopSlug: isKarigarMode ? "" : shopSlug.trim(),
        username: username.trim().toLowerCase(),
        password,
      });

      const session: TenantSession = {
        token: result.token,
        user: result.user,
        shop: result.shop,
      };

      setTenantSession(session);
      toast.success(`Welcome ${session.user.name}!`);
      if (session.user.role === 'karigar') {
        navigate("/karigar-tasks");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Login failed", err);
      toast.error((err as Error).message || "User not found");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-12 font-sans bg-linear-to-br from-amber-500/5 via-background to-slate-900/5">
      {/* LEFT COLUMN: LOGIN FORM */}
      <div className="lg:col-span-7 xl:col-span-6 flex items-center justify-center p-4 sm:p-8 lg:p-12">
        <Card className="w-full max-w-md shadow-2xl border-amber-500/20 bg-background/95 backdrop-blur-md rounded-2xl overflow-hidden transition-all">
          <CardHeader className="text-center pb-2 pt-6 sm:pt-8">
            {/* LOGO BRANDING */}
            <Link to="/" className="inline-flex items-center gap-3 justify-center mb-5 group">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 shadow-xs group-hover:scale-105 transition-transform">
                <img
                  src="/logo.png"
                  alt="jewellarifyerp Logo"
                  className="h-10 w-10 object-contain"
                />
              </div>
              <div className="leading-tight text-left">
                <div className="font-display text-2xl font-bold tracking-tight text-foreground">
                  jewellarify<span className="text-amber-700 dark:text-amber-400">erp</span>
                </div>
                <div className="-mt-1 text-[10px] tracking-[0.25em] font-bold text-amber-600 dark:text-amber-400 uppercase">
                  JEWELLERY ERP SYSTEM
                </div>
              </div>
            </Link>

            {/* ROLE SWITCHER PILL TABS */}
            <div className="grid grid-cols-2 bg-muted/60 p-1.5 rounded-xl border border-border mb-6">
              <button
                type="button"
                onClick={() => setIsKarigarMode(false)}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  !isKarigarMode
                    ? "bg-linear-to-r from-amber-700 to-amber-800 text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <StoreIcon className="w-3.5 h-3.5" /> Shop Sign In
              </button>
              <button
                type="button"
                onClick={() => setIsKarigarMode(true)}
                className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  isKarigarMode
                    ? "bg-linear-to-r from-amber-600 to-amber-700 text-white shadow-md"
                    : "text-amber-800 dark:text-amber-300 hover:text-amber-900 bg-amber-500/10"
                }`}
              >
                <Hammer className="w-3.5 h-3.5" /> Karigar Login
              </button>
            </div>

            <CardTitle className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
              {isKarigarMode ? (
                <>
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                    <Hammer className="w-4 h-4" />
                  </div>
                  Karigar Portal Sign In
                </>
              ) : (
                "Shop Staff / Admin Sign In"
              )}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1.5 text-muted-foreground max-w-xs mx-auto">
              {isKarigarMode
                ? "Enter your Karigar Username & Password to access your assigned work dashboard."
                : "Enter your shop credentials to access billing, inventory, and management dashboard."}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 pt-4 space-y-4">
            <form onSubmit={handleLogin} className="space-y-4">
              {!isKarigarMode && (
                <div className="space-y-1.5">
                  <Label htmlFor="shopSlug" className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Shop ID / Store Identifier *
                  </Label>
                  <div className="relative">
                    <StoreIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="shopSlug"
                      type="text"
                      placeholder="e.g. yash-jewellers"
                      value={shopSlug}
                      onChange={(e) => setShopSlug(e.target.value)}
                      required={!isKarigarMode}
                      autoFocus={!isKarigarMode}
                      className="h-11 pl-10 bg-background border-border focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600 rounded-xl text-foreground placeholder:text-muted-foreground/60 text-sm font-medium"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    This is the unique Shop ID provided by your shop owner.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  {isKarigarMode ? "Karigar Username *" : "Username *"}
                </Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder={isKarigarMode ? "e.g. karigar-ramesh" : "Enter your username"}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="h-11 pl-10 bg-background border-border focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600 rounded-xl text-foreground placeholder:text-muted-foreground/60 text-sm font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 pl-10 pr-10 bg-background border-border focus:ring-2 focus:ring-amber-500/40 focus:border-amber-600 rounded-xl text-foreground placeholder:text-muted-foreground/60 text-sm font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className={`w-full h-11 text-sm sm:text-base font-bold text-white shadow-lg transition-all duration-200 mt-6 rounded-xl ${
                  isKarigarMode
                    ? "bg-linear-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-700 hover:to-amber-900 shadow-amber-600/25"
                    : "bg-linear-to-r from-amber-700 via-amber-800 to-amber-900 hover:from-amber-800 hover:to-amber-950 shadow-amber-700/25"
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 animate-spin" /> Verifying Credentials...
                  </span>
                ) : isKarigarMode ? (
                  "Sign In to Karigar Portal"
                ) : (
                  "Sign In to Shop Dashboard"
                )}
              </Button>
            </form>

            {/* SECONDARY MODE TOGGLE BUTTON */}
            <div className="pt-2 text-center">
              {!isKarigarMode ? (
                <button
                  type="button"
                  onClick={() => setIsKarigarMode(true)}
                  className="w-full inline-flex items-center justify-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-4 py-2.5 rounded-xl transition-colors"
                >
                  <Hammer className="w-4 h-4 text-amber-600" /> Are you a Karigar? Click here for Karigar Login
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsKarigarMode(false)}
                  className="w-full inline-flex items-center justify-center gap-2 text-xs font-semibold text-foreground bg-muted/60 hover:bg-muted border border-border px-4 py-2.5 rounded-xl transition-colors"
                >
                  <StoreIcon className="w-4 h-4 text-amber-700" /> Switch to Shop Staff / Admin Sign In
                </button>
              )}
            </div>

            {/* BACK TO HOME LINK */}
            <div className="pt-4 text-center border-t border-border/60">
              <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400 transition-colors font-medium">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
              </Link>
            </div>

            <div className="text-center pt-2 text-[11px] text-muted-foreground/80">
              &copy; {new Date().getFullYear()} jewellarifyerp. All rights reserved.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT COLUMN: LUXURY HERO DISPLAY (DESKTOP) */}
      <div className="hidden lg:block lg:col-span-5 xl:col-span-6 relative overflow-hidden bg-slate-950">
        <img
          src="/dashboard.png"
          alt="Jewellery ERP Showcase"
          className="absolute inset-0 h-full w-full object-cover opacity-60 scale-105 hover:scale-100 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/60 to-slate-900/30" />

        <div className="relative h-full flex flex-col justify-between p-12 text-white z-10">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest bg-amber-500/20 backdrop-blur-md px-3 py-1.5 rounded-full w-fit border border-amber-500/30">
            <ShieldCheck className="w-4 h-4" /> Enterprise Security Protected
          </div>

          <div className="space-y-6 max-w-lg">
            <h2 className="font-display text-4xl xl:text-5xl font-bold leading-tight tracking-tight text-amber-100">
              The Complete ERP for Modern Jewellers &amp; Artisans.
            </h2>
            <p className="text-slate-300 text-base leading-relaxed">
              Streamline POS billing, live metal rate calculations, old gold melting, Girvi loans, and Karigar work orders with real-time accuracy.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 text-xs">
              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" /> Fast POS GST Billing
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" /> Live Metal Rate Ticker
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" /> Girvi Interest Ledger
              </div>
              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" /> Karigar Portal Access
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
