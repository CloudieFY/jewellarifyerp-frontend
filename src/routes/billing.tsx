import { Layout } from "@/components/Layout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormKeyboardNav } from "@/lib/useFormKeyboardNav";
import { Plus, Trash2, Printer, Receipt, Pencil, Search, Calendar, Calculator, Scale, Palette, AlertCircle, NotebookPen, Send, ScanBarcode } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import {
  inr,
  calcItem,
  computeMakingCharge,
  type Invoice,
  type InvoiceItem,
  type MakingChargeType,
  defaultInvoiceSettings,
  type InvoiceSettings,
  getCleanInvoiceTitle,
} from "@/lib/storage";

type EditableInvoiceItem = InvoiceItem & { huid?: string; hmc?: number };
import { formatDate, useDebounce, triggerPrint } from "@/lib/utils";
import { useTenantAPI } from "@/lib/api";
import { toast } from "sonner";
import { ThermalInvoiceReceipt, CompactA5Invoice, BillOfSupplyEstimate, PremiumA4Invoice, LuxuryJewelleryInvoice, ModernInvoice } from "@/components/InvoiceBranding";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

// Date helpers for DD/MM/YYYY format
function formatDDMMYYYY(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function parseDDMMYYYY(s: string): Date | null {
  if (!s) return null;
  const parts = s.split("/");
  if (parts.length !== 3) return null;
  const dd = Number(parts[0]);
  const mm = Number(parts[1]);
  const yyyy = Number(parts[2]);
  if (!dd || !mm || !yyyy) return null;
  // months in JS Date are 0-based
  const dt = new Date(yyyy, mm - 1, dd, 0, 0, 0);
  // validate that the components round-trip (guards against invalid dates like 31/02)
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
  return dt;
}



// Sorts by the numeric part of the invoice number (e.g. "GST-0012" -> 12),
// newest (highest number) first — robust to differing prefixes/padding.
function compareByInvoiceNumber(a: Invoice, b: Invoice) {
  const numA = parseInt((a.number || "").replace(/\D/g, ""), 10) || 0;
  const numB = parseInt((b.number || "").replace(/\D/g, ""), 10) || 0;
  return numB - numA;
}

function dedupeInvoices(arr: any[]) {
  const m = new Map<string, any>();
  arr.forEach((it: any) => {
    const k = it._id || it.id;
    if (k) m.set(k, it);
    else m.set(JSON.stringify(it), it);
  });
  return Array.from(m.values());
}

function isProductMatchingBillMetal(p: any, billMetal: "Gold" | "Silver"): boolean {
  const mType = (p.metalType || "").toLowerCase();
  const cat = (p.category || "").toLowerCase();
  const name = (p.name || "").toLowerCase();
  const purity = (p.purity || "").toLowerCase();

  const isSilver =
    mType.includes("silver") ||
    mType.includes("chandi") ||
    cat.includes("silver") ||
    cat.includes("chandi") ||
    name.includes("silver") ||
    name.includes("chandi") ||
    purity.includes("925") ||
    purity.includes("999") ||
    purity.includes("800");

  const isGold =
    mType.includes("gold") ||
    cat.includes("gold") ||
    name.includes("gold") ||
    purity.includes("22k") ||
    purity.includes("18k") ||
    purity.includes("24k") ||
    purity.includes("14k");

  if (billMetal === "Silver") {
    if (isGold && !isSilver) return false;
    return isSilver || !isGold;
  } else {
    if (isSilver && !isGold) return false;
    return true;
  }
}

export default function BillingPage() {
  const api = useTenantAPI();
  const queryClient = useQueryClient();

  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: api.invoices.getAll });
  const { data: products = [] } = useQuery({ queryKey: ["inventory"], queryFn: api.inventory.getAll });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: api.customers.getAll });
  const { data: ratesList = [] } = useQuery({ queryKey: ["goldRates"], queryFn: api.goldRates.getAll });
  const { data: orders = [] } = useQuery({ queryKey: ["orders"], queryFn: api.orders.getAll });
  const { data: repairs = [] } = useQuery({ queryKey: ["repairs"], queryFn: api.repairs.getAll });
  const { data: salesReturns = [] } = useQuery<any[]>({ queryKey: ["salesReturns"], queryFn: api.salesReturns.getAll });
  const latestRates = ratesList[0];
  
  const useApiMutation = (mutationFn: (...args: any[]) => Promise<any>, queryKeys: string | string[]) => {
    return useMutation({
      mutationFn,
      onSuccess: () => {
        const keys = Array.isArray(queryKeys) ? queryKeys : [queryKeys];
        keys.forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
      },
    });
  };

  const createMutation = useApiMutation((data: any) => api.invoices.create(data), ["invoices", "inventory"]);
  const deleteMutation = useApiMutation((id: string) => api.invoices.remove(id), ["invoices", "inventory", "salesReturns"]);
  const updateMutation = useApiMutation((data: { id: string; body: any }) => api.invoices.update(data.id, data.body), ["invoices", "inventory"]);
  const updateOrderMutation = useApiMutation((data: { id: string; body: any }) => api.orders.update(data.id, data.body), ["orders"]);
  const updateRepairMutation = useApiMutation((data: { id: string; body: any }) => api.repairs.update(data.id, data.body), ["repairs"]);
  const createCustomerMutation = useApiMutation((data: any) => api.customers.create(data), ["customers"]);

  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // WhatsApp Invoice Send State
  const [waInvModalOpen, setWaInvModalOpen] = useState(false);
  const [waInvItem, setWaInvItem] = useState<Invoice | null>(null);
  const [waInvPhone, setWaInvPhone] = useState("");
  const [waInvMessage, setWaInvMessage] = useState("");

  const handleSendInvoiceWhatsApp = (inv: Invoice) => {
    let cleanPhone = (inv.customerMobile || (inv as any).phone || "").replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

    const shopName = tenantSession?.shop?.shopName || "Our Jewellery Shop";
    const shopPhone = tenantSession?.shop?.phone || "";
    const invId = inv._id || inv.id;
    
    // Digital Bill link
    const billLink = invId ? `${window.location.protocol}//${window.location.host}/v-bill/${invId}` : "";
    const isPaid = (inv.balanceDue || 0) <= 0;
    const itemsList = inv.items?.map((it: any) => `• ${it.name} (${it.netWeight || 0}g)`).join("\n") || "Jewellery Items";

    const msg = `✨ *${shopName}* ✨\n🧾 *INVOICE BILL / ESTIMATE*\n\nDear *${inv.customerName || "Customer"}*,\nThank you for shopping with us! Here are your invoice bill details:\n\n📌 *Invoice No:* ${inv.number}\n📅 *Date:* ${formatDate(inv.createdAt || new Date())}\n💳 *Payment Mode:* ${inv.paymentMode}\n💰 *Grand Total:* ${inr(inv.total)}\n${!isPaid ? `⚠️ *Balance Due:* ${inr(inv.balanceDue || 0)}\n` : '✅ *Status:* PAID COMPLETE\n'}\n🛍️ *Items Purchased:*\n${itemsList}\n${billLink ? `\n🔗 *View Digital Invoice Bill:*\n${billLink}\n` : ''}\nThank you for your business! 💍✨${shopPhone ? `\nFor queries call: ${shopPhone}` : ''}`;

    setWaInvItem(inv);
    setWaInvMessage(msg);

    if (cleanPhone.length >= 10) {
      setWaInvPhone(cleanPhone);
      const encoded = encodeURIComponent(msg);
      window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, "_blank");
      toast.success(`Opening WhatsApp chat for ${inv.customerName || cleanPhone}!`);
    } else {
      setWaInvPhone("");
      setWaInvModalOpen(true);
    }
  };

  const [type, setType] = useState<"GST" | "NON-GST">("GST");
  const [customerId, setCustomerId] = useState<string>("");
  const [searchCust, setSearchCust] = useState("");
  const debouncedSearchCust = useDebounce(searchCust, 300);
  const [searchProd, setSearchProd] = useState("");
  const debouncedSearchProd = useDebounce(searchProd, 300);
  const [items, setItems] = useState<EditableInvoiceItem[]>([]);

  // POS Barcode Scanner State & Handler
  const [posBarcodeInput, setPosBarcodeInput] = useState("");
  const posScanRef = useRef<HTMLInputElement | null>(null);

  const handleScanBarcode = (code: string) => {
    if (!code || !code.trim()) return false;
    const cleanCode = code.trim().toLowerCase();

    const matched = products.find((p) => {
      const bc = (p.barcode || "").toLowerCase();
      const sku = (p.sku || "").toLowerCase();
      const itemCode = (p.itemCode || "").toLowerCase();
      const pid = (p._id || p.id || "").toLowerCase();
      const huid = (p.huid || "").toLowerCase();
      const jwlId = `jwl-${pid.slice(-6)}`;

      return (
        bc === cleanCode ||
        sku === cleanCode ||
        itemCode === cleanCode ||
        pid === cleanCode ||
        huid === cleanCode ||
        jwlId === cleanCode ||
        (cleanCode.length >= 3 && (p.name || "").toLowerCase() === cleanCode)
      );
    });

    if (matched) {
      if (matched.stock <= 0) {
        toast.error(`Item "${matched.name}" is out of stock.`);
        return false;
      }
      addProduct(matched._id || matched.id);

      // Audio BEEP feedback
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } catch (e) {}

      toast.success(`✓ POS Scanned & Added: ${matched.name} (${matched.netWeight || 0}g)`);
      setPosBarcodeInput("");
      return true;
    } else {
      toast.error(`No item found for POS Barcode / SKU: "${code}"`);
      return false;
    }
  };

  // Global Hardware USB POS Barcode Scanner Listener
  const barcodeBuffer = useRef<string>("");
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        posScanRef.current?.focus();
        toast.info("POS Barcode Scanner input focused!");
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTime.current;
      lastKeyTime.current = now;

      if (timeDiff > 100) {
        barcodeBuffer.current = "";
      }

      if (e.key === "Enter") {
        if (barcodeBuffer.current.trim().length >= 3) {
          e.preventDefault();
          const scanned = barcodeBuffer.current.trim();
          barcodeBuffer.current = "";
          handleScanBarcode(scanned);
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeBuffer.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [products]);
  const [discount, setDiscount] = useState<number | "">("");
  const [billMetal, setBillMetal] = useState<"Gold" | "Silver">("Gold");
  const [oldMetalType, setOldMetalType] = useState<"Gold" | "Silver" | "Mixed">("Mixed");
  const [oldGoldAmount, setOldGoldAmount] = useState<number | "">("");
  const [oldSilverAmount, setOldSilverAmount] = useState<number | "">("");
  const [cashAmount, setCashAmount] = useState<number | "">("");
  const [onlineAmount, setOnlineAmount] = useState<number | "">("");
  const [onlineMode, setOnlineMode] = useState<string>("UPI");
  const [customerSignature, setCustomerSignature] = useState<string>("");
  const [authorizedSignatory, setAuthorizedSignatory] = useState<string>("");
  const [pages, setPages] = useState<Record<number, number>>({});
  const [linkedOrderId, setLinkedOrderId] = useState<string>("");
  const [nonGstFilter, setNonGstFilter] = useState<"All" | "INV" | "MAN">("All");
  const [date, setDate] = useState<string>(formatDDMMYYYY(new Date()));
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement | null>(null);

  const [openOldGoldCalc, setOpenOldGoldCalc] = useState(false);
  const [oldCalcMetal, setOldCalcMetal] = useState<"Gold" | "Silver" | "Mixed">("Gold");
  const [oldGoldForm, setOldGoldForm] = useState({
    grossWeight: 0,
    lossWeight: 0,
    purityPct: 91.6,
    scrapRate: 7100,
  });
  const [oldSilverForm, setOldSilverForm] = useState({
    grossWeight: 0,
    lossWeight: 0,
    purityPct: 80,
    scrapRate: 85,
  });

  const [manualDueOpen, setManualDueOpen] = useState(false);
  const [manualDue, setManualDue] = useState({
    customerId: "NEW",
    customerName: "",
    phone: "",
    itemName: "",
    dueAmount: "" as number | "",
    date: formatDDMMYYYY(new Date()),
  });

  const saveManualDue = async () => {
    if (!manualDue.customerName || !manualDue.customerName.trim() || !manualDue.itemName || !manualDue.itemName.trim() || !manualDue.dueAmount || Number(manualDue.dueAmount) <= 0) {
      toast.error("Please enter Customer Name, Item Name/Reason, and a valid Due Amount.");
      return;
    }

    const parsedDt = parseDDMMYYYY(manualDue.date);
    if (!parsedDt) {
      toast.error("Invalid date. Use DD/MM/YYYY.");
      return;
    }
    const isoDate = parsedDt.toISOString();

    const amount = Number(manualDue.dueAmount);
    const initialPayment: any = {
      date: isoDate,
      amount: 0,
      mode: "Pending",
      note: "Manual Due Entry Created",
    };

    let custId = manualDue.customerId;
    let custName = manualDue.customerName.trim();
    let custMobile = manualDue.phone.trim();

    if (custId === "NEW") {
      try {
        const created = await createCustomerMutation.mutateAsync({
          name: custName,
          phone: custMobile,
          notes: "Created via Manual Due entry in Billing",
        });
        if (created?._id || created?.id) {
          custId = created._id || created.id;
        }
      } catch (e) {
        // fail silently or continue
      }
    }

    const newInvoice: any = {
      number: `MAN-${Date.now().toString().slice(-6)}`,
      createdAt: isoDate,
      customerId: custId !== "NEW" ? custId : undefined,
      customerName: custName,
      customerMobile: custMobile,
      type: "NON-GST",
      subtotal: amount,
      discount: 0,
      makingCharges: 0,
      gstAmount: 0,
      total: amount,
      amountPaid: 0,
      balanceDue: amount,
      paymentMode: "Pending",
      payments: [initialPayment],
      items: [
        {
          name: manualDue.itemName.trim(),
          purity: "22K",
          netWeight: 0,
          grossWeight: 0,
          ratePerGram: 0,
          totalPrice: amount,
          makingCharge: 0,
          qty: 1,
        },
      ],
    };

    try {
      await createMutation.mutateAsync(newInvoice);
      toast.success("Manual Due entry created successfully!");
      setManualDueOpen(false);
      setManualDue({
        customerId: "NEW",
        customerName: "",
        phone: "",
        itemName: "",
        dueAmount: "",
        date: formatDDMMYYYY(new Date()),
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to create manual due entry.");
    }
  };

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!showCalendar) return;
      const target = e.target as Node;
      if (calendarRef.current && !calendarRef.current.contains(target)) {
        setShowCalendar(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showCalendar]);

  useEffect(() => {
    console.log("Billing: dialog/open/editing state", { open, editingId, date });
  }, [open, editingId]);

  useEffect(() => {
    console.log("Billing: date state changed", date);
  }, [date]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  const [newCust, setNewCust] = useState({ name: "", phone: "", address: "" });
  const [openCustomItemDialog, setOpenCustomItemDialog] = useState(false);
  const [customItemSearch, setCustomItemSearch] = useState("");
  const debouncedCustomItemSearch = useDebounce(customItemSearch, 300);

  const { tenantSession } = useAuth();
  const authUser = tenantSession?.user;

  const isOperator = authUser?.role === 'operator';
  const isGst = type === "GST";

  const addProduct = (pid: string) => {
    console.log("Billing: addProduct called", pid);
    const p = products.find((x) => (x.id || x._id) === pid);
    if (!p) return;

    if (p.stock <= 0) {
      toast.error(`Cannot add "${p.name}". It is currently out of stock.`);
      return;
    }

    let currentRate = p.ratePerGram;
    if (latestRates && p.category !== "Diamond" && p.category !== "Other") {
      const purityUpper = (p.purity || "").toUpperCase();
      if (purityUpper.includes("24K") && latestRates.gold24) currentRate = latestRates.gold24;
      else if (purityUpper.includes("22K") && latestRates.gold22) currentRate = latestRates.gold22;
      else if (purityUpper.includes("20K") && latestRates.gold20) currentRate = latestRates.gold20;
      else if (purityUpper.includes("18K") && latestRates.gold18) currentRate = latestRates.gold18;
      else if ((p.category === "Silver" || purityUpper.includes("SILVER") || purityUpper.includes("925")) && latestRates.silver) currentRate = latestRates.silver;
    }

    let itemName = p.name;
    if (p.huid) {
      itemName += ` (HUID: ${p.huid})`;
    } else if (p.barcode && !p.barcode.startsWith("AJ-") && !p.barcode.startsWith("CAT-")) {
      itemName += ` (BC: ${p.barcode})`;
    }

    const newItem = {
      productId: p.id || p._id,
      name: itemName,
      purity: p.purity || "",
      netWeight: p.netWeight,
      grossWeight: p.grossWeight !== undefined ? p.grossWeight : p.netWeight,
      stoneWeight: p.stoneWeight || 0,
      ratePerGram: currentRate,
      makingCharge: 0,
      makingChargePct: 0,
      makingChargeType: "PERCENTAGE",
      makingChargeValue: 0,
      stoneCharge: 0,
      gstPct: p.gstPct,
      qty: 1,
      huid: p.huid || "",
      hmc: 0,
    } as any;

    setItems((prev) => {
      const emptyIdx = prev.findIndex((item) => !item.name || !item.name.trim());
      if (emptyIdx !== -1) {
        const updated = [...prev];
        updated[emptyIdx] = newItem;
        return updated;
      }
      return [...prev, newItem];
    });
  };

  const addCustomItem = () => {
    setCustomItemSearch(""); // Clear search when opening
    setOpenCustomItemDialog(true);
  };

  const addCustomItemFromDialog = (product?: any) => {
    console.log("Billing: addCustomItemFromDialog", product ? (product._id || product.id) : "blank");
    if (product) {
      // Add from inventory
      addProduct(product._id || product.id);
    } else {
      // Add completely blank custom item
      setItems((prev) => [
        ...prev,
        {
          productId: "manual-" + Date.now(),
          name: "",
          purity: "",
          netWeight: 0,
          grossWeight: 0,
          stoneWeight: 0,
          ratePerGram: 0,
          makingCharge: 0,
          makingChargePct: 0,
          makingChargeType: "PERCENTAGE",
          makingChargeValue: 0,
          stoneCharge: 0,
          gstPct: type === "GST" ? 3 : 0,
          qty: 1,
          huid: "",
          hmc: 0,
        } as any,
      ]);
    }
    setOpenCustomItemDialog(false);
    setCustomItemSearch("");
  };  

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    console.log("Billing: updateItem", { idx, patch });
    setItems((prev) => {
      const updated = [...prev];
      const item = updated[idx];
      if (!item) return prev;

      // If this is a manual custom item and name is being changed, try to fetch from inventory
      if (patch.name !== undefined && item.productId.startsWith("manual-")) {
        const nameToSearch = patch.name.toLowerCase().trim();
        if (nameToSearch !== "") {
          const matchedProduct = products.find(
            (p) =>
              p.name.toLowerCase() === nameToSearch ||
              (p.barcode || "").toLowerCase() === nameToSearch ||
              (p.huid || "").toLowerCase() === nameToSearch
          );

          if (matchedProduct) {
            let currentRate = matchedProduct.ratePerGram;
            if (latestRates && matchedProduct.category !== "Diamond" && matchedProduct.category !== "Other") {
              const purityUpper = (matchedProduct.purity || "").toUpperCase();
              if (purityUpper.includes("24K") && latestRates.gold24) currentRate = latestRates.gold24;
              else if (purityUpper.includes("22K") && latestRates.gold22) currentRate = latestRates.gold22;
              else if (purityUpper.includes("20K") && latestRates.gold20) currentRate = latestRates.gold20;
              else if (purityUpper.includes("18K") && latestRates.gold18) currentRate = latestRates.gold18;
              else if ((matchedProduct.category === "Silver" || purityUpper.includes("SILVER") || purityUpper.includes("925")) && latestRates.silver) currentRate = latestRates.silver;
            }

            // Update item with inventory data
            updated[idx] = {
              ...item,
              name: matchedProduct.name,
              purity: matchedProduct.purity,
              netWeight: matchedProduct.netWeight,
              grossWeight: matchedProduct.grossWeight !== undefined ? matchedProduct.grossWeight : matchedProduct.netWeight,
              stoneWeight: matchedProduct.stoneWeight || 0,
              ratePerGram: currentRate,
              gstPct: matchedProduct.gstPct,
            };
            return updated;
          }
        }
      }

      // Default: just apply the patch
      updated[idx] = { ...item, ...patch };
      return updated;
    });
  };

  // Recomputes makingCharge (per-unit) from the item's making-charge type/value
  // whenever a field it depends on (netWeight, ratePerGram, qty, type, value) changes.
  const recalcMaking = (item: EditableInvoiceItem, patch: Partial<InvoiceItem>) => {
    const merged = { ...item, ...patch } as any;
    const value = merged.makingChargeValue ?? merged.makingChargePct ?? 0;
    const makingCharge = computeMakingCharge({
      type: merged.makingChargeType,
      value,
      netWeight: merged.netWeight,
      ratePerGram: merged.ratePerGram,
      qty: merged.qty,
    });
    return { ...patch, makingCharge } as Partial<InvoiceItem>;
  };

  const removeItem = (idx: number) => {
    console.log("Billing: removeItem", idx);
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let gst = 0;

    items.forEach((it) => {
      const c = calcItem(it, isGst);
      subtotal += c.line;
      gst += c.gst;
    });

    const totalOldExchange = (Number(oldGoldAmount) || 0) + (Number(oldSilverAmount) || 0);
    const afterAdj = subtotal - (Number(discount) || 0) - totalOldExchange;
    const preRound = Math.round((afterAdj + gst) * 100) / 100;
    const gTotal = Math.floor(preRound);
    const roundOff = Math.round((gTotal - preRound) * 100) / 100;
    const cgst = gst / 2;
    const sgst = gst / 2;

    return { subtotal, gst, cgst, sgst, preRound, roundOff, gTotal, totalOldExchange };
  }, [items, discount, oldGoldAmount, oldSilverAmount, isGst]);

  const selectedCust = useMemo(() => customers.find((c) => (c._id || c.id) === customerId), [customers, customerId]);

  const handleCustomerSelect = (val: string) => {
    console.log("Billing: handleCustomerSelect", val);
    setCustomerId(val);
    if (val !== "NEW") {
      setNewCust({ name: "", phone: "", address: "" });
    }
    setLinkedOrderId("");
  };

  const customerOrdersAndRepairs = useMemo(() => {
    if (!selectedCust) return [];
    const o = orders.filter(o => 
      (o.customerMobile === selectedCust.mobile || (selectedCust.phone && o.customerMobile === selectedCust.phone)) && 
      o.status !== "Delivered" && 
      o.status !== "Cancelled"
    ).map(o => ({ type: 'order', id: `order_${o._id || o.id}`, originalId: o._id || o.id, desc: `${o.orderNo} - ${o.itemDescription}`, advance: o.advancePaid || 0, item: o }));

    const r = repairs.filter(r => 
      (r.customerMobile === selectedCust.mobile || (selectedCust.phone && r.customerMobile === selectedCust.phone)) && 
      r.status !== "Delivered"
    ).map(r => ({ type: 'repair', id: `repair_${r._id || r.id}`, originalId: r._id || r.id, desc: `${r.ticketNo} - ${r.itemDescription}`, advance: r.advance || 0, item: r }));

    return [...o, ...r];
  }, [orders, repairs, selectedCust]);

  const reset = () => {
    console.log("Billing: reset new invoice");
    setEditingId(null);
    setItems([]);
    setDiscount("");
    setOldGoldAmount("");
    setOldSilverAmount("");
    setOldMetalType("Mixed");
    setBillMetal("Gold");
    setCustomerId("");
    setCashAmount("");
    setOnlineAmount("");
    setOnlineMode("UPI");
    setCustomerSignature("");
    setAuthorizedSignatory("");
    setLinkedOrderId("");
    setSearchCust("");
    setSearchProd("");
    setNewCust({ name: "", phone: "", address: "" });
    setCustomItemSearch("");
    setOpenCustomItemDialog(false);
  };

  useEffect(() => {
    if (isOperator) {
      setType("NON-GST");
    } else {
      setType("GST");
    }
  }, [isOperator]);

  const editInvoice = (inv: any) => {
    console.log("Billing: editInvoice start", inv && (inv.number || inv._id || inv.id));
    setEditingId(inv._id || inv.id);
    setType(inv.type);
    setCustomerId(inv.customerId);
    setSearchCust(inv.customerName || "");
    const parsedItems = (inv.items || []).map((it: any) => {
      let pid = it.productId;
      let gw = it.netWeight;
      let sw = 0;
      if (pid && typeof pid === "string" && pid.includes("__GW_")) {
        const parts = pid.split("__GW_");
        pid = parts[0];
        const subParts = parts[1].split("__SW_");
        gw = Number(subParts[0]);
        sw = Number(subParts[1]);
      }
      return { ...it, productId: pid, grossWeight: gw, stoneWeight: sw };
    });
    setItems(parsedItems);
    console.log("Billing: editInvoice - items set", parsedItems.length);
    setDiscount(inv.discount || "");
    setOldGoldAmount(inv.oldGoldAmount || "");
    setOldSilverAmount(inv.oldSilverAmount || "");
    setOldMetalType(inv.oldMetalType || (inv.oldSilverAmount && inv.oldGoldAmount ? "Mixed" : inv.oldSilverAmount ? "Silver" : "Gold"));
    setBillMetal(inv.billMetal || "Gold");
    
    let cAmt = 0;
    let oAmt = 0;
    let oMode = "UPI";

    if (inv.payments && inv.payments.length > 0) {
      inv.payments.forEach((p: any) => {
        if (p.mode === "Cash") cAmt += p.amount;
        else if (p.mode === "Advance" || p.mode === "Order Advance") {
           // Do not bleed advance amounts into general online amount inputs
        } else { oAmt += p.amount; oMode = p.mode; }
      });
    } else {
      const paid = inv.amountPaid !== undefined ? inv.amountPaid : inv.total;
      if (inv.paymentMode === "Cash") { cAmt = paid; }
      else { oAmt = paid; oMode = inv.paymentMode || "UPI"; }
    }
    
    if (cAmt === 0 && oAmt === 0) {
      setCashAmount(0);
      setOnlineAmount("");
    } else {
      setCashAmount(cAmt > 0 ? cAmt : "");
      setOnlineAmount(oAmt > 0 ? oAmt : "");
    }
    console.log("Billing: editInvoice - payments set", { cash: cAmt, online: oAmt, mode: oMode });
    setOnlineMode(oMode);
    
    setCustomerSignature(inv.customerSignature || "");
    setAuthorizedSignatory(inv.authorizedSignatory || "");
    setLinkedOrderId(inv.linkedOrderId || "");
    const invDate = inv.createdAt ? (typeof inv.createdAt === 'string' ? new Date(inv.createdAt) : new Date(inv.createdAt)) : new Date();
    setDate(formatDDMMYYYY(invDate));
    console.log("Billing: editInvoice - date set", formatDDMMYYYY(invDate));
    setOpen(true);
    console.log("Billing: editInvoice end");
  };

  const save = async () => {
    if (items.length === 0 || !customerId) {
      console.log("Billing: validation failed - missing customer or items", { itemsLength: items.length, customerId });
      toast.error("Please select a customer and add items.");
      return;
    }

    let custId = customerId;
    let custName = "";
    let custMobile = "";
    let custAddress = "";

    if (customerId === "NEW") {
      if (!newCust.name || !newCust.address) {
        toast.error("New customer's name and address are required.");
        return;
      }
      try {
        const newCustomer = await createCustomerMutation.mutateAsync(newCust);
        custId = newCustomer._id || newCustomer.id;
        custName = newCustomer.name;
        custMobile = newCustomer.phone;
        custAddress = newCustomer.address;
      } catch (error: any) {
        toast.error(error?.message || "Failed to create new customer.");
        return;
      }
    } else {
      const cust = customers.find((c) => (c._id || c.id) === customerId);
      if (!cust) { toast.error("Selected customer not found."); return; }
      custName = cust.name;
      custMobile = cust.mobile || cust.phone || "";
      custAddress = cust.address || "";
    }

    const existingInv = editingId ? invoices.find(i => (i._id || i.id) === editingId) : null;

    const cAmt = Number(cashAmount) || 0;
    const oAmt = Number(onlineAmount) || 0;
    const linkedOrder = orders.find(o => (o._id || o.id) === linkedOrderId || `order_${o._id || o.id}` === linkedOrderId);
    const linkedRepair = repairs.find(r => `repair_${r._id || r.id}` === linkedOrderId);
    const orderAdvanceAmount = linkedOrder ? (linkedOrder.advancePaid || 0) : linkedRepair ? (linkedRepair.advance || 0) : 0;
    const advanceNote = linkedOrder ? `Order ${linkedOrder.orderNo} Advance` : linkedRepair ? `Repair ${linkedRepair.ticketNo} Advance` : "Advance";
 
    let safeActualPaid = 0;
    let finalPaymentMode = "Cash";
    const initialPayment: any[] = [];

    safeActualPaid = cAmt + oAmt + orderAdvanceAmount;
    console.log("Billing: saving - inputs", { date, customerId, itemsCount: items.length, totals, cashAmount: cAmt, onlineAmount: oAmt, linkedOrderId });

    if (safeActualPaid > totals.gTotal) {
      toast.error(`Entered amount (${inr(safeActualPaid)}) is more than the Grand Total (${inr(totals.gTotal)}). Please correct it.`);
      return;
    }

    finalPaymentMode = oAmt > (cAmt + orderAdvanceAmount) ? onlineMode : "Cash";

    // Parse and validate manual invoice date (DD/MM/YYYY)
    const parsedDt = parseDDMMYYYY(date);
    if (!parsedDt) {
      toast.error("Invalid invoice date. Use DD/MM/YYYY.");
      return;
    }
    const now = new Date();
    // compare only date portion
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (parsedDt > nowDate) {
      toast.error("Invoice date cannot be in the future.");
      return;
    }
    const parsedIso = parsedDt.toISOString();

    if (orderAdvanceAmount > 0) initialPayment.push({ date: parsedIso, amount: orderAdvanceAmount, mode: "Advance", note: advanceNote });
    if (cAmt > 0) initialPayment.push({ date: parsedIso, amount: cAmt, mode: "Cash", note: "Initial Cash Payment" });
    if (oAmt > 0) initialPayment.push({ date: parsedIso, amount: oAmt, mode: onlineMode, note: `Initial ${onlineMode} Payment` });

    const balanceDue = Math.max(0, totals.gTotal - safeActualPaid);

    // Clean _id from subdocuments to avoid Mongoose immutable _id CastErrors on update
    const cleanItems = items.map((it: any) => {
      const { _id, id, grossWeight, stoneWeight, ...rest } = it;
      const gw = grossWeight !== undefined ? grossWeight : rest.netWeight;
      const sw = stoneWeight || 0;
      return { ...rest, grossWeight: gw, stoneWeight: sw, productId: `${rest.productId}__GW_${gw}__SW_${sw}` };
    });

    let cleanPayments = initialPayment;
    const oldPaid = existingInv?.amountPaid || 0;
    if (existingInv) {
      if (safeActualPaid === oldPaid) {
        // If the user updated the invoice date while editing, update existing payment dates to match the new date
        if (existingInv.createdAt && existingInv.createdAt !== parsedIso) {
          cleanPayments = (existingInv.payments || []).map((p: any) => ({ ...p, date: parsedIso }));
        } else {
          cleanPayments = existingInv.payments || [];
        }
      } else if (Array.isArray(existingInv.payments) && existingInv.payments.length > 0) {
        const oldFirstDate = existingInv.payments[0].date || existingInv.createdAt;
        initialPayment.forEach(p => p.date = oldFirstDate);
        cleanPayments = initialPayment;
      }
    }

    let newNumber = existingInv ? existingInv.number : "";
    if (!existingInv) {
      const typeInvoices = invoices.filter(i => i.type === type && !i.number?.startsWith("MAN-"));
      const prefix = type === "GST" ? "GST-" : "INV-";
      newNumber = prefix + (typeInvoices.length + 1).toString().padStart(4, "0");
    }

    const inv: any = {
      ...(editingId ? { number: newNumber } : {}),
      type,
      customerId: custId,
      customerName: custName,
      customerMobile: custMobile,
      customerAddress: custAddress,
      items: cleanItems,
      discount: Number(discount) || 0,
      oldGoldAmount: Number(oldGoldAmount) || 0,
      oldSilverAmount: Number(oldSilverAmount) || 0,
      oldMetalType: oldMetalType,
      billMetal: billMetal,
      paymentMode: finalPaymentMode,
      subtotal: totals.subtotal,
      gstAmount: totals.gst,
      total: totals.gTotal,
      amountPaid: safeActualPaid,
      balanceDue,
      createdAt: parsedIso,
      payments: cleanPayments,
      customerSignature,
      authorizedSignatory,
      linkedOrderId: linkedOrderId || undefined,
    };

    try {
      console.log("Billing: invoice payload about to be sent", { number: newNumber, type, customerId: custId, items: cleanItems.length, subtotal: totals.subtotal, total: totals.gTotal, amountPaid: safeActualPaid });
      if (editingId) {
        const saved = await updateMutation.mutateAsync({ id: editingId, body: inv });
        console.log("Billing: invoice updated", saved);
        // update viewing and local cache so UI reflects new date immediately
        setViewing(saved);
        try {
          queryClient.setQueryData(["invoices"], (old: any) => {
            if (!Array.isArray(old)) return old;
            const m = new Map<string, any>();
            old.forEach((it: any) => {
              const k = it._id || it.id;
              if (k) m.set(k, it);
            });
            const sk = saved._id || saved.id;
            if (sk) m.set(sk, saved);
            return Array.from(m.values());
          });
          console.log("Billing: invoices cache updated (deduped)");
        } catch (e) { console.warn("Billing: cache update failed", e); }
        toast.success("Invoice updated successfully");
      } else {
        const saved = await createMutation.mutateAsync(inv);
        console.log("Billing: invoice saved", saved);
        
        if (linkedOrderId) {
          if (linkedOrder) {
            await updateOrderMutation.mutateAsync({
              id: linkedOrder._id || linkedOrder.id,
              body: { ...linkedOrder, status: "Delivered" }
            });
          } else if (linkedRepair) {
            await updateRepairMutation.mutateAsync({
              id: linkedRepair._id || linkedRepair.id,
              body: { ...linkedRepair, status: "Delivered" }
            });
          }
        }
        
        // Inventory deduction is handled atomically by the backend POST /invoices transaction.
        // createMutation already invalidates ["invoices", "inventory"] so the UI will refresh.
        setViewing(saved);
        toast.success("Invoice generated successfully");
      }
      reset();
      setOpen(false);
    } catch (error: any) {
      console.error("Billing: save error", error);
      toast.error(error?.message || "Failed to save invoice");
    }
  };

  const removeInvoice = async (invoice: Invoice) => {
    const isReturned = salesReturns.some(
      (r: any) => r.invoiceId === ((invoice as any)._id || invoice.id)
    );

    const confirmMsg = isReturned
      ? `Delete Invoice ${invoice.number}?\n\nThis invoice has already been returned. Only the invoice record will be deleted — inventory will NOT be changed (stock was already restored when the return was processed).`
      : `Delete Invoice ${invoice.number}?\n\nThis will also add the sold items back to your inventory.`;

    if (window.confirm(confirmMsg)) {
      try {
        await deleteMutation.mutateAsync(invoice._id || invoice.id || "");
        toast.success(
          isReturned
            ? `Invoice ${invoice.number} deleted. Inventory unchanged.`
            : `Invoice ${invoice.number} deleted and stock restored.`
        );
      } catch (e) { toast.error("Failed to delete invoice."); }
    }
  };

  const handleKeyNav = useFormKeyboardNav(save);
  const productSearchRef = useRef<HTMLInputElement>(null);

  const today = new Date().toDateString();
  const roleInvoices = dedupeInvoices(invoices.filter(i => i.type === type));
  const todayInvoices = roleInvoices.filter(i => new Date(i.createdAt).toDateString() === today);
  const todayRevenue = todayInvoices.reduce((s, i) => s + i.total, 0);

  const gstInvoices = useMemo(() => {
    let list = dedupeInvoices(invoices.filter((i) => i.type === "GST"));
    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase().trim();
      list = list.filter((i) => (i.number || "").toLowerCase().includes(q) || (i.customerName || "").toLowerCase().includes(q) || (i.customerMobile || "").includes(q) || (i.customerAddress || "").toLowerCase().includes(q));
    }
    return list.sort(compareByInvoiceNumber);
  }, [invoices, debouncedSearchQuery]);

  const nonGstInvoices = useMemo(() => {
    let list = dedupeInvoices(invoices.filter((i) => i.type === "NON-GST"));
    if (nonGstFilter === "INV") {
      list = list.filter((i) => !i.number?.startsWith("MAN-"));
    } else if (nonGstFilter === "MAN") {
      list = list.filter((i) => i.number?.startsWith("MAN-"));
    }
    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase().trim();
      list = list.filter((i) => (i.number || "").toLowerCase().includes(q) || (i.customerName || "").toLowerCase().includes(q) || (i.customerMobile || "").includes(q) || (i.customerAddress || "").toLowerCase().includes(q));
    }
    return list.sort(compareByInvoiceNumber);
  }, [invoices, debouncedSearchQuery, nonGstFilter]);

  return (
    <Layout>
      <div className="print:hidden">
      {/* ═══════════════════════════════════════════════════════════
           HERO HEADER
      ═══════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-amber-950 to-slate-900 p-4 sm:p-6 mb-5 border border-amber-900/40 shadow-xl">
        {/* Decorative blobs */}
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-amber-600/8 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
          {/* Title */}
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-amber-500/20 border border-amber-500/30">
                <Receipt className="w-3.5 h-3.5 text-amber-400" />
              </span>
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-amber-400/80">Point of Sale</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-display font-bold text-white tracking-tight">Billing &amp; Invoices</h1>
            <p className="text-amber-200/60 text-[11px] sm:text-xs mt-0.5">Tax Invoices · Trade-ins · HUID Scanning · GST · Manual Dues</p>
          </div>

          {/* Live rates ticker (4-col grid on mobile, flex on desktop) */}
          {latestRates && (
            <div className="bg-black/40 border border-white/10 rounded-xl p-2 sm:px-3 sm:py-2 w-full md:w-auto">
              <div className="grid grid-cols-4 items-center gap-1 sm:gap-3 text-center sm:text-left divide-x divide-white/10">
                <div className="flex items-center justify-center sm:justify-start gap-1 text-[10px] sm:text-xs font-medium text-white/60 px-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span>Live</span>
                </div>
                {latestRates.gold24 && (
                  <div className="px-1 text-center">
                    <div className="text-[8px] sm:text-[9px] text-amber-400/90 uppercase tracking-wider font-bold">24K</div>
                    <div className="text-white font-mono text-[11px] sm:text-xs font-semibold truncate">{inr(latestRates.gold24)}</div>
                  </div>
                )}
                {latestRates.gold22 && (
                  <div className="px-1 text-center">
                    <div className="text-[8px] sm:text-[9px] text-amber-400/90 uppercase tracking-wider font-bold">22K</div>
                    <div className="text-white font-mono text-[11px] sm:text-xs font-semibold truncate">{inr(latestRates.gold22)}</div>
                  </div>
                )}
                {latestRates.silver && (
                  <div className="px-1 text-center">
                    <div className="text-[8px] sm:text-[9px] text-slate-300 uppercase tracking-wider font-bold">Silver</div>
                    <div className="text-white/80 font-mono text-[11px] sm:text-xs font-semibold truncate">{inr(latestRates.silver)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Link to="/dues">
              <Button variant="outline" size="sm" className="h-9 text-xs font-semibold bg-white/5 border-rose-500/40 text-rose-200 hover:bg-rose-500/15 hover:border-rose-400 hover:text-rose-100 transition-all">
                <AlertCircle className="w-3.5 h-3.5 mr-1 text-rose-400" /> Customer Dues
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs font-semibold bg-white/5 border-amber-500/40 text-amber-200 hover:bg-amber-500/15 hover:border-amber-400 hover:text-amber-100 transition-all"
              onClick={() => {
                setManualDue({
                  customerId: "NEW",
                  customerName: "",
                  phone: "",
                  itemName: "",
                  dueAmount: "",
                  date: formatDDMMYYYY(new Date()),
                });
                setManualDueOpen(true);
              }}
            >
              <NotebookPen className="w-3.5 h-3.5 mr-1 text-amber-400" /> + Manual Due
            </Button>
            <Link to="/invoice-designer">
              <Button variant="outline" size="sm" className="h-9 text-xs font-semibold bg-white/5 border-amber-500/40 text-amber-200 hover:bg-amber-500/15 hover:border-amber-400 hover:text-amber-100 transition-all">
                <Palette className="w-3.5 h-3.5 mr-1" /> Designer
              </Button>
            </Link>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-9 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold shadow-lg shadow-amber-900/30 transition-all" onClick={() => reset()}>
                  <Plus className="w-4 h-4 mr-1" /> New Invoice
                </Button>
              </DialogTrigger>
          <DialogContent className="w-[98vw] max-w-6xl max-h-[96vh] overflow-y-auto overflow-x-hidden p-3.5 sm:p-5" aria-describedby={undefined} onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-display">{editingId ? "Edit Invoice" : "Create Invoice"}</DialogTitle>
            </DialogHeader>
            <form className="space-y-4 mt-3" onSubmit={(e) => { e.preventDefault(); save(); }} onKeyDown={handleKeyNav}>
              
              {/* 1. Invoice Details */}
              <div className="p-4 border rounded-lg bg-muted/10 space-y-3">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">1</span>
                  Invoice Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Search Customer</Label>
                    <Input
                      className="bg-background"
                    placeholder="Search name, mobile, or address..."
                      value={searchCust}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSearchCust(v);
                        const match = customers.find(
                          (c) =>
                            c.mobile === v ||
                            c.phone === v ||
                            c.name.toLowerCase() === v.toLowerCase() ||
                            (c.address || "").toLowerCase().includes(v.toLowerCase())
                        );
                        if (match) {
                          handleCustomerSelect(match._id || match.id);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (searchCust.trim() !== "") {
                            const v = searchCust.toLowerCase().trim();
                            const match = customers.find(
                              (c) => c.name.toLowerCase().includes(v) || (c.mobile || c.phone || "").includes(v) || (c.address || "").toLowerCase().includes(v)
                            );
                            if (match) {
                              handleCustomerSelect(match._id || match.id);
                            }
                          }
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Customer</Label>
                      <Select
                        value={customerId}
                        onValueChange={(val) => {
                          handleCustomerSelect(val);
                        }}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NEW" className="font-semibold text-primary">+ Create New Customer</SelectItem>
                          {customers
                            .filter(
                              (c) =>
                                c.name.toLowerCase().includes(debouncedSearchCust.toLowerCase()) ||
                                (c.mobile || c.phone || "").includes(debouncedSearchCust) ||
                                (c.address || "").toLowerCase().includes(debouncedSearchCust.toLowerCase())
                            )
                            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                            .map((c) => (
                              <SelectItem key={c._id || c.id} value={c._id || c.id}>
                                {c.name} · {c.mobile || (c as any).phone}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Invoice Date</Label>
                      <div className="relative">
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            className="bg-background h-8 w-40"
                            value={date}
                            onChange={(e) => {
                              setDate(e.target.value);
                              console.log("Billing: date input changed", e.target.value);
                            }}
                            onFocus={() => setShowCalendar(true)}
                            placeholder="DD/MM/YYYY"
                          />
                          <button type="button" aria-label="Toggle date picker" onClick={() => setShowCalendar(s => !s)} className="h-8 w-8 inline-flex items-center justify-center rounded border bg-background">
                            <Calendar className="w-4 h-4" />
                          </button>
                        </div>
                        {showCalendar && (
                          <div ref={calendarRef} className="absolute z-50 bg-white border rounded shadow p-2 mt-2">
                            <DayPicker
                              mode="single"
                              selected={parseDDMMYYYY(date) || undefined}
                              onSelect={(d) => {
                                if (d) {
                                  const formatted = formatDDMMYYYY(d);
                                  console.log("Billing: calendar selected", formatted);
                                  setDate(formatted);
                                  setShowCalendar(false);
                                }
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Use the date picker or enter DD/MM/YYYY (future dates blocked)</p>
                    </div>

                    {customerId === "NEW" && (
                      <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-sm space-y-3 mt-2">
                        <h4 className="text-xs font-bold text-primary uppercase">New Customer Details</h4>
                        <div className="space-y-1.5"><Label className="text-xs">Full Name *</Label><Input value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value})} className="h-8 bg-background" /></div>
                        <div className="space-y-1.5"><Label className="text-xs">Mobile No (optional)</Label><Input value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value})} className="h-8 bg-background" /></div>
                        <div className="space-y-1.5"><Label className="text-xs">Address *</Label><Input value={newCust.address} onChange={e => setNewCust({...newCust, address: e.target.value})} className="h-8 bg-background" /></div>
                      </div>
                    )}

                    {customerId && (
                      <div className="p-3 rounded-md bg-background border border-border text-sm">
                        {(() => {
                          if (!selectedCust) return null;
                          return (
                            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                              <div>
                                <strong className="text-foreground">Name:</strong> {selectedCust.name}
                              </div>
                              <div>
                                <strong className="text-foreground">Mobile:</strong>{" "}
                                {selectedCust.mobile || selectedCust.phone}
                              </div>
                              <div className="col-span-2">
                                <strong className="text-foreground">Address:</strong>{" "}
                                {selectedCust.address || "—"}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    {customerId && customerOrdersAndRepairs.length > 0 && !editingId && (
                      <div className="mt-2 space-y-1.5 p-3 rounded-md bg-primary/5 border border-primary/20">
                        <Label className="text-xs text-primary font-semibold">Link Active Order / Repair (Apply Advance)</Label>
                        <Select value={linkedOrderId || "none"} onValueChange={(v) => {
                          const newLinkedId = v === "none" ? "" : v;
                          const oldLinkedId = linkedOrderId;
                          setLinkedOrderId(newLinkedId);
                          
                          setItems(prev => {
                            let updated = [...prev];
                            if (oldLinkedId) {
                               updated = updated.filter(it => it.productId !== `linked-${oldLinkedId}`);
                            }
                            
                            if (newLinkedId) {
                              const isOrder = newLinkedId.startsWith("order_") || orders.find(o => (o._id || o.id) === newLinkedId);
                              if (isOrder) {
                                const linkedOrder = orders.find(o => `order_${o._id || o.id}` === newLinkedId || (o._id || o.id) === newLinkedId);
                                if (linkedOrder) {
                                  let currentRate = 0;
                                  if (latestRates && linkedOrder.metal !== "Diamond" && linkedOrder.metal !== "Other") {
                                    const purityUpper = (linkedOrder.purity || "").toUpperCase();
                                    if (purityUpper.includes("24K") && latestRates.gold24) currentRate = latestRates.gold24;
                                    else if (purityUpper.includes("22K") && latestRates.gold22) currentRate = latestRates.gold22;
                                    else if (purityUpper.includes("20K") && latestRates.gold20) currentRate = latestRates.gold20;
                                    else if (purityUpper.includes("18K") && latestRates.gold18) currentRate = latestRates.gold18;
                                    else if ((linkedOrder.metal === "Silver" || purityUpper.includes("SILVER") || purityUpper.includes("925")) && latestRates.silver) currentRate = latestRates.silver;
                                  }
                                  updated.push({
                                    productId: `linked-${newLinkedId}`,
                                    name: linkedOrder.itemDescription,
                                    purity: linkedOrder.purity || "",
                                    netWeight: 0,
                                    grossWeight: 0,
                                    stoneWeight: 0,
                                    ratePerGram: currentRate,
                                    makingCharge: 0,
                                    makingChargePct: 0,
                                    stoneCharge: 0,
                                    gstPct: type === "GST" ? 3 : 0,
                                    qty: 1,
                                  } as any);
                                }
                              } else {
                                const linkedRepair = repairs.find(r => `repair_${r._id || r.id}` === newLinkedId);
                                if (linkedRepair) {
                                  updated.push({
                                    productId: `linked-${newLinkedId}`,
                                    name: `Repair: ${linkedRepair.itemDescription}`,
                                    purity: "-",
                                    netWeight: 0,
                                    grossWeight: 0,
                                    stoneWeight: 0,
                                    ratePerGram: 0,
                                    makingCharge: 0,
                                    makingChargePct: 0,
                                    stoneCharge: 0,
                                    gstPct: type === "GST" ? 3 : 0,
                                    qty: 1,
                                  } as any);
                                }
                              }
                            }
                            return updated;
                          });
                        }}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select an order or repair" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {customerOrdersAndRepairs.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.desc} (Advance: {inr(item.advance)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Items */}
              <div className="p-4 border rounded-lg bg-muted/10 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold text-primary flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">2</span>
                    Items
                  </h3>
                  <div className="flex items-center gap-2 bg-background px-3 py-1 rounded-lg border border-border/80 shadow-2xs">
                    <span className="text-xs font-semibold text-muted-foreground">Bill Type:</span>
                    <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-md">
                      <button
                        type="button"
                        onClick={() => setBillMetal("Gold")}
                        className={`px-3 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                          billMetal === "Gold" ? "bg-amber-600 text-white shadow-2xs" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Gold / General Bill
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillMetal("Silver")}
                        className={`px-3 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                          billMetal === "Silver" ? "bg-slate-800 text-white shadow-2xs" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Silver Bill
                      </button>
                    </div>
                  </div>
                </div>
                {/* POS MACHINE BARCODE SCANNER BAR */}
                <div className="w-full bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <ScanBarcode className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-emerald-950 dark:text-emerald-300 flex items-center gap-1.5">
                        POS Barcode Scanner Machine
                        <span className="bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">Press F2</span>
                      </div>
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400">Scan any jewellery tag / barcode / SKU to auto-add item to invoice</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-72">
                      <Input
                        ref={posScanRef}
                        placeholder="Scan Barcode / SKU / HUID / Tag #..."
                        value={posBarcodeInput}
                        onChange={(e) => setPosBarcodeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleScanBarcode(posBarcodeInput);
                          }
                        }}
                        className="bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 focus-visible:ring-emerald-500 font-mono text-xs pl-8 pr-16 h-9"
                      />
                      <ScanBarcode className="w-4 h-4 text-emerald-600 absolute left-2.5 top-2.5 pointer-events-none" />
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white absolute right-1 top-1 px-2 font-bold"
                        onClick={() => handleScanBarcode(posBarcodeInput)}
                      >
                        Scan
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full items-start sm:items-center">
                    <Input
                      ref={productSearchRef}
                      placeholder="Type name/barcode & press Enter..."
                      value={searchProd}
                      onChange={(e) => setSearchProd(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation(); // keep focus in this box for rapid successive scans/entries
                          if (searchProd.trim() !== "") {
                            const query = searchProd.toLowerCase().trim();
                          const matches = products.filter(
                            (p) => {
                              if (!isGst && (p.gstPct || 0) > 0) return false;
                              if (!isProductMatchingBillMetal(p, billMetal)) return false;
                              return (
                                p.name.toLowerCase().includes(query) ||
                                (p.barcode || "").toLowerCase() === query ||
                                (p.huid || "").toLowerCase() === query
                              );
                            }
                          );
                          if (matches.length > 0) {
                            const exact = matches.find(
                              (p) =>
                                p.name.toLowerCase() === query ||
                                (p.barcode || "").toLowerCase() === query ||
                                (p.huid || "").toLowerCase() === query
                            );
                            addProduct((exact || matches[0])._id || (exact || matches[0]).id);
                            setSearchProd("");
                          } else {
                            toast.error("No product found matching this name or barcode.");
                          }
                          }
                        }
                      }}
                      className="bg-background w-full sm:w-64"
                    />

                    <div className="w-full sm:w-64">
                      <Select
                        value=""
                        onValueChange={(val) => {
                          addProduct(val);
                          setSearchProd("");
                        }}
                      >
                        <SelectTrigger className="bg-background w-full sm:w-64">
                          <SelectValue
                            placeholder={
                              products.length ? "Add product…" : "No products in inventory"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {products
                            .filter(
                              (p) => {
                                if (!isGst && (p.gstPct || 0) > 0) return false;
                                if (!isProductMatchingBillMetal(p, billMetal)) return false;
                                return (
                                  p.name.toLowerCase().includes(debouncedSearchProd.toLowerCase()) ||
                                  (p.barcode || "")
                                    .toLowerCase()
                                    .includes(debouncedSearchProd.toLowerCase()) ||
                                  (p.huid || "")
                                    .toLowerCase()
                                    .includes(debouncedSearchProd.toLowerCase())
                                );
                              }
                            )
                            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                            .map((p) => (
                              <SelectItem key={p._id || p.id} value={p._id || p.id} disabled={p.stock <= 0}>
                                {p.name} · {p.barcode || p.huid || p.purity} · {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" variant="secondary" onClick={addCustomItem} className="shrink-0">
                      <Plus className="w-4 h-4 mr-2" /> Add Custom Item
                    </Button>
                    
                    {/* Custom Item Dialog */}
                    <Dialog open={openCustomItemDialog} onOpenChange={setOpenCustomItemDialog}>
                      <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                        <DialogHeader>
                          <DialogTitle>Add Custom Item</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm font-medium mb-2 block">Search Inventory</Label>
                            <Input
                              placeholder="Type product name, barcode, or HUID..."
                              value={customItemSearch}
                              onChange={(e) => setCustomItemSearch(e.target.value)}
                              className="bg-background"
                              autoFocus
                            />
                          </div>

                          {debouncedCustomItemSearch.trim() !== "" && (
                            <div className="max-h-48 overflow-y-auto border rounded-md">
                              {products
                                .filter(
                                  (p) => {
                                    if (!isGst && (p.gstPct || 0) > 0) return false;
                                    if (!isProductMatchingBillMetal(p, billMetal)) return false;
                                    return (
                                      p.name.toLowerCase().includes(debouncedCustomItemSearch.toLowerCase()) ||
                                      (p.barcode || "").toLowerCase().includes(debouncedCustomItemSearch.toLowerCase()) ||
                                      (p.huid || "").toLowerCase().includes(debouncedCustomItemSearch.toLowerCase())
                                    );
                                  }
                                )
                                .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                                .map((p) => (
                                  <div
                                    key={p._id || p.id}
                                    onClick={() => addCustomItemFromDialog(p)}
                                    className="p-3 border-b hover:bg-muted cursor-pointer transition-colors last:border-0"
                                  >
                                    <div className="font-medium text-sm">{p.name}</div>
                                    <div className="text-xs text-muted-foreground flex gap-2">
                                      {p.barcode && <span>BC: {p.barcode}</span>}
                                      {p.huid && <span>HUID: {p.huid}</span>}
                                      <span>{p.purity}</span>
                                      <span className={p.stock > 0 ? "text-green-600" : "text-red-600"}>
                                        {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              {products.filter(
                                (p) => {
                                  if (!isGst && (p.gstPct || 0) > 0) return false;
                                  if (!isProductMatchingBillMetal(p, billMetal)) return false;
                                  return (
                                    p.name.toLowerCase().includes(debouncedCustomItemSearch.toLowerCase()) ||
                                    (p.barcode || "").toLowerCase().includes(debouncedCustomItemSearch.toLowerCase()) ||
                                    (p.huid || "").toLowerCase().includes(debouncedCustomItemSearch.toLowerCase())
                                  );
                                }
                              ).length === 0 && (
                                <div className="p-3 text-sm text-muted-foreground text-center">
                                  No products found
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex gap-2 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => addCustomItemFromDialog()}
                              className="w-full"
                            >
                              Add Blank Custom Item
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setOpenCustomItemDialog(false)}
                              className="w-full"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                </div>
                {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">
                      Add products from the dropdown to start billing.
                    </p>
                  ) : (
                    <>
                      {/* Mobile Item Cards View (Visible on screens < md) */}
                      <div className="block md:hidden space-y-3">
                        {items.map((it, i) => {
                          const c = calcItem(it, isGst);
                          return (
                            <div key={i} className="p-3.5 border border-border rounded-lg bg-background space-y-3 shadow-xs">
                              <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  Item #{i + 1}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50"
                                  onClick={() => removeItem(i)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>

                              <div className="grid grid-cols-1 gap-2">
                                <div>
                                  <Label className="text-[11px] font-semibold text-muted-foreground block mb-1">Product Name</Label>
                                  <Input
                                    value={it.name}
                                    onChange={(e) => updateItem(i, { name: e.target.value })}
                                    className="h-8 text-xs font-medium bg-background"
                                    placeholder="Item Name"
                                  />
                                </div>
                                {billMetal !== "Silver" && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-[11px] font-semibold text-muted-foreground block mb-1">Purity</Label>
                                      <Input
                                        value={it.purity}
                                        onChange={(e) => updateItem(i, { purity: e.target.value })}
                                        className="h-8 text-xs bg-background"
                                        placeholder="Purity (e.g. 22K)"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-[11px] font-semibold text-muted-foreground block mb-1">HUID</Label>
                                      <Input
                                        value={it.huid || ""}
                                        onChange={(e) => updateItem(i, { huid: e.target.value })}
                                        className="h-8 text-xs bg-background font-mono"
                                        placeholder="HUID Code"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-4 gap-1.5 text-center bg-muted/20 p-2 rounded-md border border-border/60">
                                <div>
                                  <Label className="text-[10px] text-muted-foreground block mb-1">Pcs</Label>
                                  <NumI v={it.qty} on={(v) => updateItem(i, recalcMaking(it, { qty: v }))} className="w-full h-7 text-xs bg-background text-center font-mono" />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-muted-foreground block mb-1">Gross Wt</Label>
                                  <NumI
                                    v={(it as any).grossWeight !== undefined ? (it as any).grossWeight : it.netWeight}
                                    on={(v) => {
                                      const stWt = (it as any).stoneWeight || 0;
                                      const net = Math.max(0, v - stWt);
                                      updateItem(i, recalcMaking(it, { grossWeight: v, netWeight: net }));
                                    }}
                                    className="w-full h-7 text-xs bg-background text-center font-mono"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-muted-foreground block mb-1">Less Wt</Label>
                                  <NumI
                                    v={(it as any).stoneWeight || 0}
                                    on={(v) => {
                                      const grWt = (it as any).grossWeight !== undefined ? (it as any).grossWeight : it.netWeight;
                                      const net = Math.max(0, grWt - v);
                                      updateItem(i, recalcMaking(it, { stoneWeight: v, netWeight: net }));
                                    }}
                                    className="w-full h-7 text-xs bg-background text-center font-mono"
                                  />
                                </div>
                                <div>
                                  <Label className="text-[10px] text-muted-foreground block mb-1">Net Wt</Label>
                                  <NumI
                                    v={it.netWeight}
                                    on={(v) => updateItem(i, recalcMaking(it, { netWeight: v, grossWeight: v + ((it as any).stoneWeight || 0) }))}
                                    className="w-full h-7 text-xs bg-background text-center font-mono"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-[11px] font-semibold text-muted-foreground block mb-1">Rate (₹/g)</Label>
                                  <NumI
                                    v={it.ratePerGram}
                                    on={(v) => updateItem(i, recalcMaking(it, { ratePerGram: v }))}
                                    className="w-full h-8 text-xs bg-background font-mono"
                                  />
                                </div>
                                {billMetal !== "Silver" && (
                                  <div>
                                    <Label className="text-[11px] font-semibold text-muted-foreground block mb-1">HMC Charge (₹)</Label>
                                    <NumI v={it.hmc || 0} on={(v) => updateItem(i, { hmc: v })} className="w-full h-8 text-xs bg-background font-mono" />
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-2 items-center bg-muted/20 p-2 rounded.md border border-border/60">
                                <div>
                                  <Label className="text-[10px] font-semibold text-muted-foreground block mb-1">Making Charge</Label>
                                  <div className="flex items-center gap-1">
                                    <Select
                                      value={it.makingChargeType || "PERCENTAGE"}
                                      onValueChange={(val: MakingChargeType) => {
                                        const value = it.makingChargeValue ?? it.makingChargePct ?? 0;
                                        const patch: any = { makingChargeType: val };
                                        patch.makingChargePct = val === "PERCENTAGE" ? value : 0;
                                        updateItem(i, recalcMaking(it, patch));
                                      }}
                                    >
                                      <SelectTrigger className="w-20 h-7 text-[10px] bg-background">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="PERCENTAGE">%</SelectItem>
                                        <SelectItem value="PER_GRAM">₹/g</SelectItem>
                                        <SelectItem value="WASTAGE">Wastage%</SelectItem>
                                        <SelectItem value="PER_PIECE">₹/pc</SelectItem>
                                        <SelectItem value="FIXED">Fixed</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <NumI
                                      v={it.makingChargeValue ?? it.makingChargePct ?? 0}
                                      on={(v) => {
                                        const patch: any = { makingChargeValue: v };
                                        if ((it.makingChargeType || "PERCENTAGE") === "PERCENTAGE") patch.makingChargePct = v;
                                        updateItem(i, recalcMaking(it, patch));
                                      }}
                                      className="w-full h-7 text-xs bg-background font-mono"
                                    />
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Subtotal</span>
                                  <span className="font-bold text-emerald-700 text-sm font-mono">{inr(c.line)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Items Table (Visible on screens >= md) */}
                      <div className="hidden md:block overflow-x-auto w-full border border-border rounded-md">
                        <table className="w-full text-sm min-w-[1100px]">
                          <thead className="text-left text-muted-foreground border-b bg-muted/20 text-xs uppercase tracking-wider">
                            <tr>
                              <th className="p-2 font-semibold whitespace-nowrap">Product</th>
                              {billMetal !== "Silver" && <th className="p-2 font-semibold whitespace-nowrap w-28">HUID</th>}
                              <th className="py-2 px-1.5 font-semibold whitespace-nowrap text-right w-16">Pcs</th>
                              <th className="py-2 px-1.5 font-semibold whitespace-nowrap text-right w-24">Gross Wt</th>
                              <th className="py-2 px-1.5 font-semibold whitespace-nowrap text-right w-24">Less Wt</th>
                              <th className="py-2 px-1.5 font-semibold whitespace-nowrap text-right w-24">Net Wt</th>
                              {billMetal !== "Silver" && <th className="p-2 font-semibold whitespace-nowrap text-right w-24">HMC (₹)</th>}
                              <th className="py-2 px-1.5 font-semibold whitespace-nowrap text-right w-28">Rate(₹/g)</th>
                              <th className="py-2 px-1.5 font-semibold whitespace-nowrap text-right w-36">Making Charge</th>
                              <th className="py-2 px-2 font-semibold whitespace-nowrap text-right w-28">Total (₹)</th>
                              <th className="w-10" />
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((it, i) => {
                              const c = calcItem(it, isGst);
                              return (
                                <tr key={i} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                                  <td className="p-2 min-w-36 space-y-1.5 align-top">
                                    <Input value={it.name} onChange={(e) => updateItem(i, { name: e.target.value })} className="h-8 text-sm font-medium" placeholder="Item Name" />
                                    {billMetal !== "Silver" && (
                                      <Input value={it.purity} onChange={(e) => updateItem(i, { purity: e.target.value })} className="h-7 text-xs" placeholder="Purity (e.g. 22K)" />
                                    )}
                                  </td>
                                  {billMetal !== "Silver" && (
                                    <td className="p-2">
                                      <Input value={it.huid || ""} onChange={(e) => updateItem(i, { huid: e.target.value })} className="h-8 text-sm" placeholder="HUID" />
                                    </td>
                                  )}
                                  <td className="py-1.5 px-1.5">
                                    <NumI v={it.qty} on={(v) => updateItem(i, recalcMaking(it, { qty: v }))} className="w-16 h-8 bg-background text-right" />
                                  </td>
                                  <td className="py-1.5 px-1.5">
                                    <NumI
                                      v={(it as any).grossWeight !== undefined ? (it as any).grossWeight : it.netWeight}
                                      on={(v) => {
                                        const stWt = (it as any).stoneWeight || 0;
                                        const net = Math.max(0, v - stWt);
                                        updateItem(i, recalcMaking(it, { grossWeight: v, netWeight: net }));
                                      }}
                                      className="w-20 h-8 bg-background text-right"
                                    />
                                  </td>
                                  <td className="py-1.5 px-1.5">
                                    <NumI
                                      v={(it as any).stoneWeight || 0}
                                      on={(v) => {
                                        const grWt = (it as any).grossWeight !== undefined ? (it as any).grossWeight : it.netWeight;
                                        const net = Math.max(0, grWt - v);
                                        updateItem(i, recalcMaking(it, { stoneWeight: v, netWeight: net }));
                                      }}
                                      className="w-20 h-8 bg-background text-right"
                                    />
                                  </td>
                                  <td className="py-1.5 px-1.5">
                                    <NumI
                                      v={it.netWeight}
                                      on={(v) => {
                                        updateItem(i, recalcMaking(it, { netWeight: v, grossWeight: v + ((it as any).stoneWeight || 0) }));
                                      }}
                                      className="w-20 h-8 bg-background text-right"
                                    />
                                  </td>
                                  {billMetal !== "Silver" && (
                                    <td className="p-2">
                                      <NumI v={it.hmc || 0} on={(v) => updateItem(i, { hmc: v })} className="w-24 h-8 bg-background text-right" />
                                    </td>
                                  )}
                                  <td className="py-1.5 px-1.5">
                                    <NumI
                                      v={it.ratePerGram}
                                      on={(v) => {
                                        updateItem(i, recalcMaking(it, { ratePerGram: v }));
                                      }}
                                      className="w-24 h-8 bg-background text-right"
                                    />
                                  </td>
                                  <td className="py-1.5 px-1.5 space-y-1">
                                    <Select
                                      value={it.makingChargeType || "PERCENTAGE"}
                                      onValueChange={(val: MakingChargeType) => {
                                        const value = it.makingChargeValue ?? it.makingChargePct ?? 0;
                                        const patch: any = { makingChargeType: val };
                                        patch.makingChargePct = val === "PERCENTAGE" ? value : 0;
                                        updateItem(i, recalcMaking(it, patch));
                                      }}
                                    >
                                      <SelectTrigger className="w-28 h-7 bg-background text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="PERCENTAGE">% of value</SelectItem>
                                        <SelectItem value="PER_GRAM">₹ / gram</SelectItem>
                                        <SelectItem value="WASTAGE">Wastage %</SelectItem>
                                        <SelectItem value="PER_PIECE">₹ / piece</SelectItem>
                                        <SelectItem value="FIXED">Fixed ₹</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <NumI
                                      v={it.makingChargeValue ?? it.makingChargePct ?? 0}
                                      on={(v) => {
                                        const patch: any = { makingChargeValue: v };
                                        if ((it.makingChargeType || "PERCENTAGE") === "PERCENTAGE") patch.makingChargePct = v;
                                        updateItem(i, recalcMaking(it, patch));
                                      }}
                                      className="w-28 h-8 bg-background text-right"
                                      onKeyDown={
                                        i === items.length - 1
                                          ? (e) => {
                                              if (e.key !== "Enter") return;
                                              e.preventDefault();
                                              e.stopPropagation();
                                              productSearchRef.current?.focus();
                                            }
                                          : undefined
                                      }
                                    />
                                  </td>
                                  <td className="py-1.5 px-2 text-right font-medium">{inr(c.line)}</td>
                                  <td className="py-1.5 text-right">
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => removeItem(i)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
              </div>

              {/* 3. Payment Summary */}
              <div className="p-4 border rounded-lg bg-muted/10 space-y-3">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">3</span>
                  Payment Summary
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="text-sm text-muted-foreground bg-background p-4 rounded-lg border border-border">
                    <p className="font-medium text-foreground mb-2">Billing Instructions:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Verify the customer and item details before generating.</li>
                      <li>Any discount or old gold amount entered will be deducted from the subtotal.</li>
                      <li>GST is calculated automatically if 'GST Invoice' is selected.</li>
                    </ul>
                  </div>
                  <div className="space-y-3 text-sm bg-background p-4 rounded-lg border border-border shadow-sm">
                    <Row label="Subtotal" v={inr(totals.subtotal)} />
                    
                    <div className="flex items-center justify-between gap-4">
                      <Label className="text-muted-foreground font-normal">Discount (₹)</Label>
                      <Input type="number" className="w-32 h-8 text-right bg-background" value={discount} onChange={(e) => setDiscount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0" />
                    </div>
                    
                    <div className="space-y-2 py-0.5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-muted-foreground font-normal">
                            {oldMetalType === "Gold" ? "Old Gold (₹)" : oldMetalType === "Silver" ? "Old Silver (₹)" : "Old Metal"}
                          </Label>
                          <Select value={oldMetalType} onValueChange={(val: "Gold" | "Silver" | "Mixed") => {
                            setOldMetalType(val);
                            if (val === "Gold") setOldSilverAmount("");
                            if (val === "Silver") setOldGoldAmount("");
                          }}>
                            <SelectTrigger className="w-22 h-8 bg-background text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Gold">Gold</SelectItem>
                              <SelectItem value="Silver">Silver</SelectItem>
                              <SelectItem value="Mixed">Mixed</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[10px] text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                            onClick={() => setOpenOldGoldCalc(true)}
                            title="Open Scrap Metal Trade-In Calculator"
                          >
                            <Calculator className="w-3 h-3 mr-1 text-amber-600" /> Calc
                          </Button>
                        </div>
                        
                        {oldMetalType === "Gold" && (
                          <Input
                            type="number"
                            className="w-32 h-8 text-right bg-background font-medium"
                            value={oldGoldAmount}
                            onChange={(e) => setOldGoldAmount(e.target.value === "" ? "" : Number(e.target.value))}
                            placeholder="0"
                          />
                        )}

                        {oldMetalType === "Silver" && (
                          <Input
                            type="number"
                            className="w-32 h-8 text-right bg-background font-medium"
                            value={oldSilverAmount}
                            onChange={(e) => setOldSilverAmount(e.target.value === "" ? "" : Number(e.target.value))}
                            placeholder="0"
                          />
                        )}
                      </div>

                      {oldMetalType === "Mixed" && (
                        <div className="bg-amber-50/60 rounded-md border border-amber-200/80 p-2.5 space-y-2 text-xs mt-1">
                          <div className="flex items-center justify-between gap-4">
                            <Label className="text-amber-900 font-medium">Old Gold (₹)</Label>
                            <Input
                              type="number"
                              className="w-28 h-7 text-right bg-background font-medium"
                              value={oldGoldAmount}
                              onChange={(e) => setOldGoldAmount(e.target.value === "" ? "" : Number(e.target.value))}
                              placeholder="0"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <Label className="text-amber-900 font-medium">Old Silver (₹)</Label>
                            <Input
                              type="number"
                              className="w-28 h-7 text-right bg-background font-medium"
                              value={oldSilverAmount}
                              onChange={(e) => setOldSilverAmount(e.target.value === "" ? "" : Number(e.target.value))}
                              placeholder="0"
                            />
                          </div>
                          {((Number(oldGoldAmount) || 0) > 0 || (Number(oldSilverAmount) || 0) > 0) && (
                            <div className="flex items-center justify-between font-semibold text-amber-950 pt-1 border-t border-amber-200/80">
                              <span>Total Metal Exchange:</span>
                              <span>{inr((Number(oldGoldAmount) || 0) + (Number(oldSilverAmount) || 0))}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {isGst && (
                      <>
                        <Row label="CGST @ 1.5%" v={inr(totals.cgst)} />
                        <Row label="SGST @ 1.5%" v={inr(totals.sgst)} />
                      </>
                    )}
                    
                    <Row label="Round Off" v={inr(totals.roundOff)} />
                    
                    <div className="border-t pt-4 mt-2 flex justify-between items-center font-display text-xl text-primary">
                      <span>Grand Total</span>
                      <span>{inr(totals.gTotal)}</span>
                    </div>

                    <div className="bg-muted/40 p-3.5 rounded-lg border border-border space-y-3 mt-3">
                      {(linkedOrderId && (() => {
                        const linkedOrder = orders.find(o => (o._id || o.id) === linkedOrderId || `order_${o._id || o.id}` === linkedOrderId);
                        const linkedRepair = repairs.find(r => `repair_${r._id || r.id}` === linkedOrderId);
                        return (linkedOrder && (linkedOrder.advancePaid || 0) > 0) || (linkedRepair && (linkedRepair.advance || 0) > 0);
                      })()) && (
                        <Row 
                          label={
                            (() => {
                              const linkedOrder = orders.find(o => (o._id || o.id) === linkedOrderId || `order_${o._id || o.id}` === linkedOrderId);
                              if (linkedOrder) return `Order Advance (${linkedOrder.orderNo})`;
                              const linkedRepair = repairs.find(r => `repair_${r._id || r.id}` === linkedOrderId);
                              if (linkedRepair) return `Repair Advance (${linkedRepair.ticketNo})`;
                              return "Advance";
                            })()
                          }
                          v={`- ${inr(
                            (() => {
                              const linkedOrder = orders.find(o => (o._id || o.id) === linkedOrderId || `order_${o._id || o.id}` === linkedOrderId);
                              if (linkedOrder) return linkedOrder.advancePaid || 0;
                              const linkedRepair = repairs.find(r => `repair_${r._id || r.id}` === linkedOrderId);
                              if (linkedRepair) return linkedRepair.advance || 0;
                              return 0;
                            })()
                          )}`} 
                          valueClassName="text-green-600" 
                        />
                      )}
                      <div className="flex items-center justify-between gap-4">
                        <Label className="text-muted-foreground font-normal">Cash Amount</Label>
                        <Input type="number" className="w-32 h-8 text-right bg-background" value={cashAmount} onChange={(e) => setCashAmount(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)} placeholder="0" />
                      </div>
                      
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <Label className="text-muted-foreground font-normal">Online Amount</Label>
                          <Select value={onlineMode} onValueChange={setOnlineMode}>
                            <SelectTrigger className="w-24 h-8 bg-background text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(["UPI", "Card", "Bank", "EMI"] as const).map((m) => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input type="number" className="w-32 h-8 text-right bg-background" value={onlineAmount} onChange={(e) => setOnlineAmount(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)} placeholder="0" />
                      </div>

                      {(() => {
                        let currentPaid = 0;
                        const linkedOrder = orders.find(o => (o._id || o.id) === linkedOrderId || `order_${o._id || o.id}` === linkedOrderId);
                        const linkedRepair = repairs.find(r => `repair_${r._id || r.id}` === linkedOrderId);
                        const orderAdv = linkedOrder ? (linkedOrder.advancePaid || 0) : linkedRepair ? (linkedRepair.advance || 0) : 0;
                        currentPaid = (Number(cashAmount) || 0) + (Number(onlineAmount) || 0) + orderAdv;
                        const currentDue = Math.max(0, totals.gTotal - currentPaid);
                        const overpaid = currentPaid - totals.gTotal;
                        return (
                          <>
                            <Row
                              label="Balance Due"
                              v={inr(currentDue)}
                              valueClassName={currentDue > 0 ? "text-rose-600" : "text-green-600"}
                            />
                            {overpaid > 0 && (
                              <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-2 py-1.5 mt-1">
                                Amount is wrong: entered {inr(currentPaid)} is {inr(overpaid)} more than the Grand Total.
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    
                    <div className="bg-muted/40 p-3.5 rounded-lg border border-border mt-3">
                      <Label className="text-muted-foreground font-normal block mb-3">Signatures (Optional)</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Customer Signature</Label>
                          <Input type="file" accept="image/*" className="bg-background mt-1" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => setCustomerSignature(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }} />
                          {customerSignature && <img src={customerSignature} alt="Customer Signature" className="mt-2 h-16 object-contain" />}
                        </div>
                        <div>
                          <Label className="text-xs">Authorized Signatory</Label>
                          <Input type="file" accept="image/*" className="bg-background mt-1" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => setAuthorizedSignatory(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }} />
                          {authorizedSignatory && <img src={authorizedSignatory} alt="Authorized Signatory" className="mt-2 h-16 object-contain" />}
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="w-full mt-2" size="lg" disabled={items.length === 0 || !customerId}>
                      <Plus className="w-4 h-4 mr-2" /> {editingId ? "Save Changes" : "Generate Invoice"}
                    </Button>
              </div>
            </div>
              </div>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      </div>

      {/* ═══════════════════════════════════════════════════════════
           KPI CARDS
      ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-5">
        <div className="relative overflow-hidden rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50 p-2.5 sm:p-4 shadow-2xs">
          <div className="hidden sm:flex absolute top-3 right-3 w-8 h-8 bg-amber-100 rounded-lg items-center justify-center">
            <Receipt className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-[10px] sm:text-xs font-semibold text-amber-700/90 uppercase tracking-wider truncate">Total Bills</p>
          <p className="text-xl sm:text-3xl font-display font-bold text-amber-950 mt-0.5 sm:mt-1">{roleInvoices.length}</p>
          <p className="text-[9px] sm:text-[11px] text-amber-600/70 mt-0.5 truncate hidden sm:block">All time records</p>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-blue-200/60 bg-gradient-to-br from-blue-50 to-indigo-50 p-2.5 sm:p-4 shadow-2xs">
          <div className="hidden sm:flex absolute top-3 right-3 w-8 h-8 bg-blue-100 rounded-lg items-center justify-center">
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-[10px] sm:text-xs font-semibold text-blue-700/90 uppercase tracking-wider truncate">Today's</p>
          <p className="text-xl sm:text-3xl font-display font-bold text-blue-950 mt-0.5 sm:mt-1">{todayInvoices.length}</p>
          <p className="text-[9px] sm:text-[11px] text-blue-600/70 mt-0.5 truncate hidden sm:block">{new Date().toLocaleDateString('en-IN', { weekday: 'short' })}</p>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-green-50 p-2.5 sm:p-4 shadow-2xs">
          <div className="hidden sm:flex absolute top-3 right-3 w-8 h-8 bg-emerald-100 rounded-lg items-center justify-center">
            <Calculator className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-[10px] sm:text-xs font-semibold text-emerald-700/90 uppercase tracking-wider truncate">Revenue</p>
          <p className="text-base sm:text-2xl font-display font-bold text-emerald-950 mt-0.5 sm:mt-1 font-mono truncate">{inr(todayRevenue)}</p>
          <p className="text-[9px] sm:text-[11px] text-emerald-600/70 mt-0.5 truncate hidden sm:block">Collected today</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-10 h-11 w-full bg-background border-border/70 shadow-sm rounded-xl text-sm placeholder:text-muted-foreground/60 focus-visible:ring-amber-500/30"
          placeholder="Search by invoice no., customer name, mobile or address…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-xs font-medium">
            Clear
          </button>
        )}
      </div>

      {(isOperator ? [{ title: "Estimate Order History", data: nonGstInvoices }] : [
        { title: "GST Invoice History", data: gstInvoices }
      ]).map(({ title, data }, index) => {
        const returnedInvoiceIds = new Set(salesReturns.map((r: any) => r.invoiceId));
        let tableData = data;
        const totalPages = Math.ceil(tableData.length / 10) || 1;
        const currentPage = Math.min(pages[index] || 1, totalPages);
        const paginated = tableData.slice((currentPage - 1) * 10, currentPage * 10);

        return (
        <Card key={title} className={`overflow-hidden shadow-sm border-border/60 ${index === 0 ? "mb-6" : ""}`}>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/20 border-b border-border/60 py-4 px-5">
            <CardTitle className="font-display flex items-center gap-2 text-lg">
              <span className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <Receipt className="w-3.5 h-3.5 text-amber-700" />
              </span>
              {title}
              <span className="ml-1 text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{tableData.length}</span>
            </CardTitle>
            {title === "Estimate Order History" && (
              <div className="flex bg-background p-1 rounded-lg border border-border shadow-sm">
                {(["All", "INV", "MAN"] as const).map((f) => (
                  <button
                    key={f}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      nonGstFilter === f
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                    onClick={() => setNonGstFilter(f)}
                  >
                    {f === "All" ? "All" : f === "INV" ? "Invoices" : "Manual Dues"}
                  </button>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {tableData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                  <Receipt className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No invoices found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your search or create a new invoice.</p>
              </div>
            ) : (
            <div>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full text-sm min-w-[750px]">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-3 px-4 font-semibold text-left whitespace-nowrap">Invoice #</th>
                      <th className="py-3 px-4 font-semibold text-left whitespace-nowrap">Date</th>
                      <th className="py-3 px-4 font-semibold text-left">Customer</th>
                      {title === "Estimate Order History" && <th className="py-3 px-4 font-semibold text-left whitespace-nowrap">Type</th>}
                      <th className="py-3 px-4 font-semibold text-left whitespace-nowrap">Mode</th>
                      <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Total</th>
                      <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Balance Due</th>
                      <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">Status</th>
                      <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {paginated.map((i) => (
                      <tr key={i._id || i.id} className="hover:bg-amber-50/40 transition-colors group">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded">{i.number}</span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-muted-foreground text-xs">{formatDate(i.createdAt)}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{i.customerName}</div>
                          {i.customerMobile && <div className="text-[11px] text-muted-foreground">{i.customerMobile}</div>}
                        </td>
                        {title === "Estimate Order History" && (
                          <td className="py-3 px-4 whitespace-nowrap">
                            {i.number?.startsWith("MAN-") ? (
                              <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">Manual Due</span>
                            ) : (
                              <span className="bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">Invoice</span>
                            )}
                          </td>
                        )}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">{i.paymentMode}</span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className="font-bold text-emerald-700">{inr(i.total)}</span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {(i.balanceDue || 0) > 0
                            ? <span className="font-semibold text-rose-600">{inr(i.balanceDue)}</span>
                            : <span className="text-muted-foreground/40 text-xs">—</span>}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex flex-col items-center gap-1">
                          {(i.balanceDue || 0) <= 0 ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Due
                            </span>
                          )}
                          {returnedInvoiceIds.has(i._id || i.id) && (
                            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 border border-orange-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />Returned
                            </span>
                          )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex justify-end items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="outline" className="h-7 w-7 border-emerald-500/40 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800" onClick={() => handleSendInvoiceWhatsApp(i)} title="Send Bill on WhatsApp">
                              <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-[11px] font-semibold px-2.5 border-border/60 hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50" onClick={() => setViewing(i)}>
                              <Printer className="w-3 h-3 mr-1" /> View
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-blue-50 hover:text-blue-600" onClick={() => editInvoice(i)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-rose-50 hover:text-rose-600" onClick={() => removeInvoice(i)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden grid grid-cols-1 gap-3 p-3">
                {paginated.map((i) => (
                  <div key={i._id || i.id} className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
                    <div className="flex items-start justify-between gap-2 p-3.5 border-b border-border/40 bg-muted/20">
                      <div>
                        <div className="font-mono text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded inline-block">{i.number}</div>
                        <div className="font-bold text-foreground text-base mt-1">{i.customerName}</div>
                        {i.customerMobile && <div className="text-[11px] text-muted-foreground">{i.customerMobile}</div>}
                      </div>
                      {(i.balanceDue || 0) <= 0 ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Due: {inr(i.balanceDue || 0)}
                        </span>
                      )}
                      {returnedInvoiceIds.has(i._id || i.id) && (
                        <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />Returned
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="text-[11px] text-muted-foreground mb-2 truncate" title={i.items?.map((it: any) => it.name).join(", ")}>
                        📦 {i.items?.map((it: any) => it.name).join(", ") || "Custom Item"}
                      </div>
                      <div className="grid grid-cols-3 gap-2 bg-muted/30 rounded-lg p-2 text-center text-xs mb-3">
                        <div><div className="text-[10px] text-muted-foreground uppercase font-semibold">Mode</div><div className="font-semibold mt-0.5">{i.paymentMode}</div></div>
                        <div><div className="text-[10px] text-muted-foreground uppercase font-semibold">Items</div><div className="font-semibold mt-0.5">{i.items?.length || 0}</div></div>
                        <div><div className="text-[10px] text-muted-foreground uppercase font-semibold">Total</div><div className="font-bold text-emerald-700 mt-0.5">{inr(i.total)}</div></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] text-muted-foreground">{formatDate(i.createdAt)}</div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="outline" className="h-7 w-7 border-emerald-500/40 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" onClick={() => handleSendInvoiceWhatsApp(i)} title="Send Bill on WhatsApp">
                            <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => setViewing(i)}><Printer className="w-3 h-3 mr-1" />View</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => editInvoice(i)}><Pencil className="w-3 h-3 mr-1" />Edit</Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50" onClick={() => removeInvoice(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border/60 bg-muted/10">
                  <div className="text-xs text-muted-foreground">
                    Showing <span className="font-semibold text-foreground">{(currentPage - 1) * 10 + 1}–{Math.min(currentPage * 10, tableData.length)}</span> of <span className="font-semibold text-foreground">{tableData.length}</span> invoices
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => setPages(p => ({ ...p, [index]: Math.max(1, currentPage - 1) }))} disabled={currentPage === 1}>← Prev</Button>
                    <span className="text-xs font-semibold text-muted-foreground px-2">{currentPage} / {totalPages}</span>
                    <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => setPages(p => ({ ...p, [index]: Math.min(totalPages, currentPage + 1) }))} disabled={currentPage === totalPages}>Next →</Button>
                  </div>
                </div>
              )}
            </div>
          )}
          </CardContent>
        </Card>
      )})}
      </div>

      {/* OLD GOLD/SILVER TRADE-IN CALCULATOR MODAL */}
      <Dialog open={openOldGoldCalc} onOpenChange={setOpenOldGoldCalc}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-600" /> Scrap Metal Trade-in Calculator
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs pt-1">
            <div className="flex items-center justify-between gap-2 bg-muted/40 p-2 rounded-lg border border-border">
              <Label className="text-xs font-semibold">Metal Category:</Label>
              <Select value={oldCalcMetal} onValueChange={(v: "Gold" | "Silver" | "Mixed") => setOldCalcMetal(v)}>
                <SelectTrigger className="w-32 h-8 bg-background text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gold">Gold</SelectItem>
                  <SelectItem value="Silver">Silver</SelectItem>
                  <SelectItem value="Mixed">Mixed (Both)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(oldCalcMetal === "Gold" || oldCalcMetal === "Mixed") && (
              <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200/80 space-y-2">
                <div className="font-bold text-amber-900">Gold Scrap Details</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Gross Wt (g)</Label>
                    <Input
                      type="number"
                      value={oldGoldForm.grossWeight || ""}
                      onChange={(e) => setOldGoldForm({ ...oldGoldForm, grossWeight: Number(e.target.value) })}
                      placeholder="10.5"
                      className="mt-0.5 h-7 bg-background text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Melting Loss (g)</Label>
                    <Input
                      type="number"
                      value={oldGoldForm.lossWeight || ""}
                      onChange={(e) => setOldGoldForm({ ...oldGoldForm, lossWeight: Number(e.target.value) })}
                      placeholder="0.5"
                      className="mt-0.5 h-7 bg-background text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Touch Purity %</Label>
                    <Input
                      type="number"
                      value={oldGoldForm.purityPct || ""}
                      onChange={(e) => setOldGoldForm({ ...oldGoldForm, purityPct: Number(e.target.value) })}
                      placeholder="91.6"
                      className="mt-0.5 h-7 bg-background text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Scrap Rate (₹/g)</Label>
                    <Input
                      type="number"
                      value={oldGoldForm.scrapRate || ""}
                      onChange={(e) => setOldGoldForm({ ...oldGoldForm, scrapRate: Number(e.target.value) })}
                      placeholder="7100"
                      className="mt-0.5 h-7 bg-background text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {(oldCalcMetal === "Silver" || oldCalcMetal === "Mixed") && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800">Silver Scrap Details</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Gross Wt (g)</Label>
                    <Input
                      type="number"
                      value={oldSilverForm.grossWeight || ""}
                      onChange={(e) => setOldSilverForm({ ...oldSilverForm, grossWeight: Number(e.target.value) })}
                      placeholder="100"
                      className="mt-0.5 h-7 bg-background text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Melting Loss (g)</Label>
                    <Input
                      type="number"
                      value={oldSilverForm.lossWeight || ""}
                      onChange={(e) => setOldSilverForm({ ...oldSilverForm, lossWeight: Number(e.target.value) })}
                      placeholder="2"
                      className="mt-0.5 h-7 bg-background text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Touch Purity %</Label>
                    <Input
                      type="number"
                      value={oldSilverForm.purityPct || ""}
                      onChange={(e) => setOldSilverForm({ ...oldSilverForm, purityPct: Number(e.target.value) })}
                      placeholder="80"
                      className="mt-0.5 h-7 bg-background text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Scrap Rate (₹/g)</Label>
                    <Input
                      type="number"
                      value={oldSilverForm.scrapRate || ""}
                      onChange={(e) => setOldSilverForm({ ...oldSilverForm, scrapRate: Number(e.target.value) })}
                      placeholder="85"
                      className="mt-0.5 h-7 bg-background text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {(() => {
              const goldNet = Math.max(0, (oldGoldForm.grossWeight || 0) - (oldGoldForm.lossWeight || 0));
              const goldPure = (goldNet * (oldGoldForm.purityPct || 0)) / 100;
              const goldValuation = Math.round(goldPure * (oldGoldForm.scrapRate || 0));

              const silverNet = Math.max(0, (oldSilverForm.grossWeight || 0) - (oldSilverForm.lossWeight || 0));
              const silverPure = (silverNet * (oldSilverForm.purityPct || 0)) / 100;
              const silverValuation = Math.round(silverPure * (oldSilverForm.scrapRate || 0));

              const totalValuation =
                oldCalcMetal === "Gold" ? goldValuation : oldCalcMetal === "Silver" ? silverValuation : goldValuation + silverValuation;

              return (
                <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-200 space-y-1.5 mt-3 text-xs">
                  {oldCalcMetal !== "Silver" && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Gold Scrap Credit:</span>
                      <span className="font-semibold text-foreground">{inr(goldValuation)}</span>
                    </div>
                  )}
                  {oldCalcMetal !== "Gold" && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Silver Scrap Credit:</span>
                      <span className="font-semibold text-foreground">{inr(silverValuation)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-amber-900 border-t border-amber-200 pt-1.5">
                    <span>Total Calculated Trade-in:</span>
                    <span>{inr(totalValuation)}</span>
                  </div>

                  <Button
                    type="button"
                    className="w-full mt-3 bg-amber-700 hover:bg-amber-800 text-white h-8"
                    onClick={() => {
                      if (oldCalcMetal === "Gold") {
                        setOldGoldAmount(goldValuation);
                        setOldSilverAmount("");
                        setOldMetalType("Gold");
                      } else if (oldCalcMetal === "Silver") {
                        setOldSilverAmount(silverValuation);
                        setOldGoldAmount("");
                        setOldMetalType("Silver");
                      } else {
                        setOldGoldAmount(goldValuation);
                        setOldSilverAmount(silverValuation);
                        setOldMetalType("Mixed");
                      }
                      setOpenOldGoldCalc(false);
                      toast.success(`Applied ${inr(totalValuation)} Metal Trade-in Credit`);
                    }}
                  >
                    Apply {inr(totalValuation)} Credit to Billing
                  </Button>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* MANUAL DUE ENTRY DIALOG */}
      <Dialog open={manualDueOpen} onOpenChange={setManualDueOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-display flex items-center gap-2">
              <NotebookPen className="w-5 h-5 text-amber-600" />
              Add Manual Due Record
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); saveManualDue(); }} className="space-y-3 py-2 text-sm">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Customer *</Label>
              <Select
                value={manualDue.customerId}
                onValueChange={(val) => {
                  if (val === "NEW") {
                    setManualDue(prev => ({ ...prev, customerId: "NEW" }));
                  } else {
                    const c = customers.find(x => (x._id || x.id) === val);
                    if (c) {
                      setManualDue(prev => ({
                        ...prev,
                        customerId: val,
                        customerName: c.name,
                        phone: c.mobile || c.phone || "",
                      }));
                    }
                  }
                }}
              >
                <SelectTrigger className="bg-background mt-1">
                  <SelectValue placeholder="Select or create new customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW" className="font-semibold text-primary">+ New Customer</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c._id || c.id} value={c._id || c.id}>
                      {c.name} · {c.mobile || c.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Customer Name *</Label>
              <Input
                value={manualDue.customerName}
                onChange={(e) => setManualDue({ ...manualDue, customerName: e.target.value })}
                placeholder="Enter customer name"
                className="mt-1 bg-background"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Mobile Number</Label>
              <Input
                value={manualDue.phone}
                onChange={(e) => setManualDue({ ...manualDue, phone: e.target.value })}
                placeholder="Enter mobile number"
                className="mt-1 bg-background"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Item Name / Reason *</Label>
              <Input
                value={manualDue.itemName}
                onChange={(e) => setManualDue({ ...manualDue, itemName: e.target.value })}
                placeholder="e.g. Old Bahi-Khata Pending Balance"
                className="mt-1 bg-background"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Due Amount (₹) *</Label>
              <Input
                type="number"
                value={manualDue.dueAmount}
                onChange={(e) => setManualDue({ ...manualDue, dueAmount: e.target.value ? Number(e.target.value) : "" })}
                placeholder="e.g. 15000"
                className="mt-1 font-mono font-bold bg-background"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Date (DD/MM/YYYY)</Label>
              <Input
                type="text"
                value={manualDue.date}
                onChange={(e) => setManualDue({ ...manualDue, date: e.target.value })}
                placeholder="DD/MM/YYYY"
                className="mt-1 bg-background"
              />
            </div>

            <DialogFooter className="mt-4 pt-2">
              <Button type="button" variant="outline" onClick={() => setManualDueOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold">
                Save Manual Due
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* WHATSAPP INVOICE SEND MODAL */}
      <Dialog open={waInvModalOpen} onOpenChange={setWaInvModalOpen}>
        <DialogContent className="max-w-md p-4 sm:p-6" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-display flex items-center gap-2 text-emerald-700">
              <WhatsAppIcon className="w-5 h-5 text-emerald-600 shrink-0" />
              Send Invoice Bill on WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            {waInvItem && (
              <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200/80 flex justify-between items-center">
                <div>
                  <div className="font-bold text-emerald-950 text-sm">{waInvItem.number}</div>
                  <div className="text-muted-foreground">{waInvItem.customerName} • {inr(waInvItem.total)}</div>
                </div>
                <div className="font-semibold px-2 py-0.5 rounded bg-emerald-200/60 text-emerald-800 text-[10px]">
                  {waInvItem.paymentMode}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Customer Mobile Number *</Label>
              <div className="flex gap-2">
                <span className="inline-flex items-center px-3 rounded-md border border-input bg-muted text-xs text-muted-foreground font-semibold">
                  +91
                </span>
                <Input
                  className="text-xs"
                  placeholder="Enter 10-digit mobile number"
                  value={waInvPhone}
                  onChange={(e) => setWaInvPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Message Preview</Label>
              <textarea
                rows={7}
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs font-mono leading-relaxed resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={waInvMessage}
                onChange={(e) => setWaInvMessage(e.target.value)}
              />
              <p className="text-[11px] font-medium text-emerald-800 bg-emerald-50/80 p-2 rounded border border-emerald-200 mt-1">
                🚀 Opens WhatsApp chat directly for the target customer with bill summary & digital receipt link!
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setWaInvModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={() => {
                if (!waInvPhone.trim()) {
                  toast.error("Please enter customer's mobile number.");
                  return;
                }
                let clean = waInvPhone.replace(/\D/g, "");
                if (clean.length === 10) clean = "91" + clean;
                if (clean.length < 10) {
                  toast.error("Please enter a valid 10-digit mobile number.");
                  return;
                }
                const encoded = encodeURIComponent(waInvMessage);
                window.open(`https://wa.me/${clean}?text=${encoded}`, "_blank");
                toast.success("WhatsApp chat opened!");
                setWaInvModalOpen(false);
              }}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" /> Send Invoice on WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewing && <InvoiceModal inv={viewing} isReturned={new Set(salesReturns.map((r: any) => r.invoiceId)).has((viewing as any)._id || (viewing as any).id)} onClose={() => setViewing(null)} onSendWhatsApp={handleSendInvoiceWhatsApp} />}
    </Layout>
  );
}

function Row({ label, v, className, valueClassName }: { label: string; v: string; className?: string; valueClassName?: string }) {
  return (
    <div className={`flex justify-between items-center ${className || ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${valueClassName || ""}`}>{v}</span>
    </div>
  );
}

function NumI({ v, on, className = "w-24 h-8", onKeyDown }: { v: number; on: (n: number) => void; className?: string; onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void }) {
  const safeV = v ?? 0;
  const [val, setVal] = useState(safeV === 0 ? "" : safeV.toString());

  // Update local state if the prop changes externally (e.g., reset)
  useEffect(() => {
    setVal((prev) => {
      const parsedPrev = parseFloat(prev);
      if (parsedPrev === safeV || (prev === "" && safeV === 0)) {
        return prev;
      }
      return safeV === 0 ? "" : safeV.toString();
    });
  }, [safeV]);

  return (
    <Input
      type="number"
      className={className}
      value={val}
      onBlur={() => {
        if (val === "" || isNaN(parseFloat(val))) {
          setVal("");
          on(0);
        }
      }}
      onChange={(e) => {
        setVal(e.target.value);
        const parsed = parseFloat(e.target.value);
        if (!isNaN(parsed)) {
          on(parsed);
        } else if (e.target.value === "") {
          on(0);
        }
      }}
      onKeyDown={onKeyDown}
    />
  );
}




function InvoiceModal({ inv, onClose, isReturned, onSendWhatsApp }: { inv: any; onClose: () => void; isReturned?: boolean; onSendWhatsApp?: (inv: any) => void }) {
  const { tenantSession } = useAuth();
  const invSettings: InvoiceSettings = { ...defaultInvoiceSettings, ...((tenantSession?.shop as any)?.invoiceSettings || {}) };

  // Theme color helpers based on saved InvoiceSettings
  const themeAccent = (() => {
    switch (invSettings.themeColor) {
      case "purple": return { border: "border-purple-700", bg: "bg-purple-100", text: "text-purple-900", headerText: "text-purple-900", th: "bg-purple-100 text-purple-900 border-purple-300" };
      case "emerald": return { border: "border-emerald-700", bg: "bg-emerald-100", text: "text-emerald-900", headerText: "text-emerald-900", th: "bg-emerald-100 text-emerald-900 border-emerald-300" };
      case "blue": return { border: "border-blue-700", bg: "bg-blue-100", text: "text-blue-900", headerText: "text-blue-900", th: "bg-blue-100 text-blue-900 border-blue-300" };
      case "slate": return { border: "border-slate-900", bg: "bg-slate-200", text: "text-slate-900", headerText: "text-slate-900", th: "bg-slate-200 text-slate-900 border-slate-400" };
      case "gold":
      default: return { border: "border-amber-600", bg: "bg-amber-100", text: "text-amber-900", headerText: "text-amber-900", th: "bg-amber-100 text-amber-900 border-amber-300" };
    }
  })();

  const [printMode, setPrintMode] = useState<"a4" | "premium_a4" | "luxury" | "modern" | "a5" | "estimate" | "thermal58" | "thermal78">("a4");
  const pageCss =
    printMode === "a4" || printMode === "premium_a4" || printMode === "luxury" || printMode === "modern"
      ? `@page { size: A4; margin: 4mm; } body { zoom: 0.9; }`
      : printMode === "a5"
      ? `@page { size: A5; margin: 3mm; } body { zoom: 0.95; }`
      : printMode === "estimate"
      ? `@page { size: A4; margin: 4mm; } body { zoom: 0.9; }`
      : `@page { size: ${printMode === "thermal58" ? "58mm" : "78mm"} auto; margin: 2mm; } body { zoom: 1; }`;

  return (
    <div className="print-section fixed inset-0 z-100 bg-black/50 flex justify-center items-start p-2 sm:p-4 print:static print:block print:bg-white print:p-0 print:overflow-visible print:h-auto overflow-y-auto pointer-events-auto">
      <div className={`bg-white w-full rounded-lg shadow-xl print:shadow-none print:max-w-none text-slate-900 my-auto relative flex flex-col max-h-[95vh] print:my-0 print:max-h-none print:block ${printMode === "thermal58" || printMode === "thermal78" ? "max-w-xs" : printMode === "a5" ? "max-w-2xl" : "max-w-4xl"}`}>
        <style>{`@media print { ${pageCss} }`}</style>

        {/* RETURNED Watermark Overlay — covers all template modes */}
        {isReturned && (() => {
          const isThermal = printMode === "thermal58" || printMode === "thermal78";
          const fontSize = isThermal ? '2rem' : '6rem';
          const borderWidth = isThermal ? '3px' : '6px';
          return (
            <div
              className="pointer-events-none select-none absolute inset-0 flex items-center justify-center z-20 print:flex"
              style={{ transform: 'rotate(-35deg)' }}
            >
              <span
                style={{
                  fontSize,
                  fontWeight: 900,
                  color: 'rgba(220, 38, 38, 0.18)',
                  letterSpacing: '0.08em',
                  whiteSpace: 'nowrap',
                  border: `${borderWidth} solid rgba(220, 38, 38, 0.18)`,
                  padding: '0.25em 0.6em',
                  borderRadius: '0.2em',
                  lineHeight: 1,
                  userSelect: 'none',
                }}
              >
                RETURNED
              </span>
            </div>
          );
        })()}

        {printMode === "thermal58" || printMode === "thermal78" ? (
          <div className="p-4 print:p-0 overflow-y-auto flex-1 print:overflow-visible flex justify-center">
            <ThermalInvoiceReceipt inv={inv} widthMm={printMode === "thermal58" ? 58 : 78} />
          </div>
        ) : printMode === "a5" ? (
          <div className="p-4 print:p-0 overflow-y-auto flex-1 print:overflow-visible">
            <CompactA5Invoice inv={inv} />
          </div>
        ) : printMode === "premium_a4" ? (
          <div className="p-4 print:p-0 overflow-y-auto flex-1 print:overflow-visible">
            <PremiumA4Invoice inv={inv} />
          </div>
        ) : printMode === "luxury" ? (
          <div className="p-4 print:p-0 overflow-y-auto flex-1 print:overflow-visible">
            <LuxuryJewelleryInvoice inv={inv} />
          </div>
        ) : printMode === "modern" ? (
          <div className="p-4 print:p-0 overflow-y-auto flex-1 print:overflow-visible">
            <ModernInvoice inv={inv} />
          </div>
        ) : printMode === "estimate" ? (
          <div className="p-4 print:p-0 overflow-y-auto flex-1 print:overflow-visible">
            <BillOfSupplyEstimate inv={inv} />
          </div>
        ) : (
        <div className="p-4 sm:p-6 print:p-2 border-2 border-transparent print:border-none m-2 print:m-0 bg-white overflow-y-auto flex-1 print:overflow-visible">

          {/* ========= THEMED SHOP HEADER ========= */}
          <div className={`border-b-4 ${themeAccent.border} pb-4 mb-4 flex ${invSettings.headerStyle === "centered" ? "flex-col items-center text-center gap-2" : "justify-between items-start"}`}>
            <div className={`flex items-start gap-3 ${invSettings.headerStyle === "centered" ? "flex-col items-center" : ""}`}>
              {invSettings.showLogo && (
                tenantSession?.shop?.logoUrl
                  ? <img src={tenantSession.shop.logoUrl} alt="Logo" className="h-16 w-16 object-contain shrink-0" />
                  : <img src="/logo.png" alt="Logo" className="h-16 w-16 object-contain shrink-0" />
              )}
              <div>
                <h2 className="text-2xl font-display font-bold uppercase tracking-wider text-slate-900">
                  {tenantSession?.shop?.shopName || "Jewellery Shop"}
                </h2>
                {invSettings.tagline && <p className="text-[11px] font-semibold text-slate-600 tracking-wide mt-0.5">{invSettings.tagline}</p>}
                <p className="text-xs text-slate-600 mt-1">{tenantSession?.shop?.address}</p>
                <div className={`flex flex-wrap gap-3 text-xs text-slate-700 mt-1 ${invSettings.headerStyle === "centered" ? "justify-center" : ""}`}>
                  {tenantSession?.shop?.phone && <span><strong>Mob:</strong> {tenantSession.shop.phone}</span>}
                  {tenantSession?.shop?.numberOfShopOwner && <span><strong>Alt:</strong> {tenantSession.shop.numberOfShopOwner}</span>}
                  {inv.type === "GST" && tenantSession?.shop?.gstNumber && <span><strong>GSTIN:</strong> {tenantSession.shop.gstNumber}</span>}
                </div>
              </div>
            </div>
            <div className={`${invSettings.headerStyle === "centered" ? "text-center mt-2" : "text-right shrink-0"}`}>
              <div className={`inline-block px-3 py-1.5 rounded font-bold uppercase tracking-widest text-xs ${themeAccent.bg} ${themeAccent.text}`}>
                {getCleanInvoiceTitle(invSettings.invoiceTitle)}
              </div>
              <div className="text-xs text-slate-600 mt-1.5">Invoice No: <span className="font-bold text-slate-900">{inv.number}</span></div>
              <div className="text-xs text-slate-600">Date: <span className="font-bold text-slate-900">{formatDate(inv.createdAt)}</span></div>
              {inv.paymentMode && <div className="text-xs text-slate-600 mt-0.5">Mode: <span className="font-semibold">{inv.paymentMode}</span></div>}
            </div>
          </div>

          {/* Customer Info */}
          <div className={`flex flex-wrap justify-between items-center gap-2 mb-3 p-2.5 rounded border text-xs ${themeAccent.bg} border-${invSettings.themeColor === 'slate' ? 'slate-300' : invSettings.themeColor === 'purple' ? 'purple-200' : invSettings.themeColor === 'emerald' ? 'emerald-200' : invSettings.themeColor === 'blue' ? 'blue-200' : 'amber-200'}`}>
            <div>
              <span className="font-semibold text-slate-500">Billed To: </span>
              <span className="font-bold text-slate-900 text-sm">{inv.customerName}</span>
            </div>
            {inv.customerMobile && <div><span className="font-semibold text-slate-500">Mobile:</span> {inv.customerMobile}</div>}
            {inv.customerAddress && <div className="text-slate-600 max-w-xs">{inv.customerAddress}</div>}
          </div>

          {/* Items Table */}
          {(() => {
            const isSilverBill = inv.billMetal === "Silver";
            const hasHuid = invSettings.showHuid && !isSilverBill && (inv.items || []).some((it: any) => it.huid && it.huid !== "-" && it.huid !== "—");
            const hasHmc = !isSilverBill && (inv.items || []).some((it: any) => Number((it as any).hmc || 0) > 0);
            return (
              <div className="overflow-x-auto w-full mb-3">
                <table className="w-full text-xs border-collapse border border-slate-300 min-w-150 print:min-w-full">
                  <thead>
                  <tr className={`${themeAccent.th} border-b-2 font-bold uppercase text-[10px] tracking-wide`}>
                    <th className="border border-slate-300 py-1.5 px-1.5 text-center w-12">S.No.</th>
                    <th className="border border-slate-300 py-1.5 px-1.5 text-left">Description of Goods</th>
                    {hasHuid && <th className="border border-slate-300 py-1.5 px-1.5 text-left">{invSettings.huidHeaderLabel}</th>}
                    <th className="border border-slate-300 py-1.5 px-1.5 text-right">Qty</th>
                    {invSettings.showGrossWeight && <th className="border border-slate-300 py-1.5 px-1.5 text-right">Gross Wt</th>}
                    {invSettings.showWastage && <th className="border border-slate-300 py-1.5 px-1.5 text-right">Less Wt</th>}
                    {invSettings.showNetWeight && <th className="border border-slate-300 py-1.5 px-1.5 text-right">Net Wt</th>}
                    {hasHmc && <th className="border border-slate-300 py-1.5 px-1.5 text-right">HMC</th>}
                    {invSettings.showRatePerGram && <th className="border border-slate-300 py-1.5 px-1.5 text-right">Rate/g</th>}
                    {invSettings.showMakingCharges && <th className="border border-slate-300 py-1.5 px-1.5 text-right">{invSettings.makingChargeHeaderLabel}</th>}
                    <th className="border border-slate-300 py-1.5 px-1.5 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map((it: any, i: number) => {
                    let gw = it.grossWeight !== undefined ? it.grossWeight : it.netWeight;
                    let sw = it.stoneWeight || 0;
                    if (it.productId && typeof it.productId === 'string' && it.productId.includes("__GW_")) {
                      const parts = it.productId.split("__GW_");
                      const subParts = parts[1].split("__SW_");
                      gw = Number(subParts[0]);
                      sw = Number(subParts[1]);
                    }
                    const c = calcItem(it, inv.type === "GST");
                    return (
                      <tr key={i} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                        <td className="border border-slate-200 py-1 px-1.5 text-center text-slate-500">{i + 1}</td>
                        <td className="border border-slate-200 py-1 px-1.5">
                          <div className="font-semibold leading-tight">{it.name}</div>
                          {invSettings.showPurity && !isSilverBill && it.purity && it.purity !== "-" && it.purity !== "—" && (
                            <div className="text-[10px] text-slate-500">Purity: {it.purity}</div>
                          )}
                        </td>
                        {hasHuid && <td className="border border-slate-200 py-1 px-1.5 text-left font-mono text-[10px] text-slate-600">{(it as any).huid || '—'}</td>}
                        <td className="border border-slate-200 py-1 px-1.5 text-right">{it.qty}</td>
                        {invSettings.showGrossWeight && <td className="border border-slate-200 py-1 px-1.5 text-right">{gw} g</td>}
                        {invSettings.showWastage && <td className="border border-slate-200 py-1 px-1.5 text-right">{sw} g</td>}
                        {invSettings.showNetWeight && <td className="border border-slate-200 py-1 px-1.5 text-right font-semibold">{it.netWeight} g</td>}
                        {hasHmc && <td className="border border-slate-200 py-1 px-1.5 text-right text-slate-600">{inr((it as any).hmc || 0)}</td>}
                        {invSettings.showRatePerGram && <td className="border border-slate-200 py-1 px-1.5 text-right">{inr(it.ratePerGram)}</td>}
                        {invSettings.showMakingCharges && <td className="border border-slate-200 py-1 px-1.5 text-right">
                          {(() => {
                            const mcType: MakingChargeType = it.makingChargeType || "PERCENTAGE";
                            if (mcType === "PERCENTAGE") {
                              const pct = it.makingChargeValue ?? it.makingChargePct ?? (it.makingCharge > 0 && it.netWeight > 0 && it.ratePerGram > 0 ? (it.makingCharge / (it.netWeight * it.ratePerGram)) * 100 : 0);
                              return pct > 0 ? `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%` : '0%';
                            }
                            const value = it.makingChargeValue ?? 0;
                            if (mcType === "PER_GRAM") return `${inr(value)}/g`;
                            if (mcType === "PER_PIECE") return `${inr(value)}/pc`;
                            return `${inr(value)} Fixed`;
                          })()}
                        </td>}
                        <td className="border border-slate-200 py-1 px-1.5 text-right font-bold">{inr(c.line)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            );
          })()}

          {/* Calculations & Totals */}
          <div className="flex flex-col sm:flex-row justify-between items-start text-xs gap-4 border-t border-slate-200 pt-3">
            {/* Left: Terms, Bank, Payment Status */}
            <div className="w-full sm:w-1/2 sm:pr-8 order-2 sm:order-1 space-y-2">
              {((inv.balanceDue || 0) <= 0) && (
                <div className="p-1.5 bg-green-50 border border-green-200 text-green-800 text-center font-bold rounded tracking-widest text-sm">
                  ✓ PAYMENT COMPLETE
                </div>
              )}
              {invSettings.bankAccountDetails && (
                <div className="text-[10px] font-mono text-slate-700 bg-amber-50 border border-amber-200 p-2 rounded">
                  <strong>Bank Details:</strong> {invSettings.bankAccountDetails}
                </div>
              )}
              {invSettings.showPaymentQr && (
                <div className="border border-slate-300 rounded p-2 flex items-center gap-3 bg-slate-50 text-[10px] text-slate-700">
                  <img
                    src={
                      invSettings.qrCodeUrl ||
                      `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=2&data=${encodeURIComponent(
                        `upi://pay?pa=${invSettings.upiId || (tenantSession?.shop?.phone ? `${tenantSession.shop.phone}@ybl` : "")}&pn=${encodeURIComponent(tenantSession?.shop?.shopName || "Jewellery Shop")}&am=${inv.total || 0}&cu=INR`
                      )}`
                    }
                    alt="UPI Payment QR Code"
                    className="w-14 h-14 object-contain rounded border bg-white p-0.5 shrink-0"
                  />
                  <div>
                    <div className="font-bold text-slate-900 uppercase tracking-wider text-[9px]">Scan &amp; Pay via UPI</div>
                    <div className="font-mono text-[9.5px] text-slate-700 font-semibold mt-0.5">
                      {invSettings.upiId || (tenantSession?.shop?.phone ? `${tenantSession.shop.phone}@ybl` : "GPay / PhonePe / Paytm")}
                    </div>
                    <div className="text-[8.5px] text-slate-500 mt-0.5">Accepts GPay, PhonePe, Paytm &amp; BHIM</div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Totals summary */}
            <div className="w-full sm:w-1/2 max-w-sm order-1 sm:order-2">
              <table className="w-full">
                <tbody>
                  <tr><td className="py-0.5 text-slate-600">Subtotal</td><td className="py-0.5 text-right font-semibold">{inr(inv.subtotal)}</td></tr>
                  {inv.discount > 0 && <tr><td className="py-0.5 text-slate-600">Discount</td><td className="py-0.5 text-right font-semibold text-green-600">- {inr(inv.discount)}</td></tr>}
                  {invSettings.showOldGoldSection && (
                    <>
                      {inv.oldMetalType === "Silver" ? (
                        <tr><td className="py-0.5 text-slate-600">Old Silver Exchange</td><td className="py-0.5 text-right font-semibold text-green-600">- {inr(inv.oldSilverAmount || inv.oldGoldAmount)}</td></tr>
                      ) : inv.oldMetalType === "Mixed" || (inv.oldGoldAmount > 0 && (inv.oldSilverAmount || 0) > 0) ? (
                        <>
                          {inv.oldGoldAmount > 0 && <tr><td className="py-0.5 text-slate-600">Old Gold Exchange</td><td className="py-0.5 text-right font-semibold text-green-600">- {inr(inv.oldGoldAmount)}</td></tr>}
                          {(inv.oldSilverAmount || 0) > 0 && <tr><td className="py-0.5 text-slate-600">Old Silver Exchange</td><td className="py-0.5 text-right font-semibold text-green-600">- {inr(inv.oldSilverAmount)}</td></tr>}
                        </>
                      ) : inv.oldGoldAmount > 0 ? (
                        <tr><td className="py-0.5 text-slate-600">Old Gold Exchange</td><td className="py-0.5 text-right font-semibold text-green-600">- {inr(inv.oldGoldAmount)}</td></tr>
                      ) : (inv.oldSilverAmount || 0) > 0 ? (
                        <tr><td className="py-0.5 text-slate-600">Old Silver Exchange</td><td className="py-0.5 text-right font-semibold text-green-600">- {inr(inv.oldSilverAmount)}</td></tr>
                      ) : null}
                    </>
                  )}
                  {inv.type === "GST" && invSettings.showGstBreakdown && (
                    <>
                      <tr><td className="py-0.5 text-slate-600">CGST @ 1.5%</td><td className="py-0.5 text-right font-semibold">{inr(inv.gstAmount / 2)}</td></tr>
                      <tr><td className="py-0.5 text-slate-600">SGST @ 1.5%</td><td className="py-0.5 text-right font-semibold">{inr(inv.gstAmount / 2)}</td></tr>
                    </>
                  )}
                  {inv.type === "GST" && !invSettings.showGstBreakdown && (
                    <tr><td className="py-0.5 text-slate-600">GST (3%)</td><td className="py-0.5 text-right font-semibold">{inr(inv.gstAmount)}</td></tr>
                  )}
                  {(() => {
                    const totalOld = inv.oldMetalType === "Silver" ? (inv.oldSilverAmount || inv.oldGoldAmount || 0) : ((inv.oldGoldAmount || 0) + (inv.oldSilverAmount || 0));
                    const preRound = Math.round((inv.subtotal - inv.discount - totalOld + (inv.type === "GST" ? inv.gstAmount : 0)) * 100) / 100;
                    const roundOff = Math.round((inv.total - preRound) * 100) / 100;
                    return roundOff !== 0 ? <tr><td className="py-0.5 text-slate-600">Round Off</td><td className="py-0.5 text-right font-semibold">{inr(roundOff)}</td></tr> : null;
                  })()}
                  <tr className={`border-t-2 ${themeAccent.border} text-sm`}>
                    <td className={`py-1.5 font-bold ${themeAccent.headerText}`}>Grand Total</td>
                    <td className={`py-1.5 text-right font-bold ${themeAccent.headerText}`}>{inr(inv.total)}</td>
                  </tr>
                  {inv.amountPaid !== undefined && (
                    <>
                      {(() => {
                        if (inv.payments && inv.payments.length > 0) {
                          const cashPaid = inv.payments.filter((p: any) => p.mode === "Cash").reduce((s: number, p: any) => s + p.amount, 0);
                        const onlinePaid = inv.payments.filter((p: any) => p.mode !== "Cash" && p.mode !== "Advance" && p.mode !== "Order Advance").reduce((s: number, p: any) => s + p.amount, 0);
                        const advancePaid = inv.payments.filter((p: any) => p.mode === "Advance" || p.mode === "Order Advance").reduce((s: number, p: any) => s + p.amount, 0);
                          return (
                            <>
                            {advancePaid > 0 && (
                              <tr className="border-t border-slate-200 text-xs">
                                <td className="py-0.5 text-slate-600">Advance Settled</td>
                                <td className="py-0.5 text-right font-medium text-green-700">{inr(advancePaid)}</td>
                              </tr>
                            )}
                              {cashPaid > 0 && (
                              <tr className={advancePaid > 0 ? "text-xs" : "border-t border-slate-200 text-xs"}>
                                  <td className="py-0.5 text-slate-600">Paid (Cash)</td>
                                  <td className="py-0.5 text-right font-medium text-green-700">{inr(cashPaid)}</td>
                                </tr>
                              )}
                              {onlinePaid > 0 && (
                              <tr className={(cashPaid > 0 || advancePaid > 0) ? "text-xs" : "border-t border-slate-200 text-xs"}>
                                  <td className="py-0.5 text-slate-600">Paid (Online)</td>
                                  <td className="py-0.5 text-right font-medium text-green-700">{inr(onlinePaid)}</td>
                                </tr>
                              )}
                            {(cashPaid > 0 || onlinePaid > 0 || advancePaid > 0) && (
                                <tr className="text-xs">
                                  <td className="py-0.5 font-bold text-slate-800">Total Paid</td>
                                  <td className="py-0.5 text-right font-bold text-green-700">{inr(inv.amountPaid)}</td>
                                </tr>
                              )}
                            </>
                          );
                        }
                        return (
                          <tr className="border-t border-slate-200 text-xs">
                            <td className="py-0.5 text-slate-600">Amount Paid {inv.paymentMode && !inv.paymentMode.includes("+") ? `(${inv.paymentMode})` : ""}</td>
                            <td className="py-0.5 text-right font-semibold text-green-700">{inr(inv.amountPaid)}</td>
                          </tr>
                        );
                      })()}
                      <tr>
                        <td className="py-0.5 font-bold text-sm">Balance Due</td>
                        <td className="py-0.5 text-right font-bold text-sm text-rose-700">{inr(inv.balanceDue || 0)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Custom Terms & Conditions from InvoiceSettings */}
          {invSettings.termsAndConditions && (
            <div className="mt-4 pt-3 border-t border-dashed border-slate-200 text-[10px] text-slate-600 print:break-inside-avoid">
              <p className="font-bold text-slate-700 uppercase tracking-wider mb-1">Terms & Conditions:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                {invSettings.termsAndConditions.split('\n').map((t, i) => t.trim() ? <li key={i}>{t.trim()}</li> : null)}
              </ol>
            </div>
          )}

          {/* Custom Footer Note */}
          {invSettings.customFooterNote && (
            <div className={`mt-3 py-2 border-t border-slate-200 text-center text-[10px] font-medium ${themeAccent.text} print:break-inside-avoid`}>
              {invSettings.customFooterNote}
            </div>
          )}

          {/* Signatures */}
          <div className="mt-8 print:mt-4 grid grid-cols-1 sm:grid-cols-2 gap-8 items-end text-[10px] font-bold text-slate-500 uppercase tracking-wider print:break-inside-avoid">
            <div className="text-center">
              {inv.customerSignature ? (
                <img src={inv.customerSignature} alt="Customer Signature" className="h-10 mx-auto mb-1 object-contain" />
              ) : (
                <div className="w-32 border-t border-slate-300 mb-1 mx-auto"></div>
              )}
              {invSettings.signature1Label || "Customer Signature"}
            </div>
            <div className="text-center">
              {inv.authorizedSignatory ? (
                <img src={inv.authorizedSignatory} alt="Authorized Signatory" className="h-10 mx-auto mb-1 object-contain" />
              ) : (
                <div className="w-32 border-t border-slate-300 mb-1 mx-auto"></div>
              )}
              {invSettings.signature2Label || "Authorized Signatory"}
            </div>
          </div>
        </div>
        )}

        {/* Action Buttons */}
        <div className="shrink-0 bg-slate-100 p-4 border-t border-slate-200 rounded-b-lg flex flex-wrap justify-between items-center gap-3 print:hidden">
          <div className="flex flex-wrap gap-1 bg-white border border-slate-200 rounded-md p-1">
            <Button type="button" size="sm" variant={printMode === "a4" ? "default" : "ghost"} onClick={() => setPrintMode("a4")}>Standard A4</Button>
            <Button type="button" size="sm" variant={printMode === "premium_a4" ? "default" : "ghost"} onClick={() => setPrintMode("premium_a4")}>Premium A4</Button>
            <Button type="button" size="sm" variant={printMode === "luxury" ? "default" : "ghost"} onClick={() => setPrintMode("luxury")}>Luxury Jewellery</Button>
            <Button type="button" size="sm" variant={printMode === "modern" ? "default" : "ghost"} onClick={() => setPrintMode("modern")}>Modern Invoice</Button>
            <Button type="button" size="sm" variant={printMode === "a5" ? "default" : "ghost"} onClick={() => setPrintMode("a5")}>Compact A5</Button>
            <Button type="button" size="sm" variant={printMode === "estimate" ? "default" : "ghost"} onClick={() => setPrintMode("estimate")}>Estimate Order</Button>
            <Button type="button" size="sm" variant={printMode === "thermal78" ? "default" : "ghost"} onClick={() => setPrintMode("thermal78")}>Thermal 78mm</Button>
            <Button type="button" size="sm" variant={printMode === "thermal58" ? "default" : "ghost"} onClick={() => setPrintMode("thermal58")}>Thermal 58mm</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            {onSendWhatsApp && (
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" onClick={() => onSendWhatsApp(inv)}>
                <WhatsAppIcon className="w-4 h-4 mr-1.5 shrink-0" /> Send Bill on WhatsApp
              </Button>
            )}
            <Button onClick={triggerPrint}>
              <Printer className="w-4 h-4 mr-2" /> Print Bill
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
