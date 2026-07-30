import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { superAdminAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function SuperAdminLoginPage() {
  const { setSuperAdminSession } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");


  // Quick local-development default: if user leaves password empty,
  // use the seeded default from backend seed script.
  // Seed uses env SUPERADMIN_PASSWORD or fallback 'ChangeMe123!'.
  const seededDefaultPassword = "bajrang@55";

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[SuperAdminLogin] submit", { username: username.trim() });
    setIsLoading(true);
    try {
      const result = await superAdminAPI.login({
        username: username.trim(),
        password: password?.trim() ? password.trim() : seededDefaultPassword,
      });


      console.log("[SuperAdminLogin] login success", {
        adminId: (result as any).admin?.id,
        adminName: (result as any).admin?.name,
      });
      setSuperAdminSession({ token: result.token, admin: result.admin });
      toast.success(`Welcome back, ${result.admin.name}!`);
      navigate("/superadmin");
    } catch (err) {
      console.error("[SuperAdminLogin] login failed", err);
      toast.error((err as Error).message || "User not found");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2 font-sans">
      <div className="flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#FA8112]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-[#FA8112]/10 rounded-full blur-3xl pointer-events-none" />

        <Card className="w-full max-w-md shadow-2xl border-border relative z-10 bg-card/80 backdrop-blur-sm text-card-foreground">
          <CardHeader className="text-center pb-4">
            <Link to="/" className="flex items-center gap-2.5 justify-center mb-4">
              <img src="/logo.png" alt="jewellarifyerp Logo" className="h-12 w-12 object-contain" />
              <div className="leading-tight text-left">
                <div className="font-serif text-2xl font-semibold text-foreground">jewellarifyerp</div>
                <div className="-mt-0.5 text-[10px] tracking-[0.25em] text-[#FA8112]">JEWELLERY ERP</div>
              </div>
            </Link>
            <CardTitle className="text-3xl font-serif tracking-tight text-foreground">Super Admin</CardTitle>
            <CardDescription className="text-base mt-1 text-muted-foreground">Platform control panel</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="superadmin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                    className="h-11 pl-10 bg-background border-border focus:ring-primary text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={false}
                    className="h-11 pl-10 pr-10 bg-background border-border focus:ring-primary text-foreground placeholder:text-muted-foreground"
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
                className="w-full h-11 text-base font-semibold bg-[#FA8112] text-white shadow-lg shadow-[#FA8112]/20 hover:bg-[#FA8112]/90 transition-all duration-200 mt-4"
                disabled={isLoading}
              >
                {isLoading ? "Authenticating..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
          <div className="px-6 pb-6 text-center mt-2">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to shop login
            </Link>
          </div>
        </Card>
      </div>
      <div className="hidden lg:block relative">
        <img
          src="/dashboard.png"
          alt="Jewellery ERP Dashboard"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-black/10" />
        <div className="relative h-full flex flex-col justify-end p-12 text-white">
          <h2 className="font-serif text-4xl font-bold leading-tight">
            Manage the Entire Platform.
          </h2>
          <p className="mt-4 max-w-md text-lg text-white/80">
            Onboard new shops, manage subscriptions, and oversee the entire SaaS ecosystem from one powerful control panel.
          </p>
        </div>
      </div>
    </div>
  );
}
