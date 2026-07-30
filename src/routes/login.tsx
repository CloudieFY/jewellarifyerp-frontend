import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User, Store as StoreIcon, Eye, EyeOff, ArrowLeft, Hammer } from "lucide-react";
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
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2 font-sans">
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md shadow-2xl border-border bg-card text-card-foreground">
          <CardHeader className="text-center pb-4">
            <Link to="/" className="flex items-center gap-2.5 justify-center mb-4">
              <img
                src="/logo.png"
                alt="jewellarifyerp Logo"
                className="h-12 w-12 object-contain"
              />
              <div className="leading-tight text-left">
                <div className="font-serif text-2xl font-semibold text-foreground">jewellarifyerp</div>
                <div className="-mt-0.5 text-[10px] tracking-[0.25em] text-[#FA8112]">JEWELLERY ERP</div>
              </div>
            </Link>

            {/* Role Switcher Tabs */}
            <div className="flex bg-muted/70 p-1 rounded-lg border border-border mb-3">
              <button
                type="button"
                onClick={() => setIsKarigarMode(false)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  !isKarigarMode
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <StoreIcon className="w-3.5 h-3.5" /> Shop Sign In
              </button>
              <button
                type="button"
                onClick={() => setIsKarigarMode(true)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  isKarigarMode
                    ? "bg-amber-600 text-white shadow-sm font-bold"
                    : "text-amber-800 hover:text-amber-900 bg-amber-500/10"
                }`}
              >
                <Hammer className="w-3.5 h-3.5" /> Karigar Login
              </button>
            </div>

            <CardTitle className="font-serif text-3xl tracking-tight text-foreground flex items-center justify-center gap-2">
              {isKarigarMode ? (
                <>
                  <Hammer className="w-7 h-7 text-amber-600 inline" /> Karigar Portal Sign In
                </>
              ) : (
                "Shop Sign In"
              )}
            </CardTitle>
            <CardDescription className="text-base mt-1 text-muted-foreground">
              {isKarigarMode
                ? "Enter your Karigar Username & Password to access your assigned work dashboard."
                : "Enter your credentials to access your shop dashboard."}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-2">
            <form onSubmit={handleLogin} className="space-y-4">
              {!isKarigarMode && (
                <div className="space-y-1.5">
                  <Label htmlFor="shopSlug">Shop ID</Label>
                  <div className="relative">
                    <StoreIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="shopSlug"
                      type="text"
                      placeholder="e.g. your-shop-name"
                      value={shopSlug}
                      onChange={(e) => setShopSlug(e.target.value)}
                      required={!isKarigarMode}
                      autoFocus={!isKarigarMode}
                      className="h-11 pl-9 bg-background border-border focus:ring-primary text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    This is the unique Shop ID provided by your shop owner.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="username">{isKarigarMode ? "Karigar Username" : "Username"}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder={isKarigarMode ? "Enter karigar username" : "Enter your username"}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="h-11 pl-9 bg-background border-border focus:ring-primary text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 pl-9 pr-10 bg-background border-border focus:ring-primary text-foreground placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className={`w-full h-11 text-base font-semibold text-white shadow-lg transition-all duration-200 mt-6! ${
                  isKarigarMode
                    ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                    : "bg-[#FA8112] hover:bg-[#FA8112]/90 shadow-[#FA8112]/20"
                }`}
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : isKarigarMode ? "Sign In to Karigar Portal" : "Sign In"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              {!isKarigarMode ? (
                <button
                  type="button"
                  onClick={() => setIsKarigarMode(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-900 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3.5 py-2 rounded-md transition-colors"
                >
                  <Hammer className="w-3.5 h-3.5" /> Are you a Karigar? Click here for Karigar Login
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsKarigarMode(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border px-3.5 py-2 rounded-md transition-colors"
                >
                  <StoreIcon className="w-3.5 h-3.5" /> Switch to Shop Staff / Admin Sign In
                </button>
              )}
            </div>
          </CardContent>

          <div className="px-6 pb-4 text-center">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
            </Link>
          </div>

          <div className="text-center pb-6 pt-4 text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} jewellarifyerp. All rights reserved.
          </div>
        </Card>
      </div>

      <div className="hidden lg:block relative">
        <img
          src="/dashboard.png"
          alt="Elegant jewellery display"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-black/10" />
        <div className="relative h-full flex flex-col justify-end p-12 text-white">
          <h2 className="font-serif text-4xl font-bold leading-tight">
            The Complete ERP for the Modern Jeweller.
          </h2>
          <p className="mt-4 max-w-md text-lg text-white/80">
            From billing to barcode, manage every facet of your business with precision and ease.
          </p>
        </div>
      </div>
    </div>
  );
}
