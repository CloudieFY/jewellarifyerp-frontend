import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useTenantAPI } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { triggerPrint, formatDate } from "@/lib/utils";
import { inr, defaultInvoiceSettings, getCleanInvoiceTitle, getUpiQrCodeUrl, type InvoiceSettings } from "@/lib/storage";
import {
  Palette,
  Eye,
  Save,
  Printer,
  FileText,
  SlidersHorizontal,
  Heading,
} from "lucide-react";

const SAMPLE_INVOICE = {
  number: "INV-2026-8809",
  createdAt: new Date().toISOString(),
  type: "GST",
  customerName: "Smt. Sunita Sharma",
  customerMobile: "+91 98765 43210",
  customerAddress: "Flat 402, Royal Palms, Jaipur, Rajasthan",
  paymentMode: "UPI / Cash",
  items: [
    {
      name: "22K BIS Hallmarked Gold Necklace Set",
      huid: "HUID-916-A89K",
      purity: "22K (91.6)",
      qty: 1,
      grossWeight: 28.5,
      netWeight: 26.2,
      stoneWeight: 2.3,
      stoneCharge: 1200,
      ratePerGram: 7200,
      makingChargeType: "PERCENTAGE",
      makingChargeValue: 8,
      makingCharge: (26.2 * 7200 * 0.08),
      gstPct: 3,
      hmc: 45,
    },
    {
      name: "18K Diamond Solitaire Ring",
      huid: "HUID-750-X42L",
      purity: "18K (75.0)",
      qty: 1,
      grossWeight: 4.8,
      netWeight: 4.2,
      stoneWeight: 0.6,
      stoneCharge: 18500,
      ratePerGram: 5890,
      makingChargeType: "FIXED",
      makingChargeValue: 2500,
      makingCharge: 2500,
      gstPct: 3,
      hmc: 45,
    },
  ],
  subtotal: 247850,
  discount: 2850,
  oldGoldAmount: 15000,
  gstAmount: 6900,
  total: 236900,
  amountPaid: 236900,
  balanceDue: 0,
};

