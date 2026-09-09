import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTenantAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { type Repair, type Order, type Karigar, useLocalState } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { 
  Hammer, Wrench, ShoppingBag, Eye, Plus, Printer, Coins, Scale, Receipt, 
  Calendar, ArrowUpRight, ArrowDownLeft, FileText, Sparkles, Trash2, 
  Calculator, CheckCircle2, ShieldAlert, NotebookPen, Layers, UserCheck
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type KarigarVoucher = {
  id: string;
  karigarId: string;
  karigarName?: string;
  date: string;
  voucherNo: string;
  type: "METAL_ISSUE" | "METAL_RECEIVE" | "CASH_GIVEN" | "CASH_RECEIVED" | "LABOUR_CHARGE";
  metalType: "Gold" | "Silver" | "Alloy" | "Other";
  purity: string;
  touchPct: number;
  grossWeight: number;
  lossWeight: number;
  netWeight: number;
  fineWeight: number;
  ratePerGram: number;
  metalAmount: number; // ₹ Total Metal Value
  cashGiven: number; // ₹ (Debit to Karigar)
  cashReceived: number; // ₹ (Credit from Karigar)
  labourAmount: number; // ₹ (Labour Earned by Karigar)
  orderOrRepairNo?: string;
  remarks: string;
};

function inr(n: number) {
  return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatDDMMYYYY(isoStr: string) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return isoStr;
  }
}

