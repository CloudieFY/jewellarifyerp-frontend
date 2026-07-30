import { useMemo, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { calcItem, inr, defaultInvoiceSettings, getCleanInvoiceTitle, type InvoiceSettings, type MakingChargeType } from "@/lib/storage";
import { formatDate } from "@/lib/utils";

export function ShopHeader({ documentLabel, compact = false, rightElement }: { documentLabel?: string; compact?: boolean; rightElement?: ReactNode }) {
  const { tenantSession } = useAuth();
  const shop = tenantSession?.shop;
  const invSettings: InvoiceSettings = { ...defaultInvoiceSettings, ...((shop as any)?.invoiceSettings || {}) };

  return (
    <div className={`border-b-2 border-slate-300 flex flex-col sm:flex-row justify-between items-start gap-6 ${compact ? "pb-3 mb-4" : "pb-5 mb-6"}`}>
      <div className="flex-1 flex items-start gap-4">
        {invSettings.showLogo && (
          <div className="shrink-0">
            {shop?.logoUrl ? (
              <img src={shop.logoUrl} alt={`${shop.shopName} Logo`} className={`object-contain ${compact ? "h-16 w-16" : "h-20 w-20"}`} />
            ) : (
              <img src="/logo.png" alt="Default Logo" className={`object-contain ${compact ? "h-16 w-16" : "h-20 w-20"}`} />
            )}
          </div>
        )}
        <div>
          <h2 className={`${compact ? "text-2xl" : "text-3xl"} font-display font-bold uppercase tracking-wider text-slate-900`}>
            {shop?.shopName || "Jewellery Shop"}
          </h2>
          {invSettings.tagline && <p className="text-xs font-semibold text-slate-600 tracking-wide mt-0.5">{invSettings.tagline}</p>}
          <p className={`mt-1 text-slate-700 ${compact ? "text-xs" : "text-sm"}`}>{shop?.address}</p>
          <div className={`mt-2 space-y-0.5 text-slate-800 ${compact ? "text-[11px]" : "text-xs"}`}>
            {shop?.phone && <p><span className="font-semibold">Mobile:</span> {shop.phone}</p>}
            {shop?.numberOfShopOwner && <p><span className="font-semibold">Contact:</span> {shop.numberOfShopOwner}</p>}
            {(documentLabel === "Tax Invoice" || documentLabel === "INVOICE" || documentLabel === "Invoice" || !documentLabel) && shop?.gstNumber && <p><span className="font-semibold">GSTIN:</span> {shop.gstNumber}</p>}
            {(shop?.instaId || shop?.fbId) && (
              <div className="flex items-center gap-x-3 pt-1">
                {shop?.instaId && <p><span className="font-semibold">Instagram:</span> {shop.instaId.startsWith('@') ? shop.instaId : `@${shop.instaId}`}</p>}
                {shop?.fbId && <p><span className="font-semibold">Facebook:</span> {shop.fbId}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="shrink-0 w-full sm:w-auto text-right">
        {documentLabel && (
          <p className={`text-xs font-bold uppercase tracking-[0.25em] text-slate-500 ${rightElement ? 'mb-2' : ''}`}>{documentLabel}</p>
        )}
        {rightElement && <div className="w-full sm:w-80 ml-auto">{rightElement}</div>}
      </div>
    </div>
  );
}

/**
 * Narrow receipt-style layout for 58mm/78mm thermal printers. Items are
 * stacked (name, then qty/weight/rate, then making-charge/total lines)
 * instead of a table, since a thermal roll has no room for columns.
 */
export function ThermalInvoiceReceipt({ inv, widthMm }: { inv: any; widthMm: 58 | 78 }) {
  const { tenantSession } = useAuth();
  const shop = tenantSession?.shop;

  const makingChargeLabel = (it: any) => {
    const mcType: MakingChargeType = it.makingChargeType || "PERCENTAGE";
    if (mcType === "PERCENTAGE") {
      const pct = it.makingChargeValue ?? it.makingChargePct ?? (it.makingCharge > 0 && it.netWeight > 0 && it.ratePerGram > 0 ? (it.makingCharge / (it.netWeight * it.ratePerGram)) * 100 : 0);
      return pct > 0 ? `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%` : "0%";
    }
    const value = it.makingChargeValue ?? 0;
    if (mcType === "PER_GRAM") return `${inr(value)}/g`;
    if (mcType === "PER_PIECE") return `${inr(value)}/pc`;
    return `${inr(value)} Fixed`;
  };

  const preRound = Math.round((inv.subtotal - inv.discount - inv.oldGoldAmount + (inv.type === "GST" ? inv.gstAmount : 0)) * 100) / 100;
  const roundOff = Math.round((inv.total - preRound) * 100) / 100;

  return (
    <div className="bg-white text-black mx-auto font-mono" style={{ width: `${widthMm}mm` }}>
      <div className="flex items-center gap-2 mb-1.5 border-b border-dashed border-black pb-1.5">
        <div className="shrink-0">
          {shop?.logoUrl ? (
            <img src={shop.logoUrl} alt="Logo" className="h-10 w-10 object-contain" />
          ) : (
            <img src="/logo.png" alt="Logo" className="h-10 w-10 object-contain" />
          )}
        </div>
        <div className="text-left flex-1 min-w-0">
          <div className="font-bold text-[12px] uppercase leading-tight text-black truncate">{shop?.shopName || "Jewellery Shop"}</div>
          {shop?.address && <div className="text-[8.5px] leading-tight text-black truncate">{shop.address}</div>}
          {shop?.phone && <div className="text-[8.5px] text-black">Mob: {shop.phone}</div>}
          {inv.type === "GST" && shop?.gstNumber && <div className="text-[8.5px] text-black">GSTIN: {shop.gstNumber}</div>}
        </div>
      </div>
      <div className="text-[10px] leading-tight">
        <div className="font-bold text-center mb-0.5">INVOICE</div>
        <div>Invoice: {inv.number}</div>
        <div>Date: {formatDate(inv.createdAt)}</div>
        <div>Customer: {inv.customerName}</div>
        {inv.customerMobile && <div>Mobile: {inv.customerMobile}</div>}
      </div>
      <div className="border-t border-dashed border-black my-1" />
      <div className="text-[10px]">
        {inv.items.map((it: any, i: number) => {
          const c = calcItem(it, inv.type === "GST");
          return (
            <div key={i} className="mb-1">
              <div className="font-semibold leading-tight">{i + 1}. {it.name}{it.purity ? ` (${it.purity})` : ""}</div>
              <div className="flex justify-between text-[9px]">
                <span>{it.qty} x {it.netWeight}g @ {inr(it.ratePerGram)}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span>MC: {makingChargeLabel(it)}</span>
                <span className="font-semibold">{inr(c.line)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-dashed border-black my-1" />
      <div className="text-[10px] space-y-0.5">
        <div className="flex justify-between"><span>Subtotal</span><span>{inr(inv.subtotal)}</span></div>
        {inv.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{inr(inv.discount)}</span></div>}
        {inv.oldGoldAmount > 0 && <div className="flex justify-between"><span>Old Gold Exch.</span><span>-{inr(inv.oldGoldAmount)}</span></div>}
        {inv.type === "GST" && (
          <>
            <div className="flex justify-between"><span>CGST @1.5%</span><span>{inr(inv.gstAmount / 2)}</span></div>
            <div className="flex justify-between"><span>SGST @1.5%</span><span>{inr(inv.gstAmount / 2)}</span></div>
          </>
        )}
        {roundOff !== 0 && <div className="flex justify-between"><span>Round Off</span><span>{inr(roundOff)}</span></div>}
        <div className="flex justify-between font-bold text-[11px] border-t border-black pt-0.5 mt-0.5"><span>Grand Total</span><span>{inr(inv.total)}</span></div>
        {inv.amountPaid !== undefined && (
          <>
            <div className="flex justify-between"><span>Paid</span><span>{inr(inv.amountPaid)}</span></div>
            <div className="flex justify-between font-bold"><span>Balance Due</span><span>{inr(inv.balanceDue || 0)}</span></div>
          </>
        )}
      </div>
      <div className="border-t border-dashed border-black my-1" />
      <div className="text-center text-[9px] mt-1">Thank you for your business!</div>
    </div>
  );
}

export function InvoiceTerms({}: { compact?: boolean }) {
  const { tenantSession } = useAuth();
  const terms = tenantSession?.shop?.termsAndConditions;
  // Only show terms the shop owner entered in Shop Profile. Nothing entered => blank, no default.
  const termsList = useMemo(() => {
    return (terms || "").split('\n').map(t => t.trim()).filter(t => t);
  }, [terms]);

  if (termsList.length === 0) return null;

  return (
    <div className="text-left text-xs leading-tight">
      <p className="font-bold mb-1">Terms & Conditions:</p>
      <ol className="list-decimal list-inside text-slate-600 space-y-0.5">
        {termsList.map((term, index) => <li key={index}>{term}</li>)}
      </ol>
    </div>
  );
}

export function CompactA5Invoice({ inv }: { inv: any }) {
  const { tenantSession } = useAuth();
  const shop = tenantSession?.shop;
  const invSettings: InvoiceSettings = { ...defaultInvoiceSettings, ...((shop as any)?.invoiceSettings || {}) };

  // Theme accent for A5
  const accent = (() => {
    switch (invSettings.themeColor) {
      case "purple": return { border: "border-purple-700", bg: "bg-purple-50", text: "text-purple-900", th: "bg-purple-100 text-purple-900" };
      case "emerald": return { border: "border-emerald-700", bg: "bg-emerald-50", text: "text-emerald-900", th: "bg-emerald-100 text-emerald-900" };
      case "blue": return { border: "border-blue-700", bg: "bg-blue-50", text: "text-blue-900", th: "bg-blue-100 text-blue-900" };
      case "slate": return { border: "border-slate-800", bg: "bg-slate-100", text: "text-slate-900", th: "bg-slate-200 text-slate-900" };
      case "gold":
      default: return { border: "border-amber-600", bg: "bg-amber-50", text: "text-amber-900", th: "bg-amber-100 text-amber-900" };
    }
  })();

  const makingChargeLabel = (it: any) => {
    const mcType: MakingChargeType = it.makingChargeType || "PERCENTAGE";
    if (mcType === "PERCENTAGE") {
      const pct = it.makingChargeValue ?? it.makingChargePct ?? (it.makingCharge > 0 && it.netWeight > 0 && it.ratePerGram > 0 ? (it.makingCharge / (it.netWeight * it.ratePerGram)) * 100 : 0);
      return pct > 0 ? `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%` : "0%";
    }
    const value = it.makingChargeValue ?? 0;
    if (mcType === "PER_GRAM") return `${inr(value)}/g`;
    if (mcType === "PER_PIECE") return `${inr(value)}/pc`;
    return `${inr(value)}`;
  };

  return (
    <div className="bg-white text-slate-900 p-5 font-sans text-xs max-w-2xl mx-auto border border-slate-300 rounded shadow-sm print:shadow-none print:border-none print:p-0 print:m-0">
      {/* Header */}
      <div className={`flex justify-between items-start border-b-4 ${accent.border} pb-3 mb-3`}>
        <div className="flex items-start gap-3">
          {invSettings.showLogo && (
            shop?.logoUrl
              ? <img src={shop.logoUrl} alt="Logo" className="h-12 w-12 object-contain shrink-0" />
              : <img src="/logo.png" alt="Logo" className="h-12 w-12 object-contain shrink-0" />
          )}
          <div>
            <h2 className="text-xl font-bold text-slate-900 uppercase tracking-wide">{shop?.shopName || "Jewellery Shop"}</h2>
            {invSettings.tagline && <p className="text-[10px] font-semibold text-slate-500 tracking-wide">{invSettings.tagline}</p>}
            <p className="text-[11px] text-slate-600 leading-tight mt-0.5">{shop?.address}</p>
            <div className="text-[11px] text-slate-700 mt-1 flex flex-wrap gap-3">
              {shop?.phone && <span>Mob 1: {shop.phone}</span>}
              {shop?.numberOfShopOwner && <span>Mob 2: {shop.numberOfShopOwner}</span>}
              {inv.type === "GST" && shop?.gstNumber && <span>GSTIN: {shop.gstNumber}</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`inline-block px-2 py-1 rounded font-bold text-xs uppercase tracking-widest ${accent.bg} ${accent.text}`}>
            {getCleanInvoiceTitle(invSettings.invoiceTitle)}
          </div>
          <div className="text-[11px] text-slate-600 mt-0.5">Inv #: <span className="font-semibold text-slate-900">{inv.number}</span></div>
          <div className="text-[11px] text-slate-600">Date: <span className="font-semibold text-slate-900">{formatDate(inv.createdAt)}</span></div>
        </div>
      </div>

      {/* Customer Info */}
      <div className={`flex justify-between items-center mb-3 p-2 rounded text-[11px] border ${accent.bg}`}>
        <div><span className="font-semibold text-slate-500">Customer:</span> <span className="font-bold text-slate-900">{inv.customerName}</span></div>
        {inv.customerMobile && <div><span className="font-semibold text-slate-500">Mobile:</span> {inv.customerMobile}</div>}
        {inv.customerAddress && <div><span className="font-semibold text-slate-500">Address:</span> {inv.customerAddress}</div>}
      </div>

      {/* Items Table */}
      <table className="w-full text-left text-[11px] border-collapse mb-3 border border-slate-200">
        <thead>
          <tr className={`border-b border-slate-300 ${accent.th} font-bold uppercase text-[10px]`}>
            <th className="py-1 px-1.5">#</th>
            <th className="py-1 px-1.5">Item Description</th>
            {invSettings.showHuid && <th className="py-1 px-1.5">{invSettings.huidHeaderLabel}</th>}
            <th className="py-1 px-1.5 text-right">Pcs</th>
            {invSettings.showGrossWeight && <th className="py-1 px-1.5 text-right">Gross Wt</th>}
            {invSettings.showNetWeight && <th className="py-1 px-1.5 text-right">Net Wt</th>}
            {invSettings.showRatePerGram && <th className="py-1 px-1.5 text-right">Rate</th>}
            {invSettings.showMakingCharges && <th className="py-1 px-1.5 text-right">{invSettings.makingChargeHeaderLabel}</th>}
            <th className="py-1 px-1.5 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it: any, idx: number) => {
            const c = calcItem(it, inv.type === "GST");
            return (
              <tr key={idx} className="border-b border-slate-200 last:border-0">
                <td className="py-1 px-1.5 text-slate-500">{idx + 1}</td>
                <td className="py-1 px-1.5">
                  <div className="font-semibold">{it.name}</div>
                  {invSettings.showPurity && <div className="text-[9px] text-slate-500">{it.purity || ""}</div>}
                </td>
                {invSettings.showHuid && <td className="py-1 px-1.5 text-slate-600 font-mono text-[10px]">{it.huid || "-"}</td>}
                <td className="py-1 px-1.5 text-right">{it.qty || 1}</td>
                {invSettings.showGrossWeight && <td className="py-1 px-1.5 text-right">{(it as any).grossWeight !== undefined ? (it as any).grossWeight : it.netWeight}g</td>}
                {invSettings.showNetWeight && <td className="py-1 px-1.5 text-right font-semibold">{it.netWeight}g</td>}
                {invSettings.showRatePerGram && <td className="py-1 px-1.5 text-right">{inr(it.ratePerGram)}</td>}
                {invSettings.showMakingCharges && <td className="py-1 px-1.5 text-right">{makingChargeLabel(it)}</td>}
                <td className="py-1 px-1.5 text-right font-bold">{inr(c.line)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals & Payment */}
      <div className={`flex justify-between items-end border-t-2 ${accent.border} pt-2 text-[11px]`}>
        <div className="space-y-1">
          {inv.paymentMode && <div><span className="font-semibold text-slate-500">Payment Mode:</span> {inv.paymentMode}</div>}
          {invSettings.bankAccountDetails && (
            <div className="text-[10px] font-mono text-slate-600">{invSettings.bankAccountDetails}</div>
          )}
          {invSettings.showPaymentQr && (
            <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded text-[9px] mt-1">
              <img
                src={
                  invSettings.qrCodeUrl ||
                  `https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=2&data=${encodeURIComponent(
                    `upi://pay?pa=${invSettings.upiId || (shop?.phone ? `${shop.phone}@ybl` : "")}&pn=${encodeURIComponent(shop?.shopName || "Jewellery Shop")}&am=${inv.total || 0}&cu=INR`
                  )}`
                }
                alt="UPI QR Code"
                className="w-10 h-10 object-contain rounded border bg-white p-0.5 shrink-0"
              />
              <div className="leading-tight">
                <span className="font-bold text-slate-800 uppercase">Scan to Pay UPI</span>
                <p className="font-mono text-[9px] text-slate-600 mt-0.5">{invSettings.upiId || (shop?.phone ? `${shop.phone}@ybl` : "")}</p>
              </div>
            </div>
          )}
          <div className="text-[10px] text-slate-500">E. &amp; O.E. · Computer Generated Invoice</div>
        </div>
        <div className="w-56 space-y-1 text-right">
          <div className="flex justify-between"><span className="text-slate-600">Subtotal:</span><span>{inr(inv.subtotal)}</span></div>
          {inv.discount > 0 && <div className="flex justify-between text-green-700"><span>Discount:</span><span>-{inr(inv.discount)}</span></div>}
          {invSettings.showOldGoldSection && inv.oldGoldAmount > 0 && <div className="flex justify-between text-green-700"><span>Old Gold Exch:</span><span>-{inr(inv.oldGoldAmount)}</span></div>}
          {inv.type === "GST" && invSettings.showGstBreakdown ? (
            <>
              <div className="flex justify-between text-slate-600"><span>CGST (1.5%):</span><span>{inr(inv.gstAmount / 2)}</span></div>
              <div className="flex justify-between text-slate-600"><span>SGST (1.5%):</span><span>{inr(inv.gstAmount / 2)}</span></div>
            </>
          ) : inv.type === "GST" ? (
            <div className="flex justify-between text-slate-600"><span>GST (3%):</span><span>{inr(inv.gstAmount)}</span></div>
          ) : null}
          <div className={`flex justify-between font-bold text-sm border-t-2 ${accent.border} pt-1.5 mt-1 ${accent.text}`}>
            <span>Grand Total:</span><span>{inr(inv.total)}</span>
          </div>
          {inv.amountPaid !== undefined && (
            <div className="flex justify-between text-slate-700 font-semibold">
              <span>Paid: {inr(inv.amountPaid)}</span>
              <span className="text-rose-700">Due: {inr(inv.balanceDue || 0)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Terms */}
      {invSettings.termsAndConditions && (
        <div className="mt-3 pt-2 border-t border-dashed border-slate-200 text-[9px] text-slate-600">
          <p className="font-bold uppercase tracking-wide mb-0.5">Terms &amp; Conditions:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            {invSettings.termsAndConditions.split('\n').map((t, i) => t.trim() ? <li key={i}>{t.trim()}</li> : null)}
          </ol>
        </div>
      )}

      {/* Signatures */}
      <div className="mt-5 flex justify-between items-end text-[10px] text-slate-500 uppercase font-semibold pt-2 border-t border-dashed border-slate-200">
        <div>{invSettings.signature1Label || "Customer Signature"}</div>
        <div>{invSettings.signature2Label || `For ${shop?.shopName || "Jewellery Shop"}`}</div>
      </div>

      {/* Custom Footer */}
      {invSettings.customFooterNote && (
        <div className={`mt-2 text-center text-[9px] font-medium ${accent.text}`}>{invSettings.customFooterNote}</div>
      )}
    </div>
  );
}

export function BillOfSupplyEstimate({ inv }: { inv: any }) {
  const { tenantSession } = useAuth();
  const shop = tenantSession?.shop;

  return (
    <div className="bg-white text-slate-900 p-6 font-sans text-xs max-w-3xl mx-auto border border-slate-300 rounded shadow-sm print:shadow-none print:border-none print:p-0 print:m-0">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-amber-500 pb-4 mb-4">
        <div className="flex items-start gap-3">
          {shop?.logoUrl ? (
            <img src={shop.logoUrl} alt="Logo" className="h-12 w-12 object-contain shrink-0" />
          ) : (
            <img src="/logo.png" alt="Logo" className="h-12 w-12 object-contain shrink-0" />
          )}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-wide">{shop?.shopName || "Jewellery Shop"}</h2>
            <p className="text-xs text-slate-600 mt-0.5">{shop?.address}</p>
            {shop?.phone && <p className="text-xs text-slate-700 mt-1"><span className="font-semibold">Mobile:</span> {shop.phone}</p>}
          </div>
        </div>
        <div className="text-right">
          <div className="inline-block bg-amber-100 text-amber-900 px-3 py-1 rounded font-bold text-xs uppercase tracking-wider mb-1">
            ESTIMATE / QUOTATION
          </div>
          <div className="text-xs text-slate-600">Ref #: <span className="font-bold text-slate-900">{inv.number}</span></div>
          <div className="text-xs text-slate-600">Date: <span className="font-bold text-slate-900">{formatDate(inv.createdAt)}</span></div>
        </div>
      </div>

      {/* Customer Info */}
      <div className="bg-slate-50 p-3 rounded mb-4 flex justify-between items-center text-xs border border-slate-200">
        <div><span className="font-semibold text-slate-500">Customer:</span> <span className="font-bold text-slate-900">{inv.customerName}</span></div>
        {inv.customerMobile && <div><span className="font-semibold text-slate-500">Phone:</span> {inv.customerMobile}</div>}
      </div>

      {/* Table */}
      <table className="w-full text-left text-xs border-collapse mb-4 border border-slate-200">
        <thead>
          <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-700">
            <th className="py-2 px-2 font-bold">#</th>
            <th className="py-2 px-2 font-bold">Item Description</th>
            <th className="py-2 px-2 font-bold">Purity</th>
            <th className="py-2 px-2 font-bold text-right">Gross Wt</th>
            <th className="py-2 px-2 font-bold text-right">Net Wt</th>
            <th className="py-2 px-2 font-bold text-right">Rate / g</th>
            <th className="py-2 px-2 font-bold text-right">Making</th>
            <th className="py-2 px-2 font-bold text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it: any, idx: number) => {
            const c = calcItem(it, false);
            return (
              <tr key={idx} className="border-b border-slate-200 last:border-0">
                <td className="py-2 px-2 text-slate-500">{idx + 1}</td>
                <td className="py-2 px-2 font-semibold">{it.name}</td>
                <td className="py-2 px-2 text-slate-600">{it.purity || "-"}</td>
                <td className="py-2 px-2 text-right">{(it as any).grossWeight !== undefined ? (it as any).grossWeight : it.netWeight}g</td>
                <td className="py-2 px-2 text-right">{it.netWeight}g</td>
                <td className="py-2 px-2 text-right">{inr(it.ratePerGram)}</td>
                <td className="py-2 px-2 text-right">{inr(it.makingCharge || 0)}</td>
                <td className="py-2 px-2 text-right font-bold">{inr(c.line)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Total Block */}
      <div className="flex justify-between items-end border-t-2 border-slate-300 pt-3 text-xs">
        <div className="text-slate-500 text-[11px]">
          * Note: This is an estimation quote for reference. Rates subject to daily market changes.
        </div>
        <div className="w-64 space-y-1 text-right">
          <div className="flex justify-between text-slate-600"><span>Estimated Subtotal:</span><span>{inr(inv.subtotal)}</span></div>
          {inv.discount > 0 && <div className="flex justify-between text-green-700"><span>Discount:</span><span>-{inr(inv.discount)}</span></div>}
          {inv.oldGoldAmount > 0 && <div className="flex justify-between text-green-700"><span>Old Gold Exch:</span><span>-{inr(inv.oldGoldAmount)}</span></div>}

          <div className="flex justify-between font-bold text-base border-t border-slate-300 pt-1 text-slate-900">
            <span>Estimated Total:</span><span>{inr(inv.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PremiumA4Invoice({ inv }: { inv: any }) {
  const { tenantSession } = useAuth();
  const shop = tenantSession?.shop;
  const invSettings: InvoiceSettings = { ...defaultInvoiceSettings, ...((shop as any)?.invoiceSettings || {}) };

  const makingChargeLabel = (it: any) => {
    const mcType: MakingChargeType = it.makingChargeType || "PERCENTAGE";
    if (mcType === "PERCENTAGE") {
      const pct = it.makingChargeValue ?? it.makingChargePct ?? (it.makingCharge > 0 && it.netWeight > 0 && it.ratePerGram > 0 ? (it.makingCharge / (it.netWeight * it.ratePerGram)) * 100 : 0);
      return pct > 0 ? `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%` : '0%';
    }
    const value = it.makingChargeValue ?? 0;
    if (mcType === "PER_GRAM") return `${inr(value)}/g`;
    if (mcType === "PER_PIECE") return `${inr(value)}/pc`;
    return `${inr(value)} Fixed`;
  };

  return (
    <div className="bg-white text-slate-900 p-6 sm:p-8 font-sans text-xs max-w-4xl mx-auto border-2 border-amber-600 rounded-lg shadow-md print:shadow-none print:border-amber-600 print:p-4 print:m-0 relative">
      <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 text-white px-6 py-2.5 rounded-t flex justify-between items-center -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-5">
        <div className="font-bold tracking-widest text-xs uppercase flex items-center gap-2">
          <span>❖ PREMIUM INVOICE ❖</span>
        </div>
        <div className="text-[11px] font-mono font-semibold">
          {shop?.gstNumber ? `GSTIN: ${shop.gstNumber}` : `INV: ${inv.number}`}
        </div>
      </div>

      <div className="flex justify-between items-start border-b-2 border-amber-500 pb-4 mb-4">
        <div className="flex items-start gap-4">
          {invSettings.showLogo && (
            shop?.logoUrl
              ? <img src={shop.logoUrl} alt="Logo" className="h-16 w-16 object-contain shrink-0" />
              : <img src="/logo.png" alt="Logo" className="h-16 w-16 object-contain shrink-0" />
          )}
          <div>
            <h1 className="text-3xl font-display font-bold uppercase tracking-wider text-amber-950">
              {shop?.shopName || "Jewellery Shop"}
            </h1>
            {invSettings.tagline && <p className="text-xs font-bold text-amber-700 tracking-wide mt-0.5">{invSettings.tagline}</p>}
            <p className="text-xs text-slate-600 mt-1">{shop?.address}</p>
            <div className="flex flex-wrap gap-4 text-xs text-slate-700 mt-1.5 font-medium">
              {shop?.phone && <span><strong>Mob:</strong> {shop.phone}</span>}
              {shop?.numberOfShopOwner && <span><strong>Alt:</strong> {shop.numberOfShopOwner}</span>}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="bg-amber-100 text-amber-950 border border-amber-300 px-3.5 py-1.5 rounded font-bold uppercase tracking-widest text-xs inline-block shadow-sm">
            {getCleanInvoiceTitle(invSettings.invoiceTitle)}
          </div>
          <div className="text-xs text-slate-700 font-mono mt-2">Invoice #: <strong className="text-slate-900">{inv.number}</strong></div>
          <div className="text-xs text-slate-700 font-mono">Date: <strong className="text-slate-900">{formatDate(inv.createdAt)}</strong></div>
          {inv.paymentMode && <div className="text-xs text-slate-600 mt-1">Mode: <strong className="text-slate-900">{inv.paymentMode}</strong></div>}
        </div>
      </div>

      <div className="bg-amber-50/70 border border-amber-200/80 rounded-md p-3 mb-4 flex flex-wrap justify-between items-center text-xs gap-3">
        <div>
          <span className="text-amber-900 font-bold uppercase tracking-wider text-[10px]">Billed To Customer:</span>
          <div className="text-sm font-bold text-slate-900 mt-0.5">{inv.customerName}</div>
        </div>
        {inv.customerMobile && (
          <div>
            <span className="text-amber-900 font-bold uppercase tracking-wider text-[10px]">Mobile Contact:</span>
            <div className="font-semibold text-slate-800 font-mono mt-0.5">{inv.customerMobile}</div>
          </div>
        )}
        {inv.customerAddress && (
          <div className="max-w-xs">
            <span className="text-amber-900 font-bold uppercase tracking-wider text-[10px]">Billing Address:</span>
            <div className="text-slate-700 leading-tight mt-0.5">{inv.customerAddress}</div>
          </div>
        )}
      </div>

      <table className="w-full text-xs border-collapse border border-amber-300 mb-4">
        <thead>
          <tr className="bg-amber-800 text-white font-bold uppercase text-[10px] tracking-wider">
            <th className="border border-amber-700 py-2 px-2 text-center w-8">#</th>
            <th className="border border-amber-700 py-2 px-2 text-left">Description of Jewellery Goods</th>
            {invSettings.showHuid && <th className="border border-amber-700 py-2 px-2 text-left">{invSettings.huidHeaderLabel}</th>}
            <th className="border border-amber-700 py-2 px-2 text-right">Qty</th>
            {invSettings.showGrossWeight && <th className="border border-amber-700 py-2 px-2 text-right">Gross Wt</th>}
            {invSettings.showNetWeight && <th className="border border-amber-700 py-2 px-2 text-right">Net Wt</th>}
            {invSettings.showRatePerGram && <th className="border border-amber-700 py-2 px-2 text-right">Rate/g</th>}
            {invSettings.showMakingCharges && <th className="border border-amber-700 py-2 px-2 text-right">{invSettings.makingChargeHeaderLabel}</th>}
            <th className="border border-amber-700 py-2 px-2 text-right">Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it: any, i: number) => {
            const gw = it.grossWeight !== undefined ? it.grossWeight : it.netWeight;
            const c = calcItem(it, inv.type === "GST");
            return (
              <tr key={i} className="border-b border-amber-200 even:bg-amber-50/30 hover:bg-amber-50/60">
                <td className="border border-amber-200 py-2 px-2 text-center text-slate-500">{i + 1}</td>
                <td className="border border-amber-200 py-2 px-2">
                  <div className="font-bold text-slate-900">{it.name}</div>
                  {invSettings.showPurity && <div className="text-[10px] text-amber-900 font-medium">Purity: {it.purity || '—'}</div>}
                </td>
                {invSettings.showHuid && <td className="border border-amber-200 py-2 px-2 font-mono text-[10px] text-slate-700">{(it as any).huid || '—'}</td>}
                <td className="border border-amber-200 py-2 px-2 text-right">{it.qty}</td>
                {invSettings.showGrossWeight && <td className="border border-amber-200 py-2 px-2 text-right font-mono">{gw} g</td>}
                {invSettings.showNetWeight && <td className="border border-amber-200 py-2 px-2 text-right font-bold font-mono">{it.netWeight} g</td>}
                {invSettings.showRatePerGram && <td className="border border-amber-200 py-2 px-2 text-right font-mono">{inr(it.ratePerGram)}</td>}
                {invSettings.showMakingCharges && <td className="border border-amber-200 py-2 px-2 text-right font-mono">{makingChargeLabel(it)}</td>}
                <td className="border border-amber-200 py-2 px-2 text-right font-bold font-mono text-slate-900">{inr(c.line)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex flex-col sm:flex-row justify-between items-start text-xs gap-5 border-t-2 border-amber-500 pt-4 mb-4">
        <div className="w-full sm:w-1/2 space-y-2">
          {invSettings.bankAccountDetails && (
            <div className="text-[10px] font-mono text-slate-800 bg-amber-50 border border-amber-300 p-2 rounded">
              <strong className="text-amber-900 uppercase">Bank Details:</strong>
              <div className="mt-0.5">{invSettings.bankAccountDetails}</div>
            </div>
          )}

          {invSettings.showPaymentQr && (
            <div className="border border-amber-300 rounded p-2 flex items-center gap-3 bg-amber-50/50 text-[10px]">
              <img
                src={
                  invSettings.qrCodeUrl ||
                  `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=2&data=${encodeURIComponent(
                    `upi://pay?pa=${invSettings.upiId || (shop?.phone ? `${shop.phone}@ybl` : "")}&pn=${encodeURIComponent(shop?.shopName || "Jewellery Shop")}&am=${inv.total || 0}&cu=INR`
                  )}`
                }
                alt="UPI Payment QR Code"
                className="w-14 h-14 object-contain rounded border border-amber-300 bg-white p-0.5 shrink-0"
              />
              <div>
                <div className="font-bold text-amber-950 uppercase tracking-wider text-[9px]">Scan &amp; Pay via UPI</div>
                <div className="font-mono text-[10px] text-slate-800 font-bold mt-0.5">
                  {invSettings.upiId || (shop?.phone ? `${shop.phone}@ybl` : "UPI Payment")}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-full sm:w-1/2 max-w-xs ml-auto space-y-1 text-right">
          <div className="flex justify-between text-slate-600"><span>Subtotal:</span><span className="font-semibold">{inr(inv.subtotal)}</span></div>
          {inv.discount > 0 && <div className="flex justify-between text-emerald-700"><span>Discount:</span><span className="font-semibold">-{inr(inv.discount)}</span></div>}
          {invSettings.showOldGoldSection && inv.oldGoldAmount > 0 && <div className="flex justify-between text-amber-800"><span>Old Gold Exch:</span><span className="font-semibold">-{inr(inv.oldGoldAmount)}</span></div>}
          {inv.type === "GST" && (
            <div className="flex justify-between text-slate-600"><span>GST (3%):</span><span>{inr(inv.gstAmount)}</span></div>
          )}
          <div className="flex justify-between font-bold text-base border-t-2 border-amber-700 pt-1.5 mt-1 text-amber-950 bg-amber-100/70 p-1.5 rounded">
            <span>Grand Total:</span><span>{inr(inv.total)}</span>
          </div>
          {inv.amountPaid !== undefined && (
            <div className="flex justify-between text-slate-700 font-semibold pt-1">
              <span>Paid: {inr(inv.amountPaid)}</span>
              <span className="text-rose-700 font-bold">Due: {inr(inv.balanceDue || 0)}</span>
            </div>
          )}
        </div>
      </div>

      {invSettings.termsAndConditions && (
        <div className="mt-3 pt-2 border-t border-dashed border-amber-300 text-[10px] text-slate-600">
          <p className="font-bold text-amber-950 uppercase tracking-wider mb-0.5">Terms &amp; Conditions:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            {invSettings.termsAndConditions.split('\n').map((t, i) => t.trim() ? <li key={i}>{t.trim()}</li> : null)}
          </ol>
        </div>
      )}

      <div className="mt-6 flex justify-between items-end text-[10px] font-bold text-slate-600 uppercase tracking-wider pt-2 border-t border-amber-300">
        <div className="text-center">
          <div className="w-32 border-t border-slate-400 mb-1 mx-auto"></div>
          {invSettings.signature1Label || "Customer Signature"}
        </div>
        <div className="text-center">
          <div className="w-32 border-t border-slate-400 mb-1 mx-auto"></div>
          {invSettings.signature2Label || `For ${shop?.shopName || "Jewellery Shop"}`}
        </div>
      </div>

      {invSettings.customFooterNote && (
        <div className="mt-3 text-center text-[10px] text-amber-900 font-bold uppercase tracking-wide">
          {invSettings.customFooterNote}
        </div>
      )}
    </div>
  );
}

export function LuxuryJewelleryInvoice({ inv }: { inv: any }) {
  const { tenantSession } = useAuth();
  const shop = tenantSession?.shop;
  const invSettings: InvoiceSettings = { ...defaultInvoiceSettings, ...((shop as any)?.invoiceSettings || {}) };

  const makingChargeLabel = (it: any) => {
    const mcType: MakingChargeType = it.makingChargeType || "PERCENTAGE";
    if (mcType === "PERCENTAGE") {
      const pct = it.makingChargeValue ?? it.makingChargePct ?? (it.makingCharge > 0 && it.netWeight > 0 && it.ratePerGram > 0 ? (it.makingCharge / (it.netWeight * it.ratePerGram)) * 100 : 0);
      return pct > 0 ? `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%` : '0%';
    }
    const value = it.makingChargeValue ?? 0;
    return `${inr(value)}`;
  };

  return (
    <div className="bg-amber-50/20 text-slate-900 p-6 sm:p-8 font-serif text-xs max-w-4xl mx-auto border-double border-4 border-amber-600 rounded shadow-lg print:shadow-none print:border-amber-600 print:p-4 print:m-0 relative">
      <div className="text-center text-amber-600 text-xl tracking-widest mb-1">👑 ✦ 👑</div>

      <div className="text-center border-b-2 border-amber-600 pb-4 mb-4">
        {invSettings.showLogo && (
          shop?.logoUrl ? (
            <img src={shop.logoUrl} alt="Logo" className="h-16 w-16 object-contain mx-auto mb-2" />
          ) : (
            <img src="/logo.png" alt="Logo" className="h-16 w-16 object-contain mx-auto mb-2" />
          )
        )}
        <h1 className="text-3xl font-serif font-bold uppercase tracking-widest text-amber-950">
          {shop?.shopName || "Royal Jewellery House"}
        </h1>
        {invSettings.tagline && <p className="text-xs font-semibold text-amber-700 tracking-widest uppercase mt-1">{invSettings.tagline}</p>}
        <p className="text-xs text-slate-600 mt-1 font-sans">{shop?.address}</p>
        <div className="flex justify-center gap-6 text-xs text-slate-700 mt-2 font-sans">
          {shop?.phone && <span><strong>Tel:</strong> {shop.phone}</span>}
          {inv.type === "GST" && shop?.gstNumber && <span><strong>GSTIN:</strong> {shop.gstNumber}</span>}
        </div>
      </div>

      <div className="flex justify-between items-center bg-amber-100/60 border border-amber-300 px-4 py-2 rounded mb-4 font-sans">
        <div>
          <span className="font-serif font-bold text-amber-950 uppercase text-xs">Customer Name: </span>
          <strong className="text-slate-900 text-sm">{inv.customerName}</strong>
          {inv.customerMobile && <span className="text-slate-600 ml-3">({inv.customerMobile})</span>}
        </div>
        <div className="text-right">
          <span className="font-serif font-bold text-amber-950 uppercase text-xs">Invoice No: </span>
          <strong className="text-amber-900 font-mono text-sm">{inv.number}</strong>
          <span className="text-slate-600 ml-3">Date: {formatDate(inv.createdAt)}</span>
        </div>
      </div>

      <table className="w-full text-xs border-collapse border border-amber-400 mb-4 font-sans">
        <thead>
          <tr className="bg-amber-900 text-amber-100 font-serif font-bold uppercase text-[10px] tracking-widest">
            <th className="border border-amber-700 py-2.5 px-2 text-center w-8">#</th>
            <th className="border border-amber-700 py-2.5 px-2 text-left">Fine Jewellery Description</th>
            {invSettings.showHuid && <th className="border border-amber-700 py-2.5 px-2 text-left">{invSettings.huidHeaderLabel}</th>}
            <th className="border border-amber-700 py-2.5 px-2 text-right">Qty</th>
            {invSettings.showGrossWeight && <th className="border border-amber-700 py-2.5 px-2 text-right">Gross Wt</th>}
            {invSettings.showNetWeight && <th className="border border-amber-700 py-2.5 px-2 text-right">Net Wt</th>}
            {invSettings.showRatePerGram && <th className="border border-amber-700 py-2.5 px-2 text-right">Rate/g</th>}
            {invSettings.showMakingCharges && <th className="border border-amber-700 py-2.5 px-2 text-right">{invSettings.makingChargeHeaderLabel}</th>}
            <th className="border border-amber-700 py-2.5 px-2 text-right">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it: any, i: number) => {
            const gw = it.grossWeight !== undefined ? it.grossWeight : it.netWeight;
            const c = calcItem(it, inv.type === "GST");
            return (
              <tr key={i} className="border-b border-amber-200 last:border-0 hover:bg-amber-50">
                <td className="border border-amber-200 py-2 px-2 text-center text-slate-500">{i + 1}</td>
                <td className="border border-amber-200 py-2 px-2">
                  <div className="font-serif font-bold text-slate-900 text-sm">{it.name}</div>
                  {invSettings.showPurity && <div className="text-[10px] text-amber-800 font-serif">Karat/Purity: {it.purity || '—'}</div>}
                </td>
                {invSettings.showHuid && <td className="border border-amber-200 py-2 px-2 font-mono text-[10px] text-slate-700">{(it as any).huid || '—'}</td>}
                <td className="border border-amber-200 py-2 px-2 text-right">{it.qty}</td>
                {invSettings.showGrossWeight && <td className="border border-amber-200 py-2 px-2 text-right font-mono">{gw} g</td>}
                {invSettings.showNetWeight && <td className="border border-amber-200 py-2 px-2 text-right font-bold font-mono">{it.netWeight} g</td>}
                {invSettings.showRatePerGram && <td className="border border-amber-200 py-2 px-2 text-right font-mono">{inr(it.ratePerGram)}</td>}
                {invSettings.showMakingCharges && <td className="border border-amber-200 py-2 px-2 text-right font-mono">{makingChargeLabel(it)}</td>}
                <td className="border border-amber-200 py-2 px-2 text-right font-bold font-mono text-amber-950">{inr(c.line)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex flex-col sm:flex-row justify-between items-start gap-5 border-t-2 border-amber-600 pt-4 mb-4 font-sans">
        <div className="w-full sm:w-1/2 space-y-2">
          {invSettings.bankAccountDetails && (
            <div className="text-[10px] font-mono text-slate-800 bg-amber-100/50 border border-amber-300 p-2 rounded">
              <strong className="text-amber-900 uppercase font-serif">Bank Details:</strong>
              <div>{invSettings.bankAccountDetails}</div>
            </div>
          )}

          {invSettings.showPaymentQr && (
            <div className="border border-amber-300 rounded p-2 flex items-center gap-3 bg-amber-50 text-[10px]">
              <img
                src={
                  invSettings.qrCodeUrl ||
                  `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=2&data=${encodeURIComponent(
                    `upi://pay?pa=${invSettings.upiId || (shop?.phone ? `${shop.phone}@ybl` : "")}&pn=${encodeURIComponent(shop?.shopName || "Jewellery Shop")}&am=${inv.total || 0}&cu=INR`
                  )}`
                }
                alt="UPI QR Code"
                className="w-14 h-14 object-contain rounded border border-amber-300 bg-white p-0.5 shrink-0"
              />
              <div>
                <div className="font-serif font-bold text-amber-950 uppercase text-[10px]">Scan &amp; Pay via UPI</div>
                <div className="font-mono text-[10px] text-slate-900 font-bold mt-0.5">
                  {invSettings.upiId || (shop?.phone ? `${shop.phone}@ybl` : "UPI Payment")}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-full sm:w-1/2 max-w-xs ml-auto space-y-1 text-right font-serif">
          <div className="flex justify-between text-slate-700"><span>Subtotal Amount:</span><span className="font-sans font-semibold">{inr(inv.subtotal)}</span></div>
          {inv.discount > 0 && <div className="flex justify-between text-emerald-800"><span>Special Discount:</span><span className="font-sans font-semibold">-{inr(inv.discount)}</span></div>}
          {invSettings.showOldGoldSection && inv.oldGoldAmount > 0 && <div className="flex justify-between text-amber-900"><span>Old Gold Exchange:</span><span className="font-sans font-semibold">-{inr(inv.oldGoldAmount)}</span></div>}
          {inv.type === "GST" && (
            <div className="flex justify-between text-slate-700"><span>GST Tax (3%):</span><span className="font-sans font-semibold">{inr(inv.gstAmount)}</span></div>
          )}
          <div className="flex justify-between font-bold text-lg border-t-2 border-b-2 border-amber-600 py-1.5 text-amber-950 bg-amber-100/80 my-1 px-2 rounded">
            <span>Grand Total:</span><span className="font-sans">{inr(inv.total)}</span>
          </div>
          {inv.amountPaid !== undefined && (
            <div className="flex justify-between text-slate-800 font-sans font-bold pt-1">
              <span>Paid: {inr(inv.amountPaid)}</span>
              <span className="text-rose-700">Due: {inr(inv.balanceDue || 0)}</span>
            </div>
          )}
        </div>
      </div>

      {invSettings.termsAndConditions && (
        <div className="mt-3 pt-2 border-t border-dashed border-amber-400 text-[10px] text-slate-600 font-sans">
          <p className="font-serif font-bold text-amber-950 uppercase tracking-widest mb-0.5">Guarantee &amp; Store Terms:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            {invSettings.termsAndConditions.split('\n').map((t, i) => t.trim() ? <li key={i}>{t.trim()}</li> : null)}
          </ol>
        </div>
      )}

      <div className="mt-6 flex justify-between items-end text-[10px] font-serif font-bold text-amber-950 uppercase tracking-widest pt-2 border-t border-amber-400 font-sans">
        <div className="text-center">
          <div className="w-32 border-t border-amber-600 mb-1 mx-auto"></div>
          {invSettings.signature1Label || "Valued Customer Signature"}
        </div>
        <div className="text-center">
          <div className="w-32 border-t border-amber-600 mb-1 mx-auto"></div>
          {invSettings.signature2Label || `For ${shop?.shopName || "Jewellery Shop"}`}
        </div>
      </div>

      {invSettings.customFooterNote && (
        <div className="mt-3 text-center text-[10px] text-amber-900 font-serif font-bold uppercase tracking-widest">
          {invSettings.customFooterNote}
        </div>
      )}
    </div>
  );
}

export function ModernInvoice({ inv }: { inv: any }) {
  const { tenantSession } = useAuth();
  const shop = tenantSession?.shop;
  const invSettings: InvoiceSettings = { ...defaultInvoiceSettings, ...((shop as any)?.invoiceSettings || {}) };

  const makingChargeLabel = (it: any) => {
    const mcType: MakingChargeType = it.makingChargeType || "PERCENTAGE";
    if (mcType === "PERCENTAGE") {
      const pct = it.makingChargeValue ?? it.makingChargePct ?? (it.makingCharge > 0 && it.netWeight > 0 && it.ratePerGram > 0 ? (it.makingCharge / (it.netWeight * it.ratePerGram)) * 100 : 0);
      return pct > 0 ? `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%` : '0%';
    }
    const value = it.makingChargeValue ?? 0;
    return `${inr(value)}`;
  };

  return (
    <div className="bg-white text-slate-900 p-6 sm:p-8 font-sans text-xs max-w-4xl mx-auto border border-slate-300 rounded-xl shadow-lg print:shadow-none print:border-none print:p-4 print:m-0">
      <div className="bg-slate-900 text-white p-5 rounded-xl mb-5 flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-start gap-4">
          {invSettings.showLogo && (
            shop?.logoUrl ? (
              <img src={shop.logoUrl} alt="Logo" className="h-14 w-14 object-contain shrink-0 bg-white rounded-lg p-1" />
            ) : (
              <img src="/logo.png" alt="Logo" className="h-14 w-14 object-contain shrink-0 bg-white rounded-lg p-1" />
            )
          )}
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider text-white">
              {shop?.shopName || "Jewellery Shop"}
            </h1>
            {invSettings.tagline && <p className="text-xs text-slate-300 font-medium mt-0.5">{invSettings.tagline}</p>}
            <p className="text-xs text-slate-400 mt-1 leading-tight">{shop?.address}</p>
            {shop?.phone && <p className="text-xs text-slate-300 mt-1">Mob: {shop.phone}</p>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="inline-block bg-blue-600 text-white font-bold uppercase tracking-widest px-3 py-1 rounded-md text-xs mb-2">
            {getCleanInvoiceTitle(invSettings.invoiceTitle)}
          </span>
          <div className="text-xs font-mono text-slate-300">Invoice: <strong className="text-white">{inv.number}</strong></div>
          <div className="text-xs font-mono text-slate-300">Date: <strong className="text-white">{formatDate(inv.createdAt)}</strong></div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-5 flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">BILLED TO</span>
          <div className="text-sm font-bold text-slate-900 mt-0.5">{inv.customerName}</div>
          {inv.customerMobile && <div className="text-xs text-slate-600 font-mono mt-0.5">{inv.customerMobile}</div>}
        </div>
        {inv.customerAddress && (
          <div className="max-w-xs">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">ADDRESS</span>
            <div className="text-xs text-slate-600 leading-tight mt-0.5">{inv.customerAddress}</div>
          </div>
        )}
      </div>

      <table className="w-full text-xs border-collapse mb-5">
        <thead>
          <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b-2 border-slate-300">
            <th className="py-2.5 px-3 text-left">#</th>
            <th className="py-2.5 px-3 text-left">Description</th>
            {invSettings.showHuid && <th className="py-2.5 px-3 text-left">{invSettings.huidHeaderLabel}</th>}
            <th className="py-2.5 px-3 text-right">Qty</th>
            {invSettings.showGrossWeight && <th className="py-2.5 px-3 text-right">Gross Wt</th>}
            {invSettings.showNetWeight && <th className="py-2.5 px-3 text-right">Net Wt</th>}
            {invSettings.showRatePerGram && <th className="py-2.5 px-3 text-right">Rate/g</th>}
            {invSettings.showMakingCharges && <th className="py-2.5 px-3 text-right">{invSettings.makingChargeHeaderLabel}</th>}
            <th className="py-2.5 px-3 text-right">Line Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {inv.items.map((it: any, i: number) => {
            const gw = it.grossWeight !== undefined ? it.grossWeight : it.netWeight;
            const c = calcItem(it, inv.type === "GST");
            return (
              <tr key={i} className="hover:bg-slate-50">
                <td className="py-2.5 px-3 text-slate-400 font-mono">{i + 1}</td>
                <td className="py-2.5 px-3">
                  <div className="font-semibold text-slate-900">{it.name}</div>
                  {invSettings.showPurity && <span className="inline-block bg-slate-100 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5">{it.purity || '—'}</span>}
                </td>
                {invSettings.showHuid && <td className="py-2.5 px-3 font-mono text-[10px] text-slate-600">{(it as any).huid || '—'}</td>}
                <td className="py-2.5 px-3 text-right">{it.qty}</td>
                {invSettings.showGrossWeight && <td className="py-2.5 px-3 text-right font-mono">{gw} g</td>}
                {invSettings.showNetWeight && <td className="py-2.5 px-3 text-right font-semibold font-mono">{it.netWeight} g</td>}
                {invSettings.showRatePerGram && <td className="py-2.5 px-3 text-right font-mono">{inr(it.ratePerGram)}</td>}
                {invSettings.showMakingCharges && <td className="py-2.5 px-3 text-right font-mono">{makingChargeLabel(it)}</td>}
                <td className="py-2.5 px-3 text-right font-bold font-mono text-slate-900">{inr(c.line)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex flex-col sm:flex-row justify-between items-start gap-5 border-t border-slate-200 pt-4 mb-5">
        <div className="w-full sm:w-1/2 space-y-2">
          {invSettings.bankAccountDetails && (
            <div className="text-[10px] font-mono text-slate-700 bg-slate-50 border border-slate-200 p-2 rounded-lg">
              <strong className="text-slate-900 uppercase">Bank Details:</strong>
              <div className="mt-0.5">{invSettings.bankAccountDetails}</div>
            </div>
          )}

          {invSettings.showPaymentQr && (
            <div className="border border-slate-200 rounded-lg p-2 flex items-center gap-3 bg-slate-50 text-[10px]">
              <img
                src={
                  invSettings.qrCodeUrl ||
                  `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=2&data=${encodeURIComponent(
                    `upi://pay?pa=${invSettings.upiId || (shop?.phone ? `${shop.phone}@ybl` : "")}&pn=${encodeURIComponent(shop?.shopName || "Jewellery Shop")}&am=${inv.total || 0}&cu=INR`
                  )}`
                }
                alt="UPI QR Code"
                className="w-14 h-14 object-contain rounded border bg-white p-0.5 shrink-0"
              />
              <div>
                <div className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">Scan &amp; Pay via UPI</div>
                <div className="font-mono text-[10px] text-slate-800 font-semibold mt-0.5">
                  {invSettings.upiId || (shop?.phone ? `${shop.phone}@ybl` : "UPI Payment")}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-full sm:w-1/2 max-w-xs ml-auto space-y-1 text-right">
          <div className="flex justify-between text-slate-600"><span>Subtotal:</span><span className="font-semibold">{inr(inv.subtotal)}</span></div>
          {inv.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount:</span><span className="font-semibold">-{inr(inv.discount)}</span></div>}
          {invSettings.showOldGoldSection && inv.oldGoldAmount > 0 && <div className="flex justify-between text-amber-700"><span>Old Gold Exch:</span><span className="font-semibold">-{inr(inv.oldGoldAmount)}</span></div>}
          {inv.type === "GST" && (
            <div className="flex justify-between text-slate-600"><span>GST Tax (3%):</span><span className="font-semibold">{inr(inv.gstAmount)}</span></div>
          )}
          <div className="flex justify-between font-bold text-base border-t-2 border-slate-900 pt-1.5 text-slate-900 mt-1">
            <span>Grand Total:</span><span>{inr(inv.total)}</span>
          </div>
          {inv.amountPaid !== undefined && (
            <div className="flex justify-between text-slate-700 font-semibold pt-1">
              <span>Paid: {inr(inv.amountPaid)}</span>
              <span className="text-rose-600 font-bold">Due: {inr(inv.balanceDue || 0)}</span>
            </div>
          )}
        </div>
      </div>

      {invSettings.termsAndConditions && (
        <div className="mt-3 pt-2 border-t border-slate-200 text-[10px] text-slate-500">
          <p className="font-bold text-slate-700 uppercase tracking-wider mb-0.5">Terms &amp; Conditions:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            {invSettings.termsAndConditions.split('\n').map((t, i) => t.trim() ? <li key={i}>{t.trim()}</li> : null)}
          </ol>
        </div>
      )}

      <div className="mt-6 flex justify-between items-end text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-2 border-t border-slate-200">
        <div className="text-center">
          <div className="w-32 border-t border-slate-300 mb-1 mx-auto"></div>
          {invSettings.signature1Label || "Customer Signature"}
        </div>
        <div className="text-center">
          <div className="w-32 border-t border-slate-300 mb-1 mx-auto"></div>
          {invSettings.signature2Label || "Authorized Signatory"}
        </div>
      </div>
    </div>
  );
}