export default function InvoiceDesignerPage() {
  const { tenantSession, setTenantSession } = useAuth();
  const shop = tenantSession?.shop;
  const api = useTenantAPI();
  const queryClient = useQueryClient();

  // Load existing shop invoice settings or default
  const savedSettings: InvoiceSettings = useMemo(() => {
    return (shop as any)?.invoiceSettings || defaultInvoiceSettings;
  }, [shop]);

  const [settings, setSettings] = useState<InvoiceSettings>({ ...defaultInvoiceSettings, ...savedSettings });

  // Shop profile text fields
  const [shopForm, setShopForm] = useState({
    shopName: shop?.shopName || "Shree Ganesh Jewellers",
    address: shop?.address || "Main Bazaar, Opp. Town Hall, City Center",
    phone: shop?.phone || "+91 98765 00000",
    numberOfShopOwner: shop?.numberOfShopOwner || "+91 98765 11111",
    gstNumber: shop?.gstNumber || "08AAAAA0000A1Z5",
    logoUrl: shop?.logoUrl || "/logo.png",
  });

  useEffect(() => {
    if (shop) {
      setShopForm({
        shopName: shop.shopName || "Shree Ganesh Jewellers",
        address: shop.address || "Main Bazaar, Opp. Town Hall, City Center",
        phone: shop.phone || "+91 98765 00000",
        numberOfShopOwner: shop.numberOfShopOwner || "",
        gstNumber: shop.gstNumber || "08AAAAA0000A1Z5",
        logoUrl: shop.logoUrl || "/logo.png",
      });
      const customTerms = shop.termsAndConditions || (shop as any).invoiceSettings?.termsAndConditions || defaultInvoiceSettings.termsAndConditions;
      setSettings({
        ...defaultInvoiceSettings,
        ...((shop as any).invoiceSettings || {}),
        termsAndConditions: customTerms,
      });
    }
  }, [shop]);

  const { mutate: saveDesign, isPending: isSaving } = useMutation({
    mutationFn: () => {
      const payload: Partial<typeof shopForm & { invoiceSettings: InvoiceSettings; termsAndConditions: string }> = {
        ...shopForm,
        invoiceSettings: settings,
        termsAndConditions: settings.termsAndConditions,
      };
      return api.profile.update(payload as any);
    },
    onSuccess: (data) => {
      if (data.shop && tenantSession) {
        setTenantSession({ ...tenantSession, shop: data.shop });
      }
      queryClient.invalidateQueries({ queryKey: ["tenantProfile"] });
      toast.success("Invoice UI design template saved successfully!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save invoice design.");
    },
  });

  const updateSetting = <K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Color classes for live preview
  const getThemeHeaderClass = () => {
    switch (settings.themeColor) {
      case "purple":
        return "border-purple-700 text-purple-950";
      case "emerald":
        return "border-emerald-700 text-emerald-950";
      case "blue":
        return "border-blue-700 text-blue-950";
      case "slate":
        return "border-slate-900 text-slate-900";
      case "gold":
      default:
        return "border-amber-600 text-amber-950";
    }
  };

  const getThemeBgClass = () => {
    switch (settings.themeColor) {
      case "purple":
        return "bg-purple-50 text-purple-900 border-purple-200";
      case "emerald":
        return "bg-emerald-50 text-emerald-900 border-emerald-200";
      case "blue":
        return "bg-blue-50 text-blue-900 border-blue-200";
      case "slate":
        return "bg-slate-100 text-slate-900 border-slate-300";
      case "gold":
      default:
        return "bg-amber-50 text-amber-900 border-amber-200";
    }
  };

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2 text-foreground">
            <Palette className="w-8 h-8 text-amber-600" /> Editable Invoice Template & UI Designer
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Customize header styles, colors, table columns, terms, logo, and signature layouts for all printed invoices.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={triggerPrint}
            variant="outline"
            className="h-10 text-xs font-semibold"
          >
            <Printer className="w-4 h-4 mr-1.5 text-blue-600" /> Test Print Bill
          </Button>
          <Button onClick={() => saveDesign()} disabled={isSaving} className="h-10 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold">
            <Save className="w-4 h-4 mr-1.5" /> {isSaving ? "Saving Design..." : "Save Invoice Template"}
          </Button>
        </div>
      </header>

      {/* DUAL PANE DESIGN EDITOR & LIVE PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT PANE: CONTROLS & CUSTOMIZERS */}
        <div className="lg:col-span-5 space-y-5">
          <Tabs defaultValue="theme" className="w-full">
            <TabsList className="grid grid-cols-3 w-full bg-muted/80 p-1">
              <TabsTrigger value="theme" className="text-xs font-semibold">
                <Palette className="w-3.5 h-3.5 mr-1" /> Style & Theme
              </TabsTrigger>
              <TabsTrigger value="columns" className="text-xs font-semibold">
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1" /> Table Columns
              </TabsTrigger>
              <TabsTrigger value="footer" className="text-xs font-semibold">
                <FileText className="w-3.5 h-3.5 mr-1" /> Footer & Terms
              </TabsTrigger>
            </TabsList>

            {/* STYLE & THEME TAB */}
            <TabsContent value="theme" className="mt-4 space-y-4">
              <Card className="shadow-sm border">
                <CardHeader className="py-3.5 bg-muted/20 border-b">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Heading className="w-4 h-4 text-amber-600" /> Showroom Identity & Header Layout
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3.5 text-xs">
                  <div>
                    <Label className="text-xs font-semibold">Showroom Name</Label>
                    <Input
                      value={shopForm.shopName}
                      onChange={(e) => setShopForm({ ...shopForm, shopName: e.target.value })}
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Invoice Header Title</Label>
                    <Input
                      value={settings.invoiceTitle}
                      onChange={(e) => updateSetting("invoiceTitle", e.target.value)}
                      placeholder="e.g. INVOICE, ESTIMATE, BILL OF SUPPLY"
                      className="h-9 text-xs mt-1 font-semibold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Showroom Tagline / Slogan</Label>
                    <Input
                      value={settings.tagline}
                      onChange={(e) => updateSetting("tagline", e.target.value)}
                      placeholder="e.g. Govt. Approved BIS Hallmarked Jewellery"
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Address & Landmark</Label>
                    <Textarea
                      value={shopForm.address}
                      onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })}
                      rows={2}
                      className="text-xs mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Phone / Mobile 1</Label>
                      <Input
                        value={shopForm.phone}
                        onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })}
                        placeholder="+91 98765 00000"
                        className="h-9 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Phone / Mobile 2 (Alt)</Label>
                      <Input
                        value={shopForm.numberOfShopOwner}
                        onChange={(e) => setShopForm({ ...shopForm, numberOfShopOwner: e.target.value })}
                        placeholder="+91 98765 11111"
                        className="h-9 text-xs mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">GSTIN Number</Label>
                    <Input
                      value={shopForm.gstNumber}
                      onChange={(e) => setShopForm({ ...shopForm, gstNumber: e.target.value })}
                      placeholder="08AAAAA0000A1Z5"
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    <div>
                      <Label className="text-xs font-semibold">Header Alignment</Label>
                      <Select value={settings.headerStyle} onValueChange={(v: any) => updateSetting("headerStyle", v)}>
                        <SelectTrigger className="h-9 text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="classic">Classic (Left Logo, Right Invoice)</SelectItem>
                          <SelectItem value="centered">Centered (Logo & Name Middle)</SelectItem>
                          <SelectItem value="modern">Modern Accent Bar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">Accent Color Theme</Label>
                      <Select value={settings.themeColor} onValueChange={(v: any) => updateSetting("themeColor", v)}>
                        <SelectTrigger className="h-9 text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gold">Amber Gold (Classic)</SelectItem>
                          <SelectItem value="emerald">Emerald Green (Fresh)</SelectItem>
                          <SelectItem value="purple">Royal Purple (Luxury)</SelectItem>
                          <SelectItem value="blue">Sapphire Blue (Corporate)</SelectItem>
                          <SelectItem value="slate">Slate Black (Monochrome)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <div className="font-semibold">Show Showroom Logo</div>
                      <div className="text-[10px] text-muted-foreground">Print logo image on top of invoice header</div>
                    </div>
                    <Switch
                      checked={settings.showLogo}
                      onCheckedChange={(c) => updateSetting("showLogo", c)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TABLE COLUMNS TAB */}
            <TabsContent value="columns" className="mt-4 space-y-4">
              <Card className="shadow-sm border">
                <CardHeader className="py-3.5 bg-muted/20 border-b">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-purple-600" /> Invoice Item Table Column Controls
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Toggle which columns to show or hide on customer printed tax invoices.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between py-1 border-b">
                    <span>Show HUID / Hallmarking Code</span>
                    <Switch checked={settings.showHuid} onCheckedChange={(c) => updateSetting("showHuid", c)} />
                  </div>
                  <div className="flex items-center justify-between py-1 border-b">
                    <span>Show Purity / Karat (22K, 18K, 925)</span>
                    <Switch checked={settings.showPurity} onCheckedChange={(c) => updateSetting("showPurity", c)} />
                  </div>
                  <div className="flex items-center justify-between py-1 border-b">
                    <span>Show Gross Weight (g)</span>
                    <Switch checked={settings.showGrossWeight} onCheckedChange={(c) => updateSetting("showGrossWeight", c)} />
                  </div>
                  <div className="flex items-center justify-between py-1 border-b">
                    <span>Show Net Weight (g)</span>
                    <Switch checked={settings.showNetWeight} onCheckedChange={(c) => updateSetting("showNetWeight", c)} />
                  </div>
                  <div className="flex items-center justify-between py-1 border-b">
                    <span>Show Rate per Gram (₹)</span>
                    <Switch checked={settings.showRatePerGram} onCheckedChange={(c) => updateSetting("showRatePerGram", c)} />
                  </div>
                  <div className="flex items-center justify-between py-1 border-b">
                    <span>Show Making Charges (₹ / %)</span>
                    <Switch checked={settings.showMakingCharges} onCheckedChange={(c) => updateSetting("showMakingCharges", c)} />
                  </div>
                  <div className="flex items-center justify-between py-1 border-b">
                    <span>Show GST Tax Breakdown (CGST + SGST)</span>
                    <Switch checked={settings.showGstBreakdown} onCheckedChange={(c) => updateSetting("showGstBreakdown", c)} />
                  </div>
                  <div className="flex items-center justify-between py-1 border-b">
                    <span>Show Old Gold Exchange Summary Box</span>
                    <Switch checked={settings.showOldGoldSection} onCheckedChange={(c) => updateSetting("showOldGoldSection", c)} />
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span>Show UPI Payment Stamp / QR Placeholder</span>
                    <Switch checked={settings.showPaymentQr} onCheckedChange={(c) => updateSetting("showPaymentQr", c)} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* FOOTER & TERMS TAB */}
            <TabsContent value="footer" className="mt-4 space-y-4">
              <Card className="shadow-sm border">
                <CardHeader className="py-3.5 bg-muted/20 border-b">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" /> Invoice Terms, Signatures & Bank Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3.5 text-xs">
                  <div>
                    <Label className="text-xs font-semibold">Terms & Conditions (One rule per line)</Label>
                    <Textarea
                      value={settings.termsAndConditions}
                      onChange={(e) => updateSetting("termsAndConditions", e.target.value)}
                      rows={4}
                      className="text-xs mt-1 font-mono"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Custom Footer Note</Label>
                    <Input
                      value={settings.customFooterNote}
                      onChange={(e) => updateSetting("customFooterNote", e.target.value)}
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Left Signature Title</Label>
                      <Input
                        value={settings.signature1Label}
                        onChange={(e) => updateSetting("signature1Label", e.target.value)}
                        className="h-9 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Right Signature Title</Label>
                      <Input
                        value={settings.signature2Label}
                        onChange={(e) => updateSetting("signature2Label", e.target.value)}
                        className="h-9 text-xs mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Bank Account & NEFT Details</Label>
                    <Input
                      value={settings.bankAccountDetails}
                      onChange={(e) => updateSetting("bankAccountDetails", e.target.value)}
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  {/* UPI & PAYMENT QR CODE SECTION */}
                  <div className="pt-3 border-t space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-bold text-slate-800">Show UPI Payment Stamp / QR Code on Invoice</Label>
                        <p className="text-[10px] text-muted-foreground">Print custom QR image or auto-generated UPI QR on customer tax invoices</p>
                      </div>
                      <Switch checked={settings.showPaymentQr} onCheckedChange={(c) => updateSetting("showPaymentQr", c)} />
                    </div>

                    {settings.showPaymentQr && (
                      <div className="space-y-3 p-3 bg-amber-50/60 rounded border border-amber-200/80">
                        <div>
                          <Label className="text-xs font-semibold">UPI ID / VPA (e.g., 9876543210@ybl or shopname@upi)</Label>
                          <Input
                            value={settings.upiId || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSettings((prev) => ({
                                ...prev,
                                upiId: val,
                                showPaymentQr: val.trim() ? true : prev.showPaymentQr,
                              }));
                            }}
                            placeholder="Enter UPI ID (e.g. 9876543210@ybl)"
                            className="h-9 text-xs mt-1 bg-white font-mono"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-semibold">Upload Custom Payment QR Image (or paste Image URL)</Label>
                          <div className="flex gap-2 mt-1 items-center">
                            <Input
                              value={settings.qrCodeUrl || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSettings((prev) => ({
                                  ...prev,
                                  qrCodeUrl: val,
                                  showPaymentQr: val.trim() ? true : prev.showPaymentQr,
                                }));
                              }}
                              placeholder="Paste QR Image URL or upload image..."
                              className="h-9 text-xs bg-white flex-1 font-mono"
                            />
                            <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-xs font-medium h-9 px-3 bg-slate-900 text-white hover:bg-slate-800 shrink-0">
                              Upload QR
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                      if (ev.target?.result) {
                                        setSettings((prev) => ({
                                          ...prev,
                                          qrCodeUrl: ev.target!.result as string,
                                          showPaymentQr: true,
                                        }));
                                      }
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        {/* QR Code Preview Thumbnail */}
                        {(settings.qrCodeUrl || settings.upiId || shopForm.phone) && (
                          <div className="flex items-center gap-3 pt-2 border-t border-amber-200/60">
                            <img
                              src={getUpiQrCodeUrl({
                                upiId: settings.upiId,
                                shopName: shopForm.shopName,
                                phone: shopForm.phone,
                                qrCodeUrl: settings.qrCodeUrl,
                              })}
                              alt="QR Code Preview"
                              className="h-14 w-14 object-contain bg-white rounded border p-1 shrink-0"
                            />
                            <div className="text-[11px] leading-tight">
                              <span className="font-bold text-slate-800">QR Code Live Preview</span>
                              <p className="text-[10px] text-slate-700 font-mono mt-0.5">
                                UPI: <strong>{settings.upiId || (shopForm.phone ? `${shopForm.phone}@ybl` : "Not Set")}</strong>
                              </p>
                              <p className="text-[9.5px] text-slate-500 mt-0.5">
                                {settings.qrCodeUrl ? "✓ Using custom uploaded QR image" : "✓ Auto-generated QR code from UPI ID"}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* RIGHT PANE: LIVE REAL-TIME PRINT PREVIEW CANVAS */}
        <div className="lg:col-span-7">
          <Card className="shadow-md border bg-slate-100 overflow-hidden">
            <CardHeader className="bg-slate-900 text-white py-3 px-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider">Live Real-Time Invoice Print Preview</span>
              </div>
              <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-400 font-mono">
                {settings.themeColor.toUpperCase()} THEME
              </Badge>
            </CardHeader>

            <CardContent className="p-4 sm:p-8 bg-slate-200 overflow-x-auto">
              <div id="printable-invoice-preview" className={`bg-white text-slate-900 p-6 rounded shadow-lg border max-w-2xl mx-auto font-sans text-xs`}>
                {/* HEADER */}
                <div className={`border-b-2 ${getThemeHeaderClass()} pb-4 mb-4 flex ${settings.headerStyle === "centered" ? "flex-col items-center text-center" : "justify-between items-start"}`}>
                  <div className={`flex items-start gap-3 ${settings.headerStyle === "centered" ? "flex-col items-center" : ""}`}>
                    {settings.showLogo && (
                      <img src={shopForm.logoUrl || "/logo.png"} alt="Logo" className="h-16 w-16 object-contain shrink-0" />
                    )}
                    <div>
                      <h2 className="text-2xl font-bold uppercase tracking-wide text-slate-900 font-display">
                        {shopForm.shopName || "Jewellery Showroom"}
                      </h2>
                      {settings.tagline && <p className="text-[11px] font-semibold text-slate-600 tracking-wide">{settings.tagline}</p>}
                      <p className="text-[11px] text-slate-600 mt-1 leading-tight">{shopForm.address}</p>
                      <div className="text-[11px] text-slate-700 mt-1 flex flex-wrap gap-3">
                        {shopForm.phone && <span><strong>Mob 1:</strong> {shopForm.phone}</span>}
                        {shopForm.numberOfShopOwner && <span><strong>Mob 2:</strong> {shopForm.numberOfShopOwner}</span>}
                        {shopForm.gstNumber && <span><strong>GSTIN:</strong> {shopForm.gstNumber}</span>}
                      </div>
                    </div>
                  </div>

                  {settings.headerStyle !== "centered" && (
                    <div className="text-right">
                      <span className={`inline-block px-2.5 py-1 rounded font-bold uppercase tracking-widest text-[10px] ${getThemeBgClass()}`}>
                        {getCleanInvoiceTitle(settings.invoiceTitle)}
                      </span>
                      <div className="text-[11px] font-mono mt-2">Inv #: <strong>{SAMPLE_INVOICE.number}</strong></div>
                      <div className="text-[11px] font-mono">Date: <strong>{formatDate(SAMPLE_INVOICE.createdAt)}</strong></div>
                    </div>
                  )}
                </div>

                {/* CUSTOMER BILL TO */}
                <div className="flex justify-between items-center mb-4 bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-semibold">Billed To:</span>{" "}
                    <strong className="text-slate-900 text-xs">{SAMPLE_INVOICE.customerName}</strong>
                  </div>
                  <div><strong>Mobile:</strong> {SAMPLE_INVOICE.customerMobile}</div>
                  <div><strong>Payment Mode:</strong> {SAMPLE_INVOICE.paymentMode}</div>
                </div>

                {/* DYNAMIC ITEM TABLE */}
                <table className="w-full text-left text-[11px] border-collapse border border-slate-300 mb-4">
                  <thead>
                    <tr className={`border-b-2 border-slate-400 ${getThemeBgClass()} font-bold uppercase`}>
                      <th className="py-2 px-2 border-r">#</th>
                      <th className="py-2 px-2 border-r">Item Description</th>
                      {settings.showHuid && <th className="py-2 px-2 border-r">{settings.huidHeaderLabel}</th>}
                      {settings.showGrossWeight && <th className="py-2 px-2 border-r text-right">Gross Wt</th>}
                      {settings.showNetWeight && <th className="py-2 px-2 border-r text-right">Net Wt</th>}
                      {settings.showRatePerGram && <th className="py-2 px-2 border-r text-right">Rate/g</th>}
                      {settings.showMakingCharges && <th className="py-2 px-2 border-r text-right">{settings.makingChargeHeaderLabel}</th>}
                      <th className="py-2 px-2 text-right">Line Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAMPLE_INVOICE.items.map((it, idx) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="py-2 px-2 border-r text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-2 border-r font-semibold text-slate-900">{it.name}</td>
                        {settings.showHuid && <td className="py-2 px-2 border-r text-slate-700 font-mono text-[10px]">{it.huid} ({it.purity})</td>}
                        {settings.showGrossWeight && <td className="py-2 px-2 border-r text-right font-mono">{it.grossWeight}g</td>}
                        {settings.showNetWeight && <td className="py-2 px-2 border-r text-right font-mono font-semibold">{it.netWeight}g</td>}
                        {settings.showRatePerGram && <td className="py-2 px-2 border-r text-right font-mono">{inr(it.ratePerGram)}</td>}
                        {settings.showMakingCharges && <td className="py-2 px-2 border-r text-right font-mono">{inr(it.makingCharge)}</td>}
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">{inr((it.netWeight * it.ratePerGram) + it.makingCharge)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* TOTALS & TAX BREAKDOWN */}
                <div className="flex justify-between items-start gap-4 border-t border-slate-300 pt-3">
                  <div className="flex-1 space-y-2">
                    {/* TERMS */}
                    {settings.termsAndConditions && (
                      <div className="text-[10px] text-slate-600 bg-slate-50 p-2 rounded border">
                        <div className="font-bold text-slate-800 uppercase mb-0.5">Terms & Conditions:</div>
                        <div className="whitespace-pre-line leading-tight">{settings.termsAndConditions}</div>
                      </div>
                    )}

                    {settings.bankAccountDetails && (
                      <div className="text-[10px] font-mono text-slate-700 bg-amber-50/50 p-1.5 rounded border border-amber-200">
                        <strong>Bank Details:</strong> {settings.bankAccountDetails}
                      </div>
                    )}

                    {settings.showPaymentQr && (
                      <div className="border border-slate-300 rounded p-2 flex items-center gap-2.5 bg-slate-50 text-[10px] text-slate-700">
                        <img
                          src={getUpiQrCodeUrl({
                            upiId: settings.upiId,
                            shopName: shopForm.shopName,
                            phone: shopForm.phone,
                            qrCodeUrl: settings.qrCodeUrl,
                            amount: SAMPLE_INVOICE.total,
                          })}
                          alt="UPI Payment QR"
                          className="w-12 h-12 object-contain rounded border bg-white p-0.5 shrink-0"
                        />
                        <div>
                          <div className="font-bold text-slate-900 uppercase tracking-wider text-[9px]">Scan &amp; Pay via UPI</div>
                          <div className="font-mono text-[9.5px] text-slate-700 font-semibold mt-0.5">
                            {settings.upiId || (shopForm.phone ? `${shopForm.phone}@ybl` : "UPI Payment")}
                          </div>
                          <div className="text-[8.5px] text-slate-500 mt-0.5">Accepts GPay, PhonePe, Paytm &amp; BHIM</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SUMMARY BOX */}
                  <div className="w-56 text-[11px] space-y-1 text-right">
                    <div className="flex justify-between text-slate-600"><span>Subtotal:</span><span>{inr(SAMPLE_INVOICE.subtotal)}</span></div>
                    <div className="flex justify-between text-emerald-700"><span>Discount:</span><span>-{inr(SAMPLE_INVOICE.discount)}</span></div>
                    {settings.showOldGoldSection && (
                      <div className="flex justify-between text-amber-800"><span>Old Gold Exchange:</span><span>-{inr(SAMPLE_INVOICE.oldGoldAmount)}</span></div>
                    )}
                    {settings.showGstBreakdown && (
                      <>
                        <div className="flex justify-between text-slate-600"><span>CGST (1.5%):</span><span>{inr(SAMPLE_INVOICE.gstAmount / 2)}</span></div>
                        <div className="flex justify-between text-slate-600"><span>SGST (1.5%):</span><span>{inr(SAMPLE_INVOICE.gstAmount / 2)}</span></div>
                      </>
                    )}
                    <div className={`flex justify-between font-bold text-sm border-t-2 border-slate-900 pt-1.5 mt-1 ${getThemeHeaderClass()}`}>
                      <span>Grand Total:</span>
                      <span>{inr(SAMPLE_INVOICE.total)}</span>
                    </div>
                  </div>
                </div>

                {/* SIGNATURES & STAMPS */}
                <div className="mt-10 grid grid-cols-2 gap-8 text-center text-[11px] font-semibold text-slate-700">
                  <div className="border-t border-slate-400 pt-1.5">{settings.signature1Label || "Customer Signature"}</div>
                  <div className="border-t border-slate-400 pt-1.5">{settings.signature2Label || "For Authorized Signatory"}</div>
                </div>

                {/* FOOTER NOTE */}
                {settings.customFooterNote && (
                  <div className="mt-4 pt-2 border-t border-slate-200 text-center text-[10px] text-slate-500 font-medium">
                    {settings.customFooterNote}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