export default function KarigarTasksPage() {
  const api = useTenantAPI();
  const queryClient = useQueryClient();

  const { data: karigars = [], isLoading: isLoadingK } = useQuery<Karigar[]>({ queryKey: ["karigars"], queryFn: api.karigars.getAll });
  const { data: repairs = [], isLoading: isLoadingR } = useQuery<Repair[]>({ queryKey: ["repairs"], queryFn: api.repairs.getAll });
  const { data: orders = [], isLoading: isLoadingO } = useQuery<Order[]>({ queryKey: ["orders"], queryFn: api.orders.getAll });
  const { data: ratesList = [] } = useQuery({ queryKey: ["goldRates"], queryFn: api.goldRates.getAll });
  const latestRates = ratesList[0];

  const isLoading = isLoadingK || isLoadingR || isLoadingO;

  const updateRepairMutation = useMutation({ 
    mutationFn: (data: { id: string; body: Repair }) => api.repairs.update(data.id, data.body), 
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["repairs"] }) 
  });

  const updateOrderMutation = useMutation({ 
    mutationFn: (data: { id: string; body: Order }) => api.orders.update(data.id, data.body), 
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }) 
  });

  const updateKarigarMutation = useMutation({
    mutationFn: (data: { id: string; body: Karigar }) => api.karigars.update(data.id, data.body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["karigars"] })
  });

  const { tenantSession } = useAuth();
  const [authUser] = useLocalState<any>("ajms.auth", null);
  const currentUser = tenantSession?.user || authUser;
  const isKarigar = currentUser?.role === "karigar";
  const karigarRefId = currentUser?.karigarRefId;

  const [selectedKarigarId, setSelectedKarigarId] = useState<string>("");
  const [allVouchers, setAllVouchers] = useLocalState<KarigarVoucher[]>("ajms.karigarVouchersList", []);

  useEffect(() => {
    if (isKarigar && karigarRefId) {
      setSelectedKarigarId(karigarRefId);
    }
  }, [isKarigar, karigarRefId]);

  const [viewingRepair, setViewingRepair] = useState<Repair | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [pageR, setPageR] = useState(1);
  const [pageO, setPageO] = useState(1);
  const [activeTab, setActiveTab] = useState<string>("ledger");

  const activeKarigar = useMemo(() => {
    if (selectedKarigarId) {
      const found = karigars.find((k) => (k._id || k.id) === selectedKarigarId || String(k._id) === String(selectedKarigarId) || String(k.id) === String(selectedKarigarId));
      if (found) return found;
    }
    if (isKarigar) {
      if (karigarRefId) {
        const found = karigars.find((k) => (k._id || k.id) === karigarRefId || String(k._id) === String(karigarRefId) || String(k.id) === String(karigarRefId));
        if (found) return found;
      }
      if (currentUser?.username) {
        const found = karigars.find((k) => k.username?.toLowerCase().trim() === currentUser.username.toLowerCase().trim());
        if (found) return found;
      }
      if (currentUser?.name) {
        const found = karigars.find((k) => k.name.toLowerCase().trim() === currentUser.name.toLowerCase().trim());
        if (found) return found;
      }
    }
    return null;
  }, [karigars, selectedKarigarId, isKarigar, karigarRefId, currentUser]);

  const effectiveKarigarId = activeKarigar ? (activeKarigar._id || activeKarigar.id) : (selectedKarigarId || karigarRefId || currentUser?.id || "");
  const activeKarigarName = activeKarigar?.name || currentUser?.name || "";

  // Assigned Tasks
  const assignedRepairs = useMemo(() => {
    if (!effectiveKarigarId && !activeKarigarName) return [];
    return repairs.filter((r) => {
      const rKarigarIdStr = r.karigarId ? String(r.karigarId) : "";
      const effIdStr = effectiveKarigarId ? String(effectiveKarigarId) : "";
      const matchId = rKarigarIdStr && effIdStr && rKarigarIdStr === effIdStr;
      const matchNote = activeKarigarName && r.note?.toLowerCase().includes(`[assigned: ${activeKarigarName.toLowerCase()}]`);
      const matchName = (r as any).karigarName && activeKarigarName && (r as any).karigarName.toLowerCase().trim() === activeKarigarName.toLowerCase().trim();
      return matchId || matchNote || matchName;
    }).sort((a, b) => (a.customerName || "").localeCompare(b.customerName || ""));
  }, [repairs, effectiveKarigarId, activeKarigarName]);

  const assignedOrders = useMemo(() => {
    if (!effectiveKarigarId && !activeKarigarName) return [];
    return orders.filter((o) => {
      const oKarigarIdStr = o.karigarId ? String(o.karigarId) : "";
      const effIdStr = effectiveKarigarId ? String(effectiveKarigarId) : "";
      const matchId = oKarigarIdStr && effIdStr && oKarigarIdStr === effIdStr;
      const matchNote = activeKarigarName && o.note?.toLowerCase().includes(`[assigned: ${activeKarigarName.toLowerCase()}]`);
      const matchName = (o as any).karigarName && activeKarigarName && (o as any).karigarName.toLowerCase().trim() === activeKarigarName.toLowerCase().trim();
      return matchId || matchNote || matchName;
    }).sort((a, b) => (a.customerName || "").localeCompare(b.customerName || ""));
  }, [orders, effectiveKarigarId, activeKarigarName]);

  const activeRepairs = useMemo(() => assignedRepairs.filter(r => r.status !== "Delivered"), [assignedRepairs]);
  const activeOrders = useMemo(() => assignedOrders.filter(o => o.status !== "Delivered" && o.status !== "Cancelled"), [assignedOrders]);
  const repairsWeight = activeRepairs.reduce((sum, r) => sum + (Number(r.itemWeight) || 0), 0);

  // Active Karigar Vouchers & Ledger Calculations
  const activeKarigarVouchers = useMemo(() => {
    if (!effectiveKarigarId && !activeKarigarName) return [];
    return allVouchers.filter((v) => 
      v.karigarId === effectiveKarigarId || 
      String(v.karigarId) === String(effectiveKarigarId) ||
      (activeKarigarName && v.karigarName?.toLowerCase().trim() === activeKarigarName.toLowerCase().trim())
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allVouchers, effectiveKarigarId, activeKarigarName]);

  // Dynamic Ledger Aggregations & Calculations
  const ledgerSummary = useMemo(() => {
    let goldIssuedFine = 0;
    let goldReturnedFine = 0;
    let silverIssuedFine = 0;
    let silverReturnedFine = 0;

    let totalMetalAmountGiven = 0;
    let totalMetalAmountReturned = 0;

    let totalCashGiven = 0;
    let totalCashReceived = 0;
    let totalLabourEarned = 0;

    activeKarigarVouchers.forEach((v) => {
      const isGold = v.metalType === "Gold";
      const isSilver = v.metalType === "Silver";

      if (v.type === "METAL_ISSUE") {
        if (isGold) goldIssuedFine += v.fineWeight || 0;
        if (isSilver) silverIssuedFine += v.fineWeight || 0;
        totalMetalAmountGiven += v.metalAmount || 0;
        if (v.cashGiven > 0) totalCashGiven += v.cashGiven;
      } else if (v.type === "METAL_RECEIVE") {
        if (isGold) goldReturnedFine += v.fineWeight || 0;
        if (isSilver) silverReturnedFine += v.fineWeight || 0;
        totalMetalAmountReturned += v.metalAmount || 0;
        if (v.labourAmount > 0) totalLabourEarned += v.labourAmount;
      } else if (v.type === "CASH_GIVEN") {
        totalCashGiven += v.cashGiven || 0;
      } else if (v.type === "CASH_RECEIVED") {
        totalCashReceived += v.cashReceived || 0;
      } else if (v.type === "LABOUR_CHARGE") {
        totalLabourEarned += v.labourAmount || 0;
      }
    });

    const openingGold = (activeKarigar as any)?.openingBalanceGold || 0;
    const openingSilver = (activeKarigar as any)?.openingBalanceSilver || 0;
    const openingCash = (activeKarigar as any)?.openingBalanceCash || 0;

    const netGoldPending = openingGold + (goldIssuedFine - goldReturnedFine);
    const netSilverPending = openingSilver + (silverIssuedFine - silverReturnedFine);
    const netCashBalance = openingCash + (totalLabourEarned + totalCashReceived) - totalCashGiven;

    return {
      goldIssuedFine,
      goldReturnedFine,
      netGoldPending,
      silverIssuedFine,
      silverReturnedFine,
      netSilverPending,
      totalMetalAmountGiven,
      totalMetalAmountReturned,
      totalCashGiven,
      totalCashReceived,
      totalLabourEarned,
      netCashBalance,
    };
  }, [activeKarigarVouchers, activeKarigar?.openingBalanceGold, activeKarigar?.openingBalanceSilver, activeKarigar?.openingBalanceCash]);

  // Synchronize dynamic balances back to backend Karigar master when vouchers change
  useEffect(() => {
    if (activeKarigar && effectiveKarigarId) {
      const isGoldDiff = Math.abs((activeKarigar.metalBalanceGold || 0) - ledgerSummary.netGoldPending) > 0.0001;
      const isSilverDiff = Math.abs((activeKarigar.metalBalanceSilver || 0) - ledgerSummary.netSilverPending) > 0.0001;
      const isCashDiff = Math.abs((activeKarigar.balance || 0) - ledgerSummary.netCashBalance) > 0.01;

      if (isGoldDiff || isSilverDiff || isCashDiff) {
        updateKarigarMutation.mutate({
          id: effectiveKarigarId,
          body: {
            ...activeKarigar,
            pendingWeight: ledgerSummary.netGoldPending,
            metalBalanceGold: ledgerSummary.netGoldPending,
            metalBalanceSilver: ledgerSummary.netSilverPending,
            balance: ledgerSummary.netCashBalance,
          }
        });
      }
    }
  }, [ledgerSummary.netGoldPending, ledgerSummary.netSilverPending, ledgerSummary.netCashBalance, effectiveKarigarId]);

  // Running Ledger Balances Table Rows
  const runningLedgerRows = useMemo(() => {
    let goldBal = (activeKarigar as any)?.openingBalanceGold || 0;
    let silverBal = (activeKarigar as any)?.openingBalanceSilver || 0;
    let cashBal = (activeKarigar as any)?.openingBalanceCash || 0;

    return activeKarigarVouchers.map((v) => {
      const isGold = v.metalType === "Gold";
      const isSilver = v.metalType === "Silver";

      if (v.type === "METAL_ISSUE") {
        if (isGold) goldBal += v.fineWeight || 0;
        if (isSilver) silverBal += v.fineWeight || 0;
        if (v.cashGiven > 0) cashBal -= v.cashGiven;
      } else if (v.type === "METAL_RECEIVE") {
        if (isGold) goldBal -= v.fineWeight || 0;
        if (isSilver) silverBal -= v.fineWeight || 0;
        if (v.labourAmount > 0) cashBal += v.labourAmount;
      } else if (v.type === "CASH_GIVEN") {
        cashBal -= (v.cashGiven || 0);
      } else if (v.type === "CASH_RECEIVED") {
        cashBal += (v.cashReceived || 0);
      } else if (v.type === "LABOUR_CHARGE") {
        cashBal += (v.labourAmount || 0);
      }

      return {
        ...v,
        runningGoldBal: goldBal,
        runningSilverBal: silverBal,
        runningCashBal: cashBal,
      };
    });
  }, [activeKarigarVouchers]);

  // MODAL STATES FOR KARIGAR VOUCHERS
  const [openIssueMetal, setOpenIssueMetal] = useState(false);
  const [issueForm, setIssueForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    metalType: "Gold" as "Gold" | "Silver" | "Alloy",
    purity: "22K (91.6%)",
    touchPct: 91.6,
    grossWeight: "" as number | "",
    ratePerGram: "" as number | "",
    cashGiven: "" as number | "",
    orderOrRepairNo: "",
    remarks: "",
  });

  const [openReceiveMetal, setOpenReceiveMetal] = useState(false);
  const [receiveForm, setReceiveForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    metalType: "Gold" as "Gold" | "Silver",
    itemName: "",
    purity: "22K (91.6%)",
    touchPct: 91.6,
    grossWeight: "" as number | "",
    lossWeight: "" as number | "",
    ratePerGram: "" as number | "",
    labourType: "PER_GRAM" as "PER_GRAM" | "FIXED",
    labourRate: "" as number | "",
    orderOrRepairNo: "",
    remarks: "",
  });

  const [openCashTx, setOpenCashTx] = useState(false);
  const [cashTxForm, setCashTxForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    txType: "CASH_GIVEN" as "CASH_GIVEN" | "CASH_RECEIVED" | "LABOUR_CHARGE",
    amount: "" as number | "",
    remarks: "",
  });

  const [openPrintStatement, setOpenPrintStatement] = useState(false);

  // Auto-fill Metal Rates when Opening Issue / Receive Modals
  useEffect(() => {
    if (openIssueMetal && !issueForm.ratePerGram && latestRates) {
      if (issueForm.metalType === "Gold") {
        setIssueForm(prev => ({ ...prev, ratePerGram: latestRates.gold22 || latestRates.gold24 || 7200 }));
      } else if (issueForm.metalType === "Silver") {
        setIssueForm(prev => ({ ...prev, ratePerGram: latestRates.silver || 85 }));
      }
    }
  }, [openIssueMetal, issueForm.metalType, latestRates]);

  useEffect(() => {
    if (openReceiveMetal && !receiveForm.ratePerGram && latestRates) {
      if (receiveForm.metalType === "Gold") {
        setReceiveForm(prev => ({ ...prev, ratePerGram: latestRates.gold22 || latestRates.gold24 || 7200 }));
      } else if (receiveForm.metalType === "Silver") {
        setReceiveForm(prev => ({ ...prev, ratePerGram: latestRates.silver || 85 }));
      }
    }
  }, [openReceiveMetal, receiveForm.metalType, latestRates]);

  // HANDLERS FOR SAVING KARIGAR VOUCHERS
  const handleSaveIssueMetal = () => {
    if (!effectiveKarigarId) {
      toast.error("Please select a Karigar profile first.");
      return;
    }
    const grWt = Number(issueForm.grossWeight) || 0;
    if (grWt <= 0) {
      toast.error("Please enter a valid Gross Weight (g).");
      return;
    }

    const touch = Number(issueForm.touchPct) || 91.6;
    const netWt = grWt;
    const fineWt = (netWt * touch) / 100;
    const rate = Number(issueForm.ratePerGram) || 0;
    const metalAmt = fineWt * rate;
    const cashGivenVal = Number(issueForm.cashGiven) || 0;

    const newVoucher: KarigarVoucher = {
      id: "vch-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
      karigarId: effectiveKarigarId,
      karigarName: activeKarigarName,
      date: issueForm.date ? new Date(issueForm.date).toISOString() : new Date().toISOString(),
      voucherNo: `K-ISS-${Date.now().toString().slice(-5)}`,
      type: "METAL_ISSUE",
      metalType: issueForm.metalType,
      purity: issueForm.purity,
      touchPct: touch,
      grossWeight: grWt,
      lossWeight: 0,
      netWeight: netWt,
      fineWeight: fineWt,
      ratePerGram: rate,
      metalAmount: metalAmt,
      cashGiven: cashGivenVal,
      cashReceived: 0,
      labourAmount: 0,
      orderOrRepairNo: issueForm.orderOrRepairNo,
      remarks: issueForm.remarks || `${issueForm.metalType} metal issued for job work`,
    };

    setAllVouchers(prev => [newVoucher, ...prev]);
    toast.success(`✓ Issued ${fineWt.toFixed(3)}g Pure ${issueForm.metalType} (Val: ${inr(metalAmt)}) to ${activeKarigarName}`);
    setOpenIssueMetal(false);
    setIssueForm({
      date: new Date().toISOString().slice(0, 10),
      metalType: "Gold",
      purity: "22K (91.6%)",
      touchPct: 91.6,
      grossWeight: "",
      ratePerGram: "",
      cashGiven: "",
      orderOrRepairNo: "",
      remarks: "",
    });
  };

  const handleSaveReceiveMetal = () => {
    if (!effectiveKarigarId) {
      toast.error("Please select a Karigar profile first.");
      return;
    }
    const grWt = Number(receiveForm.grossWeight) || 0;
    if (grWt <= 0) {
      toast.error("Please enter a valid Gross Weight (g).");
      return;
    }

    const lossWt = Number(receiveForm.lossWeight) || 0;
    const netWt = Math.max(0, grWt - lossWt);
    const touch = Number(receiveForm.touchPct) || 91.6;
    const fineWt = (netWt * touch) / 100;
    const rate = Number(receiveForm.ratePerGram) || 0;
    const metalAmt = fineWt * rate;

    const labourRateVal = Number(receiveForm.labourRate) || 0;
    const labourTotal = receiveForm.labourType === "PER_GRAM" ? (labourRateVal * grWt) : labourRateVal;

    const newVoucher: KarigarVoucher = {
      id: "vch-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
      karigarId: effectiveKarigarId,
      karigarName: activeKarigarName,
      date: receiveForm.date ? new Date(receiveForm.date).toISOString() : new Date().toISOString(),
      voucherNo: `K-RCV-${Date.now().toString().slice(-5)}`,
      type: "METAL_RECEIVE",
      metalType: receiveForm.metalType,
      purity: receiveForm.purity,
      touchPct: touch,
      grossWeight: grWt,
      lossWeight: lossWt,
      netWeight: netWt,
      fineWeight: fineWt,
      ratePerGram: rate,
      metalAmount: metalAmt,
      cashGiven: 0,
      cashReceived: 0,
      labourAmount: labourTotal,
      orderOrRepairNo: receiveForm.orderOrRepairNo,
      remarks: receiveForm.remarks || `${receiveForm.itemName || "Finished Ornament"} received back`,
    };

    setAllVouchers(prev => [newVoucher, ...prev]);
    toast.success(`✓ Received ${fineWt.toFixed(3)}g Fine ${receiveForm.metalType} (Labour: ${inr(labourTotal)}) from ${activeKarigarName}`);
    setOpenReceiveMetal(false);
    setReceiveForm({
      date: new Date().toISOString().slice(0, 10),
      metalType: "Gold",
      itemName: "",
      purity: "22K (91.6%)",
      touchPct: 91.6,
      grossWeight: "",
      lossWeight: "",
      ratePerGram: "",
      labourType: "PER_GRAM",
      labourRate: "",
      orderOrRepairNo: "",
      remarks: "",
    });
  };

  const handleSaveCashTx = () => {
    if (!effectiveKarigarId) {
      toast.error("Please select a Karigar profile first.");
      return;
    }
    const amt = Number(cashTxForm.amount) || 0;
    if (amt <= 0) {
      toast.error("Please enter a valid amount (₹).");
      return;
    }

    const isGiven = cashTxForm.txType === "CASH_GIVEN";
    const isLabour = cashTxForm.txType === "LABOUR_CHARGE";

    const newVoucher: KarigarVoucher = {
      id: "vch-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
      karigarId: effectiveKarigarId,
      karigarName: activeKarigarName,
      date: cashTxForm.date ? new Date(cashTxForm.date).toISOString() : new Date().toISOString(),
      voucherNo: `K-CSH-${Date.now().toString().slice(-5)}`,
      type: cashTxForm.txType,
      metalType: "Other",
      purity: "N/A",
      touchPct: 0,
      grossWeight: 0,
      lossWeight: 0,
      netWeight: 0,
      fineWeight: 0,
      ratePerGram: 0,
      metalAmount: 0,
      cashGiven: isGiven ? amt : 0,
      cashReceived: !isGiven && !isLabour ? amt : 0,
      labourAmount: isLabour ? amt : 0,
      remarks: cashTxForm.remarks || (isGiven ? "Cash advance paid" : isLabour ? "Labour charge added" : "Cash received"),
    };

    setAllVouchers(prev => [newVoucher, ...prev]);
    toast.success(`✓ Saved Cash Transaction: ${inr(amt)} (${cashTxForm.txType})`);
    setOpenCashTx(false);
    setCashTxForm({
      date: new Date().toISOString().slice(0, 10),
      txType: "CASH_GIVEN",
      amount: "",
      remarks: "",
    });
  };

  const handleDeleteVoucher = (vId: string) => {
    if (confirm("Are you sure you want to delete this Karigar ledger voucher?")) {
      setAllVouchers(prev => prev.filter(v => v.id !== vId));
      toast.success("Voucher deleted successfully.");
    }
  };

  const updateRepairStatus = async (id: string, status: Repair["status"]) => {
    const repair = repairs.find(r => r._id === id || r.id === id);
    if (repair) {
      await updateRepairMutation.mutateAsync({ id, body: { ...repair, status } });
      toast.success(`Repair status updated to ${status}`);
    }
  };

  const updateOrderStatus = async (id: string, status: Order["status"]) => {
    const order = orders.find(o => o._id === id || o.id === id);
    if (order) {
      await updateOrderMutation.mutateAsync({ id, body: { ...order, status } });
      toast.success(`Order status updated to ${status}`);
    }
  };

  const shopName = tenantSession?.shop?.shopName || (tenantSession?.shop as any)?.name || (tenantSession?.shop as any)?.companyName || "Demo Jewellers";
  const shopPhone = tenantSession?.shop?.phone || "";
  const shopAddress = tenantSession?.shop?.address || "";

  // PRINT KARIGAR STATEMENT
  const handlePrintStatement = () => {
    const printWin = window.open("", "_blank", "width=850,height=950");
    if (!printWin) {
      toast.error("Popup blocked! Please allow popups to print statement.");
      return;
    }

    const rowsHtml = runningLedgerRows.map((r, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 6px; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px;">${formatDDMMYYYY(r.date)}</td>
        <td style="padding: 6px; font-weight: bold; color: ${r.type === 'METAL_ISSUE' ? '#b45309' : r.type === 'METAL_RECEIVE' ? '#047857' : '#1e293b'};">
          ${r.type === 'METAL_ISSUE' ? ' Metal Issue (सोना दिया)' : r.type === 'METAL_RECEIVE' ? ' Metal Receive (तैयार माल)' : r.type === 'CASH_GIVEN' ? ' Cash Given (नगद दिया)' : r.type === 'CASH_RECEIVED' ? ' Cash Received (नगद जमा)' : ' Labour Charge'}
        </td>
        <td style="padding: 6px;">${r.remarks || '-'}</td>
        <td style="padding: 6px; text-align: center;">${r.metalType !== 'Other' ? `${r.metalType} (${r.purity})` : '-'}</td>
        <td style="padding: 6px; text-align: right;">${r.grossWeight ? r.grossWeight.toFixed(3) + 'g' : '-'}</td>
        <td style="padding: 6px; text-align: right; font-weight: bold; color: #b45309;">${r.type === 'METAL_ISSUE' ? r.fineWeight.toFixed(3) + 'g' : '-'}</td>
        <td style="padding: 6px; text-align: right; font-weight: bold; color: #047857;">${r.type === 'METAL_RECEIVE' ? r.fineWeight.toFixed(3) + 'g' : '-'}</td>
        <td style="padding: 6px; text-align: right;">${r.ratePerGram ? inr(r.ratePerGram) : '-'}</td>
        <td style="padding: 6px; text-align: right; font-weight: bold;">${r.metalAmount ? inr(r.metalAmount) : '-'}</td>
        <td style="padding: 6px; text-align: right; color: #b91c1c;">${r.cashGiven ? inr(r.cashGiven) : r.type === 'METAL_ISSUE' && r.cashGiven ? inr(r.cashGiven) : '-'}</td>
        <td style="padding: 6px; text-align: right; color: #15803d;">${r.labourAmount ? inr(r.labourAmount) : r.cashReceived ? inr(r.cashReceived) : '-'}</td>
        <td style="padding: 6px; text-align: right; font-weight: bold; background: #fef3c7;">${r.runningGoldBal.toFixed(3)}g</td>
        <td style="padding: 6px; text-align: right; font-weight: bold; background: #f1f5f9;">${inr(r.runningCashBal)}</td>
      </tr>
    `).join("");

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Karigar Ledger Statement - ${activeKarigarName}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 0; padding: 15px; background: #fff; }
            .header { text-align: center; border-bottom: 2px solid #78350f; padding-bottom: 10px; margin-bottom: 15px; }
            .header h1 { margin: 0; font-size: 24px; color: #78350f; font-family: Georgia, serif; text-transform: uppercase; }
            .header p { margin: 3px 0; font-size: 11px; color: #475569; }
            .profile-box { display: flex; justify-content: space-between; background: #fef3c7; border: 1px solid #fde68a; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; }
            .profile-box div { font-size: 12px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
            .kpi-card { background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px; border-radius: 6px; text-align: center; }
            .kpi-card label { font-size: 9px; text-transform: uppercase; font-weight: bold; color: #64748b; }
            .kpi-card val { display: block; font-size: 14px; font-weight: bold; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #1e293b; color: #ffffff; padding: 6px; font-size: 10px; text-transform: uppercase; text-align: left; }
            th.right { text-align: right; }
            th.center { text-align: center; }
            .footer { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 15px; border-top: 1px border #cbd5e1; }
            .sign-box { text-align: center; width: 200px; border-top: 1px solid #000; padding-top: 5px; font-size: 11px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${shopName}</h1>
            <p>${shopAddress} ${shopPhone ? '| Phone: ' + shopPhone : ''}</p>
            <p style="font-weight: bold; font-size: 13px; color: #92400e; margin-top: 4px;">CRAFTSMAN & KARIGAR ACCOUNT STATEMENT (कारीगर खाता विवरण)</p>
          </div>

          <div class="profile-box">
            <div>
              <strong>Karigar Name:</strong> ${activeKarigarName}<br/>
              <strong>Specialty / Category:</strong> ${activeKarigar?.specialty || "Goldsmith"} | <strong>Mobile:</strong> ${activeKarigar?.mobile || "N/A"}
            </div>
            <div style="text-align: right;">
              <strong>Statement Date:</strong> ${formatDDMMYYYY(new Date().toISOString())}<br/>
              <strong>Total Transactions:</strong> ${runningLedgerRows.length} Entries
            </div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <label>Fine Gold Pending</label>
              <val style="color: #b45309;">${ledgerSummary.netGoldPending.toFixed(3)} g</val>
            </div>
            <div class="kpi-card">
              <label>Fine Silver Pending</label>
              <val style="color: #475569;">${ledgerSummary.netSilverPending.toFixed(3)} g</val>
            </div>
            <div class="kpi-card">
              <label>Total Metal Value Issued</label>
              <val style="color: #0369a1;">${inr(ledgerSummary.totalMetalAmountGiven)}</val>
            </div>
            <div class="kpi-card">
              <label>Net Cash / Labour Balance</label>
              <val style="color: ${ledgerSummary.netCashBalance >= 0 ? '#15803d' : '#b91c1c'};">${inr(ledgerSummary.netCashBalance)}</val>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="center">#</th>
                <th>Date</th>
                <th>Voucher Type</th>
                <th>Remarks / Item</th>
                <th class="center">Metal</th>
                <th class="right">Gr. Wt</th>
                <th class="right">Issued Pure</th>
                <th class="right">Returned Pure</th>
                <th class="right">Rate (₹/g)</th>
                <th class="right">Metal Amt</th>
                <th class="right">Cash Dr (दिया)</th>
                <th class="right">Labour Cr (बनी)</th>
                <th class="right">Gold Bal</th>
                <th class="right">Cash Bal</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colSpan="14" style="text-align:center; padding: 15px; color:#64748b;">No transaction entries recorded for this karigar.</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            <div class="sign-box">Karigar Signature (कारीगर हस्ताक्षर)</div>
            <div class="sign-box">Authorized Signatory (${shopName})</div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 250);
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const pageContent = (
    <>
      {/* HEADER SECTION */}
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              <Hammer className="w-3.5 h-3.5" /> Craftsman &amp; Karigar Portal
            </span>
            <span className="text-xs text-muted-foreground">{karigars.length} Registered Artisans</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground">{shopName}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Complete Karigar Metal Issue/Receipt Ledger, Labour Charges, Cash Advance &amp; Task Assignments.
          </p>
        </div>

        {isKarigar ? (
          <div className="bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 px-4 py-2 rounded-xl border border-amber-300 dark:border-amber-800 font-semibold flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-600" /> Logged in as: {currentUser?.name || "Karigar"}
          </div>
        ) : (
          <div className="w-full sm:w-80">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
              Select Karigar Profile (कारीगर चुनें):
            </Label>
            <Select value={selectedKarigarId} onValueChange={setSelectedKarigarId}>
              <SelectTrigger className="h-11 bg-card border-amber-500/40 shadow-sm font-semibold text-sm focus:ring-amber-500">
                <SelectValue placeholder="-- Select Craftsman Profile --" />
              </SelectTrigger>
              <SelectContent>
                {karigars.map(k => (
                  <SelectItem key={k._id || k.id} value={k._id || k.id || `unknown-${k.name}`}>
                    <span className="font-bold">{k.name}</span> <span className="text-xs text-muted-foreground">({k.specialty || k.category || "Goldsmith"}) • {k.mobile || "No Mobile"}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      {isLoading ? (
        <p className="text-center py-16 text-muted-foreground font-semibold flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5 animate-spin text-amber-600" /> Loading Karigar Profile &amp; Ledgers...
        </p>
      ) : !effectiveKarigarId ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/20 border-2 border-dashed border-amber-300/60 rounded-2xl p-6 text-center shadow-xs">
          <Hammer className="w-16 h-16 mb-4 text-amber-600/60 animate-bounce" />
          <h3 className="text-xl font-bold text-foreground">No Karigar Selected</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-1">
            Please select a Karigar profile from the dropdown above to view their metal issue history, labour charges, cash balance, and assigned work.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KARIGAR PROFILE BANNER & SUMMARY KPI CARDS */}
          {activeKarigar && (
            <Card className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-white border-amber-800 shadow-xl overflow-hidden relative">
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-amber-500/5 backdrop-blur-3xl rounded-l-full pointer-events-none" />
              <CardContent className="p-5 sm:p-6 flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center relative z-10">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-500 text-amber-950 font-bold uppercase text-[10px]">
                      {activeKarigar.specialty || "Goldsmith"}
                    </Badge>
                    <span className="text-xs text-amber-200">ID: {activeKarigar._id || activeKarigar.id}</span>
                  </div>
                  <h2 className="text-3xl font-display font-black text-amber-100 mt-1">{activeKarigar.name}</h2>
                  <p className="text-xs sm:text-sm text-amber-300/80 mt-0.5">
                    📱 {activeKarigar.mobile || "No Mobile"} {activeKarigar.address ? `• 📍 ${activeKarigar.address}` : ""}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 min-w-[130px]">
                    <div className="text-[11px] font-bold text-amber-200 uppercase tracking-wider flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-amber-400" /> Fine Gold Pending
                    </div>
                    <div className="text-lg font-bold font-mono text-amber-300 mt-1">
                      {ledgerSummary.netGoldPending.toFixed(3)} g
                    </div>
                    <div className="text-[10px] text-amber-200/70">Pure Gold Due</div>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 min-w-[130px]">
                    <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-slate-300" /> Fine Silver Pending
                    </div>
                    <div className="text-lg font-bold font-mono text-slate-100 mt-1">
                      {ledgerSummary.netSilverPending.toFixed(3)} g
                    </div>
                    <div className="text-[10px] text-slate-300/70">Pure Silver Due</div>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 min-w-[130px]">
                    <div className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                      <Calculator className="w-3.5 h-3.5 text-emerald-400" /> Metal Value Given
                    </div>
                    <div className="text-lg font-bold font-mono text-emerald-200 mt-1">
                      {inr(ledgerSummary.totalMetalAmountGiven)}
                    </div>
                    <div className="text-[10px] text-emerald-300/70">Total Metal (₹)</div>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 min-w-[130px]">
                    <div className="text-[11px] font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1">
                      <Receipt className="w-3.5 h-3.5 text-sky-400" /> Cash/Labour Bal.
                    </div>
                    <div className={`text-lg font-bold font-mono mt-1 ${ledgerSummary.netCashBalance >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {inr(ledgerSummary.netCashBalance)}
                    </div>
                    <div className="text-[10px] text-sky-200/70">{ledgerSummary.netCashBalance >= 0 ? "Shop owes Karigar" : "Karigar owes Shop"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* QUICK VOUCHER ENTRY & STATEMENT BUTTONS */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 sm:p-4 rounded-xl border border-border shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                onClick={() => setOpenIssueMetal(true)}
                className="bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs sm:text-sm h-9 shadow-sm"
              >
                <ArrowUpRight className="w-4 h-4 mr-1.5" /> + Issue Metal (सोना/चांदी दें)
              </Button>
              <Button 
                onClick={() => setOpenReceiveMetal(true)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm h-9 shadow-sm"
              >
                <ArrowDownLeft className="w-4 h-4 mr-1.5" /> + Receive Metal (तैयार माल लें)
              </Button>
              <Button 
                onClick={() => setOpenCashTx(true)}
                variant="outline"
                className="font-bold text-xs sm:text-sm h-9 border-amber-500/40 text-amber-900 dark:text-amber-200 hover:bg-amber-50"
              >
                <Coins className="w-4 h-4 mr-1.5 text-amber-600" /> + Cash / Labour Tx (हिसाब/एडवांस)
              </Button>
            </div>

            <Button 
              onClick={handlePrintStatement}
              variant="secondary"
              className="font-bold text-xs sm:text-sm h-9 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 shadow-sm"
            >
              <Printer className="w-4 h-4 mr-1.5" /> Print Karigar Statement (खाता पर्चा)
            </Button>
          </div>

          {/* INTERACTIVE TABS */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
            <TabsList className="bg-muted p-1 rounded-xl grid grid-cols-3 max-w-xl">
              <TabsTrigger value="ledger" className="font-bold text-xs sm:text-sm">
                <Receipt className="w-4 h-4 mr-1.5" /> Karigar Ledger ({runningLedgerRows.length})
              </TabsTrigger>
              <TabsTrigger value="metal" className="font-bold text-xs sm:text-sm">
                <Scale className="w-4 h-4 mr-1.5" /> Metal Summary
              </TabsTrigger>
              <TabsTrigger value="tasks" className="font-bold text-xs sm:text-sm">
                <Wrench className="w-4 h-4 mr-1.5" /> Tasks ({activeRepairs.length + activeOrders.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: FULL KARIGAR LEDGER TABLE */}
            <TabsContent value="ledger" className="space-y-4">
              <Card className="border shadow-md overflow-hidden">
                <CardHeader className="bg-muted/40 pb-3 border-b">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="font-display text-xl flex items-center gap-2">
                        <NotebookPen className="w-5 h-5 text-amber-600" />
                        Karigar Account Ledger Statement (कारीगर सम्पूर्ण बहीखाता)
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Complete chronological history of metal issued, ornaments returned, labour earned &amp; cash transactions for {activeKarigarName}.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm border-collapse min-w-[1000px]">
                      <thead className="bg-slate-900 text-white font-bold text-left uppercase text-[11px]">
                        <tr>
                          <th className="p-2.5 text-center w-10">#</th>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5">Voucher Type</th>
                          <th className="p-2.5">Remarks / Ref</th>
                          <th className="p-2.5 text-center">Metal</th>
                          <th className="p-2.5 text-right">Gross Wt</th>
                          <th className="p-2.5 text-right bg-amber-900/60 text-amber-200">Fine Issue</th>
                          <th className="p-2.5 text-right bg-emerald-900/60 text-emerald-200">Fine Rcvd</th>
                          <th className="p-2.5 text-right">Rate ₹/g</th>
                          <th className="p-2.5 text-right">Metal Amt</th>
                          <th className="p-2.5 text-right text-rose-300">Cash Dr (दिया)</th>
                          <th className="p-2.5 text-right text-emerald-300">Labour Cr (बनी)</th>
                          <th className="p-2.5 text-right bg-amber-950 text-amber-300 font-black">Gold Bal</th>
                          <th className="p-2.5 text-right bg-slate-800 font-black">Cash Bal</th>
                          <th className="p-2.5 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-mono text-xs">
                        {runningLedgerRows.map((r, i) => (
                          <tr key={r.id || i} className="hover:bg-muted/50 transition-colors">
                            <td className="p-2.5 text-center text-muted-foreground font-sans">{i + 1}</td>
                            <td className="p-2.5 font-sans font-medium whitespace-nowrap">{formatDDMMYYYY(r.date)}</td>
                            <td className="p-2.5 font-sans">
                              {r.type === "METAL_ISSUE" && (
                                <Badge className="bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-100">
                                  <ArrowUpRight className="w-3 h-3 mr-1 text-amber-600" /> Metal Issue
                                </Badge>
                              )}
                              {r.type === "METAL_RECEIVE" && (
                                <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-100">
                                  <ArrowDownLeft className="w-3 h-3 mr-1 text-emerald-600" /> Metal Rcvd
                                </Badge>
                              )}
                              {r.type === "CASH_GIVEN" && (
                                <Badge className="bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-100">
                                  Cash Adv.
                                </Badge>
                              )}
                              {r.type === "CASH_RECEIVED" && (
                                <Badge className="bg-sky-100 text-sky-900 border-sky-300 hover:bg-sky-100">
                                  Cash Rcvd
                                </Badge>
                              )}
                              {r.type === "LABOUR_CHARGE" && (
                                <Badge className="bg-purple-100 text-purple-900 border-purple-300 hover:bg-purple-100">
                                  Labour
                                </Badge>
                              )}
                            </td>
                            <td className="p-2.5 font-sans font-medium text-slate-800 dark:text-slate-200">
                              {r.remarks} {r.orderOrRepairNo ? <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold bg-amber-100 dark:bg-amber-950 px-1.5 py-0.5 rounded ml-1">Ref: {r.orderOrRepairNo}</span> : ""}
                            </td>
                            <td className="p-2.5 text-center font-sans">
                              {r.metalType !== "Other" ? `${r.metalType} (${r.purity})` : "—"}
                            </td>
                            <td className="p-2.5 text-right">{r.grossWeight ? `${r.grossWeight.toFixed(3)}g` : "—"}</td>
                            <td className="p-2.5 text-right font-bold text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/30">
                              {r.type === "METAL_ISSUE" ? `${r.fineWeight.toFixed(3)}g` : "—"}
                            </td>
                            <td className="p-2.5 text-right font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30">
                              {r.type === "METAL_RECEIVE" ? `${r.fineWeight.toFixed(3)}g` : "—"}
                            </td>
                            <td className="p-2.5 text-right">{r.ratePerGram ? inr(r.ratePerGram) : "—"}</td>
                            <td className="p-2.5 text-right font-bold text-slate-900 dark:text-slate-100">{r.metalAmount ? inr(r.metalAmount) : "—"}</td>
                            <td className="p-2.5 text-right text-rose-600 dark:text-rose-400 font-bold">{r.cashGiven ? inr(r.cashGiven) : "—"}</td>
                            <td className="p-2.5 text-right text-emerald-600 dark:text-emerald-400 font-bold">{r.labourAmount ? inr(r.labourAmount) : r.cashReceived ? inr(r.cashReceived) : "—"}</td>
                            <td className="p-2.5 text-right font-black text-amber-900 dark:text-amber-200 bg-amber-100/80 dark:bg-amber-950/80">
                              {r.runningGoldBal.toFixed(3)}g
                            </td>
                            <td className={`p-2.5 text-right font-black bg-slate-100 dark:bg-slate-800 ${r.runningCashBal >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                              {inr(r.runningCashBal)}
                            </td>
                            <td className="p-2.5 text-center font-sans">
                              <button
                                type="button"
                                onClick={() => handleDeleteVoucher(r.id)}
                                className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                                title="Delete Voucher Entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {runningLedgerRows.length === 0 && (
                          <tr>
                            <td colSpan={15} className="text-center py-12 text-muted-foreground font-sans">
                              No ledger entries found for {activeKarigarName}. Click <strong>"+ Issue Metal"</strong> or <strong>"+ Receive Metal"</strong> above to add transaction records.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: METAL ISSUE & RECEIVE DETAILED BREAKDOWN */}
            <TabsContent value="metal" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="bg-amber-50 dark:bg-amber-950/40 border-b">
                    <CardTitle className="text-lg font-display flex items-center gap-2 text-amber-900 dark:text-amber-200">
                      <ArrowUpRight className="w-5 h-5 text-amber-600" /> Metal Issued Summary (सोना/चांदी दिया)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex justify-between items-center py-2 border-b text-sm">
                      <span className="text-muted-foreground font-medium">Fine Gold Issued:</span>
                      <span className="font-bold font-mono text-amber-700 text-base">{ledgerSummary.goldIssuedFine.toFixed(3)} g</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b text-sm">
                      <span className="text-muted-foreground font-medium">Fine Silver Issued:</span>
                      <span className="font-bold font-mono text-slate-700 text-base">{ledgerSummary.silverIssuedFine.toFixed(3)} g</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b text-sm">
                      <span className="text-muted-foreground font-medium">Total Metal Amount Value:</span>
                      <span className="font-bold font-mono text-emerald-700 text-base">{inr(ledgerSummary.totalMetalAmountGiven)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 text-sm">
                      <span className="text-muted-foreground font-medium">Cash Advance Paid with Metal:</span>
                      <span className="font-bold font-mono text-rose-600 text-base">{inr(ledgerSummary.totalCashGiven)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="bg-emerald-50 dark:bg-emerald-950/40 border-b">
                    <CardTitle className="text-lg font-display flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                      <ArrowDownLeft className="w-5 h-5 text-emerald-600" /> Metal Received &amp; Labour (तैयार माल जमा)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex justify-between items-center py-2 border-b text-sm">
                      <span className="text-muted-foreground font-medium">Fine Gold Returned:</span>
                      <span className="font-bold font-mono text-emerald-700 text-base">{ledgerSummary.goldReturnedFine.toFixed(3)} g</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b text-sm">
                      <span className="text-muted-foreground font-medium">Fine Silver Returned:</span>
                      <span className="font-bold font-mono text-slate-700 text-base">{ledgerSummary.silverReturnedFine.toFixed(3)} g</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b text-sm">
                      <span className="text-muted-foreground font-medium">Total Labour Earned by Karigar:</span>
                      <span className="font-bold font-mono text-purple-700 text-base">{inr(ledgerSummary.totalLabourEarned)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 text-sm">
                      <span className="text-muted-foreground font-medium">Net Pending Fine Gold:</span>
                      <span className="font-black font-mono text-amber-800 text-lg">{ledgerSummary.netGoldPending.toFixed(3)} g</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* TAB 3: REPAIRS & CUSTOM ORDERS */}
            <TabsContent value="tasks" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1">
                      <Wrench className="w-4 h-4 text-amber-600" /> Active Repairs Assigned
                    </div>
                    <div className="text-2xl font-bold font-display text-primary mt-1">
                      {activeRepairs.length} <span className="text-xs font-normal text-muted-foreground">assigned</span>
                    </div>
                    <div className="text-xs font-semibold text-muted-foreground mt-1">
                      Total Weight: {repairsWeight.toFixed(2)} g
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4">
                    <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1">
                      <ShoppingBag className="w-4 h-4 text-amber-600" /> Active Custom Orders Assigned
                    </div>
                    <div className="text-2xl font-bold font-display text-primary mt-1">
                      {activeOrders.length} <span className="text-xs font-normal text-muted-foreground">assigned</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* REPAIRS TABLE */}
                <Card>
                  <CardHeader><CardTitle className="font-display flex items-center gap-2 text-base"><Wrench className="w-4 h-4"/> Repairs ({assignedRepairs.length})</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead className="text-left text-muted-foreground border-b bg-muted/20">
                          <tr>
                            <th className="py-2 px-3">Ticket</th>
                            <th>Item</th>
                            <th>Due</th>
                            <th className="px-3 text-right">Status</th>
                            <th className="px-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignedRepairs.map(r => (
                            <tr key={r._id || r.id} className="border-b last:border-0 hover:bg-muted/40">
                              <td className="py-2 px-3"><div className="font-bold">{r.ticketNo}</div><div className="text-[11px] text-muted-foreground">{formatDate(r.date)}</div></td>
                              <td><div className="font-medium">{r.itemDescription}</div><div className="text-[11px] text-rose-500">{r.problem}</div></td>
                              <td className="text-xs">{r.deliveryDate ? formatDate(r.deliveryDate) : "—"}</td>
                              <td className="px-3 py-2 text-right">
                                <select 
                                  className={`border rounded px-2 py-1 text-xs cursor-pointer ${r.status === 'Ready' ? 'bg-green-50 text-green-700 border-green-200 font-bold' : r.status === 'Delivered' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-background'}`} 
                                  value={r.status} 
                                  onChange={e => updateRepairStatus(r._id || r.id || "", e.target.value as Repair["status"])} 
                                  disabled={r.status === 'Delivered'}
                                >
                                  {['Received', 'In Progress', 'Ready', 'Delivered'].filter(s => s !== "Delivered" || r.status === "Delivered").map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </td>
                              <td className="px-3 text-right">
                                <Button size="sm" variant="ghost" onClick={() => setViewingRepair(r)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {assignedRepairs.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground text-xs">No repairs assigned.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* CUSTOM ORDERS TABLE */}
                <Card>
                  <CardHeader><CardTitle className="font-display flex items-center gap-2 text-base"><ShoppingBag className="w-4 h-4"/> Custom Orders ({assignedOrders.length})</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead className="text-left text-muted-foreground border-b bg-muted/20">
                          <tr>
                            <th className="py-2 px-3">Order</th>
                            <th>Item</th>
                            <th>Due</th>
                            <th className="px-3 text-right">Status</th>
                            <th className="px-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignedOrders.map(o => (
                            <tr key={o._id || o.id} className="border-b last:border-0 hover:bg-muted/40">
                              <td className="py-2 px-3"><div className="font-bold">{o.orderNo}</div><div className="text-[11px] text-muted-foreground">{formatDate(o.date)}</div></td>
                              <td><div className="font-medium">{o.itemDescription}</div><div className="text-[11px] text-muted-foreground">{o.metal} {o.purity}</div></td>
                              <td className="text-xs">{o.dueDate ? formatDate(o.dueDate) : "—"}</td>
                              <td className="px-3 py-2 text-right">
                                <select 
                                  className={`border rounded px-2 py-1 text-xs cursor-pointer ${o.status === 'Ready' ? 'bg-green-50 text-green-700 border-green-200 font-bold' : o.status === 'Delivered' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-background'}`} 
                                  value={o.status} 
                                  onChange={e => updateOrderStatus(o._id || o.id || "", e.target.value as Order["status"])} 
                                  disabled={o.status === 'Delivered'}
                                >
                                  {["Pending","In Progress","Ready","Delivered","Cancelled"].filter(s => s !== "Delivered" || o.status === "Delivered").map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </td>
                              <td className="px-3 text-right">
                                <Button size="sm" variant="ghost" onClick={() => setViewingOrder(o)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {assignedOrders.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground text-xs">No custom orders assigned.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* DIALOG 1: ISSUE METAL (सोना / चांदी दिया) */}
      <Dialog open={openIssueMetal} onOpenChange={setOpenIssueMetal}>
        <DialogContent className="w-[95vw] sm:max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <ArrowUpRight className="w-5 h-5 text-amber-600" /> Issue Metal to Karigar (कारीगर को सोना/चांदी दें)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record raw metal or gold bar issued to <strong>{activeKarigarName}</strong> for manufacturing/job work.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-xs sm:text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Date</Label>
                <Input type="date" value={issueForm.date} onChange={e => setIssueForm({ ...issueForm, date: e.target.value })} className="h-9 mt-1 text-xs" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Metal Type</Label>
                <Select value={issueForm.metalType} onValueChange={(v: any) => setIssueForm({ ...issueForm, metalType: v })}>
                  <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gold">Gold (सोना)</SelectItem>
                    <SelectItem value="Silver">Silver (चांदी)</SelectItem>
                    <SelectItem value="Alloy">Alloy / Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Purity Stamp</Label>
                <Select 
                  value={issueForm.purity} 
                  onValueChange={(v: any) => {
                    let touch = 91.6;
                    if (v.includes("24K") || v.includes("Fine")) touch = 99.9;
                    else if (v.includes("22K")) touch = 91.6;
                    else if (v.includes("20K")) touch = 83.3;
                    else if (v.includes("18K")) touch = 75.0;
                    else if (v.includes("14K")) touch = 58.5;
                    else if (v.includes("925")) touch = 92.5;
                    setIssueForm({ ...issueForm, purity: v, touchPct: touch });
                  }}
                >
                  <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24K (99.9%)">24K Fine (99.9%)</SelectItem>
                    <SelectItem value="22K (91.6%)">22K Hallmark (91.6%)</SelectItem>
                    <SelectItem value="20K (83.3%)">20K (83.3%)</SelectItem>
                    <SelectItem value="18K (75.0%)">18K (75.0%)</SelectItem>
                    <SelectItem value="14K (58.5%)">14K (58.5%)</SelectItem>
                    <SelectItem value="925 Silver (92.5%)">925 Silver (92.5%)</SelectItem>
                    <SelectItem value="Fine Silver (99.9%)">Fine Silver (99.9%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Touch / Purity %</Label>
                <Input type="number" value={issueForm.touchPct} onChange={e => setIssueForm({ ...issueForm, touchPct: Number(e.target.value) || 0 })} className="h-9 mt-1 text-xs font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Gross Weight (g) *</Label>
                <Input type="number" value={issueForm.grossWeight} onChange={e => setIssueForm({ ...issueForm, grossWeight: e.target.value ? Number(e.target.value) : "" })} placeholder="e.g. 10.500" className="h-9 mt-1 text-xs font-bold" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-amber-800 dark:text-amber-300">Fine Weight (शुद्ध वजन)</Label>
                <Input type="text" readOnly value={`${(((Number(issueForm.grossWeight) || 0) * (Number(issueForm.touchPct) || 0)) / 100).toFixed(3)} g`} className="h-9 mt-1 text-xs font-mono font-bold bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-amber-300" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Metal Rate (₹/g)</Label>
                <Input type="number" value={issueForm.ratePerGram} onChange={e => setIssueForm({ ...issueForm, ratePerGram: e.target.value ? Number(e.target.value) : "" })} placeholder="e.g. 7200" className="h-9 mt-1 text-xs font-bold" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Calculated Metal Amount</Label>
                <Input type="text" readOnly value={inr(((((Number(issueForm.grossWeight) || 0) * (Number(issueForm.touchPct) || 0)) / 100) * (Number(issueForm.ratePerGram) || 0)))} className="h-9 mt-1 text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border-emerald-300" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Cash Advance Given (₹)</Label>
                <Input type="number" value={issueForm.cashGiven} onChange={e => setIssueForm({ ...issueForm, cashGiven: e.target.value ? Number(e.target.value) : "" })} placeholder="Optional cash paid" className="h-9 mt-1 text-xs" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Order / Repair Ref No.</Label>
                <Input type="text" value={issueForm.orderOrRepairNo} onChange={e => setIssueForm({ ...issueForm, orderOrRepairNo: e.target.value })} placeholder="e.g. ORD-1002" className="h-9 mt-1 text-xs" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Remarks / Notes</Label>
              <Input type="text" value={issueForm.remarks} onChange={e => setIssueForm({ ...issueForm, remarks: e.target.value })} placeholder="e.g. Gold issued for 22K Bangle order" className="h-9 mt-1 text-xs" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpenIssueMetal(false)}>Cancel</Button>
            <Button onClick={handleSaveIssueMetal} className="bg-amber-700 hover:bg-amber-800 text-white font-bold">Save &amp; Issue Metal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: RECEIVE METAL / FINISHED ORNAMENT (तैयार माल मिला) */}
      <Dialog open={openReceiveMetal} onOpenChange={setOpenReceiveMetal}>
        <DialogContent className="w-[95vw] sm:max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
              <ArrowDownLeft className="w-5 h-5 text-emerald-600" /> Receive Metal / Ornament (तैयार माल/सोना जमा)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record finished ornament or returned metal received back from <strong>{activeKarigarName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-xs sm:text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Date</Label>
                <Input type="date" value={receiveForm.date} onChange={e => setReceiveForm({ ...receiveForm, date: e.target.value })} className="h-9 mt-1 text-xs" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Metal Type</Label>
                <Select value={receiveForm.metalType} onValueChange={(v: any) => setReceiveForm({ ...receiveForm, metalType: v })}>
                  <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gold">Gold (सोना)</SelectItem>
                    <SelectItem value="Silver">Silver (चांदी)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Item / Ornament Description</Label>
              <Input type="text" value={receiveForm.itemName} onChange={e => setReceiveForm({ ...receiveForm, itemName: e.target.value })} placeholder="e.g. 22K Finished Gold Ring (3 Pcs)" className="h-9 mt-1 text-xs font-medium" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Gross Weight (g) *</Label>
                <Input type="number" value={receiveForm.grossWeight} onChange={e => setReceiveForm({ ...receiveForm, grossWeight: e.target.value ? Number(e.target.value) : "" })} placeholder="10.200" className="h-9 mt-1 text-xs font-bold" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-rose-600">Loss / Wastage (g)</Label>
                <Input type="number" value={receiveForm.lossWeight} onChange={e => setReceiveForm({ ...receiveForm, lossWeight: e.target.value ? Number(e.target.value) : "" })} placeholder="0.200" className="h-9 mt-1 text-xs font-bold" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Touch / Purity %</Label>
                <Input type="number" value={receiveForm.touchPct} onChange={e => setReceiveForm({ ...receiveForm, touchPct: Number(e.target.value) || 0 })} className="h-9 mt-1 text-xs font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Fine Return Weight</Label>
                <Input type="text" readOnly value={`${((Math.max(0, (Number(receiveForm.grossWeight) || 0) - (Number(receiveForm.lossWeight) || 0)) * (Number(receiveForm.touchPct) || 0)) / 100).toFixed(3)} g`} className="h-9 mt-1 text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border-emerald-300" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Metal Rate (₹/g)</Label>
                <Input type="number" value={receiveForm.ratePerGram} onChange={e => setReceiveForm({ ...receiveForm, ratePerGram: e.target.value ? Number(e.target.value) : "" })} placeholder="7200" className="h-9 mt-1 text-xs font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-purple-50 dark:bg-purple-950/40 rounded-lg border border-purple-200 dark:border-purple-800">
              <div>
                <Label className="text-xs font-bold text-purple-900 dark:text-purple-200">Labour Charge Type</Label>
                <Select value={receiveForm.labourType} onValueChange={(v: any) => setReceiveForm({ ...receiveForm, labourType: v })}>
                  <SelectTrigger className="h-8 mt-1 text-xs bg-white dark:bg-slate-900"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PER_GRAM">Per Gram (₹/g)</SelectItem>
                    <SelectItem value="FIXED">Fixed Amount (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold text-purple-900 dark:text-purple-200">Labour Rate (मजदूरी)</Label>
                <Input type="number" value={receiveForm.labourRate} onChange={e => setReceiveForm({ ...receiveForm, labourRate: e.target.value ? Number(e.target.value) : "" })} placeholder="e.g. 250" className="h-8 mt-1 text-xs font-bold bg-white dark:bg-slate-900" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Order Ref No.</Label>
                <Input type="text" value={receiveForm.orderOrRepairNo} onChange={e => setReceiveForm({ ...receiveForm, orderOrRepairNo: e.target.value })} placeholder="e.g. ORD-1002" className="h-9 mt-1 text-xs" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Remarks</Label>
                <Input type="text" value={receiveForm.remarks} onChange={e => setReceiveForm({ ...receiveForm, remarks: e.target.value })} placeholder="Finished item returned" className="h-9 mt-1 text-xs" />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpenReceiveMetal(false)}>Cancel</Button>
            <Button onClick={handleSaveReceiveMetal} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold">Save &amp; Receive Ornament</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: CASH / LABOUR TRANSACTIONS */}
      <Dialog open={openCashTx} onOpenChange={setOpenCashTx}>
        <DialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
              <Coins className="w-5 h-5 text-indigo-600" /> Cash / Labour Transaction (नगद हिसाब / मजदूरी)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record cash paid to or received from <strong>{activeKarigarName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-xs sm:text-sm">
            <div>
              <Label className="text-xs font-semibold">Date</Label>
              <Input type="date" value={cashTxForm.date} onChange={e => setCashTxForm({ ...cashTxForm, date: e.target.value })} className="h-9 mt-1 text-xs" />
            </div>

            <div>
              <Label className="text-xs font-semibold">Transaction Type</Label>
              <Select value={cashTxForm.txType} onValueChange={(v: any) => setCashTxForm({ ...cashTxForm, txType: v })}>
                <SelectTrigger className="h-9 mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH_GIVEN">Cash Given / Advance Paid (कारीगर को नगद दिया)</SelectItem>
                  <SelectItem value="CASH_RECEIVED">Cash Received from Karigar (कारीगर से नगद प्राप्त)</SelectItem>
                  <SelectItem value="LABOUR_CHARGE">Labour Charges Earned (मजदूरी जमा की)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Amount (₹) *</Label>
              <Input type="number" value={cashTxForm.amount} onChange={e => setCashTxForm({ ...cashTxForm, amount: e.target.value ? Number(e.target.value) : "" })} placeholder="e.g. 5000" className="h-9 mt-1 text-xs font-bold" />
            </div>

            <div>
              <Label className="text-xs font-semibold">Remarks / Note</Label>
              <Input type="text" value={cashTxForm.remarks} onChange={e => setCashTxForm({ ...cashTxForm, remarks: e.target.value })} placeholder="e.g. Advance cash for festival" className="h-9 mt-1 text-xs" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpenCashTx(false)}>Cancel</Button>
            <Button onClick={handleSaveCashTx} className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold">Save Transaction</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: VIEW REPAIR DETAILS */}
      <Dialog open={!!viewingRepair} onOpenChange={(v) => !v && setViewingRepair(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6" onInteractOutside={(e) => e.preventDefault()}>
          {viewingRepair && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">Repair Details - {viewingRepair.ticketNo}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Item Description</div>
                  <div className="font-semibold text-lg text-foreground mt-0.5">{viewingRepair.itemDescription}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Problem / Work to do</div>
                  <div className="font-medium text-rose-600 bg-rose-50 p-2 rounded border border-rose-200 text-sm mt-0.5">{viewingRepair.problem}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Item Weight</div>
                    <div className="font-semibold text-foreground text-sm mt-0.5">{viewingRepair.itemWeight} g</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Delivery Date</div>
                    <div className="font-semibold text-foreground text-sm mt-0.5">{viewingRepair.deliveryDate ? formatDate(viewingRepair.deliveryDate) : "—"}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Note / Instructions</div>
                  <div className="font-normal text-muted-foreground text-xs mt-0.5 bg-muted/30 p-2 rounded">{viewingRepair.note || "—"}</div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG 5: VIEW ORDER DETAILS */}
      <Dialog open={!!viewingOrder} onOpenChange={(v) => !v && setViewingOrder(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6" onInteractOutside={(e) => e.preventDefault()}>
          {viewingOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">Order Details - {viewingOrder.orderNo}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Item Description</div>
                  <div className="font-semibold text-lg text-foreground mt-0.5">{viewingOrder.itemDescription}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Metal &amp; Purity</div>
                    <div className="font-semibold text-amber-800 text-sm mt-0.5">{viewingOrder.metal} - {viewingOrder.purity}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Due Date</div>
                    <div className="font-semibold text-foreground text-sm mt-0.5">{viewingOrder.dueDate ? formatDate(viewingOrder.dueDate) : "—"}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Note / Instructions</div>
                  <div className="font-normal text-muted-foreground text-xs mt-0.5 bg-muted/30 p-2 rounded">{viewingOrder.note || "—"}</div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );

  if (isKarigar) {
    return (
      <div className="min-h-screen bg-muted/10 flex flex-col">
        <div className="bg-card border-b px-6 py-4 flex items-center justify-between shadow-sm mb-6">
          <div className="font-display font-bold text-xl text-primary flex items-center gap-2">
            <Hammer className="w-5 h-5 text-amber-600" /> {shopName} — Karigar Work &amp; Ledger Portal
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              localStorage.removeItem("ajms.auth");
              localStorage.removeItem("ajms.tenant");
              window.location.href = "/";
            }}
          >
            Logout
          </Button>
        </div>
        <div className="px-4 sm:px-6 w-full max-w-7xl mx-auto pb-12 flex-1">
          {pageContent}
        </div>
      </div>
    );
  }

  return <Layout>{pageContent}</Layout>;
}