import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr, type Invoice, type Purchase, type Customer, type Supplier } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useTenantAPI } from "@/lib/api";
import { 
  Download, 
  FileText, 
  ShoppingBag, 
  FileCheck, 
  Building2, 
  Users, 
  CheckCircle2, 
  Layers, 
  Calculator, 
  Sparkles
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Select as CustomSelect, SelectContent as SC, SelectItem as SI, SelectTrigger as ST, SelectValue as SV } from "@/components/ui/select";

export default function GstReportPage() {
  const api = useTenantAPI();

  // Load All Required Data
  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: api.invoices.getAll,
  });

  const { data: purchases = [] } = useQuery<Purchase[]>({
    queryKey: ["purchases"],
    queryFn: api.purchases.getAll,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: api.customers.getAll,
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: api.suppliers.getAll,
  });

  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [startDate, setStartDate] = useState<string>(firstDayOfMonth.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(today.toISOString().slice(0, 10));
  const [activeTab, setActiveTab] = useState<string>("summary");

  // Table Pagination States (15 items per page)
  const [b2bPage, setB2bPage] = useState(1);
  const [b2cPage, setB2cPage] = useState(1);
  const [hsnPage, setHsnPage] = useState(1);
  const [gstr2B2bPage, setGstr2B2bPage] = useState(1);

  useEffect(() => {
    setB2bPage(1);
    setB2cPage(1);
    setHsnPage(1);
    setGstr2B2bPage(1);
  }, [startDate, endDate]);

  // State Code / Shop POS default (27 = Maharashtra default or extracted from GSTIN)
  const defaultStateCode = "27";

  // Quick Date Range helper
  const setQuickRange = (type: "thisMonth" | "lastMonth" | "q1" | "q2" | "q3" | "q4") => {
    const now = new Date();
    const y = now.getFullYear();

    if (type === "thisMonth") {
      setStartDate(new Date(y, now.getMonth(), 1).toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (type === "lastMonth") {
      setStartDate(new Date(y, now.getMonth() - 1, 1).toISOString().slice(0, 10));
      setEndDate(new Date(y, now.getMonth(), 0).toISOString().slice(0, 10));
    } else if (type === "q1") {
      setStartDate(`${y}-04-01`);
      setEndDate(`${y}-06-30`);
    } else if (type === "q2") {
      setStartDate(`${y}-07-01`);
      setEndDate(`${y}-09-30`);
    } else if (type === "q3") {
      setStartDate(`${y}-10-01`);
      setEndDate(`${y}-12-31`);
    } else if (type === "q4") {
      setStartDate(`${y + 1}-01-01`);
      setEndDate(`${y + 1}-03-31`);
    }
  };

  // ----------------------------------------------------
  // FILTERED RECORDS BY DATE RANGE
  // ----------------------------------------------------
  const gstInvoices = useMemo(() => {
    if (!startDate || !endDate) return [];
    return invoices.filter((i) => {
      if (i.type !== "GST" || !i.createdAt) return false;
      const d = i.createdAt.slice(0, 10);
      return d >= startDate && d <= endDate;
    }).sort((a, b) => (a.number || "").localeCompare(b.number || ""));
  }, [invoices, startDate, endDate]);

  const nonGstInvoices = useMemo(() => {
    if (!startDate || !endDate) return [];
    return invoices.filter((i) => {
      if (i.type === "GST" || !i.createdAt) return false;
      const d = i.createdAt.slice(0, 10);
      return d >= startDate && d <= endDate;
    });
  }, [invoices, startDate, endDate]);

  const gstPurchases = useMemo(() => {
    if (!startDate || !endDate) return [];
    return purchases.filter((p) => {
      const isEntry = (p as any).docType === "Entry" || !(p as any).docType;
      const isCompleted = (p as any).status === "Completed" || !(p as any).status;
      const isGst = (p as any).type === "GST" || p.gstPct > 0;
      if (!isEntry || !isCompleted || !isGst || !p.date) return false;
      const d = p.date.slice(0, 10);
      return d >= startDate && d <= endDate;
    }).sort((a, b) => (a.billNo || "").localeCompare(b.billNo || ""));
  }, [purchases, startDate, endDate]);

  // Customer map for GSTIN lookup
  const customerGstinMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((c) => {
      if (c.gstNumber) {
        if (c.id) map.set(c.id, c.gstNumber);
        if (c._id) map.set(c._id, c.gstNumber);
        map.set(c.name.toLowerCase(), c.gstNumber);
      }
    });
    return map;
  }, [customers]);

  // Supplier map for GSTIN lookup
  const supplierGstinMap = useMemo(() => {
    const map = new Map<string, string>();
    suppliers.forEach((s) => {
      if (s.gstNumber) {
        if (s.id) map.set(s.id, s.gstNumber);
        if (s._id) map.set(s._id, s.gstNumber);
        map.set(s.name.toLowerCase(), s.gstNumber);
      }
    });
    return map;
  }, [suppliers]);

  // ----------------------------------------------------
  // GSTR-1 LOGIC (OUTWARD SUPPLIES)
  // ----------------------------------------------------
  const gstr1Data = useMemo(() => {
    const b2bInvoices: any[] = [];
    const b2cLargeInvoices: any[] = [];
    const b2cSmallInvoices: any[] = [];

    // HSN Map
    const hsnMap = new Map<string, { description: string; uqc: string; qty: number; netWeight: number; taxable: number; cgst: number; sgst: number; igst: number; totalTax: number }>();

    gstInvoices.forEach((inv) => {
      const cGstNo = customerGstinMap.get(inv.customerId || "") || customerGstinMap.get(inv.customerName.toLowerCase()) || "";
      const invTaxable = inv.subtotal - (inv.discount || 0) - (inv.oldGoldAmount || 0);

      // Check Inter-state vs Intra-state from Customer GSTIN
      let stateCode = defaultStateCode;
      let isInterState = false;
      if (cGstNo && cGstNo.length >= 2) {
        stateCode = cGstNo.substring(0, 2);
        if (stateCode !== defaultStateCode) {
          isInterState = true;
        }
      }

      const cgstAmt = isInterState ? 0 : inv.gstAmount / 2;
      const sgstAmt = isInterState ? 0 : inv.gstAmount / 2;
      const igstAmt = isInterState ? inv.gstAmount : 0;

      const formattedRecord = {
        invoiceNo: inv.number,
        date: formatDate(inv.createdAt),
        customerName: inv.customerName,
        customerGstin: cGstNo,
        customerMobile: inv.customerMobile,
        placeOfSupply: `${stateCode}-State`,
        totalValue: inv.total,
        taxableValue: invTaxable,
        cgst: cgstAmt,
        sgst: sgstAmt,
        igst: igstAmt,
        totalTax: inv.gstAmount,
      };

      if (cGstNo) {
        // Table 4: B2B Invoices
        b2bInvoices.push(formattedRecord);
      } else if (isInterState && inv.total > 250000) {
        // Table 5: B2C Large (> 2.5 Lakhs & Inter-state)
        b2cLargeInvoices.push(formattedRecord);
      } else {
        // Table 7: B2C Small
        b2cSmallInvoices.push(formattedRecord);
      }

      // HSN Breakdown from Invoice Items
      inv.items?.forEach((it) => {
        const nameUpper = (it.name || "").toUpperCase();
        const purityUpper = (it.purity || "").toUpperCase();

        let hsn = "7113"; // Gold Jewellery default
        let desc = "Gold Jewellery & Articles";

        if (nameUpper.includes("SILVER") || purityUpper.includes("925") || purityUpper.includes("SILVER")) {
          hsn = "7114";
          desc = "Silverware & Silver Jewellery";
        } else if (nameUpper.includes("DIAMOND") || purityUpper.includes("CTS") || purityUpper.includes("CARAT")) {
          hsn = "7102";
          desc = "Diamonds & Gemstones";
        } else if (nameUpper.includes("REPAIR") || nameUpper.includes("SERVICE") || nameUpper.includes("MAKING")) {
          hsn = "9988";
          desc = "Manufacturing & Repair Services";
        }

        const lineTaxable = (it.netWeight * it.ratePerGram + it.makingCharge + it.stoneCharge + (it.hmc || 0)) * it.qty;
        const lineTax = (lineTaxable * it.gstPct) / 100;
        const lineCgst = isInterState ? 0 : lineTax / 2;
        const lineSgst = isInterState ? 0 : lineTax / 2;
        const lineIgst = isInterState ? lineTax : 0;

        const curr = hsnMap.get(hsn) || { description: desc, uqc: "GMS", qty: 0, netWeight: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
        curr.qty += it.qty;
        curr.netWeight += it.netWeight * it.qty;
        curr.taxable += lineTaxable;
        curr.cgst += lineCgst;
        curr.sgst += lineSgst;
        curr.igst += lineIgst;
        curr.totalTax += lineTax;
        hsnMap.set(hsn, curr);
      });
    });

    // Table 8: Nil Rated / Exempted / Non-GST Outward
    const nilExemptedTaxable = nonGstInvoices.reduce((sum, i) => sum + (i.subtotal - (i.discount || 0) - (i.oldGoldAmount || 0)), 0);

    const hsnSummaryList = Array.from(hsnMap.entries()).map(([hsnCode, data]) => ({
      hsnCode,
      ...data,
    }));

    return {
      b2bInvoices,
      b2cLargeInvoices,
      b2cSmallInvoices,
      nilExemptedTaxable,
      hsnSummaryList,
    };
  }, [gstInvoices, nonGstInvoices, customerGstinMap]);

  // ----------------------------------------------------
  // GSTR-2 LOGIC (INWARD SUPPLIES / PURCHASE ITC)
  // ----------------------------------------------------
  const gstr2Data = useMemo(() => {
    const b2bInward: any[] = [];
    const unregisteredInward: any[] = [];

    let totalItcInputsTaxable = 0;
    let totalItcInputsCgst = 0;
    let totalItcInputsSgst = 0;
    let totalItcInputsIgst = 0;

    const hsnMap = new Map<string, { description: string; weight: number; taxable: number; cgst: number; sgst: number; igst: number; totalTax: number }>();

    gstPurchases.forEach((p) => {
      const sGstNo = supplierGstinMap.get(p.supplierId || "") || supplierGstinMap.get((p.supplierName || "").toLowerCase()) || "";
      const baseTaxable = p.weight * p.ratePerGram + (p.makingCharge || 0);
      const taxAmt = (baseTaxable * (p.gstPct || 0)) / 100;

      let stateCode = defaultStateCode;
      let isInterState = false;
      if (sGstNo && sGstNo.length >= 2) {
        stateCode = sGstNo.substring(0, 2);
        if (stateCode !== defaultStateCode) {
          isInterState = true;
        }
      }

      const cgstAmt = isInterState ? 0 : taxAmt / 2;
      const sgstAmt = isInterState ? 0 : taxAmt / 2;
      const igstAmt = isInterState ? taxAmt : 0;

      const record = {
        billNo: p.billNo,
        date: formatDate(p.date),
        supplierName: p.supplierName,
        supplierGstin: sGstNo,
        placeOfSupply: `${stateCode}-State`,
        totalValue: p.total,
        taxableValue: baseTaxable,
        cgst: cgstAmt,
        sgst: sgstAmt,
        igst: igstAmt,
        totalTax: taxAmt,
        itcEligible: true,
      };

      if (sGstNo) {
        b2bInward.push(record);
      } else {
        unregisteredInward.push(record);
      }

      totalItcInputsTaxable += baseTaxable;
      totalItcInputsCgst += cgstAmt;
      totalItcInputsSgst += sgstAmt;
      totalItcInputsIgst += igstAmt;

      // HSN Summary for Inward Purchases
      const hsn = p.metal === "Silver" ? "7114" : p.metal === "Diamond" ? "7102" : "7113";
      const desc = p.metal === "Silver" ? "Silverware / Silver Raw" : p.metal === "Diamond" ? "Diamonds / Gems" : "Gold Raw & Jewellery Stock";

      const curr = hsnMap.get(hsn) || { description: desc, weight: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
      curr.weight += p.weight || 0;
      curr.taxable += baseTaxable;
      curr.cgst += cgstAmt;
      curr.sgst += sgstAmt;
      curr.igst += igstAmt;
      curr.totalTax += taxAmt;
      hsnMap.set(hsn, curr);
    });

    const hsnInwardList = Array.from(hsnMap.entries()).map(([hsnCode, data]) => ({
      hsnCode,
      ...data,
    }));

    return {
      b2bInward,
      unregisteredInward,
      totalItcInputsTaxable,
      totalItcInputsCgst,
      totalItcInputsSgst,
      totalItcInputsIgst,
      totalItcAvailable: totalItcInputsCgst + totalItcInputsSgst + totalItcInputsIgst,
      hsnInwardList,
    };
  }, [gstPurchases, supplierGstinMap]);

  // ----------------------------------------------------
  // GSTR-3B SETTLEMENT ENGINE & SUMMARY METRICS
  // ----------------------------------------------------
  const gstr3bData = useMemo(() => {
    // 3.1 (a) Outward Taxable Supplies
    const outTaxable = gstInvoices.reduce((s, i) => s + (i.subtotal - (i.discount || 0) - (i.oldGoldAmount || 0)), 0);
    const outTotalTax = gstInvoices.reduce((s, i) => s + i.gstAmount, 0);
    const outCgst = outTotalTax / 2;
    const outSgst = outTotalTax / 2;
    const outIgst = 0; // intra-state default

    // 3.1 (e) Non-GST Outward Supplies
    const outNonGst = nonGstInvoices.reduce((s, i) => s + (i.subtotal - (i.discount || 0) - (i.oldGoldAmount || 0)), 0);

    // Table 4 Eligible ITC
    const inputCgst = gstr2Data.totalItcInputsCgst;
    const inputSgst = gstr2Data.totalItcInputsSgst;
    const inputIgst = gstr2Data.totalItcInputsIgst;

    // Table 6.1 Tax Settlement Rules:
    // 1. Set off CGST Output with CGST ITC
    const netCgstPayable = Math.max(0, outCgst - inputCgst);
    const unusedCgstItc = Math.max(0, inputCgst - outCgst);

    // 2. Set off SGST Output with SGST ITC
    const netSgstPayable = Math.max(0, outSgst - inputSgst);
    const unusedSgstItc = Math.max(0, inputSgst - outSgst);

    // 3. Set off IGST Output with IGST ITC
    const netIgstPayable = Math.max(0, outIgst - inputIgst);
    const unusedIgstItc = Math.max(0, inputIgst - outIgst);

    const totalCashTaxPayable = netCgstPayable + netSgstPayable + netIgstPayable;
    const totalItcCarryForward = unusedCgstItc + unusedSgstItc + unusedIgstItc;

    return {
      outTaxable,
      outCgst,
      outSgst,
      outIgst,
      outTotalTax,
      outNonGst,
      inputCgst,
      inputSgst,
      inputIgst,
      inputTotalTax: gstr2Data.totalItcAvailable,
      netCgstPayable,
      netSgstPayable,
      netIgstPayable,
      totalCashTaxPayable,
      totalItcCarryForward,
    };
  }, [gstInvoices, nonGstInvoices, gstr2Data]);

  // ----------------------------------------------------
  // EXPORT GST RETURN BUNDLE
  // ----------------------------------------------------
  const exportGstReturnBundle = async () => {
    const XLSX = await import("xlsx");
    const periodLabel = `${startDate}_to_${endDate}`;

    // Sheet 1: GSTR-3B Summary
    const gstr3bRows = [
      ["FORM GSTR-3B SUMMARY RETURN"],
      [`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`],
      [],
      ["3.1 Details of Outward Supplies and Inward Supplies Liable to Reverse Charge"],
      ["Nature of Supplies", "Total Taxable Value (Rs)", "Integrated Tax (Rs)", "Central Tax (Rs)", "State/UT Tax (Rs)"],
      ["(a) Outward Taxable Supplies (other than zero rated/exempted)", Number(gstr3bData.outTaxable.toFixed(2)), 0, Number(gstr3bData.outCgst.toFixed(2)), Number(gstr3bData.outSgst.toFixed(2))],
      ["(b) Outward Taxable Supplies (zero rated)", 0, 0, 0, 0],
      ["(c) Other Outward Supplies (Nil rated, exempted)", 0, 0, 0, 0],
      ["(d) Inward Supplies (liable to reverse charge)", 0, 0, 0, 0],
      ["(e) Non-GST Outward Supplies", Number(gstr3bData.outNonGst.toFixed(2)), 0, 0, 0],
      [],
      ["4. Eligible Input Tax Credit (ITC)"],
      ["Details", "Integrated Tax (Rs)", "Central Tax (Rs)", "State/UT Tax (Rs)"],
      ["(A) ITC Available (All Other ITC - Purchases)", Number(gstr3bData.inputIgst.toFixed(2)), Number(gstr3bData.inputCgst.toFixed(2)), Number(gstr3bData.inputSgst.toFixed(2))],
      ["(B) ITC Reversed", 0, 0, 0],
      ["(C) Net ITC Available (A - B)", Number(gstr3bData.inputIgst.toFixed(2)), Number(gstr3bData.inputCgst.toFixed(2)), Number(gstr3bData.inputSgst.toFixed(2))],
      [],
      ["6.1 Payment of Tax (Net Cash Tax Liability)"],
      ["Description", "Tax Payable (Rs)", "ITC Utilized (Rs)", "Net Cash Tax Payable (Rs)"],
      ["Central Tax (CGST)", Number(gstr3bData.outCgst.toFixed(2)), Number(Math.min(gstr3bData.outCgst, gstr3bData.inputCgst).toFixed(2)), Number(gstr3bData.netCgstPayable.toFixed(2))],
      ["State Tax (SGST)", Number(gstr3bData.outSgst.toFixed(2)), Number(Math.min(gstr3bData.outSgst, gstr3bData.inputSgst).toFixed(2)), Number(gstr3bData.netSgstPayable.toFixed(2))],
      ["Integrated Tax (IGST)", Number(gstr3bData.outIgst.toFixed(2)), Number(Math.min(gstr3bData.outIgst, gstr3bData.inputIgst).toFixed(2)), Number(gstr3bData.netIgstPayable.toFixed(2))],
      ["TOTAL NET CASH PAYABLE", Number(gstr3bData.outTotalTax.toFixed(2)), Number(Math.min(gstr3bData.outTotalTax, gstr3bData.inputTotalTax).toFixed(2)), Number(gstr3bData.totalCashTaxPayable.toFixed(2))],
    ];

    // Sheet 2: GSTR-1 B2B & B2C
    const gstr1Rows = [
      ["GSTR-1 OUTWARD SUPPLIES"],
      ["Table 4: B2B Invoices (Registered Customers)"],
      ["Invoice No", "Date", "Customer GSTIN", "Customer Name", "Place of Supply", "Taxable Value (Rs)", "CGST (Rs)", "SGST (Rs)", "IGST (Rs)", "Total Amount (Rs)"],
      ...gstr1Data.b2bInvoices.map((i) => [
        i.invoiceNo,
        i.date,
        i.customerGstin,
        i.customerName,
        i.placeOfSupply,
        Number(i.taxableValue.toFixed(2)),
        Number(i.cgst.toFixed(2)),
        Number(i.sgst.toFixed(2)),
        Number(i.igst.toFixed(2)),
        Number(i.totalValue.toFixed(2)),
      ]),
      [],
      ["Table 7: B2C Small Invoices (Unregistered Customers)"],
      ["Invoice No", "Date", "Customer Name", "Mobile", "Taxable Value (Rs)", "CGST (Rs)", "SGST (Rs)", "Total Amount (Rs)"],
      ...gstr1Data.b2cSmallInvoices.map((i) => [
        i.invoiceNo,
        i.date,
        i.customerName,
        i.customerMobile,
        Number(i.taxableValue.toFixed(2)),
        Number(i.cgst.toFixed(2)),
        Number(i.sgst.toFixed(2)),
        Number(i.totalValue.toFixed(2)),
      ]),
      [],
      ["Table 12: HSN Summary of Outward Supplies"],
      ["HSN Code", "Description", "UQC", "Total Qty", "Net Weight (g)", "Taxable Value (Rs)", "CGST (Rs)", "SGST (Rs)", "Total Tax (Rs)"],
      ...gstr1Data.hsnSummaryList.map((h) => [
        h.hsnCode,
        h.description,
        h.uqc,
        h.qty,
        Number(h.netWeight.toFixed(3)),
        Number(h.taxable.toFixed(2)),
        Number(h.cgst.toFixed(2)),
        Number(h.sgst.toFixed(2)),
        Number(h.totalTax.toFixed(2)),
      ]),
    ];

    // Sheet 3: GSTR-2 Inward ITC
    const gstr2Rows = [
      ["GSTR-2 INWARD SUPPLIES & INPUT TAX CREDIT"],
      ["B2B Inward Purchases (Registered Suppliers)"],
      ["Bill No", "Date", "Supplier GSTIN", "Supplier Name", "Taxable Base (Rs)", "Input CGST (Rs)", "Input SGST (Rs)", "Input IGST (Rs)", "Total Bill Amount (Rs)"],
      ...gstr2Data.b2bInward.map((p) => [
        p.billNo,
        p.date,
        p.supplierGstin,
        p.supplierName,
        Number(p.taxableValue.toFixed(2)),
        Number(p.cgst.toFixed(2)),
        Number(p.sgst.toFixed(2)),
        Number(p.igst.toFixed(2)),
        Number(p.totalValue.toFixed(2)),
      ]),
      [],
      ["Unregistered / Retail Inward Purchases"],
      ["Bill No", "Date", "Supplier Name", "Taxable Base (Rs)", "Input Tax (Rs)", "Total Bill Amount (Rs)"],
      ...gstr2Data.unregisteredInward.map((p) => [
        p.billNo,
        p.date,
        p.supplierName,
        Number(p.taxableValue.toFixed(2)),
        Number(p.totalTax.toFixed(2)),
        Number(p.totalValue.toFixed(2)),
      ]),
      [],
      ["HSN Summary of Inward Purchases"],
      ["HSN Code", "Description", "Weight (g)", "Taxable Value (Rs)", "Input CGST (Rs)", "Input SGST (Rs)", "Total Tax (Rs)"],
      ...gstr2Data.hsnInwardList.map((h) => [
        h.hsnCode,
        h.description,
        Number(h.weight.toFixed(3)),
        Number(h.taxable.toFixed(2)),
        Number(h.cgst.toFixed(2)),
        Number(h.sgst.toFixed(2)),
        Number(h.totalTax.toFixed(2)),
      ]),
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gstr3bRows), "GSTR-3B Return");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gstr1Rows), "GSTR-1 Outward");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gstr2Rows), "GSTR-2 Inward ITC");

    XLSX.writeFile(wb, `GST_Complete_Return_${periodLabel}.xlsx`);
  };

  // Table Paginations (15 lines per page)
  const PAGE_SIZE = 15;

  const b2bTotalPages = Math.ceil(gstr1Data.b2bInvoices.length / PAGE_SIZE) || 1;
  const currentB2bPage = Math.min(b2bPage, b2bTotalPages);
  const paginatedB2b = gstr1Data.b2bInvoices.slice((currentB2bPage - 1) * PAGE_SIZE, currentB2bPage * PAGE_SIZE);

  const b2cTotalPages = Math.ceil(gstr1Data.b2cSmallInvoices.length / PAGE_SIZE) || 1;
  const currentB2cPage = Math.min(b2cPage, b2cTotalPages);
  const paginatedB2c = gstr1Data.b2cSmallInvoices.slice((currentB2cPage - 1) * PAGE_SIZE, currentB2cPage * PAGE_SIZE);

  const hsnTotalPages = Math.ceil(gstr1Data.hsnSummaryList.length / PAGE_SIZE) || 1;
  const currentHsnPage = Math.min(hsnPage, hsnTotalPages);
  const paginatedHsn = gstr1Data.hsnSummaryList.slice((currentHsnPage - 1) * PAGE_SIZE, currentHsnPage * PAGE_SIZE);

  const gstr2B2bTotalPages = Math.ceil(gstr2Data.b2bInward.length / PAGE_SIZE) || 1;
  const currentGstr2B2bPage = Math.min(gstr2B2bPage, gstr2B2bTotalPages);
  const paginatedGstr2B2b = gstr2Data.b2bInward.slice((currentGstr2B2bPage - 1) * PAGE_SIZE, currentGstr2B2bPage * PAGE_SIZE);

  return (
    <Layout>
      {/* HEADER */}
      <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-display font-bold tracking-tight">GST Compliance Center</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Complete GSTR-1, GSTR-2, and GSTR-3B tax calculations, ITC reconciliation &amp; audit tables.
          </p>
        </div>

        {/* Date Filter & Export Bundle */}
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-end gap-2 w-full lg:w-auto bg-card p-3 rounded-xl border shadow-sm">
          <div className="flex flex-row gap-2 w-full sm:w-auto">
            <div className="space-y-1 flex-1 sm:flex-none">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 w-full sm:w-36 text-xs bg-background"
              />
            </div>
            <div className="space-y-1 flex-1 sm:flex-none">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 w-full sm:w-36 text-xs bg-background"
              />
            </div>
          </div>
          <div className="flex flex-row gap-2 w-full sm:w-auto">
            <CustomSelect onValueChange={(val: any) => setQuickRange(val)}>
              <ST className="h-8 text-xs px-3 bg-muted/40 flex-1 sm:w-32">
                <SV placeholder="Select Period" />
              </ST>
              <SC>
                <SI value="thisMonth">This Month</SI>
                <SI value="lastMonth">Last Month</SI>
                <SI value="q1">Q1 (Apr-Jun)</SI>
                <SI value="q2">Q2 (Jul-Sep)</SI>
                <SI value="q3">Q3 (Oct-Dec)</SI>
                <SI value="q4">Q4 (Jan-Mar)</SI>
              </SC>
            </CustomSelect>
            <Button onClick={exportGstReturnBundle} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-none">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download GST Bundle
            </Button>
          </div>
        </div>
      </header>

      {/* COMPLIANCE TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto pb-1 -mx-1 px-1">
          <TabsList className="flex w-max min-w-full sm:grid sm:grid-cols-4 sm:w-full sm:max-w-2xl bg-muted/60 p-1 rounded-xl gap-1">
            <TabsTrigger value="summary" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap px-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" /> <span className="hidden sm:inline">Summary</span><span className="sm:hidden">Summary</span>
            </TabsTrigger>
            <TabsTrigger value="gstr1" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap px-3">
              <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> GSTR-1
            </TabsTrigger>
            <TabsTrigger value="gstr2" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap px-3">
              <ShoppingBag className="w-3.5 h-3.5 text-blue-600 shrink-0" /> GSTR-2
            </TabsTrigger>
            <TabsTrigger value="gstr3b" className="text-xs font-semibold py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap px-3">
              <Calculator className="w-3.5 h-3.5 text-purple-600 shrink-0" /> GSTR-3B
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: SUMMARY POSITION */}
        {/* ======================================================== */}
        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Outward Liability */}
            <Card className="border shadow-sm border-emerald-200">
              <CardHeader className="bg-emerald-50/50 pb-3">
                <CardTitle className="text-sm sm:text-base font-display flex items-center justify-between text-emerald-900">
                  <span>Outward GST Liability</span>
                  <span className="text-xs font-normal text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">GSTR-1</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GST Invoices Count:</span>
                  <span className="font-semibold">{gstInvoices.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxable Value:</span>
                  <span className="font-semibold text-blue-600">{inr(gstr3bData.outTaxable)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CGST (1.5%):</span>
                  <span className="font-semibold">{inr(gstr3bData.outCgst)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">SGST (1.5%):</span>
                  <span className="font-semibold">{inr(gstr3bData.outSgst)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-sm sm:text-base">
                  <span>Total Output Tax:</span>
                  <span className="text-emerald-600">{inr(gstr3bData.outTotalTax)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Inward Tax Credit */}
            <Card className="border shadow-sm border-blue-200">
              <CardHeader className="bg-blue-50/50 pb-3">
                <CardTitle className="text-sm sm:text-base font-display flex items-center justify-between text-blue-900">
                  <span>Input Tax Credit (ITC)</span>
                  <span className="text-xs font-normal text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">GSTR-2</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">GST Purchase Bills:</span>
                  <span className="font-semibold">{gstPurchases.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Purchase Taxable Base:</span>
                  <span className="font-semibold text-blue-600">{inr(gstr2Data.totalItcInputsTaxable)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Input CGST Credit:</span>
                  <span className="font-semibold">{inr(gstr3bData.inputCgst)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Input SGST Credit:</span>
                  <span className="font-semibold">{inr(gstr3bData.inputSgst)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-sm sm:text-base">
                  <span>Total ITC Available:</span>
                  <span className="text-blue-600">{inr(gstr3bData.inputTotalTax)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Net Tax Position */}
            <Card className="border shadow-sm border-purple-200 sm:col-span-2 lg:col-span-1">
              <CardHeader className="bg-purple-50/50 pb-3">
                <CardTitle className="text-sm sm:text-base font-display flex items-center justify-between text-purple-900">
                  <span>Net Cash Tax Payable</span>
                  <span className="text-xs font-normal text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">GSTR-3B</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Net CGST Payable:</span>
                  <span className="font-semibold">{inr(gstr3bData.netCgstPayable)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Net SGST Payable:</span>
                  <span className="font-semibold">{inr(gstr3bData.netSgstPayable)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Net IGST Payable:</span>
                  <span className="font-semibold">{inr(gstr3bData.netIgstPayable)}</span>
                </div>
                <div className="flex justify-between text-sm text-emerald-600 font-medium">
                  <span>Unused ITC Carry Forward:</span>
                  <span>{inr(gstr3bData.totalItcCarryForward)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-sm sm:text-base">
                  <span>Net Cash Tax Payable:</span>
                  <span className="text-purple-600">{inr(gstr3bData.totalCashTaxPayable)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Guidance Box */}
          <Card className="bg-linear-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-200">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-base text-foreground">GST Compliance Readiness</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your sales and purchase transactions for <strong>{formatDate(startDate)}</strong> to <strong>{formatDate(endDate)}</strong> are fully categorized. Use the tabs above to review individual GSTR-1, GSTR-2, and GSTR-3B schedules or click <strong>Download Full GST Bundle</strong> to export ready-to-file Excel spreadsheets.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 2: GSTR-1 (OUTWARD SUPPLIES) */}
        {/* ======================================================== */}
        <TabsContent value="gstr1" className="space-y-4">
          {/* Table 4: B2B Invoices */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 bg-muted/20 border-b">
              <div>
                <CardTitle className="text-sm sm:text-base font-display flex items-center gap-2">
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" /> Table 4: B2B Invoices ({gstr1Data.b2bInvoices.length})
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">Outward supplies to GST-registered businesses with GSTIN.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {gstr1Data.b2bInvoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No B2B registered sales found for this period.</p>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-175">
                      <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                        <tr>
                          <th className="py-2.5 px-3">Invoice #</th>
                          <th className="py-2.5 px-2">Date</th>
                          <th className="py-2.5 px-2">GSTIN</th>
                          <th className="py-2.5 px-2">Customer</th>
                          <th className="py-2.5 px-2 text-right">Taxable</th>
                          <th className="py-2.5 px-2 text-right">CGST</th>
                          <th className="py-2.5 px-2 text-right">SGST</th>
                          <th className="py-2.5 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedB2b.map((i, idx) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="py-2 px-3 font-semibold">{i.invoiceNo}</td>
                            <td className="py-2 px-2 whitespace-nowrap">{i.date}</td>
                            <td className="py-2 px-2 font-mono text-xs text-blue-600 font-semibold">{i.customerGstin}</td>
                            <td className="py-2 px-2">{i.customerName}</td>
                            <td className="py-2 px-2 text-right font-medium">{inr(i.taxableValue)}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{inr(i.cgst)}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{inr(i.sgst)}</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-600">{inr(i.totalValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y">
                    {paginatedB2b.map((i, idx) => (
                      <div key={idx} className="p-3 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm">{i.invoiceNo}</span>
                          <span className="font-bold text-emerald-600 text-sm">{inr(i.totalValue)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{i.customerName} · {i.date}</div>
                        {i.customerGstin && <div className="font-mono text-xs text-blue-600">{i.customerGstin}</div>}
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs pt-0.5">
                          <span className="text-muted-foreground">Taxable: <span className="font-medium text-foreground">{inr(i.taxableValue)}</span></span>
                          <span className="text-muted-foreground">CGST: <span className="font-medium text-foreground">{inr(i.cgst)}</span></span>
                          <span className="text-muted-foreground">SGST: <span className="font-medium text-foreground">{inr(i.sgst)}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {b2bTotalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t bg-muted/10">
                      <div className="text-xs text-muted-foreground">
                        Showing {(currentB2bPage - 1) * PAGE_SIZE + 1} to {Math.min(currentB2bPage * PAGE_SIZE, gstr1Data.b2bInvoices.length)} of {gstr1Data.b2bInvoices.length} entries
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => setB2bPage(p => Math.max(1, p - 1))} disabled={currentB2bPage === 1}>Prev</Button>
                        <span className="text-xs font-medium text-muted-foreground px-1">Page {currentB2bPage} of {b2bTotalPages}</span>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => setB2bPage(p => Math.min(b2bTotalPages, p + 1))} disabled={currentB2bPage === b2bTotalPages}>Next</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Table 7: B2C Small Invoices */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 bg-muted/20 border-b">
              <CardTitle className="text-sm sm:text-base font-display flex items-center gap-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" /> Table 7: B2C Retail Sales ({gstr1Data.b2cSmallInvoices.length})
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">Supplies to unregistered retail consumers.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {gstr1Data.b2cSmallInvoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No B2C sales found for this period.</p>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-155">
                      <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                        <tr>
                          <th className="py-2.5 px-3">Invoice #</th>
                          <th className="py-2.5 px-2">Date</th>
                          <th className="py-2.5 px-2">Customer</th>
                          <th className="py-2.5 px-2">Mobile</th>
                          <th className="py-2.5 px-2 text-right">Taxable</th>
                          <th className="py-2.5 px-2 text-right">CGST</th>
                          <th className="py-2.5 px-2 text-right">SGST</th>
                          <th className="py-2.5 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedB2c.map((i, idx) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="py-2 px-3 font-semibold">{i.invoiceNo}</td>
                            <td className="py-2 px-2 whitespace-nowrap">{i.date}</td>
                            <td className="py-2 px-2">{i.customerName}</td>
                            <td className="py-2 px-2 text-xs text-muted-foreground">{i.customerMobile}</td>
                            <td className="py-2 px-2 text-right font-medium">{inr(i.taxableValue)}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{inr(i.cgst)}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{inr(i.sgst)}</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-600">{inr(i.totalValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y">
                    {paginatedB2c.map((i, idx) => (
                      <div key={idx} className="p-3 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm">{i.invoiceNo}</span>
                          <span className="font-bold text-emerald-600 text-sm">{inr(i.totalValue)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{i.customerName}{i.customerMobile ? ` · ${i.customerMobile}` : ""} · {i.date}</div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs pt-0.5">
                          <span className="text-muted-foreground">Taxable: <span className="font-medium text-foreground">{inr(i.taxableValue)}</span></span>
                          <span className="text-muted-foreground">CGST: <span className="font-medium text-foreground">{inr(i.cgst)}</span></span>
                          <span className="text-muted-foreground">SGST: <span className="font-medium text-foreground">{inr(i.sgst)}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {b2cTotalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t bg-muted/10">
                      <div className="text-xs text-muted-foreground">
                        Showing {(currentB2cPage - 1) * PAGE_SIZE + 1} to {Math.min(currentB2cPage * PAGE_SIZE, gstr1Data.b2cSmallInvoices.length)} of {gstr1Data.b2cSmallInvoices.length} entries
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => setB2cPage(p => Math.max(1, p - 1))} disabled={currentB2cPage === 1}>Prev</Button>
                        <span className="text-xs font-medium text-muted-foreground px-1">Page {currentB2cPage} of {b2cTotalPages}</span>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => setB2cPage(p => Math.min(b2cTotalPages, p + 1))} disabled={currentB2cPage === b2cTotalPages}>Next</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>


          {/* Table 12: HSN Summary */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 bg-muted/20 border-b">
              <CardTitle className="text-sm sm:text-base font-display flex items-center gap-2">
                <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 shrink-0" /> Table 12: HSN-wise Summary
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">Grouped by HSN code (7113 Gold, 7114 Silver, 7102 Diamond, 9988 Repair).</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left min-w-187.5">
                  <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                    <tr>
                      <th className="py-2.5 px-3">HSN</th>
                      <th className="py-2.5 px-2">Description</th>
                      <th className="py-2.5 px-2">UQC</th>
                      <th className="py-2.5 px-2 text-right">Qty</th>
                      <th className="py-2.5 px-2 text-right">Wt (g)</th>
                      <th className="py-2.5 px-2 text-right">Taxable Value</th>
                      <th className="py-2.5 px-2 text-right">CGST</th>
                      <th className="py-2.5 px-2 text-right">SGST</th>
                      <th className="py-2.5 px-3 text-right">Total Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHsn.map((h, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="py-2 px-3 font-mono font-bold text-purple-700">{h.hsnCode}</td>
                        <td className="py-2 px-2 font-medium text-xs">{h.description}</td>
                        <td className="py-2 px-2">{h.uqc}</td>
                        <td className="py-2 px-2 text-right font-medium">{h.qty}</td>
                        <td className="py-2 px-2 text-right font-medium whitespace-nowrap">{h.netWeight.toFixed(3)}</td>
                        <td className="py-2 px-2 text-right font-semibold">{inr(h.taxable)}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{inr(h.cgst)}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{inr(h.sgst)}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600">{inr(h.totalTax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile Cards */}
              <div className="md:hidden divide-y">
                {gstr1Data.hsnSummaryList.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6 text-sm">No HSN data available.</p>
                ) : paginatedHsn.map((h, idx) => (
                  <div key={idx} className="p-3 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-purple-700">{h.hsnCode}</span>
                      <span className="font-bold text-emerald-600 text-sm">{inr(h.totalTax)}</span>
                    </div>
                    <div className="text-xs font-medium">{h.description}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground pt-0.5">
                      <span>Qty: <span className="font-medium text-foreground">{h.qty}</span></span>
                      <span>Wt: <span className="font-medium text-foreground">{h.netWeight.toFixed(3)}g</span></span>
                      <span>Taxable: <span className="font-medium text-foreground">{inr(h.taxable)}</span></span>
                      <span>CGST: <span className="font-medium text-foreground">{inr(h.cgst)}</span></span>
                      <span>SGST: <span className="font-medium text-foreground">{inr(h.sgst)}</span></span>
                    </div>
                  </div>
                ))}
              </div>

              {hsnTotalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t bg-muted/10">
                  <div className="text-xs text-muted-foreground">
                    Showing {(currentHsnPage - 1) * PAGE_SIZE + 1} to {Math.min(currentHsnPage * PAGE_SIZE, gstr1Data.hsnSummaryList.length)} of {gstr1Data.hsnSummaryList.length} entries
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => setHsnPage(p => Math.max(1, p - 1))} disabled={currentHsnPage === 1}>Prev</Button>
                    <span className="text-xs font-medium text-muted-foreground px-1">Page {currentHsnPage} of {hsnTotalPages}</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => setHsnPage(p => Math.min(hsnTotalPages, p + 1))} disabled={currentHsnPage === hsnTotalPages}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 3: GSTR-2 (INWARD SUPPLIES & ITC) */}
        {/* ======================================================== */}
        <TabsContent value="gstr2" className="space-y-4">
          {/* B2B Inward Purchases */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 bg-muted/20 border-b">
              <CardTitle className="text-sm sm:text-base font-display flex items-center gap-2">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" /> B2B Inward Purchases ({gstr2Data.b2bInward.length})
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">ITC eligible purchases from registered suppliers.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {gstr2Data.b2bInward.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No registered B2B purchases recorded in this period.</p>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-170">
                      <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                        <tr>
                          <th className="py-2.5 px-3">Bill #</th>
                          <th className="py-2.5 px-2">Date</th>
                          <th className="py-2.5 px-2">GSTIN</th>
                          <th className="py-2.5 px-2">Supplier</th>
                          <th className="py-2.5 px-2 text-right">Taxable</th>
                          <th className="py-2.5 px-2 text-right">Input CGST</th>
                          <th className="py-2.5 px-2 text-right">Input SGST</th>
                          <th className="py-2.5 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedGstr2B2b.map((p, idx) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="py-2 px-3 font-semibold">{p.billNo}</td>
                            <td className="py-2 px-2 whitespace-nowrap">{p.date}</td>
                            <td className="py-2 px-2 font-mono text-xs text-blue-600 font-semibold">{p.supplierGstin}</td>
                            <td className="py-2 px-2">{p.supplierName}</td>
                            <td className="py-2 px-2 text-right font-medium">{inr(p.taxableValue)}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{inr(p.cgst)}</td>
                            <td className="py-2 px-2 text-right text-muted-foreground">{inr(p.sgst)}</td>
                            <td className="py-2 px-3 text-right font-bold text-blue-600">{inr(p.totalValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y">
                    {paginatedGstr2B2b.map((p, idx) => (
                      <div key={idx} className="p-3 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm">{p.billNo}</span>
                          <span className="font-bold text-blue-600 text-sm">{inr(p.totalValue)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{p.supplierName} · {p.date}</div>
                        {p.supplierGstin && <div className="font-mono text-xs text-blue-600">{p.supplierGstin}</div>}
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs pt-0.5">
                          <span className="text-muted-foreground">Taxable: <span className="font-medium text-foreground">{inr(p.taxableValue)}</span></span>
                          <span className="text-muted-foreground">CGST: <span className="font-medium text-foreground">{inr(p.cgst)}</span></span>
                          <span className="text-muted-foreground">SGST: <span className="font-medium text-foreground">{inr(p.sgst)}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {gstr2B2bTotalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t bg-muted/10">
                      <div className="text-xs text-muted-foreground">
                        Showing {(currentGstr2B2bPage - 1) * PAGE_SIZE + 1} to {Math.min(currentGstr2B2bPage * PAGE_SIZE, gstr2Data.b2bInward.length)} of {gstr2Data.b2bInward.length} entries
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => setGstr2B2bPage(p => Math.max(1, p - 1))} disabled={currentGstr2B2bPage === 1}>Prev</Button>
                        <span className="text-xs font-medium text-muted-foreground px-1">Page {currentGstr2B2bPage} of {gstr2B2bTotalPages}</span>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => setGstr2B2bPage(p => Math.min(gstr2B2bTotalPages, p + 1))} disabled={currentGstr2B2bPage === gstr2B2bTotalPages}>Next</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Table 4: Eligible ITC Category Breakdown */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 bg-muted/20 border-b">
              <CardTitle className="text-sm sm:text-base font-display flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" /> Table 4: Eligible ITC Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left min-w-130">
                  <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                    <tr>
                      <th className="py-2.5 px-3">ITC Category</th>
                      <th className="py-2.5 px-2 text-right">Taxable Base</th>
                      <th className="py-2.5 px-2 text-right">Input CGST</th>
                      <th className="py-2.5 px-2 text-right">Input SGST</th>
                      <th className="py-2.5 px-3 text-right">Total ITC</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b hover:bg-muted/20">
                      <td className="py-3 px-3 font-semibold text-xs sm:text-sm">Inputs (Raw Gold/Silver &amp; Stock)</td>
                      <td className="py-3 px-2 text-right font-medium">{inr(gstr2Data.totalItcInputsTaxable)}</td>
                      <td className="py-3 px-2 text-right font-medium">{inr(gstr2Data.totalItcInputsCgst)}</td>
                      <td className="py-3 px-2 text-right font-medium">{inr(gstr2Data.totalItcInputsSgst)}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-600">{inr(gstr2Data.totalItcAvailable)}</td>
                    </tr>
                    <tr className="border-b hover:bg-muted/20">
                      <td className="py-3 px-3 text-muted-foreground">Capital Goods</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">₹0.00</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">₹0.00</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">₹0.00</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">₹0.00</td>
                    </tr>
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-3 text-muted-foreground">Input Services</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">₹0.00</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">₹0.00</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">₹0.00</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">₹0.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Mobile Cards */}
              <div className="md:hidden divide-y">
                <div className="p-3 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm">Inputs (Raw Gold/Silver &amp; Stock)</span>
                    <span className="font-bold text-emerald-600 text-sm">{inr(gstr2Data.totalItcAvailable)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>Taxable: <span className="font-medium text-foreground">{inr(gstr2Data.totalItcInputsTaxable)}</span></span>
                    <span>CGST: <span className="font-medium text-foreground">{inr(gstr2Data.totalItcInputsCgst)}</span></span>
                    <span>SGST: <span className="font-medium text-foreground">{inr(gstr2Data.totalItcInputsSgst)}</span></span>
                  </div>
                </div>
                <div className="p-3 flex justify-between"><span className="text-sm text-muted-foreground">Capital Goods</span><span className="text-xs text-muted-foreground">₹0.00</span></div>
                <div className="p-3 flex justify-between"><span className="text-sm text-muted-foreground">Input Services</span><span className="text-xs text-muted-foreground">₹0.00</span></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 4: GSTR-3B (MONTHLY SUMMARY & TAX SETTLEMENT ENGINE) */}
        {/* ======================================================== */}
        <TabsContent value="gstr3b" className="space-y-4">
          {/* Table 3.1 */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 bg-muted/20 border-b">
              <CardTitle className="text-sm sm:text-base font-display flex items-center gap-2">
                <Calculator className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 shrink-0" /> 3.1 Outward Supplies &amp; Inward Reverse Charge
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left min-w-140">
                  <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                    <tr>
                      <th className="py-2.5 px-3">Nature of Supplies</th>
                      <th className="py-2.5 px-2 text-right">Taxable Value</th>
                      <th className="py-2.5 px-2 text-right">IGST</th>
                      <th className="py-2.5 px-2 text-right">CGST</th>
                      <th className="py-2.5 px-3 text-right">SGST</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b hover:bg-muted/20">
                      <td className="py-3 px-3 font-semibold text-xs sm:text-sm">(a) Outward Taxable Supplies</td>
                      <td className="py-3 px-2 text-right font-medium">{inr(gstr3bData.outTaxable)}</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">₹0.00</td>
                      <td className="py-3 px-2 text-right font-medium">{inr(gstr3bData.outCgst)}</td>
                      <td className="py-3 px-3 text-right font-medium">{inr(gstr3bData.outSgst)}</td>
                    </tr>
                    <tr className="border-b hover:bg-muted/20">
                      <td className="py-3 px-3 text-muted-foreground text-xs sm:text-sm">(b) Zero Rated Supplies</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">₹0.00</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">₹0.00</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">₹0.00</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">₹0.00</td>
                    </tr>
                    <tr className="border-b hover:bg-muted/20">
                      <td className="py-3 px-3 text-muted-foreground text-xs sm:text-sm">(c) Nil Rated / Exempted</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">₹0.00</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">₹0.00</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">₹0.00</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">₹0.00</td>
                    </tr>
                    <tr className="hover:bg-muted/20">
                      <td className="py-3 px-3 text-muted-foreground text-xs sm:text-sm">(e) Non-GST Outward Supplies</td>
                      <td className="py-3 px-2 text-right font-medium">{inr(gstr3bData.outNonGst)}</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">₹0.00</td>
                      <td className="py-3 px-2 text-right text-muted-foreground">₹0.00</td>
                      <td className="py-3 px-3 text-right text-muted-foreground">₹0.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Mobile */}
              <div className="md:hidden divide-y">
                <div className="p-3 space-y-1.5">
                  <div className="font-semibold text-sm">(a) Outward Taxable Supplies</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>Taxable: <span className="font-medium text-foreground">{inr(gstr3bData.outTaxable)}</span></span>
                    <span>CGST: <span className="font-medium text-foreground">{inr(gstr3bData.outCgst)}</span></span>
                    <span>SGST: <span className="font-medium text-foreground">{inr(gstr3bData.outSgst)}</span></span>
                    <span>IGST: <span className="font-medium text-foreground">₹0.00</span></span>
                  </div>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">(b) Zero Rated</span>
                  <span className="text-xs text-muted-foreground">₹0.00</span>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">(c) Nil / Exempted</span>
                  <span className="text-xs text-muted-foreground">₹0.00</span>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="text-sm">(e) Non-GST Supplies</span>
                  <span className="text-sm font-medium">{inr(gstr3bData.outNonGst)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table 6.1 Tax Settlement Engine */}
          <Card className="shadow-sm border-purple-300">
            <CardHeader className="bg-purple-50/60 pb-3 border-b">
              <CardTitle className="text-sm sm:text-base font-display flex items-center gap-2 text-purple-950">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-700 shrink-0" /> 6.1 Payment of Tax (Net Settlement)
              </CardTitle>
              <CardDescription className="text-xs text-purple-800">
                Output Tax minus ITC equals Net Cash Tax Payable.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left min-w-120">
                  <thead className="bg-muted/40 text-muted-foreground text-xs uppercase border-b">
                    <tr>
                      <th className="py-3 px-3">Tax Description</th>
                      <th className="py-3 px-2 text-right">Output Tax</th>
                      <th className="py-3 px-2 text-right">ITC Utilized</th>
                      <th className="py-3 px-3 text-right">Net Payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b hover:bg-muted/20">
                      <td className="py-3 px-3 font-semibold">Central Tax (CGST)</td>
                      <td className="py-3 px-2 text-right font-medium">{inr(gstr3bData.outCgst)}</td>
                      <td className="py-3 px-2 text-right text-blue-600 font-medium">{inr(Math.min(gstr3bData.outCgst, gstr3bData.inputCgst))}</td>
                      <td className="py-3 px-3 text-right font-bold text-purple-700">{inr(gstr3bData.netCgstPayable)}</td>
                    </tr>
                    <tr className="border-b hover:bg-muted/20">
                      <td className="py-3 px-3 font-semibold">State Tax (SGST)</td>
                      <td className="py-3 px-2 text-right font-medium">{inr(gstr3bData.outSgst)}</td>
                      <td className="py-3 px-2 text-right text-blue-600 font-medium">{inr(Math.min(gstr3bData.outSgst, gstr3bData.inputSgst))}</td>
                      <td className="py-3 px-3 text-right font-bold text-purple-700">{inr(gstr3bData.netSgstPayable)}</td>
                    </tr>
                    <tr className="bg-purple-50/40 font-bold border-t">
                      <td className="py-3.5 px-3 text-purple-950 text-xs sm:text-sm">TOTAL NET CASH PAYABLE</td>
                      <td className="py-3.5 px-2 text-right text-purple-900">{inr(gstr3bData.outTotalTax)}</td>
                      <td className="py-3.5 px-2 text-right text-blue-700">{inr(Math.min(gstr3bData.outTotalTax, gstr3bData.inputTotalTax))}</td>
                      <td className="py-3.5 px-3 text-right text-base sm:text-lg text-purple-700">{inr(gstr3bData.totalCashTaxPayable)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Mobile */}
              <div className="md:hidden divide-y">
                <div className="p-3 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm">Central Tax (CGST)</span>
                    <span className="font-bold text-purple-700 text-sm">{inr(gstr3bData.netCgstPayable)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>Output: <span className="font-medium text-foreground">{inr(gstr3bData.outCgst)}</span></span>
                    <span>ITC Used: <span className="font-medium text-blue-600">{inr(Math.min(gstr3bData.outCgst, gstr3bData.inputCgst))}</span></span>
                  </div>
                </div>
                <div className="p-3 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm">State Tax (SGST)</span>
                    <span className="font-bold text-purple-700 text-sm">{inr(gstr3bData.netSgstPayable)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>Output: <span className="font-medium text-foreground">{inr(gstr3bData.outSgst)}</span></span>
                    <span>ITC Used: <span className="font-medium text-blue-600">{inr(Math.min(gstr3bData.outSgst, gstr3bData.inputSgst))}</span></span>
                  </div>
                </div>
                <div className="p-3 bg-purple-50/40 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-purple-950">TOTAL NET CASH PAYABLE</span>
                    <span className="font-bold text-lg text-purple-700">{inr(gstr3bData.totalCashTaxPayable)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>Total Output: <span className="font-medium text-purple-900">{inr(gstr3bData.outTotalTax)}</span></span>
                    <span>ITC Used: <span className="font-medium text-blue-700">{inr(Math.min(gstr3bData.outTotalTax, gstr3bData.inputTotalTax))}</span></span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}