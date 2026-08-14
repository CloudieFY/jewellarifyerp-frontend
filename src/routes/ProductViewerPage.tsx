import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Gem, Phone, MessageSquare, ZoomIn, Share2, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { inr } from "@/lib/storage";
import { toast } from "sonner";

export default function ProductViewerPage() {
  const { dbName, inventoryId } = useParams<{ dbName?: string; inventoryId: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    if (!inventoryId) {
      setError("Invalid product link");
      setLoading(false);
      return;
    }

    const fetchUrl = dbName
      ? `/api/public/inventory-item/${dbName}/${inventoryId}`
      : `/api/public/inventory-item-by-id/${inventoryId}`;

    fetch(fetchUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Product design not found");
        return res.json();
      })
      .then((resData) => {
        setData(resData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load product details");
        setLoading(false);
      });
  }, [dbName, inventoryId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
        <h3 className="text-lg font-semibold font-display">Loading Jewellery Design...</h3>
        <p className="text-xs text-muted-foreground mt-1">Please wait while we prepare the showcase.</p>
      </div>
    );
  }

  if (error || !data || !data.item) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <Gem className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold font-display">Design Not Found</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          The requested jewellery design may have been sold or removed from the catalog.
        </p>
      </div>
    );
  }

  const { item, shop } = data;
  const metalValue = (item.netWeight || 0) * (item.ratePerGram || 0);
  const making = item.makingChargePct ? (metalValue * item.makingChargePct) / 100 : (item.makingCharge || 0);
  const totalEst = metalValue + making + (item.stoneWeight || 0);

  const shopName = shop?.shopName || "Our Jewellery Shop";
  const shopPhone = shop?.phone || "";

  const handleWhatsAppInquire = () => {
    let cleanPhone = shopPhone.replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
    
    const msg = `Hi ${shopName}, I saw your design *${item.name}* (${item.category} • ${item.purity} • ${item.netWeight}g) on your catalog and would like more details!`;
    const encoded = encodeURIComponent(msg);
    
    if (cleanPhone.length >= 10) {
      window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${encoded}`, "_blank");
    }
  };

  const handleShareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: `${item.name} - ${shopName}`,
        text: `Check out ${item.name} design from ${shopName}!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Page link copied to clipboard!");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/50 via-background to-background dark:from-amber-950/20 dark:via-background dark:to-background text-foreground pb-12">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/60 px-4 py-3 shadow-xs">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm shrink-0 border border-amber-500/20">
              <Gem className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold font-display text-sm tracking-tight truncate">{shopName}</h1>
              <p className="text-[11px] text-muted-foreground truncate">Official Product Showcase</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={handleShareLink} title="Share Design">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content Showcase */}
      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* Product Image Card */}
        <Card className="overflow-hidden border border-amber-500/20 shadow-md bg-card">
          <div className="relative aspect-square bg-muted/30 group flex items-center justify-center">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-contain p-2 cursor-pointer transition-transform duration-300 group-hover:scale-105"
                onClick={() => setZoomOpen(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground p-8">
                <Gem className="w-16 h-16 mb-2 opacity-40" />
                <span className="text-xs">No Design Image</span>
              </div>
            )}
            {item.imageUrl && (
              <button
                onClick={() => setZoomOpen(true)}
                className="absolute bottom-3 right-3 bg-black/70 text-white hover:bg-black p-2 rounded-full backdrop-blur-xs transition-transform active:scale-95"
                title="Tap to Zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            )}
            <Badge className="absolute top-3 left-3 bg-amber-600 text-white font-medium text-xs shadow-xs">
              <Sparkles className="w-3 h-3 mr-1" /> {item.category}
            </Badge>
          </div>

          <CardContent className="p-4 space-y-4">
            <div>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl font-bold font-display tracking-tight text-foreground">{item.name}</h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border shrink-0">
                  {item.purity}
                </span>
              </div>
              {item.subcategory && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Subcategory: <span className="font-medium text-foreground">{item.subcategory}</span>
                </p>
              )}
            </div>

            {/* Specifications Grid */}
            <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-lg border border-border text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold tracking-wider">Net Weight</span>
                <span className="font-bold text-foreground text-sm">{item.netWeight} g</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold tracking-wider">Purity</span>
                <span className="font-bold text-foreground text-sm">{item.purity}</span>
              </div>
              {item.grossWeight ? (
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold tracking-wider">Gross Weight</span>
                  <span className="font-medium text-foreground">{item.grossWeight} g</span>
                </div>
              ) : null}
              {item.huid ? (
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold tracking-wider">HUID Code</span>
                  <span className="font-mono text-foreground font-semibold">{item.huid}</span>
                </div>
              ) : null}
            </div>

            {/* Estimated Price Display */}
            <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-amber-800 dark:text-amber-300 block">Estimated Price</span>
                <span className="text-2xl font-black text-amber-700 dark:text-amber-400 font-display tracking-tight">
                  {inr(totalEst)}
                </span>
              </div>
              <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300 text-[10px]">
                Live Rate
              </Badge>
            </div>

            {/* Contact & Inquire Action Buttons */}
            <div className="space-y-2 pt-2">
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-5 shadow-sm"
                onClick={handleWhatsAppInquire}
              >
                <MessageSquare className="w-4 h-4 mr-2" /> Inquire on WhatsApp
              </Button>

              {shopPhone && (
                <Button
                  variant="outline"
                  className="w-full py-5 font-semibold"
                  onClick={() => window.open(`tel:${shopPhone}`, "_self")}
                >
                  <Phone className="w-4 h-4 mr-2 text-primary" /> Call Store ({shopPhone})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="text-center text-xs text-muted-foreground pt-4 space-y-1">
          <p className="font-medium text-foreground">✨ {shopName} ✨</p>
          {shop?.address && (
            <p className="flex items-center justify-center gap-1 text-[11px]">
              <MapPin className="w-3 h-3 text-muted-foreground shrink-0" /> {shop.address}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground/70 pt-2">Powered by JewelShop SaaS</p>
        </div>
      </main>

      {/* Full-Screen Zoom Dialog */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-[95vw] h-[95vh] p-0 border-none bg-black/95 shadow-none sm:rounded-none flex items-center justify-center [&>button]:text-white [&>button]:hover:bg-white/20 [&>button]:hover:text-white" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Design Image Full Screen</DialogTitle>
          {item.imageUrl && (
            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain p-4" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
