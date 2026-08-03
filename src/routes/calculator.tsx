import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr, type MetalRates } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useTenantAPI } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ShopHeader } from "@/components/InvoiceBranding";
import { toast } from "sonner";
import {
  Calculator,
  RotateCcw,
  Scale,
  ArrowRightLeft,
  Sparkles,
  Gem,
  Percent,
  Printer,
  Copy,
  TrendingUp,
  CheckCircle2,
  Coins,
  Flame,
} from "lucide-react";

const PURITY_PRESETS = [
  { label: "24K (99.9%)", value: "24K", purityPct: 99.9, defaultRateKey: "gold24" },
  { label: "22K (91.6%)", value: "22K", purityPct: 91.6, defaultRateKey: "gold22" },
  { label: "20K (83.3%)", value: "20K", purityPct: 83.3, defaultRateKey: "gold20" },
  { label: "18K (75.0%)", value: "18K", purityPct: 75.0, defaultRateKey: "gold18" },
  { label: "14K (58.5%)", value: "14K", purityPct: 58.5, defaultRateKey: "gold18" },
  { label: "Silver (92.5%)", value: "Silver", purityPct: 92.5, defaultRateKey: "silver" },
];

const MAKING_PRESETS = [
  { label: "8%", value: 8, type: "percent" },
  { label: "10%", value: 10, type: "percent" },
  { label: "12%", value: 12, type: "percent" },
  { label: "15%", value: 15, type: "percent" },
  { label: "₹350/g", value: 350, type: "per_gram" },
  { label: "₹500/g", value: 500, type: "per_gram" },
];

