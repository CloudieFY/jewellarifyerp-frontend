import { useState, useEffect } from "react";
import JsBarcode from "jsbarcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, ScanBarcode, QrCode, Tag, Gem } from "lucide-react";
import { inr } from "@/lib/storage";
import { useAuth } from "@/lib/auth";

interface BarcodeTagModalProps {
  product: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BarcodeTagModal({ product, open, onOpenChange }: BarcodeTagModalProps) {
  const { tenantSession } = useAuth();
  const shopName = tenantSession?.shop?.shopName || "Arihant Jewellers";
  const [tagFormat, setTagFormat] = useState<"jewellery" | "compact" | "qr">("jewellery");
  const [quantity, setQuantity] = useState(1);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string>("");

  const barcodeValue = product
    ? (product.barcode || product.sku || product.itemCode || `JWL-${(product._id || product.id || "000000").slice(-6).toUpperCase()}`).trim()
    : "";

  const itemId = product ? product._id || product.id : "";
  const publicViewUrl = itemId ? `${window.location.protocol}//${window.location.host}/v/${itemId}` : "";

  // Generate crisp 100% POS Scanner compatible CODE128 base64 PNG barcode image
  useEffect(() => {
    if (barcodeValue) {
      try {
        const canvas = document.createElement("canvas");
        JsBarcode(canvas, barcodeValue, {
          format: "CODE128",
          width: 2,
          height: 52,
          displayValue: true,
          fontSize: 12,
          font: "monospace",
          fontOptions: "bold",
          margin: 6,
          background: "#ffffff",
          lineColor: "#000000",
        });
        setBarcodeDataUrl(canvas.toDataURL("image/png"));
      } catch (err) {
        console.error("Barcode generation error:", err);
      }
    }
  }, [barcodeValue]);

  if (!product) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4 sm:p-6 print:max-w-none print:p-0 print:border-none print:bg-white print:shadow-none">
        <DialogHeader className="print:hidden">
          <DialogTitle className="text-lg font-bold font-display flex items-center gap-2">
            <ScanBarcode className="w-5 h-5 text-amber-600" />
            Jewellery Barcode Tag &amp; Sticker Generator
          </DialogTitle>
        </DialogHeader>

        {/* Tag Controls (Hidden during print) */}
        <div className="space-y-3 pt-1 text-xs print:hidden">
          <div className="flex items-center justify-between gap-2 bg-muted/40 p-2 rounded-lg border border-border">
            <span className="font-semibold text-muted-foreground">Tag Format:</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={tagFormat === "jewellery" ? "default" : "outline"}
                className="h-7 text-[11px]"
                onClick={() => setTagFormat("jewellery")}
              >
                <Tag className="w-3 h-3 mr-1" /> Jewellery Tag
              </Button>
              <Button
                size="sm"
                variant={tagFormat === "compact" ? "default" : "outline"}
                className="h-7 text-[11px]"
                onClick={() => setTagFormat("compact")}
              >
                <ScanBarcode className="w-3 h-3 mr-1" /> Sticker
              </Button>
              <Button
                size="sm"
                variant={tagFormat === "qr" ? "default" : "outline"}
                className="h-7 text-[11px]"
                onClick={() => setTagFormat("qr")}
              >
                <QrCode className="w-3 h-3 mr-1" /> QR Phone Tag
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 bg-muted/40 p-2 rounded-lg border border-border">
            <span className="font-semibold text-muted-foreground">Print Copies:</span>
            <div className="flex items-center gap-1">
              <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0 font-bold" onClick={() => setQuantity(q => Math.max(1, q - 1))}>-</Button>
              <span className="font-bold text-xs px-3 font-mono">{quantity}</span>
              <Button type="button" size="sm" variant="outline" className="h-7 w-7 p-0 font-bold" onClick={() => setQuantity(q => Math.min(50, q + 1))}>+</Button>
            </div>
          </div>
        </div>

        {/* Print Printable Area */}
        <div className="my-2 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col items-center justify-center print:m-0 print:p-0 print:border-none print:bg-white print:w-full">
          <div className="printable-tag-wrapper">
            {Array.from({ length: Math.max(1, quantity) }).map((_, idx) => (
              <div key={idx} className="barcode-print-container mb-3 last:mb-0">
                {/* JEWELLERY DUMBBELL / RAT-TAIL TAG FORMAT */}
                {tagFormat === "jewellery" && (
                  <div className="w-[330px] h-[110px] bg-white border border-slate-300 rounded-md p-2 flex justify-between items-center gap-2 shadow-xs text-[10px] text-slate-900 font-sans print:border-slate-800 print:shadow-none">
                    {/* Left Tag Wing: Item Specs */}
                    <div className="w-[145px] flex flex-col justify-between h-full border-r border-dashed border-slate-300 pr-1.5 print:border-slate-400">
                      <div>
                        <div className="font-bold text-[11px] truncate uppercase tracking-tight text-amber-900 flex items-center gap-1">
                          <Gem className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                          <span className="truncate">{shopName}</span>
                        </div>
                        <div className="font-bold text-[11px] truncate text-slate-900 leading-tight mt-0.5">{product.name}</div>
                      </div>
                      <div className="space-y-0.5 font-medium text-[9.5px]">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Purity:</span>
                          <span className="font-bold">{product.purity || "22K"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Net Wt:</span>
                          <span className="font-bold">{product.netWeight || 0} g</span>
                        </div>
                        {product.grossWeight ? (
                          <div className="flex justify-between text-[9px]">
                            <span className="text-slate-500">Gross Wt:</span>
                            <span>{product.grossWeight} g</span>
                          </div>
                        ) : null}
                        {product.huid && (
                          <div className="flex justify-between text-[8.5px] font-mono text-amber-800">
                            <span>HUID:</span>
                            <span className="font-bold">{product.huid}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Tag Wing: Barcode & QR Code */}
                    <div className="w-[165px] flex flex-col items-center justify-between h-full pl-0.5">
                      {barcodeDataUrl ? (
                        <img src={barcodeDataUrl} alt={barcodeValue} className="h-11 w-full object-contain" />
                      ) : null}
                      <div className="flex items-center justify-between w-full mt-1 border-t border-slate-200 pt-1 text-[8.5px]">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&margin=0&data=${encodeURIComponent(publicViewUrl)}`}
                          alt="QR Code"
                          className="w-7 h-7 object-contain rounded bg-white shrink-0 border border-slate-200"
                        />
                        <div className="text-right leading-tight">
                          <div className="font-mono text-[9px] font-bold tracking-tighter text-slate-700">{barcodeValue}</div>
                          {product.sellingPrice || product.mrp ? (
                            <div className="font-bold text-amber-900 text-[10px]">{inr(product.sellingPrice || product.mrp)}</div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* COMPACT STICKER FORMAT FOR POS SCANNERS */}
                {tagFormat === "compact" && (
                  <div className="w-[260px] h-[105px] bg-white border border-slate-300 rounded-md p-2 flex flex-col items-center justify-between shadow-xs text-center font-sans text-slate-900">
                    <div className="font-bold text-[10px] truncate w-full text-amber-900 uppercase tracking-tight">{shopName}</div>
                    <div className="font-bold text-[11px] truncate w-full">{product.name} • {product.purity || "22K"}</div>
                    {barcodeDataUrl ? (
                      <img src={barcodeDataUrl} alt={barcodeValue} className="h-12 w-full object-contain bg-white" />
                    ) : null}
                    <div className="flex justify-between w-full text-[9.5px] font-mono font-bold text-slate-700 px-1 border-t border-slate-200 pt-0.5">
                      <span>Wt: {product.netWeight || 0}g</span>
                      <span>{inr(product.sellingPrice || product.mrp || 0)}</span>
                    </div>
                  </div>
                )}

                {/* PHONE SCANNABLE QR TAG FORMAT */}
                {tagFormat === "qr" && (
                  <div className="w-[220px] h-[120px] bg-white border border-slate-300 rounded-md p-2 flex flex-col items-center justify-between text-center font-sans">
                    <div className="font-bold text-[10px] text-amber-900 uppercase truncate w-full">{shopName}</div>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=0&data=${encodeURIComponent(publicViewUrl)}`}
                      alt="Phone Scan QR"
                      className="w-14 h-14 object-contain rounded border bg-white p-0.5"
                    />
                    <div className="text-[9.5px] font-bold text-slate-800 leading-tight">
                      {product.name} ({product.purity || "22K"})
                    </div>
                    <div className="text-[8.5px] text-muted-foreground font-mono">Scan with Phone Camera</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="print:hidden flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span>POS Barcode:</span>
            <code className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-xs border border-emerald-200">{barcodeValue}</code>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1.5" /> Print Barcode Tag
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
