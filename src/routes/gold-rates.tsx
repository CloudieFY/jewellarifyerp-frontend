import { useEffect, useState, useMemo } from "react";
import { useFormKeyboardNav } from "@/lib/useFormKeyboardNav";
import { Layout } from "@/components/Layout";
import { formatDate } from "@/lib/utils";
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
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { inr, type MetalRates } from "@/lib/storage";
import { useTenantAPI } from "@/lib/api";
import {
  TrendingUp,
  TrendingDown,
  Coins,
  Sparkles,
  Calculator,
  Clock,
  Edit3,
  Save,
  Flame,
  Award,
  Scale,
  Calendar,
  History,
  Zap,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const defaultRates: MetalRates = {
  updatedAt: new Date().toISOString(),
  gold24: 7850,
  gold22: 7200,
  gold20: 6540,
  gold18: 5890,
  silver: 98,
};

export default function GoldRatesPage() {
  const api = useTenantAPI();
  const queryClient = useQueryClient();

  const useApiMutation = (mutationFn: (...args: any[]) => Promise<any>, queryKey: string[]) => {
    return useMutation({
      mutationFn,
      onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });
  };

  const { data = [], isLoading, error } = useQuery({ queryKey: ["goldRates"], queryFn: api.goldRates.getAll });
  const createMutation = useApiMutation((data: MetalRates) => api.goldRates.create(data), ["goldRates"]);
  const updateMutation = useApiMutation(
    (data: { id: string; body: MetalRates }) => api.goldRates.update(data.id, data.body),
    ["goldRates"]
  );

  const latest = data[0];
  const previous = data[1];

  const [open, setOpen] = useState(false);
  const [rates, setRates] = useState<MetalRates>(defaultRates);

  // Quick Calculator State
  const [calcMetal, setCalcMetal] = useState<"24K" | "22K" | "20K" | "18K" | "Silver">("22K");
  const [calcWeightGrams, setCalcWeightGrams] = useState<number | "">(10);

  useEffect(() => {
    if (latest) {
      setRates({
        updatedAt: latest.updatedAt ?? new Date().toISOString(),
        gold24: latest.gold24,
        gold22: latest.gold22,
        gold20: latest.gold20 ?? 0,
        gold18: latest.gold18,
        silver: latest.silver,
      });
    }
  }, [latest]);

  const saveRateDirect = (key: keyof MetalRates, value: number) => {
    const nextRates = { ...rates, [key]: value, updatedAt: new Date().toISOString() };
    setRates(nextRates);
  };

  // Derived rate helpers when 24K is updated
  const applyAutoDeriveFrom24K = (base24k: number) => {
    if (base24k <= 0) return;
    setRates((prev) => ({
      ...prev,
      gold24: base24k,
      gold22: Math.round((base24k * 91.6) / 100),
      gold20: Math.round((base24k * 83.3) / 100),
      gold18: Math.round((base24k * 75.0) / 100),
      updatedAt: new Date().toISOString(),
    }));
    toast.info("Derived 22K, 20K, and 18K rates automatically from 24K base!");
  };

  const markUpdatedNow = async () => {
    const nextRates = { ...rates, updatedAt: new Date().toISOString() };
    setRates(nextRates);

    const todayStr = new Date().toDateString();
    const latestDateStr = latest?.updatedAt ? new Date(latest.updatedAt).toDateString() : "";

    try {
      if (latest && (latest as any)._id && todayStr === latestDateStr) {
        await updateMutation.mutateAsync({ id: (latest as any)._id, body: nextRates });
      } else {
        await createMutation.mutateAsync(nextRates);
      }
      toast.success("Live metal rates updated successfully!");
      setOpen(false);
    } catch (err: any) {
      toast.error("Failed to update rates: " + (err.message || "Unknown error"));
    }
  };

  const handleKeyNav = useFormKeyboardNav(markUpdatedNow);

  // Rate difference calculation vs previous entry
  const getDiff = (key: keyof MetalRates) => {
    if (!latest || !previous) return null;
    const curr = (latest as any)[key] || 0;
    const prev = (previous as any)[key] || 0;
    if (!prev) return null;
    const diff = curr - prev;
    const pct = ((diff / prev) * 100).toFixed(2);
    return { diff, pct: Number(pct) };
  };

  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    if (sorted.length === 0) {
      return [
        {
          date: formatDate(defaultRates.updatedAt).split(",")[0],
          "24K Gold": defaultRates.gold24,
          "22K Gold": defaultRates.gold22,
          "20K Gold": defaultRates.gold20,
          "18K Gold": defaultRates.gold18,
          Silver: defaultRates.silver,
        },
      ];
    }
    return sorted.map((r) => {
      const d = new Date(r.updatedAt);
      return {
        date: `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`,
        "24K Gold": r.gold24,
        "22K Gold": r.gold22,
        "20K Gold": r.gold20,
        "18K Gold": r.gold18,
        Silver: r.silver,
      };
    });
  }, [data]);

  const formatYAxis = (tickItem: number) => {
    if (tickItem >= 1000) return `₹${(tickItem / 1000).toFixed(1)}k`;
    return `₹${tickItem}`;
  };

  // Quick Calculator Value
  const calculatedTotalValue = useMemo(() => {
    const wt = typeof calcWeightGrams === "number" ? calcWeightGrams : 0;
    let ratePerGram = 0;
    if (calcMetal === "24K") ratePerGram = rates.gold24 || 0;
    if (calcMetal === "22K") ratePerGram = rates.gold22 || 0;
    if (calcMetal === "20K") ratePerGram = rates.gold20 || 0;
    if (calcMetal === "18K") ratePerGram = rates.gold18 || 0;
    if (calcMetal === "Silver") ratePerGram = rates.silver || 0;
    return Math.round(wt * ratePerGram);
  }, [calcMetal, calcWeightGrams, rates]);

  const metalCards = [
    {
      key: "gold24" as const,
      label: "24K Fine Gold",
      purity: "99.9% Pure",
      badge: "Pure Gold",
      badgeBg: "bg-amber-500 text-slate-950",
      bgGradient: "from-amber-500/20 via-yellow-400/10 to-amber-950/20 border-amber-400/40 dark:border-amber-500/50",
      accentColor: "text-amber-600 dark:text-amber-400",
      icon: Award,
    },
    {
      key: "gold22" as const,
      label: "22K Standard Gold",
      purity: "91.6% BIS Hallmark",
      badge: "Best Seller",
      badgeBg: "bg-yellow-600 text-white",
      bgGradient: "from-yellow-500/20 via-amber-400/10 to-yellow-950/20 border-yellow-400/40 dark:border-yellow-500/50",
      accentColor: "text-yellow-600 dark:text-yellow-400",
      icon: Coins,
    },
    {
      key: "gold20" as const,
      label: "20K Jewellery Gold",
      purity: "83.3% Hallmark",
      badge: "Kundan / Antique",
      badgeBg: "bg-orange-600 text-white",
      bgGradient: "from-orange-500/20 via-amber-500/10 to-orange-950/20 border-orange-400/40 dark:border-orange-500/50",
      accentColor: "text-orange-600 dark:text-orange-400",
      icon: Sparkles,
    },
    {
      key: "gold18" as const,
      label: "18K Diamond Gold",
      purity: "75.0% Hallmarked",
      badge: "Diamond Jewellery",
      badgeBg: "bg-rose-600 text-white",
      bgGradient: "from-rose-500/20 via-pink-400/10 to-rose-950/20 border-rose-400/40 dark:border-rose-500/50",
      accentColor: "text-rose-600 dark:text-rose-400",
      icon: Flame,
    },
    {
      key: "silver" as const,
      label: "99.9% Fine Silver",
      purity: "Chandi / Silver Bullion",
      badge: "Silver Rate",
      badgeBg: "bg-slate-700 text-white",
      bgGradient: "from-slate-400/20 via-slate-300/10 to-slate-900/20 border-slate-300 dark:border-slate-700",
      accentColor: "text-slate-700 dark:text-slate-300",
      icon: Scale,
    },
  ];

  return (
    <Layout>
      <div className="space-y-6 pb-10">
        {/* TOP HERO HEADER WITH GLASSMORPHISM */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-6 text-white shadow-xl border border-amber-500/30">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-0.5 text-xs font-mono">
                  ✨ Live Showroom Rates
                </Badge>
                <Badge className="bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  Last Updated: {formatDate(rates.updatedAt || new Date().toISOString())}
                </Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black font-display tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400">
                Gold & Silver Market Rates
              </h1>
              <p className="text-sm text-slate-300 mt-1 max-w-2xl font-medium">
                Set today's live per-gram rates for 24K, 22K, 20K, 18K Gold and Silver. Changes update instantly across Billing, Estimates, Buybacks & Customer Advances.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-slate-950 font-black shadow-lg shadow-amber-500/25 border border-amber-400/40 px-6 cursor-pointer flex items-center gap-2"
                  >
                    <Edit3 className="w-5 h-5" />
                    <span>Update Today's Rates</span>
                  </Button>
                </DialogTrigger>

                <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-2xl border border-amber-500/30" onKeyDown={handleKeyNav}>
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black font-display flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <Coins className="w-6 h-6" />
                      Update Today's Showroom Metal Rates
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Enter per-gram rates in INR. You can also type 24K base rate to auto-derive 22K, 20K & 18K.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-5 my-2">
                    {/* Auto-Derive 24K Box */}
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-amber-600 fill-amber-500" />
                          Auto-Calculate Purity Rates from 24K Base
                        </span>
                        <p className="text-[11px] text-amber-800 dark:text-amber-400">
                          Type 24K Gold Rate to auto-derive 22K (91.6%), 20K (83.3%) & 18K (75%)
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Input
                          type="number"
                          placeholder="24K Rate"
                          className="h-8 w-28 text-xs font-bold font-mono bg-white dark:bg-slate-900 border-amber-400 text-amber-900 dark:text-amber-200"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = Number((e.target as HTMLInputElement).value);
                              if (val > 0) applyAutoDeriveFrom24K(val);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Rates Edit Inputs Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span>24K Gold Rate (₹ / Gram)</span>
                          <span className="text-[10px] text-amber-600 font-bold">10g: {inr((rates.gold24 || 0) * 10)}</span>
                        </Label>
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            value={rates.gold24 || ""}
                            onChange={(e) => saveRateDirect("gold24", +e.target.value)}
                            className="font-mono font-bold text-base h-10 pr-16 bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 focus-visible:ring-amber-500"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-mono font-bold">₹/g</span>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span>22K Gold Rate (₹ / Gram)</span>
                          <span className="text-[10px] text-yellow-600 font-bold">10g: {inr((rates.gold22 || 0) * 10)}</span>
                        </Label>
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            value={rates.gold22 || ""}
                            onChange={(e) => saveRateDirect("gold22", +e.target.value)}
                            className="font-mono font-bold text-base h-10 pr-16 bg-yellow-50/40 dark:bg-yellow-950/20 border-yellow-300 focus-visible:ring-yellow-500"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-mono font-bold">₹/g</span>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span>20K Gold Rate (₹ / Gram)</span>
                          <span className="text-[10px] text-orange-600 font-bold">10g: {inr((rates.gold20 || 0) * 10)}</span>
                        </Label>
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            value={rates.gold20 || ""}
                            onChange={(e) => saveRateDirect("gold20", +e.target.value)}
                            className="font-mono font-bold text-base h-10 pr-16 bg-orange-50/40 dark:bg-orange-950/20 border-orange-300 focus-visible:ring-orange-500"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-mono font-bold">₹/g</span>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span>18K Gold Rate (₹ / Gram)</span>
                          <span className="text-[10px] text-rose-600 font-bold">10g: {inr((rates.gold18 || 0) * 10)}</span>
                        </Label>
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            value={rates.gold18 || ""}
                            onChange={(e) => saveRateDirect("gold18", +e.target.value)}
                            className="font-mono font-bold text-base h-10 pr-16 bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 focus-visible:ring-rose-500"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-mono font-bold">₹/g</span>
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span>99.9% Fine Silver Rate (₹ / Gram)</span>
                          <span className="text-[10px] text-slate-600 font-bold">10g: {inr((rates.silver || 0) * 10)} | 1kg: {inr((rates.silver || 0) * 1000)}</span>
                        </Label>
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            value={rates.silver || ""}
                            onChange={(e) => saveRateDirect("silver", +e.target.value)}
                            className="font-mono font-bold text-base h-10 pr-16 bg-slate-100/60 dark:bg-slate-900 border-slate-300 focus-visible:ring-slate-500"
                          />
                          <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-mono font-bold">₹/g</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t pt-4">
                    <div className="text-[11px] text-muted-foreground">
                      {isLoading ? "Loading..." : error ? "Error loading" : `Current Status: ${rates.updatedAt ? formatDate(rates.updatedAt) : "Not saved yet"}`}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 flex items-center gap-1.5"
                        onClick={markUpdatedNow}
                      >
                        <Save className="w-4 h-4" />
                        <span>Save Live Rates</span>
                      </Button>
                    </div>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* LUXURY METAL RATE CARDS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {metalCards.map((c) => {
            const Icon = c.icon;
            const currentVal = (rates as any)[c.key] || 0;
            const diffInfo = getDiff(c.key);
            const tolaVal = currentVal * 10;
            const kgVal = currentVal * 1000;

            return (
              <Card
                key={c.key}
                className={`relative overflow-hidden bg-gradient-to-br ${c.bgGradient} border-2 shadow-md hover:shadow-xl transition-all duration-300 group`}
              >
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div>
                    {/* Top Row Badge & Icon */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${c.badgeBg}`}>
                        {c.badge}
                      </span>
                      <div className="p-2 rounded-xl bg-white/60 dark:bg-slate-900/60 shadow-2xs border border-white/40">
                        <Icon className={`w-5 h-5 ${c.accentColor}`} />
                      </div>
                    </div>

                    {/* Metal Title & Purity */}
                    <h3 className="font-display font-black text-slate-900 dark:text-slate-100 text-base">{c.label}</h3>
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-0.5">{c.purity}</p>

                    {/* Large Price Display */}
                    <div className="mt-4 mb-2">
                      <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-950 dark:text-white flex items-baseline gap-1">
                        <span>{inr(currentVal)}</span>
                        <span className="text-xs font-bold text-slate-500 font-sans">/ g</span>
                      </div>
                    </div>

                    {/* Bulk Rates Breakdown (10g Tola / 1kg) */}
                    <div className="mt-3 pt-3 border-t border-slate-300/40 dark:border-slate-800 flex flex-col gap-1 text-[11px] font-mono">
                      <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                        <span>10g Rate:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">{inr(tolaVal)}</span>
                      </div>
                      {c.key === "silver" ? (
                        <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                          <span>1 Kg Rate:</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{inr(kgVal)}</span>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                          <span>1 Tola (11.66g):</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{inr(Math.round(currentVal * 11.664))}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price Trend Change Badge */}
                  {diffInfo && (
                    <div className="mt-4 pt-2 border-t border-slate-300/30 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">vs Prev Update:</span>
                      <span
                        className={`font-mono font-bold flex items-center gap-0.5 ${
                          diffInfo.diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {diffInfo.diff >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {diffInfo.diff >= 0 ? `+${diffInfo.diff}` : diffInfo.diff} ({diffInfo.pct}%)
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* QUICK COUNTER RATE CALCULATOR WIDGET & PRICE TREND CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 1. Quick Counter Price Calculator Card */}
          <Card className="lg:col-span-1 border-2 border-amber-500/20 shadow-lg bg-gradient-to-b from-amber-50/50 via-white to-amber-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
            <CardHeader className="pb-3 border-b border-amber-100 dark:border-slate-800">
              <CardTitle className="font-display text-lg flex items-center gap-2 text-amber-900 dark:text-amber-300">
                <Calculator className="w-5 h-5 text-amber-600" />
                Quick Counter Rate Calculator
              </CardTitle>
              <CardDescription className="text-xs">
                Instantly compute metal cost for any purity & weight
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Select Purity */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Select Metal Purity</Label>
                <div className="grid grid-cols-5 gap-1">
                  {(["24K", "22K", "20K", "18K", "Silver"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCalcMetal(m)}
                      className={`py-1.5 text-xs font-black rounded-md border transition-all cursor-pointer ${
                        calcMetal === m
                          ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 hover:bg-amber-100/50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Enter Weight */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Enter Weight in Grams (g)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={calcWeightGrams}
                    onChange={(e) => setCalcWeightGrams(e.target.value === "" ? "" : +e.target.value)}
                    placeholder="Enter weight in grams"
                    className="font-mono font-bold text-base h-11 pr-12 bg-white dark:bg-slate-900 border-amber-300 focus-visible:ring-amber-500"
                  />
                  <span className="absolute right-3 top-3 text-xs text-muted-foreground font-mono font-bold">g</span>
                </div>
              </div>

              {/* Result Valuation Display */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-md space-y-1 text-center">
                <span className="text-xs font-bold text-amber-100 tracking-wider uppercase">
                  Calculated Metal Cost ({calcMetal})
                </span>
                <div className="text-3xl font-black font-mono tracking-tight">
                  {inr(calculatedTotalValue)}
                </div>
                <div className="text-[11px] text-amber-100 font-mono">
                  {calcWeightGrams || 0}g × {inr(rates[calcMetal === "24K" ? "gold24" : calcMetal === "22K" ? "gold22" : calcMetal === "20K" ? "gold20" : calcMetal === "18K" ? "gold18" : "silver"] as number)}/g
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Gold Price Trend Chart */}
          <Card className="lg:col-span-2 border-2 border-slate-200 dark:border-slate-800 shadow-lg">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                  Gold Rates Historical Trend
                </CardTitle>
                <CardDescription className="text-xs">Daily per-gram price progression (24K vs 22K vs 18K)</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {chartData.length} Data Points
              </Badge>
            </CardHeader>
            <CardContent className="h-72 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="color24k" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="color22k" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="color18k" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#b45309" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#b45309" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} tickMargin={10} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={formatYAxis} domain={["auto", "auto"]} tickMargin={10} />
                  <RechartsTooltip
                    formatter={(value: number) => [inr(value), undefined]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)", backgroundColor: "rgba(255, 255, 255, 0.95)" }}
                    labelStyle={{ fontWeight: "bold", color: "#64748b", marginBottom: "4px" }}
                    cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 4" }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: "12px" }} />
                  <Area type="monotone" dataKey="24K Gold" stroke="#f59e0b" strokeWidth={3} fill="url(#color24k)" dot={chartData.length === 1} activeDot={{ r: 6, strokeWidth: 0, fill: "#f59e0b" }} />
                  <Area type="monotone" dataKey="22K Gold" stroke="#d97706" strokeWidth={3} fill="url(#color22k)" dot={chartData.length === 1} activeDot={{ r: 6, strokeWidth: 0, fill: "#d97706" }} />
                  <Area type="monotone" dataKey="18K Gold" stroke="#b45309" strokeWidth={3} fill="url(#color18k)" dot={chartData.length === 1} activeDot={{ r: 6, strokeWidth: 0, fill: "#b45309" }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* SILVER TREND & RATE HISTORY LOG TABLE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Silver Trend */}
          <Card className="lg:col-span-1 border-2 border-slate-200 dark:border-slate-800 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Scale className="w-5 h-5 text-slate-500" />
                Silver Rate Trend
              </CardTitle>
              <CardDescription className="text-xs">Per-gram 99.9% fine silver progression</CardDescription>
            </CardHeader>
            <CardContent className="h-64 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSilver" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64748b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} tickMargin={10} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={formatYAxis} domain={["auto", "auto"]} tickMargin={10} />
                  <RechartsTooltip
                    formatter={(value: number) => [inr(value), undefined]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)", backgroundColor: "rgba(255, 255, 255, 0.95)" }}
                    labelStyle={{ fontWeight: "bold", color: "#64748b", marginBottom: "4px" }}
                    cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 4" }}
                  />
                  <Area type="monotone" dataKey="Silver" stroke="#64748b" strokeWidth={3} fill="url(#colorSilver)" dot={chartData.length === 1} activeDot={{ r: 6, strokeWidth: 0, fill: "#64748b" }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Rate History Logs Table */}
          <Card className="lg:col-span-2 border-2 border-slate-200 dark:border-slate-800 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-amber-600" />
                Rates Revision History Log
              </CardTitle>
              <CardDescription className="text-xs">Recent date-wise rate entries stored in system</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs border-collapse text-left">
                <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-bold uppercase">
                  <tr>
                    <th className="p-3 border-b">Date & Time</th>
                    <th className="p-3 border-b text-right text-amber-700 dark:text-amber-400">24K Gold</th>
                    <th className="p-3 border-b text-right text-yellow-700 dark:text-yellow-400">22K Gold</th>
                    <th className="p-3 border-b text-right text-rose-700 dark:text-rose-400">18K Gold</th>
                    <th className="p-3 border-b text-right text-slate-700 dark:text-slate-300">Silver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                  {(data || []).slice(0, 8).map((r: any, idx: number) => (
                    <tr key={r._id || r.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="p-3 font-sans font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        {formatDate(r.updatedAt || new Date())}
                      </td>
                      <td className="p-3 text-right font-bold text-amber-900 dark:text-amber-200">{inr(r.gold24)}/g</td>
                      <td className="p-3 text-right font-bold text-yellow-900 dark:text-yellow-200">{inr(r.gold22)}/g</td>
                      <td className="p-3 text-right font-bold text-rose-900 dark:text-rose-200">{inr(r.gold18)}/g</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{inr(r.silver)}/g</td>
                    </tr>
                  ))}
                  {(!data || data.length === 0) && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground font-sans">
                        No rate history logs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