export default function CalculatorPage() {
  const api = useTenantAPI();
  const { data: goldRatesData = [] } = useQuery({
    queryKey: ["goldRates"],
    queryFn: api.goldRates.getAll,
  });

  const latestRates: MetalRates = useMemo(() => {
    if (goldRatesData && goldRatesData.length > 0) {
      const r = goldRatesData[0];
      return {
        updatedAt: r.updatedAt || new Date().toISOString(),
        gold24: r.gold24 || 7850,
        gold22: r.gold22 || 7200,
        gold20: r.gold20 || 6540,
        gold18: r.gold18 || 5890,
        silver: r.silver || 98,
      };
    }
    return {
      updatedAt: new Date().toISOString(),
      gold24: 7850,
      gold22: 7200,
      gold20: 6540,
      gold18: 5890,
      silver: 98,
    };
  }, [goldRatesData]);

  // Main Active Tab
  const [activeTab, setActiveTab] = useState<"new_item" | "old_gold" | "converter">("new_item");

  // New Item States
  const [grossWeight, setGrossWeight] = useState<number | "">("");
  const [stoneWeight, setStoneWeight] = useState<number | "">("");
  const [purity, setPurity] = useState<string>("22K");
  const [rate, setRate] = useState<number | "">("");
  const [making, setMaking] = useState<number | "">("");
  const [makingType, setMakingType] = useState<"percent" | "per_gram" | "fixed">("percent");
  const [wastagePct, setWastagePct] = useState<number | "">("");
  const [stoneValue, setStoneValue] = useState<number | "">("");
  const [gstType, setGstType] = useState<"GST" | "NON-GST">("GST");
  const [gstPct, setGstPct] = useState<number | "">(3);

  // Old Gold Exchange States
  const [oldMetalType, setOldMetalType] = useState<"Gold" | "Silver">("Gold");
  const [oldGrossWeight, setOldGrossWeight] = useState<number | "">("");
  const [oldLossPct, setOldLossPct] = useState<number | "">(0);
  const [oldTouchPct, setOldTouchPct] = useState<number | "">(91.6);
  const [oldScrapRate, setOldScrapRate] = useState<number | "">("");

  // Purity Converter States
  const [convWeight, setConvWeight] = useState<number | "">(10);
  const [convFromKarat, setConvFromKarat] = useState<number>(22);
  const [convToKarat, setConvToKarat] = useState<number>(24);

  // Printable Quotation Modal State
  const [showQuotation, setShowQuotation] = useState(false);
  const [customerName, setCustomerName] = useState("");

  // Auto fill rate when purity changes or user clicks quick rate button
  const handleSelectPurity = (purityVal: string) => {
    setPurity(purityVal);
    const found = PURITY_PRESETS.find((p) => p.value === purityVal);
    if (found) {
      const rateVal = latestRates[found.defaultRateKey as keyof MetalRates];
      if (typeof rateVal === "number" && rateVal > 0) {
        setRate(rateVal);
      }
    }
  };

  const applyLiveRate = (rateVal: number, purityLabel?: string) => {
    setRate(rateVal);
    if (purityLabel) setPurity(purityLabel);
    toast.success(`Applied Rate: ₹${rateVal}/g`);
  };

  // Computations
  const calc = useMemo(() => {
    // 1. New Item Net Weight
    const gross = Number(grossWeight) || 0;
    const stWt = Number(stoneWeight) || 0;
    const netWeight = Math.max(0, gross - stWt);

    // 2. Base Metal Value
    const r = Number(rate) || 0;
    const rawMetalValue = netWeight * r;

    // 3. Wastage Value
    const wast = Number(wastagePct) || 0;
    const wastageWeight = (netWeight * wast) / 100;
    const wastageValue = wastageWeight * r;

    // 4. Total Billed Weight & Value
    const effectiveMetalValue = rawMetalValue + wastageValue;

    // 5. Making Charges
    const m = Number(making) || 0;
    let makingValue = 0;
    if (makingType === "percent") {
      makingValue = (effectiveMetalValue * m) / 100;
    } else if (makingType === "per_gram") {
      makingValue = netWeight * m;
    } else {
      makingValue = m;
    }

    // 6. Stone Value
    const stVal = Number(stoneValue) || 0;

    // 7. Subtotal before Tax
    const subtotal = effectiveMetalValue + makingValue + stVal;

    // 8. Tax Calculation
    const gPct = gstType === "GST" ? Number(gstPct) || 0 : 0;
    const gstValue = (subtotal * gPct) / 100;
    const newItemTotal = subtotal + gstValue;

    // 9. Old Gold Exchange
    const oGross = Number(oldGrossWeight) || 0;
    const oLoss = Number(oldLossPct) || 0;
    const oTouch = Number(oldTouchPct) || 0;
    const oScrapR = Number(oldScrapRate) || (oldMetalType === "Gold" ? latestRates.gold22 : latestRates.silver);

    const afterLossWeight = Math.max(0, oGross * (1 - oLoss / 100));
    const fineWeightReturn = (afterLossWeight * oTouch) / 100;
    const exchangeValue = fineWeightReturn * oScrapR;

    // 10. Final Payable
    const netPayable = newItemTotal - exchangeValue;

    return {
      netWeight,
      rawMetalValue,
      wastageWeight,
      wastageValue,
      effectiveMetalValue,
      makingValue,
      subtotal,
      gstValue,
      newItemTotal,
      afterLossWeight,
      fineWeightReturn,
      exchangeValue,
      netPayable,
    };
  }, [
    grossWeight,
    stoneWeight,
    rate,
    making,
    makingType,
    wastagePct,
    stoneValue,
    gstType,
    gstPct,
    oldGrossWeight,
    oldLossPct,
    oldTouchPct,
    oldScrapRate,
    oldMetalType,
    latestRates,
  ]);

  // Purity Converter Calculation
  const convertedWeight = useMemo(() => {
    const w = Number(convWeight) || 0;
    if (w <= 0 || !convFromKarat || !convToKarat) return 0;
    return (w * convFromKarat) / convToKarat;
  }, [convWeight, convFromKarat, convToKarat]);

  const resetAll = () => {
    setGrossWeight("");
    setStoneWeight("");
    setPurity("22K");
    setRate("");
    setMaking("");
    setMakingType("percent");
    setWastagePct("");
    setStoneValue("");
    setGstType("GST");
    setGstPct(3);
    setOldGrossWeight("");
    setOldLossPct(0);
    setOldTouchPct(91.6);
    setOldScrapRate("");
    toast.info("Calculator reset to defaults.");
  };

  const copyQuoteSummary = () => {
    const summaryText = `
📌 *JEWELLERY ESTIMATE QUOTE*
--------------------------------
• Net Weight: ${calc.netWeight.toFixed(3)} g (${purity})
• Rate: ₹${Number(rate) || 0}/g
• Metal Value: ${inr(calc.rawMetalValue)}
${calc.makingValue > 0 ? `• Making Charges: ${inr(calc.makingValue)}\n` : ""}${Number(stoneValue) > 0 ? `• Stone Charges: ${inr(Number(stoneValue))}\n` : ""}${calc.gstValue > 0 ? `• GST (3%): ${inr(calc.gstValue)}\n` : ""}--------------------------------
💰 *TOTAL ITEM ESTIMATE: ${inr(calc.newItemTotal)}*
${calc.exchangeValue > 0 ? `🔄 Old Gold Exchange: -${inr(calc.exchangeValue)}\n💵 *NET PAYABLE: ${inr(calc.netPayable)}*` : ""}
    `.trim();

    navigator.clipboard.writeText(summaryText);
    toast.success("Estimate summary copied to clipboard!");
  };

  return (
    <Layout>
      {/* HEADER SECTION */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold font-display tracking-tight text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center justify-center border border-amber-500/20 shadow-2xs">
              <Calculator className="w-6 h-6" />
            </div>
            Jewellery Valuation &amp; Melting Calculator
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Instant, precise billing estimations for new ornaments, old gold melting, and karat purity conversion.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={resetAll} className="h-9 px-3.5 text-xs bg-background shadow-2xs hover:bg-muted/50 w-full sm:w-auto font-medium">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset Calculator
          </Button>
        </div>
      </header>

      {/* TODAY'S LIVE RATES TICKER BAR */}
      <div className="bg-linear-to-r from-amber-500/10 via-amber-500/5 to-slate-900/5 dark:to-slate-900/40 p-3 sm:p-4 rounded-2xl border border-amber-500/20 mb-6 shadow-2xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider shrink-0">
            <TrendingUp className="w-4 h-4 text-amber-600 animate-pulse" />
            Today's Metal Rates
            <span className="text-[10px] text-muted-foreground font-mono font-normal lowercase">
              ({formatDate(latestRates.updatedAt).split(",")[0]})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-background hover:bg-amber-50 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-mono font-semibold"
              onClick={() => applyLiveRate(latestRates.gold24, "24K")}
            >
              24K Gold: <strong className="text-amber-700 dark:text-amber-400">₹{latestRates.gold24}/g</strong>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-background hover:bg-amber-50 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-mono font-semibold"
              onClick={() => applyLiveRate(latestRates.gold22, "22K")}
            >
              22K Gold: <strong className="text-amber-700 dark:text-amber-400">₹{latestRates.gold22}/g</strong>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-background hover:bg-amber-50 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-mono font-semibold"
              onClick={() => applyLiveRate(latestRates.gold18, "18K")}
            >
              18K Gold: <strong className="text-amber-700 dark:text-amber-400">₹{latestRates.gold18}/g</strong>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-background hover:bg-slate-100 border-slate-300 font-mono font-semibold"
              onClick={() => applyLiveRate(latestRates.silver, "Silver")}
            >
              Silver: <strong className="text-slate-700 dark:text-slate-300">₹{latestRates.silver}/g</strong>
            </Button>
          </div>
        </div>
      </div>

      {/* MAIN CALCULATOR CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: TABS & INPUT PANELS */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid grid-cols-3 w-full bg-muted/60 p-1 rounded-xl mb-4">
              <TabsTrigger value="new_item" className="text-xs font-semibold py-2">
                <Coins className="w-3.5 h-3.5 mr-1.5 text-amber-600" /> New Ornament
              </TabsTrigger>
              <TabsTrigger value="old_gold" className="text-xs font-semibold py-2">
                <Flame className="w-3.5 h-3.5 mr-1.5 text-rose-600" /> Old Gold Exchange
              </TabsTrigger>
              <TabsTrigger value="converter" className="text-xs font-semibold py-2">
                <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Karat Converter
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: NEW ORNAMENT VALUATION */}
            <TabsContent value="new_item" className="space-y-6 mt-0">
              <Card className="shadow-lg border-amber-500/20 overflow-hidden transition-all">
                <CardHeader className="bg-linear-to-r from-amber-500/10 via-amber-500/5 to-transparent px-4 sm:px-5 py-3.5 border-b border-amber-500/20">
                  <CardTitle className="font-display flex items-center justify-between text-amber-900 dark:text-amber-200 text-base sm:text-lg">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-amber-500/20 rounded-lg text-amber-700 dark:text-amber-300">
                        <Gem className="w-4 h-4" />
                      </div>
                      New Ornament Specifications
                    </div>
                    <Badge variant="outline" className="text-[11px] bg-amber-50 border-amber-300 text-amber-800 font-mono">
                      Pure Metal + Making + Taxes
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 space-y-5">
                  {/* WEIGHT & PURITY SELECTOR */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <F label="Gross Weight (grams) *">
                      <div className="relative">
                        <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          className="pl-9 pr-8 h-10 text-base font-mono font-semibold bg-muted/20 focus-visible:bg-background"
                          type="number"
                          value={grossWeight}
                          onChange={(e) => setGrossWeight(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="0.000"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground font-mono">g</span>
                      </div>
                    </F>

                    <F label="Stone / Bead Weight (grams)">
                      <div className="relative">
                        <Gem className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          className="pl-9 pr-8 h-10 text-base font-mono font-semibold bg-muted/20 focus-visible:bg-background"
                          type="number"
                          value={stoneWeight}
                          onChange={(e) => setStoneWeight(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="0.000"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground font-mono">g</span>
                      </div>
                    </F>
                  </div>

                  {/* NET WEIGHT BADGE */}
                  <div className="flex items-center justify-between bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-xs font-mono">
                    <span className="text-amber-900 dark:text-amber-200 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-amber-600" /> Billed Net Metal Weight:
                    </span>
                    <strong className="text-sm font-bold text-amber-800 dark:text-amber-300">{calc.netWeight.toFixed(3)} grams</strong>
                  </div>

                  {/* PURITY PRESET CHIPS */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Metal Purity / Karat</Label>
                    <div className="flex flex-wrap gap-2">
                      {PURITY_PRESETS.map((p) => (
                        <Button
                          key={p.value}
                          type="button"
                          variant={purity === p.value ? "default" : "outline"}
                          className={`h-8 text-xs px-3 font-semibold ${
                            purity === p.value ? "bg-amber-700 hover:bg-amber-800 text-white" : "border-slate-300 hover:bg-muted/50"
                          }`}
                          onClick={() => handleSelectPurity(p.value)}
                        >
                          {p.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* RATE & WASTAGE */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <F label="Gold / Silver Rate (per gram) *">
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                        <Input
                          className="pl-8 h-10 text-base font-mono font-bold text-foreground bg-muted/20 focus-visible:bg-background"
                          type="number"
                          value={rate}
                          onChange={(e) => setRate(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="7200"
                        />
                      </div>
                    </F>

                    <F label="Wastage (%)">
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          className="pl-9 h-10 text-base font-mono font-semibold bg-muted/20 focus-visible:bg-background"
                          type="number"
                          value={wastagePct}
                          onChange={(e) => setWastagePct(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="e.g. 2.5"
                        />
                      </div>
                    </F>
                  </div>

                  {/* MAKING CHARGES */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Making Charges</Label>
                    <div className="flex gap-2">
                      <Select value={makingType} onValueChange={(v) => setMakingType(v as any)}>
                        <SelectTrigger className="w-32 shrink-0 h-10 bg-muted/20 font-medium text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">% Percentage</SelectItem>
                          <SelectItem value="per_gram">₹ per Gram</SelectItem>
                          <SelectItem value="fixed">₹ Fixed Total</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="relative flex-1">
                        {makingType === "percent" ? (
                          <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        ) : (
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                        )}
                        <Input
                          type="number"
                          value={making}
                          onChange={(e) => setMaking(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="0"
                          className="pl-8 h-10 text-base font-mono font-semibold bg-muted/20 focus-visible:bg-background"
                        />
                      </div>
                    </div>

                    {/* MAKING QUICK PRESETS */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {MAKING_PRESETS.map((mp, idx) => (
                        <Button
                          key={idx}
                          type="button"
                          variant="ghost"
                          className="h-6 text-[11px] px-2 bg-muted/40 hover:bg-muted text-muted-foreground font-mono"
                          onClick={() => {
                            setMakingType(mp.type as any);
                            setMaking(mp.value);
                          }}
                        >
                          {mp.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* STONES & TAX OPTIONS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <F label="Stone / Diamond Charges (₹)">
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                        <Input
                          className="pl-8 h-10 text-base font-mono font-semibold bg-muted/20 focus-visible:bg-background"
                          type="number"
                          value={stoneValue}
                          onChange={(e) => setStoneValue(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="0"
                        />
                      </div>
                    </F>

                    <F label="Tax / GST Mode">
                      <div className="flex gap-2">
                        <Select value={gstType} onValueChange={(v) => setGstType(v as any)}>
                          <SelectTrigger className="w-32 shrink-0 h-10 bg-muted/20 font-medium text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GST">GST (3%)</SelectItem>
                            <SelectItem value="NON-GST">Estimate (0%)</SelectItem>
                          </SelectContent>
                        </Select>

                        {gstType === "GST" && (
                          <div className="relative flex-1">
                            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              type="number"
                              value={gstPct}
                              onChange={(e) => setGstPct(e.target.value === "" ? "" : Number(e.target.value))}
                              placeholder="3"
                              className="pl-8 h-10 text-base font-mono font-semibold bg-muted/20 focus-visible:bg-background"
                            />
                          </div>
                        )}
                      </div>
                    </F>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: OLD GOLD MELTING & EXCHANGE */}
            <TabsContent value="old_gold" className="space-y-6 mt-0">
              <Card className="shadow-lg border-rose-500/20 overflow-hidden transition-all">
                <CardHeader className="bg-linear-to-r from-rose-500/10 via-rose-500/5 to-transparent px-4 sm:px-5 py-3.5 border-b border-rose-500/20">
                  <CardTitle className="font-display flex items-center justify-between text-rose-900 dark:text-rose-200 text-base sm:text-lg">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-rose-500/20 rounded-lg text-rose-700 dark:text-rose-300">
                        <ArrowRightLeft className="w-4 h-4" />
                      </div>
                      Old Gold / Silver Melting &amp; Trade-In
                    </div>
                    <Badge variant="outline" className="text-[11px] bg-rose-50 border-rose-300 text-rose-800 font-mono">
                      Melting Touch &amp; Purity Deduction
                    </Badge>
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <F label="Old Metal Category">
                      <Select value={oldMetalType} onValueChange={(v) => setOldMetalType(v as any)}>
                        <SelectTrigger className="h-10 bg-muted/20 font-medium text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Gold">Gold Ornament</SelectItem>
                          <SelectItem value="Silver">Silver Article</SelectItem>
                        </SelectContent>
                      </Select>
                    </F>

                    <F label="Old Gross Weight (grams) *">
                      <div className="relative">
                        <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          className="pl-9 pr-8 h-10 text-base font-mono font-semibold bg-muted/20 focus-visible:bg-background"
                          type="number"
                          value={oldGrossWeight}
                          onChange={(e) => setOldGrossWeight(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="0.000"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground font-mono">g</span>
                      </div>
                    </F>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <F label="Dust / Melting Loss (%)">
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          className="pl-8 h-10 text-base font-mono font-semibold bg-muted/20 focus-visible:bg-background"
                          type="number"
                          value={oldLossPct}
                          onChange={(e) => setOldLossPct(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="e.g. 2"
                        />
                      </div>
                    </F>

                    <F label="Melting Touch / Fine Purity (%) *">
                      <div className="relative">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          className="pl-8 h-10 text-base font-mono font-semibold bg-muted/20 focus-visible:bg-background"
                          type="number"
                          value={oldTouchPct}
                          onChange={(e) => setOldTouchPct(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="91.6"
                        />
                      </div>
                    </F>
                  </div>

                  <F label="Scrap Buyback Rate (₹/gram) *">
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-rose-600 font-bold">₹</span>
                      <Input
                        className="pl-8 h-10 text-base font-mono font-bold text-rose-700 bg-rose-50/50 border-rose-200"
                        type="number"
                        value={oldScrapRate}
                        onChange={(e) => setOldScrapRate(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder={String(oldMetalType === "Gold" ? latestRates.gold22 : latestRates.silver)}
                      />
                    </div>
                  </F>

                  {/* CALCULATED FINE WEIGHT RETURN CARD */}
                  <div className="bg-rose-500/10 p-3.5 rounded-xl border border-rose-500/20 text-xs space-y-1 font-mono">
                    <div className="flex items-center justify-between text-rose-900 dark:text-rose-200">
                      <span>Calculated Fine Metal Return:</span>
                      <strong className="text-sm font-bold text-rose-700 dark:text-rose-300">{calc.fineWeightReturn.toFixed(3)} grams</strong>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                      <span>Total Exchange Buyback Valuation:</span>
                      <strong className="text-xs font-bold text-rose-600">{inr(calc.exchangeValue)}</strong>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: PURITY & KARAT CONVERTER */}
            <TabsContent value="converter" className="space-y-6 mt-0">
              <Card className="shadow-lg border-blue-500/20 overflow-hidden transition-all">
                <CardHeader className="bg-linear-to-r from-blue-500/10 via-blue-500/5 to-transparent px-4 sm:px-5 py-3.5 border-b border-blue-500/20">
                  <CardTitle className="font-display flex items-center justify-between text-blue-900 dark:text-blue-200 text-base sm:text-lg">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-500/20 rounded-lg text-blue-700 dark:text-blue-300">
                        <ArrowRightLeft className="w-4 h-4" />
                      </div>
                      Karat Purity Weight Converter
                    </div>
                    <Badge variant="outline" className="text-[11px] bg-blue-50 border-blue-300 text-blue-800 font-mono">
                      Equivalent Weight Calculation
                    </Badge>
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-5">
                  <F label="Ornament Weight (grams) *">
                    <div className="relative">
                      <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        className="pl-9 pr-8 h-10 text-base font-mono font-semibold bg-muted/20"
                        type="number"
                        value={convWeight}
                        onChange={(e) => setConvWeight(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="10.000"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground font-mono">g</span>
                    </div>
                  </F>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <F label="Current Source Karat">
                      <Select value={String(convFromKarat)} onValueChange={(v) => setConvFromKarat(Number(v))}>
                        <SelectTrigger className="h-10 bg-muted/20 font-medium text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="24">24 Karat (99.9% Pure)</SelectItem>
                          <SelectItem value="22">22 Karat (91.6% Pure)</SelectItem>
                          <SelectItem value="20">20 Karat (83.3% Pure)</SelectItem>
                          <SelectItem value="18">18 Karat (75.0% Pure)</SelectItem>
                          <SelectItem value="14">14 Karat (58.5% Pure)</SelectItem>
                        </SelectContent>
                      </Select>
                    </F>

                    <F label="Target Converted Karat">
                      <Select value={String(convToKarat)} onValueChange={(v) => setConvToKarat(Number(v))}>
                        <SelectTrigger className="h-10 bg-muted/20 font-medium text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="24">24 Karat (99.9% Pure)</SelectItem>
                          <SelectItem value="22">22 Karat (91.6% Pure)</SelectItem>
                          <SelectItem value="20">20 Karat (83.3% Pure)</SelectItem>
                          <SelectItem value="18">18 Karat (75.0% Pure)</SelectItem>
                          <SelectItem value="14">14 Karat (58.5% Pure)</SelectItem>
                        </SelectContent>
                      </Select>
                    </F>
                  </div>

                  <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 text-center space-y-1">
                    <div className="text-xs text-blue-900 dark:text-blue-200 font-semibold uppercase tracking-wider">
                      Equivalent Converted Weight in {convToKarat}K Gold
                    </div>
                    <div className="text-3xl font-bold font-mono text-blue-700 dark:text-blue-300">
                      {convertedWeight.toFixed(3)} <span className="text-lg font-normal">grams</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* RIGHT COLUMN: STICKY ESTIMATE SUMMARY CARD */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          <Card className="shadow-xl border-amber-500/30 bg-linear-to-b from-amber-50/90 via-background to-background dark:from-amber-950/20 overflow-hidden sticky top-20">
            <CardHeader className="bg-linear-to-r from-amber-500/20 via-amber-500/10 to-transparent px-4 sm:px-5 py-3.5 border-b border-amber-500/20">
              <CardTitle className="font-display flex items-center justify-between text-amber-900 dark:text-amber-200 text-base sm:text-lg">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-500/20 rounded-lg text-amber-700 dark:text-amber-300 shadow-2xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  Estimate Summary
                </div>
                <Badge variant="outline" className="text-[10px] bg-amber-100 border-amber-300 text-amber-900 font-bold uppercase font-mono">
                  {purity}
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* NEW ITEM ITEMIZATION */}
              <div className="space-y-2.5">
                <div className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-widest flex items-center gap-1.5">
                  <div className="w-5 h-px bg-amber-700/40"></div> New Ornament Breakdown
                </div>

                <Row label={`Metal Value (${calc.netWeight.toFixed(3)}g @ ₹${Number(rate) || 0}/g)`} v={inr(calc.rawMetalValue)} />
                
                {calc.wastageValue > 0 && (
                  <Row label={`Wastage (${Number(wastagePct)}% = ${calc.wastageWeight.toFixed(3)}g)`} v={inr(calc.wastageValue)} />
                )}

                {calc.makingValue > 0 && <Row label="Making Charges" v={inr(calc.makingValue)} />}
                
                {Number(stoneValue) > 0 && <Row label="Stone / Diamond Charges" v={inr(Number(stoneValue))} />}

                <div className="w-full h-px border-t border-dashed border-border/70 my-1"></div>

                <Row label="Subtotal" v={inr(calc.subtotal)} boldValue />

                {gstType === "GST" && (
                  <Row label={`GST Tax (${Number(gstPct)}%)`} v={inr(calc.gstValue)} />
                )}

                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                  <Row label="Total Ornament Value" v={inr(calc.newItemTotal)} highlight boldValue />
                </div>
              </div>

              {/* OLD GOLD DEDUCTION SECTION */}
              {calc.exchangeValue > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                    <div className="w-5 h-px bg-rose-700/40"></div> Old Metal Trade-In Credit
                  </div>
                  <Row label={`Exchange Value (${calc.fineWeightReturn.toFixed(3)}g Fine)`} v={`- ${inr(calc.exchangeValue)}`} negative />
                </div>
              )}

              {/* NET PAYABLE HIGHLIGHT */}
              <div className="pt-3 border-t-2 border-amber-500/30">
                <div className="flex flex-col gap-0.5">
                  <span className="font-display font-bold text-xs text-muted-foreground uppercase tracking-wider">
                    {calc.exchangeValue > 0 ? "Net Payable Amount" : "Estimated Amount"}
                  </span>
                  <div className={`font-display font-bold text-3xl sm:text-4xl tracking-tight ${calc.netPayable < 0 ? "text-rose-600" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {inr(calc.netPayable)}
                  </div>
                </div>
              </div>

              {/* ACTIONS TOOLBAR */}
              <div className="flex flex-col gap-2 pt-3">
                <Button
                  className="w-full bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs h-10 shadow-xs flex items-center justify-center gap-2"
                  onClick={() => setShowQuotation(true)}
                >
                  <Printer className="w-4 h-4" /> Print Customer Quote Slip
                </Button>

                <Button
                  variant="outline"
                  className="w-full text-xs h-9 border-slate-300 font-medium flex items-center justify-center gap-2"
                  onClick={copyQuoteSummary}
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Quote to Clipboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* PRINTABLE ESTIMATE QUOTATION SLIP MODAL */}
      {showQuotation && (
        <div className="print-section fixed inset-0 z-100 bg-black/60 flex justify-center items-start p-3 sm:p-6 overflow-y-auto print:static print:p-0 print:bg-white">
          <style>{`@media print { @page { margin: 4mm; } body { zoom: 0.9; } }`}</style>
          <div className="bg-background w-full max-w-lg rounded-2xl shadow-2xl border p-5 sm:p-6 print:shadow-none print:border-none print:w-full print:max-w-none">
            <div className="print:hidden flex justify-between items-center pb-4 mb-4 border-b">
              <h3 className="font-display font-bold text-lg flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-700" /> Printable Estimate Quotation
              </h3>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setShowQuotation(false)}>
                ✕
              </Button>
            </div>

            {/* QUOTATION SLIP BODY */}
            <div className="space-y-4 text-xs font-mono">
              <ShopHeader documentLabel="ESTIMATE QUOTATION" compact />

              {/* Optional Customer Name Input */}
              <div className="print:hidden pb-2">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase">Customer Name (Optional)</Label>
                <Input
                  className="h-8 text-xs font-sans mt-1 bg-muted/20"
                  placeholder="e.g. Ramesh Kumar"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              <div className="space-y-2 py-1">
                <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                  <span>Date: {formatDate(new Date().toISOString())}</span>
                  <span>Quote Ref: EST-{Math.floor(1000 + Math.random() * 9000)}</span>
                </div>

                {customerName.trim() && (
                  <div className="text-xs font-bold text-foreground font-sans pt-1 border-t">
                    Customer: <span className="font-semibold text-primary">{customerName.trim()}</span>
                  </div>
                )}

                <div className="border-t border-b py-2 space-y-1.5">
                  <div className="font-bold text-foreground font-sans">Specifications:</div>
                  <div className="flex justify-between">
                    <span>Gross Wt:</span> <span>{Number(grossWeight) || 0} g</span>
                  </div>
                  {Number(stoneWeight) > 0 && (
                    <div className="flex justify-between">
                      <span>Stone Wt:</span> <span>{Number(stoneWeight)} g</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold">
                    <span>Net Billed Wt:</span> <span>{calc.netWeight.toFixed(3)} g ({purity})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rate:</span> <span>₹{Number(rate) || 0} / gram</span>
                  </div>
                </div>

                <div className="space-y-1.5 py-1">
                  <div className="flex justify-between">
                    <span>Metal Value:</span> <span>{inr(calc.rawMetalValue)}</span>
                  </div>
                  {calc.wastageValue > 0 && (
                    <div className="flex justify-between">
                      <span>Wastage ({Number(wastagePct)}%):</span> <span>{inr(calc.wastageValue)}</span>
                    </div>
                  )}
                  {calc.makingValue > 0 && (
                    <div className="flex justify-between">
                      <span>Making Charges:</span> <span>{inr(calc.makingValue)}</span>
                    </div>
                  )}
                  {Number(stoneValue) > 0 && (
                    <div className="flex justify-between">
                      <span>Stone Charges:</span> <span>{inr(Number(stoneValue))}</span>
                    </div>
                  )}
                  {gstType === "GST" && (
                    <div className="flex justify-between">
                      <span>GST (3%):</span> <span>{inr(calc.gstValue)}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-bold border-t pt-1.5 text-sm">
                    <span>Total Estimate:</span> <span>{inr(calc.newItemTotal)}</span>
                  </div>

                  {calc.exchangeValue > 0 && (
                    <>
                      <div className="flex justify-between text-rose-600">
                        <span>Old Metal Exchange:</span> <span>- {inr(calc.exchangeValue)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-1.5 text-base text-emerald-700">
                        <span>Net Payable:</span> <span>{inr(calc.netPayable)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="text-[10px] text-muted-foreground text-center border-t pt-3 mt-4 space-y-1">
                <p>* Estimate valid for today only based on current market rates.</p>
                <p>Thank you for visiting! We look forward to serving you.</p>
              </div>

              <div className="print:hidden flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" size="sm" onClick={() => setShowQuotation(false)}>
                  Close
                </Button>
                <Button size="sm" className="bg-amber-700 hover:bg-amber-800 text-white" onClick={() => window.print()}>
                  <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">{label}</Label>
      {children}
    </div>
  );
}

function Row({
  label,
  v,
  highlight = false,
  negative = false,
  boldValue = false,
}: {
  label: string;
  v: string;
  highlight?: boolean;
  negative?: boolean;
  boldValue?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center gap-2 ${highlight ? "mt-1" : "text-xs"}`}>
      <span className={highlight ? "text-foreground font-semibold text-xs" : "text-muted-foreground font-medium"}>
        {label}
      </span>
      <span
        className={
          highlight || boldValue
            ? "text-primary font-bold text-sm font-mono"
            : negative
            ? "text-rose-600 font-bold font-mono"
            : "font-semibold text-foreground font-mono"
        }
      >
        {v}
      </span>
    </div>
  );
}