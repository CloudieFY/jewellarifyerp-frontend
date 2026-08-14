import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Receipt, Phone, Printer, CheckCircle2, AlertCircle, Share2, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { inr, calcItem } from "@/lib/storage";
import { formatDate, triggerPrint } from "@/lib/utils";
import { toast } from "sonner";

export default function InvoiceViewerPage() {
  const { dbName, invoiceId } = useParams<{ dbName?: string; invoiceId: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) {
      setError("Invalid invoice link");
      setLoading(false);
      return;
    }

    const endpoint = dbName
      ? `/api/public/invoice/${dbName}/${invoiceId}`
      : `/api/public/invoice/${invoiceId}`;

    fetch(endpoint)
      .then((res) => {
        if (!res.ok) throw new Error("Invoice bill not found");
        return res.json();
      })
      .then((resData) => {
        setData(resData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load invoice details");
        setLoading(false);
      });
  }, [dbName, invoiceId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin mb-4" />
        <h3 className="text-lg font-semibold font-display">Loading Digital Invoice Bill...</h3>
        <p className="text-xs text-muted-foreground mt-1">Please wait while we retrieve your receipt.</p>
      </div>
    );
  }

  if (error || !data || !data.invoice) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <Receipt className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold font-display">Invoice Bill Not Found</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          The requested invoice link may be invalid or expired.
        </p>
      </div>
    );
  }

  const { invoice, shop } = data;
  const shopName = shop?.shopName || "Our Jewellery Shop";
  const shopPhone = shop?.phone || "";
  const isPaid = (invoice.balanceDue || 0) <= 0;

  const handleShareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: `Invoice ${invoice.number} - ${shopName}`,
        text: `View Digital Bill #${invoice.number} from ${shopName}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Invoice link copied to clipboard!");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-background to-background text-foreground pb-12 print:bg-white print:p-0">
      {/* Top Action Header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 shadow-xs print:hidden">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold font-display text-sm tracking-tight truncate">{shopName}</h1>
              <p className="text-[11px] text-muted-foreground truncate">Digital Invoice Receipt</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={triggerPrint}>
              <Printer className="w-3.5 h-3.5 mr-1" /> Print
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full" onClick={handleShareLink}>
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Invoice Card */}
      <main className="max-w-xl mx-auto p-4 space-y-4 print:max-w-none print:p-0">
        <Card className="border border-border/80 shadow-md bg-card print:border-none print:shadow-none">
          <CardContent className="p-5 sm:p-7 space-y-6">
            {/* Header branding */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <Gem className="w-6 h-6 text-amber-600" />
                  <h2 className="text-xl font-bold font-display tracking-tight text-foreground">{shopName}</h2>
                </div>
                {shop?.address && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{shop.address}</p>}
                {shopPhone && <p className="text-xs text-muted-foreground">Phone: {shopPhone}</p>}
                {shop?.gstNumber && <p className="text-xs font-mono text-muted-foreground mt-0.5">GSTIN: {shop.gstNumber}</p>}
              </div>

              <div className="sm:text-right">
                <div className="inline-block px-3 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-800 dark:text-amber-300 font-mono text-sm font-bold">
                  {invoice.number}
                </div>
                <div className="text-xs text-muted-foreground mt-1.5">
                  Date: <span className="font-semibold text-foreground">{formatDate(invoice.createdAt || new Date())}</span>
                </div>
                <div className="mt-2">
                  {isPaid ? (
                    <Badge className="bg-emerald-600 text-white font-bold text-xs uppercase px-2.5 py-0.5">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Paid Complete
                    </Badge>
                  ) : (
                    <Badge className="bg-rose-600 text-white font-bold text-xs uppercase px-2.5 py-0.5">
                      <AlertCircle className="w-3 h-3 mr-1" /> Balance Due: {inr(invoice.balanceDue || 0)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Billed To Customer */}
            <div className="bg-muted/30 p-3.5 rounded-lg border border-border flex justify-between items-center text-xs">
              <div>
                <span className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wider block">Customer Billed To</span>
                <span className="font-bold text-foreground text-sm block mt-0.5">{invoice.customerName || "Valued Customer"}</span>
                {invoice.customerMobile && <span className="text-muted-foreground font-mono">{invoice.customerMobile}</span>}
              </div>
              <div className="text-right">
                <span className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wider block">Payment Mode</span>
                <span className="font-bold text-foreground capitalize mt-0.5 block">{invoice.paymentMode || "Cash"}</span>
              </div>
            </div>

            {/* Itemized Table */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Itemized Breakdown</h3>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-semibold border-b border-border">
                    <tr>
                      <th className="py-2 px-3 text-left">Item</th>
                      <th className="py-2 px-2 text-right">Net Wt</th>
                      <th className="py-2 px-2 text-right">Rate</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoice.items?.map((it: any, i: number) => {
                      const c = calcItem(it, invoice.type === "GST");
                      return (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-foreground">{it.name}</div>
                            {it.purity && <div className="text-[10px] text-muted-foreground">Purity: {it.purity}</div>}
                          </td>
                          <td className="py-2.5 px-2 text-right font-medium">{it.netWeight} g</td>
                          <td className="py-2.5 px-2 text-right text-muted-foreground">{inr(it.ratePerGram)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-foreground">{inr(c.line)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bill Summary Calculation */}
            <div className="flex justify-end text-xs pt-2">
              <div className="w-full sm:w-64 space-y-1.5 bg-muted/20 p-3 rounded-lg border border-border">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-foreground">{inr(invoice.subtotal)}</span>
                </div>
                {invoice.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount:</span>
                    <span>- {inr(invoice.discount)}</span>
                  </div>
                )}
                {invoice.oldGoldAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Old Gold Exchange:</span>
                    <span>- {inr(invoice.oldGoldAmount)}</span>
                  </div>
                )}
                {invoice.gstAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>GST Tax (3%):</span>
                    <span>{inr(invoice.gstAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-foreground border-t border-border pt-1.5">
                  <span>Grand Total:</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-display text-base">{inr(invoice.total)}</span>
                </div>
                {invoice.amountPaid !== undefined && (
                  <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50 text-[11px]">
                    <span>Amount Paid:</span>
                    <span className="font-semibold text-foreground">{inr(invoice.amountPaid)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Notice & Actions */}
            <div className="pt-4 border-t border-border text-center text-xs text-muted-foreground space-y-2 print:hidden">
              <p className="font-medium text-foreground">Thank you for your business! 💍✨</p>
              {shopPhone && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button variant="outline" size="sm" className="h-9 px-4 text-xs font-semibold" onClick={() => window.open(`tel:${shopPhone}`, "_self")}>
                    <Phone className="w-3.5 h-3.5 mr-1.5 text-primary" /> Call Store ({shopPhone})
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
