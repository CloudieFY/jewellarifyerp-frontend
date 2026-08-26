import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenantAPI } from "@/lib/api";
import { type MetalRates, inr } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
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
import { Coins, Save, Zap, Clock } from "lucide-react";
import { toast } from "sonner";

const defaultRates: MetalRates = {
  updatedAt: new Date().toISOString(),
  gold24: 7850,
  gold22: 7200,
  gold20: 6540,
  gold18: 5890,
  silver: 98,
};

export function HeaderGoldRatesDialog() {
  const api = useTenantAPI();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["goldRates"],
    queryFn: api.goldRates.getAll,
  });

  const latest = data[0];
  const [rates, setRates] = useState<MetalRates>(defaultRates);

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

  const updateMutation = useMutation({
    mutationFn: (data: { id?: string; body: MetalRates }) => {
      if (data.id) return api.goldRates.update(data.id, data.body);
      return api.goldRates.create(data.body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goldRates"] });
      toast.success("Today's Gold & Silver rates updated!");
      setOpen(false);
    },
    onError: (err: any) => {
      toast.error("Failed to update rates: " + (err.message || "Error"));
    },
  });

  const saveRateDirect = (key: keyof MetalRates, value: number) => {
    setRates((prev) => ({
      ...prev,
      [key]: value,
      updatedAt: new Date().toISOString(),
    }));
  };

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

  const handleSave = () => {
    const nextRates = { ...rates, updatedAt: new Date().toISOString() };
    const todayStr = new Date().toDateString();
    const latestDateStr = latest?.updatedAt ? new Date(latest.updatedAt).toDateString() : "";

    if (latest && (latest as any)._id && todayStr === latestDateStr) {
      updateMutation.mutate({ id: (latest as any)._id, body: nextRates });
    } else {
      updateMutation.mutate({ body: nextRates });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/50 hover:border-amber-500 hover:shadow-xs transition-all cursor-pointer shrink-0"
          title="Click to view & update Today's Gold & Silver Rates"
        >
          <Coins className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
          <span className="hidden sm:inline font-mono">
            24K: <strong className="text-amber-900 dark:text-amber-200">{inr(rates.gold24)}</strong>
          </span>
          <span className="hidden md:inline font-mono text-[11px] text-amber-700/80 dark:text-amber-400/80">
            | 22K: {inr(rates.gold22)}
          </span>
          <Badge className="bg-amber-500 text-slate-950 font-black text-[10px] h-4 px-1 ml-0.5 hover:bg-amber-400">
            Update
          </Badge>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl bg-white dark:bg-slate-950 p-6 rounded-2xl shadow-2xl border border-amber-500/30">
        <DialogHeader>
          <DialogTitle className="text-xl font-black font-display flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Coins className="w-6 h-6" />
            Update Today's Gold & Silver Rates
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Changes save live into database & automatically reflect in Billing, Estimates, Buybacks & Customer Advances.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Quick 24K Auto Calculate Box */}
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-600 fill-amber-500" />
                Auto-Calculate Purity Rates
              </span>
              <p className="text-[11px] text-amber-800 dark:text-amber-400">
                Enter 24K Gold Rate to derive 22K, 20K & 18K
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Input
                type="number"
                placeholder="24K Rate"
                className="h-8 w-28 text-xs font-bold font-mono bg-white dark:bg-slate-900 border-amber-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = Number((e.target as HTMLInputElement).value);
                    if (val > 0) applyAutoDeriveFrom24K(val);
                  }
                }}
              />
            </div>
          </div>

          {/* Rates Inputs Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold flex justify-between">
                <span>24K Fine Gold</span>
                <span className="text-amber-600 font-mono text-[10px]">10g: {inr((rates.gold24 || 0) * 10)}</span>
              </Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  value={rates.gold24 || ""}
                  onChange={(e) => saveRateDirect("gold24", +e.target.value)}
                  className="font-mono font-bold text-sm h-9 pr-10 bg-amber-50/50 dark:bg-amber-950/30 border-amber-300"
                />
                <span className="absolute right-2.5 top-2 text-xs text-muted-foreground font-mono">₹/g</span>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold flex justify-between">
                <span>22K Standard Gold</span>
                <span className="text-yellow-600 font-mono text-[10px]">10g: {inr((rates.gold22 || 0) * 10)}</span>
              </Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  value={rates.gold22 || ""}
                  onChange={(e) => saveRateDirect("gold22", +e.target.value)}
                  className="font-mono font-bold text-sm h-9 pr-10 bg-yellow-50/50 dark:bg-yellow-950/30 border-yellow-300"
                />
                <span className="absolute right-2.5 top-2 text-xs text-muted-foreground font-mono">₹/g</span>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold flex justify-between">
                <span>20K Kundan Gold</span>
                <span className="text-orange-600 font-mono text-[10px]">10g: {inr((rates.gold20 || 0) * 10)}</span>
              </Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  value={rates.gold20 || ""}
                  onChange={(e) => saveRateDirect("gold20", +e.target.value)}
                  className="font-mono font-bold text-sm h-9 pr-10 bg-orange-50/50 dark:bg-orange-950/30 border-orange-300"
                />
                <span className="absolute right-2.5 top-2 text-xs text-muted-foreground font-mono">₹/g</span>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold flex justify-between">
                <span>18K Diamond Gold</span>
                <span className="text-rose-600 font-mono text-[10px]">10g: {inr((rates.gold18 || 0) * 10)}</span>
              </Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  value={rates.gold18 || ""}
                  onChange={(e) => saveRateDirect("gold18", +e.target.value)}
                  className="font-mono font-bold text-sm h-9 pr-10 bg-rose-50/50 dark:bg-rose-950/30 border-rose-300"
                />
                <span className="absolute right-2.5 top-2 text-xs text-muted-foreground font-mono">₹/g</span>
              </div>
            </div>

            <div className="col-span-2">
              <Label className="text-xs font-bold flex justify-between">
                <span>99.9% Fine Silver</span>
                <span className="text-slate-600 font-mono text-[10px]">10g: {inr((rates.silver || 0) * 10)} | 1kg: {inr((rates.silver || 0) * 1000)}</span>
              </Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  value={rates.silver || ""}
                  onChange={(e) => saveRateDirect("silver", +e.target.value)}
                  className="font-mono font-bold text-sm h-9 pr-10 bg-slate-100/60 dark:bg-slate-900 border-slate-300"
                />
                <span className="absolute right-2.5 top-2 text-xs text-muted-foreground font-mono">₹/g</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t pt-4">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Last Updated: {rates.updatedAt ? formatDate(rates.updatedAt) : "Now"}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={updateMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 flex items-center gap-1.5"
              onClick={handleSave}
            >
              <Save className="w-4 h-4" />
              <span>{updateMutation.isPending ? "Saving..." : "Save Today's Rates"}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
