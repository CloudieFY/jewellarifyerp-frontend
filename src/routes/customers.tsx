import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { useFormKeyboardNav } from "@/lib/useFormKeyboardNav";
import {
  Plus,
  Trash2,
  Pencil,
  Search,
  Loader2,
  Eye,
  Receipt,
  Wallet,
  ShoppingBag,
  UserCheck,
  Wrench,
  MessageCircle,
  Landmark,
  Sparkles,
  Award,
  FileSpreadsheet,
  PhoneCall,
  NotebookPen,
  TrendingUp,
  CreditCard,
  CheckCircle2,
  History,
  Calendar,
  X,
  Printer,
} from "lucide-react";
import { formatDate, useDebounce, triggerPrint } from "@/lib/utils";
import { useTenantAPI } from "@/lib/api";
import { inr, calcItem, getUpiQrCodeUrl, defaultInvoiceSettings, type InvoiceSettings, type Invoice, type InvoicePayment, type Order, type Repair, type Girvi, type Customer } from "@/lib/storage";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShopHeader, InvoiceTerms } from "@/components/InvoiceBranding";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx";

const empty: Customer = {
  name: "",
  phone: "",
  phone2: "",
  address: "",
  gstNumber: "",
  pan: "",
  notes: "",
};

const defaultManualDue: any = {
  customerId: "NEW",
  customerName: "",
  phone: "",
  phone2: "",
  address: "",
  gstNumber: "",
  itemName: "",
  dueAmount: "" as number | "",
  date: new Date().toISOString().slice(0, 10),
};

const formatInvoiceItems = (items?: any[]) => {
  if (!items || items.length === 0) return "—";
  return items
    .map((it) => {
      let rawName = (it.name || "Item").trim();
      const cleanName = rawName.replace(/\s*\(\s*HUID\s*:[^)]*\)/gi, "").trim();
      if (it.huid) {
        return `${cleanName} (HUID: ${it.huid})`;
      }
      if (rawName.includes("(HUID:")) {
        return rawName;
      }
      return cleanName;
    })
    .join(", ");
};

export default function CustomersPage() {
  const { tenantSession } = useAuth();
  const api = useTenantAPI();
  const queryClient = useQueryClient();

  const shopIdentifier = useMemo(() => {
    return tenantSession?.shop?.slug || tenantSession?.shop?.shopName || "JewelShop ERP";
  }, [tenantSession]);

  const useApiMutation = (mutationFn: (...args: any[]) => Promise<any>, queryKey: string[]) => {
    return useMutation({
      mutationFn,
      onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });
  };

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Customer>(empty);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>("ALL");

  // CRM Note Modal State
  const [crmNoteModalOpen, setCrmNoteModalOpen] = useState(false);
  const [newCrmNoteText, setNewCrmNoteText] = useState("");
  const [crmNotesList, setCrmNotesList] = useState<{ [key: string]: Array<{ date: string; note: string }> }>({});

  // Payment Collection & History States
  const [payModalInvoice, setPayModalInvoice] = useState<Invoice | null>(null);
  const [collectAmount, setCollectAmount] = useState<number | "">("");
  const [collectPaymentMode, setCollectPaymentMode] = useState<string>("Cash");
  const [collectDate, setCollectDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [collectNote, setCollectNote] = useState<string>("");
  const [historyInvoice, setHistoryInvoice] = useState<Invoice | null>(null);

  // Step Edit & Print States
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [editingStepDraft, setEditingStepDraft] = useState<InvoicePayment>({
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    mode: "Cash",
    note: "",
  });
  const [printingStepData, setPrintingStepData] = useState<{
    invoice: Invoice;
    step: InvoicePayment;
    stepIndex: number;
    remainingDueAfterStep: number;
  } | null>(null);

  // Fetch customers
  const { data: customers = [], isLoading, error } = useQuery({ queryKey: ["customers"], queryFn: api.customers.getAll });
  const { data: allInvoices = [] } = useQuery<Invoice[]>({ queryKey: ["invoices"], queryFn: api.invoices.getAll });
  const { data: orders = [] } = useQuery<Order[]>({ queryKey: ["orders"], queryFn: api.orders.getAll });
  const { data: repairs = [] } = useQuery<Repair[]>({ queryKey: ["repairs"], queryFn: api.repairs.getAll });
  const { data: girvis = [] } = useQuery<Girvi[]>({ queryKey: ["girvis"], queryFn: api.girvi.getAll });

  const isOperator = tenantSession?.user?.role === "operator";
  const invoices = useMemo(() => allInvoices.filter((i) => (isOperator ? i.type !== "GST" : i.type === "GST")), [allInvoices, isOperator]);

  const createInvoiceMutation = useApiMutation((data: any) => api.invoices.create(data), ["invoices"]);
  const updateInvoiceMutation = useApiMutation((data: { id: string; body: any }) => api.invoices.update(data.id, data.body), ["invoices"]);
  const createMutation = useApiMutation((data: Customer) => api.customers.create(data), ["customers"]);
  const updateMutation = useApiMutation((data: { id: string; body: Customer }) => api.customers.update(data.id, data.body), ["customers"]);
  const deleteMutation = useApiMutation((id: string) => api.customers.remove(id), ["customers"]);

  // Manual due state
  const [manualDueOpen, setManualDueOpen] = useState(false);
  const [manualDue, setManualDue] = useState(defaultManualDue);

  const selectedCustomer = useMemo(() => {
    if (!profileId) return null;
    return customers.find((c: Customer) => c._id === profileId || c.id === profileId) || null;
  }, [profileId, customers]);

  const custInvoices = useMemo(() => {
    if (!selectedCustomer) return [];
    return invoices.filter((i) => i.customerId === selectedCustomer._id || i.customerMobile === selectedCustomer.phone);
  }, [selectedCustomer, invoices]);

  const custOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    return orders.filter((o) => o.customerMobile === selectedCustomer.phone || o.customerName === selectedCustomer.name);
  }, [selectedCustomer, orders]);

  const custRepairs = useMemo(() => {
    if (!selectedCustomer) return [];
    return repairs.filter((r) => r.customerMobile === selectedCustomer.phone || r.customerName === selectedCustomer.name);
  }, [selectedCustomer, repairs]);

  const custGirvis = useMemo(() => {
    if (!selectedCustomer) return [];
    return girvis.filter((g) => g.customerMobile === selectedCustomer.phone || g.customerName === selectedCustomer.name);
  }, [selectedCustomer, girvis]);

  const totalSales = useMemo(() => custInvoices.reduce((sum, i) => sum + i.total, 0), [custInvoices]);
  const totalPaid = useMemo(
    () => custInvoices.reduce((sum, i) => sum + (i.amountPaid !== undefined ? i.amountPaid : i.total), 0),
    [custInvoices]
  );
  const totalDue = useMemo(() => custInvoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0), [custInvoices]);
  const activeLoans = useMemo(() => custGirvis.filter((g) => g.status === "Active" || (g.status as any) === "ACTIVE").length, [custGirvis]);
  const totalLoanAmount = useMemo(
    () => custGirvis.filter((g) => g.status === "Active" || (g.status as any) === "ACTIVE").reduce((sum, g) => sum + (g.loanAmount || 0), 0),
    [custGirvis]
  );

  // CRM Analytics Metrics
  const crmMetrics = useMemo(() => {
    let totalLtv = 0;
    let totalDues = 0;
    let vipCount = 0;
    let regularCount = 0;

    customers.forEach((c: Customer) => {
      const cInvoices = invoices.filter((i) => i.customerId === c._id || i.customerMobile === c.phone);
      const ltv = cInvoices.reduce((s, i) => s + (i.total || 0), 0);
      const due = cInvoices.reduce((s, i) => s + (i.balanceDue || 0), 0);

      totalLtv += ltv;
      totalDues += due;

      if (ltv >= 100000 || (c as any).tier === "VIP") {
        vipCount++;
      } else {
        regularCount++;
      }
    });

    return { totalLtv, totalDues, vipCount, regularCount, totalCustomers: customers.length };
  }, [customers, invoices]);

  // Filtering
  const filtered = useMemo(() => {
    let res = customers.filter((c: Customer) => {
      if (!debouncedQ) return true;
      const search = debouncedQ.toLowerCase();
      return (
        c.name.toLowerCase().includes(search) ||
        (c.phone && c.phone.includes(search)) ||
        (c.address && c.address.toLowerCase().includes(search))
      );
    });

    if (selectedTierFilter !== "ALL") {
      res = res.filter((c: Customer) => {
        if (selectedTierFilter === "VIP") return (c as any).tier === "VIP" || (c as any).ltv >= 100000;
        if (selectedTierFilter === "WHOLESALE") return (c as any).tier === "WHOLESALE";
        if (selectedTierFilter === "REGULAR") return !(c as any).tier || (c as any).tier === "REGULAR";
        return true;
      });
    }

    return res;
  }, [customers, debouncedQ, selectedTierFilter]);

  const pageSize = 15;
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  const startCreate = () => {
    setDraft(empty);
    setEditingId(null);
    setOpen(true);
  };

  const startEdit = (c: Customer) => {
    setDraft(c);
    setEditingId(c._id || null);
    setOpen(true);
  };

  const set = (key: keyof Customer, val: any) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
  };

  const save = async () => {
    if (!draft.name || !draft.name.trim()) {
      toast.error("Customer Name is required.");
      return;
    }
    const finalDraft = {
      ...draft,
      pan: draft.pan ? draft.pan.toUpperCase().trim() : "",
      gstNumber: draft.gstNumber ? draft.gstNumber.toUpperCase().trim() : "",
    };
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: finalDraft });
        toast.success("Customer updated successfully");
      } else {
        await createMutation.mutateAsync(finalDraft);
        toast.success("Customer added successfully");
      }
      setOpen(false);
      setDraft(empty);
    } catch {
      toast.error("Failed to save customer");
    }
  };

  const saveManualDue = async () => {
    if (!manualDue.customerName || !manualDue.itemName || !manualDue.dueAmount || Number(manualDue.dueAmount) <= 0) {
      toast.error("Please enter Customer Name, Item Name, and a valid Due Amount.");
      return;
    }
    try {
      const amount = Number(manualDue.dueAmount);
      const initialPayment: InvoicePayment = {
        date: manualDue.date || new Date().toISOString().slice(0, 10),
        amount: 0,
        mode: "Pending",
        note: "Manual Due Entry Created",
      };

      const newInvoice: any = {
        number: `MAN-${Date.now().toString().slice(-6)}`,
        createdAt: manualDue.date || new Date().toISOString().slice(0, 10),
        customerId: manualDue.customerId !== "NEW" ? manualDue.customerId : undefined,
        customerName: manualDue.customerName,
        customerMobile: manualDue.phone,
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
            name: manualDue.itemName,
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

      await createInvoiceMutation.mutateAsync(newInvoice);

      if (manualDue.customerId === "NEW") {
        await createMutation.mutateAsync({
          name: manualDue.customerName,
          phone: manualDue.phone,
          phone2: manualDue.phone2,
          address: manualDue.address,
          gstNumber: manualDue.gstNumber,
          notes: "Auto-created via Manual Due entry",
        });
      }

      toast.success("Manual Due Invoice created successfully!");
      setManualDueOpen(false);
      setManualDue(defaultManualDue);
    } catch (e) {
      toast.error("Failed to create manual due entry");
    }
  };

  const handleCollectPaymentSubmit = async () => {
    if (!payModalInvoice || !collectAmount || Number(collectAmount) <= 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }
    const amt = Number(collectAmount);
    const currentPaid = payModalInvoice.amountPaid !== undefined ? payModalInvoice.amountPaid : payModalInvoice.total;
    const currentDue = payModalInvoice.balanceDue || 0;

    if (amt > currentDue) {
      toast.error(`Payment amount cannot exceed balance due of ${inr(currentDue)}`);
      return;
    }

    const newPaid = currentPaid + amt;
    const newDue = Math.max(0, currentDue - amt);

    // Preserve existing payment steps array or construct initial step
    let updatedPayments: InvoicePayment[] = payModalInvoice.payments ? [...payModalInvoice.payments] : [];
    if (updatedPayments.length === 0 && currentPaid > 0) {
      updatedPayments.push({
        date: formatDate(payModalInvoice.createdAt),
        amount: currentPaid,
        mode: payModalInvoice.paymentMode || "Initial",
        note: "Initial Advance / Payment Step",
      });
    }

    updatedPayments.push({
      date: collectDate || new Date().toISOString().slice(0, 10),
      amount: amt,
      mode: collectPaymentMode,
      note: collectNote ? collectNote.trim() : `Installment Step #${updatedPayments.length + 1}`,
    });

    const updatedInvoiceBody = {
      ...payModalInvoice,
      amountPaid: newPaid,
      balanceDue: newDue,
      paymentMode: collectPaymentMode as any,
      payments: updatedPayments,
    };

    try {
      await updateInvoiceMutation.mutateAsync({
        id: payModalInvoice._id || payModalInvoice.id || "",
        body: updatedInvoiceBody,
      });
      toast.success(`Collected ${inr(amt)} payment step for Bill #${payModalInvoice.number}!`);
      setPayModalInvoice(null);
      setCollectAmount("");
      setCollectNote("");
      setCollectDate(new Date().toISOString().slice(0, 10));

      if (historyInvoice && (historyInvoice._id === payModalInvoice._id || historyInvoice.id === payModalInvoice.id)) {
        setHistoryInvoice(updatedInvoiceBody as Invoice);
      }
    } catch {
      toast.error("Failed to update payment step.");
    }
  };

  // Delete Payment Step
  const handleDeleteStep = async (stepIndex: number) => {
    if (!historyInvoice) return;

    let currentSteps: InvoicePayment[] = historyInvoice.payments ? [...historyInvoice.payments] : [];
    if (currentSteps.length === 0) {
      toast.error("No steps to delete.");
      return;
    }

    const removed = currentSteps[stepIndex];
    const newSteps = currentSteps.filter((_, idx) => idx !== stepIndex);

    const newPaid = newSteps.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const newDue = Math.max(0, (historyInvoice.total || 0) - newPaid);

    const updatedInvoiceBody = {
      ...historyInvoice,
      amountPaid: newPaid,
      balanceDue: newDue,
      payments: newSteps,
    };

    try {
      await updateInvoiceMutation.mutateAsync({
        id: historyInvoice._id || historyInvoice.id || "",
        body: updatedInvoiceBody,
      });
      toast.success(`Deleted step of ${inr(removed.amount || 0)} successfully.`);
      setHistoryInvoice(updatedInvoiceBody as Invoice);
    } catch {
      toast.error("Failed to delete payment step.");
    }
  };

  // Start Edit Step
  const startEditStep = (stepIndex: number, step: InvoicePayment) => {
    setEditingStepIndex(stepIndex);
    setEditingStepDraft({
      date: step.date || new Date().toISOString().slice(0, 10),
      amount: step.amount || 0,
      mode: step.mode || "Cash",
      note: step.note || "",
    });
  };

  // Save Edit Step
  const saveEditStep = async () => {
    if (!historyInvoice || editingStepIndex === null) return;
    if (!editingStepDraft.amount || Number(editingStepDraft.amount) <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    let currentSteps: InvoicePayment[] = historyInvoice.payments ? [...historyInvoice.payments] : [];
    currentSteps[editingStepIndex] = {
      ...editingStepDraft,
      amount: Number(editingStepDraft.amount),
    };

    const newPaid = currentSteps.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const newDue = Math.max(0, (historyInvoice.total || 0) - newPaid);

    const updatedInvoiceBody = {
      ...historyInvoice,
      amountPaid: newPaid,
      balanceDue: newDue,
      payments: currentSteps,
    };

    try {
      await updateInvoiceMutation.mutateAsync({
        id: historyInvoice._id || historyInvoice.id || "",
        body: updatedInvoiceBody,
      });
      toast.success("Payment step updated successfully!");
      setHistoryInvoice(updatedInvoiceBody as Invoice);
      setEditingStepIndex(null);
    } catch {
      toast.error("Failed to update payment step.");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Customer removed successfully");
    } catch {
      toast.error("Failed to remove customer");
    }
  };

  const sendWhatsAppMsg = (phoneRaw: string | undefined, message: string) => {
    if (!phoneRaw) {
      toast.error("No phone number available for this customer.");
      return;
    }
    let phone = phoneRaw.replace(/\D/g, "");
    if (phone.length === 10) phone = "91" + phone;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
  };

  const sendComprehensiveReminder = () => {
    if (!selectedCustomer) return;
    const unpaidInvoices = custInvoices.filter((i) => (i.balanceDue || 0) > 0);
    if (unpaidInvoices.length === 0) {
      toast.info("Customer has zero balance due!");
      return;
    }
    let totalUnpaid = unpaidInvoices.reduce((s, i) => s + (i.balanceDue || 0), 0);
    let detailsStr = unpaidInvoices.map((i) => `• Bill #${i.number}: ${inr(i.balanceDue || 0)}`).join("\n");
    let msg = `*${shopIdentifier}*\n\nनमस्ते ${selectedCustomer.name},\n\nआपके खाते में कुल बकाया राशि: *${inr(
      totalUnpaid
    )}* है।\n\nविवरण:\n${detailsStr}\n\nकृपया जल्द ही दुकान पर आकर भुगतान करें।\n\nधन्यवाद!`;

    sendWhatsAppMsg(selectedCustomer.phone, msg);
  };

  const addCrmNote = () => {
    if (!selectedCustomer || !newCrmNoteText.trim()) return;
    const custKey = selectedCustomer._id || selectedCustomer.phone;
    const currentNotes = crmNotesList[custKey] || [];
    const updated = [
      { date: new Date().toISOString().slice(0, 10), note: newCrmNoteText.trim() },
      ...currentNotes,
    ];
    setCrmNotesList((prev) => ({ ...prev, [custKey]: updated }));
    setNewCrmNoteText("");
    setCrmNoteModalOpen(false);
    toast.success("CRM note logged successfully!");
  };

  const exportCustomerDatabaseToExcel = () => {
    const sheetData = [
      ["CUSTOMER DATABASE & CRM MASTER"],
      ["Generated Date:", new Date().toLocaleString()],
      [],
      ["Name", "Mobile", "Mobile 2", "City / Address", "GSTIN", "PAN", "DOB", "Anniversary", "Total LTV (₹)", "Current Due (₹)"],
      ...customers.map((c: Customer) => {
        const cInvoices = invoices.filter((i) => i.customerId === c._id || i.customerMobile === c.phone);
        const ltv = cInvoices.reduce((s, i) => s + (i.total || 0), 0);
        const due = cInvoices.reduce((s, i) => s + (i.balanceDue || 0), 0);
        return [
          c.name,
          c.phone || "",
          c.phone2 || "",
          c.address || "",
          c.gstNumber ? c.gstNumber.toUpperCase() : "",
          c.pan ? c.pan.toUpperCase() : "",
          (c as any).dob ? formatDate((c as any).dob) : "",
          (c as any).anniversary ? formatDate((c as any).anniversary) : "",
          ltv,
          due,
        ];
      }),
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 35 }, { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers CRM");
    XLSX.writeFile(wb, `Customer_CRM_Database_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Customer CRM database exported to Excel!");
  };

  const handleNewCustKeyNav = useFormKeyboardNav(save);

  const isLoading_UI = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        {/* HERO CRM BANNER */}
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 text-white shadow-xl">
          <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-300 border border-amber-500/30 backdrop-blur-md">
                  <Sparkles className="w-3.5 h-3.5" /> Customer Relationship Management (CRM)
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-white">
                Customer CRM &amp; Accounts
              </h1>
              <p className="text-sm text-slate-300 mt-1 max-w-xl">
                Manage 360° customer profiles, order history, repair jobs, girvi loans, dues, and one-click WhatsApp greetings.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Button
                onClick={exportCustomerDatabaseToExcel}
                variant="outline"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md text-xs h-10"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
              </Button>
              <Button onClick={startCreate} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-10 shadow-md">
                <Plus className="w-4 h-4 mr-2" /> New Customer
              </Button>
            </div>
          </div>

          {/* Quick Metrics Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800">
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3.5 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                <UserCheck className="w-4 h-4" /> Total Customers
              </div>
              <div className="text-2xl font-bold text-white mt-1 font-mono">{crmMetrics.totalCustomers}</div>
              <div className="text-[10px] text-slate-400">Registered Accounts</div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3.5 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                <TrendingUp className="w-4 h-4" /> Lifetime Sales (LTV)
              </div>
              <div className="text-2xl font-bold text-white mt-1 font-mono">{inr(crmMetrics.totalLtv)}</div>
              <div className="text-[10px] text-slate-400">Cumulative Revenue</div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3.5 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
                <Wallet className="w-4 h-4" /> Total Outstanding Dues
              </div>
              <div className="text-2xl font-bold text-white mt-1 font-mono">{inr(crmMetrics.totalDues)}</div>
              <div className="text-[10px] text-slate-400">Receivable Balance</div>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3.5 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold">
                <Award className="w-4 h-4" /> VIP Customers
              </div>
              <div className="text-2xl font-bold text-white mt-1 font-mono">{crmMetrics.vipCount}</div>
              <div className="text-[10px] text-slate-400">High LTV Buyers</div>
            </div>
          </div>
        </div>

        {/* SEARCH & FILTER CONTROLS */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-card border border-border p-3 rounded-xl shadow-xs">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-1">Filter Tier:</span>
            {["ALL", "VIP", "REGULAR", "WHOLESALE"].map((tier) => (
              <button
                key={tier}
                onClick={() => {
                  setSelectedTierFilter(tier);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedTierFilter === tier
                    ? "bg-amber-700 text-white shadow-sm"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {tier}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 h-9 text-xs bg-background"
              placeholder="Search by customer name, mobile, address, or GSTIN..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {/* CUSTOMER LIST TABLE & CARDS */}
        <Card className="shadow-xs border-border overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-12">Loading customer CRM database...</p>
            ) : error ? (
              <p className="text-sm text-red-500 py-12 text-center">Failed to load customer data</p>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground space-y-2">
                <UserCheck className="w-10 h-10 mx-auto opacity-40 text-amber-600" />
                <p className="text-base font-semibold">No customers match your search.</p>
              </div>
            ) : (
              <div>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm min-w-[950px]">
                    <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                      <tr>
                        <th className="py-3 px-4 font-semibold text-left">Customer Name</th>
                        <th className="py-3 px-4 font-semibold text-left">Mobile &amp; Contact</th>
                        <th className="py-3 px-4 font-semibold text-left">Address &amp; City</th>
                        <th className="py-3 px-4 font-semibold text-left">GSTIN / PAN</th>
                        <th className="py-3 px-4 font-semibold text-left">Tier / Status</th>
                        <th className="py-3 px-4 font-semibold text-right">LTV Sales</th>
                        <th className="py-3 px-4 font-semibold text-right">Active Due</th>
                        <th className="py-3 px-4 font-semibold text-right pr-6">CRM Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((c: Customer) => {
                        const cInvoices = invoices.filter((i) => i.customerId === c._id || i.customerMobile === c.phone);
                        const custLtv = cInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
                        const custDue = cInvoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0);
                        const isVip = custLtv >= 100000 || (c as any).tier === "VIP";

                        return (
                          <tr key={c._id || c.id || c.phone} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-foreground">{c.name}</div>
                              {c.notes && <div className="text-xs text-muted-foreground line-clamp-1 italic">{c.notes}</div>}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-mono text-xs text-foreground flex items-center gap-1">
                                <PhoneCall className="w-3 h-3 text-muted-foreground" /> {c.phone || "—"}
                              </div>
                              {c.phone2 && <div className="text-xs text-muted-foreground font-mono">{c.phone2}</div>}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground text-xs">{c.address || "—"}</td>
                            <td className="py-3 px-4 text-xs font-mono">
                              <div>{c.gstNumber ? c.gstNumber.toUpperCase() : "—"}</div>
                              {c.pan && <div className="text-[10px] text-muted-foreground uppercase font-bold">{c.pan.toUpperCase()}</div>}
                            </td>
                            <td className="py-3 px-4">
                              {isVip ? (
                                <Badge className="bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-300 font-semibold text-[10px]">
                                  🌟 VIP Customer
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                  💎 Regular
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-foreground font-mono">{inr(custLtv)}</td>
                            <td className="py-3 px-4 text-right font-bold font-mono">
                              {custDue > 0 ? (
                                <span className="text-rose-600 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded border border-rose-200">
                                  {inr(custDue)}
                                </span>
                              ) : (
                                <span className="text-emerald-600 text-xs">Clear</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right pr-4">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs border-amber-500/30 text-amber-900 dark:text-amber-300 hover:bg-amber-50 font-medium"
                                  onClick={() => setProfileId(c._id || null)}
                                >
                                  <Eye className="w-3.5 h-3.5 mr-1" /> CRM Profile
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(c)} disabled={isLoading_UI}>
                                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500 hover:bg-rose-50" onClick={() => remove(c._id || "")} disabled={isLoading_UI}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden grid grid-cols-1 gap-3 p-3">
                  {paginated.map((c: Customer) => {
                    const cInvoices = invoices.filter((i) => i.customerId === c._id || i.customerMobile === c.phone);
                    const custLtv = cInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
                    const custDue = cInvoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0);

                    return (
                      <div key={c._id || c.id || c.phone} className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-base text-foreground">{c.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{c.phone} {c.phone2 ? `· ${c.phone2}` : ""}</div>
                          </div>
                          {custDue > 0 ? (
                            <span className="font-mono text-xs px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              Due: {inr(custDue)}
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-600 border border-emerald-300 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">
                              Clear
                            </span>
                          )}
                        </div>

                        {c.address && <div className="text-xs text-muted-foreground">📍 {c.address}</div>}

                        <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                          <span className="text-muted-foreground">LTV: <strong className="text-foreground">{inr(custLtv)}</strong></span>
                          <Button
                            size="sm"
                            className="bg-amber-700 hover:bg-amber-800 text-white text-xs h-7"
                            onClick={() => setProfileId(c._id || null)}
                          >
                            View CRM Profile
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* NEW / EDIT CUSTOMER DIALOG */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6" onInteractOutside={(e) => e.preventDefault()} onKeyDown={handleNewCustKeyNav}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-amber-700" />
              {editingId ? "Edit Customer CRM Details" : "Create New Customer Account"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Customer Full Name *</Label>
              <Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Ramesh Chandra Sharma" className="mt-1" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Primary Mobile No *</Label>
                <Input value={draft.phone || ""} onChange={(e) => set("phone", e.target.value)} placeholder="9876543210" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Secondary / WhatsApp No</Label>
                <Input value={draft.phone2 || ""} onChange={(e) => set("phone2", e.target.value)} placeholder="Alternate number" className="mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Full Address &amp; City</Label>
              <Input value={draft.address || ""} onChange={(e) => set("address", e.target.value)} placeholder="Shop / House No, Street, City, Pincode" className="mt-1" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">GSTIN (B2B)</Label>
                <Input value={draft.gstNumber || ""} onChange={(e) => set("gstNumber", e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" className="mt-1 font-mono text-xs uppercase" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">PAN No (Bullion HUID)</Label>
                <Input value={draft.pan || ""} onChange={(e) => set("pan", e.target.value.toUpperCase())} placeholder="ABCDE1234F" className="mt-1 font-mono text-xs uppercase" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Customer Preferences / Notes</Label>
              <Input value={draft.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. Prefers 22K Antique Bangle sets & Bridal Kundan" className="mt-1" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading_UI}>
              Cancel
            </Button>
            <Button onClick={save} disabled={isLoading_UI || !draft.name} className="bg-amber-700 hover:bg-amber-800 text-white font-medium">
              {isLoading_UI ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Save Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 360° CUSTOMER CRM PROFILE WORKSPACE MODAL */}
      <Dialog open={!!profileId} onOpenChange={(val) => !val && setProfileId(null)}>
        <DialogContent className="w-[95vw] sm:max-w-6xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border border-border shadow-2xl bg-card [&>button.absolute]:hidden" onInteractOutside={(e) => e.preventDefault()}>
          {selectedCustomer && (
            <div className="space-y-6">
              {/* Modal Executive Top Header Bar */}
              <div className="bg-slate-900 border-b border-slate-800 p-5 rounded-t-2xl text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-xl shadow-md border border-amber-500/30">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <DialogTitle className="text-xl font-bold text-white tracking-tight">{selectedCustomer.name}</DialogTitle>
                      {totalSales >= 100000 && (
                        <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px]">
                          🌟 VIP Account
                        </Badge>
                      )}
                      {selectedCustomer.gstNumber && (
                        <Badge variant="outline" className="text-[10px] text-slate-300 border-slate-700 font-mono uppercase">
                          GST: {selectedCustomer.gstNumber.toUpperCase()}
                        </Badge>
                      )}
                      {selectedCustomer.pan && (
                        <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-500/30 font-mono uppercase font-bold">
                          PAN: {selectedCustomer.pan.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 flex flex-wrap items-center gap-3 mt-1 font-sans">
                      <span className="flex items-center gap-1 font-mono">
                        <PhoneCall className="w-3.5 h-3.5 text-amber-400" /> {selectedCustomer.phone || "No Mobile"}
                      </span>
                      {selectedCustomer.phone2 && (
                        <span className="font-mono text-slate-400">· {selectedCustomer.phone2}</span>
                      )}
                      {selectedCustomer.address && <span className="text-slate-300">· 📍 {selectedCustomer.address}</span>}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={sendComprehensiveReminder}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-3.5 rounded-lg shadow-xs flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-4 h-4" /> WhatsApp Reminder
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCrmNoteModalOpen(true)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs h-9 px-3 rounded-lg flex items-center gap-1.5"
                  >
                    <NotebookPen className="w-4 h-4" /> Add Note
                  </Button>
                  <Button
                    size="icon"
                    onClick={() => setProfileId(null)}
                    className="h-9 w-9 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shrink-0 border-0 transition-transform hover:scale-105 ml-1"
                    title="Close Profile"
                  >
                    <X className="w-5 h-5 stroke-[2.5]" />
                  </Button>
                </div>
              </div>

              <div className="px-6 space-y-6 pb-6">
                {/* 360° Financial Summary Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* Card 1: Lifetime Sales */}
                  <div className="bg-card border border-border/80 rounded-xl p-4 shadow-2xs hover:border-amber-500/30 transition-all">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                      <span>Lifetime Sales (LTV)</span>
                      <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-foreground mt-2 font-mono tracking-tight">{inr(totalSales)}</div>
                    <div className="text-[11px] text-muted-foreground mt-1 font-medium">{custInvoices.length} Bills Generated</div>
                  </div>

                  {/* Card 2: Total Paid */}
                  <div className="bg-card border border-border/80 rounded-xl p-4 shadow-2xs hover:border-emerald-500/30 transition-all">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                      <span>Total Paid</span>
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                        <Wallet className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 font-mono tracking-tight">{inr(totalPaid)}</div>
                    <div className="text-[11px] text-muted-foreground mt-1 font-medium">Cash / Bank Received</div>
                  </div>

                  {/* Card 3: Current Balance Due */}
                  <div className="bg-card border border-border/80 rounded-xl p-4 shadow-2xs hover:border-rose-500/30 transition-all">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                      <span>Current Balance Due</span>
                      <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
                        <Receipt className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2 font-mono tracking-tight">{inr(totalDue)}</div>
                    <div className="text-[11px] mt-1 flex items-center gap-1.5 font-medium">
                      {totalDue > 0 ? (
                        <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md text-[10px] border border-rose-200">
                          ⚠️ Outstanding Due
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md text-[10px] border border-emerald-200">
                          ✓ Fully Clear
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card 4: Active Girvi Loans */}
                  <div className="bg-card border border-border/80 rounded-xl p-4 shadow-2xs hover:border-purple-500/30 transition-all">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                      <span>Active Girvi Loans</span>
                      <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
                        <Landmark className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2 font-mono tracking-tight">{inr(totalLoanAmount)}</div>
                    <div className="text-[11px] text-muted-foreground mt-1 font-medium">{activeLoans} Pledged Items</div>
                  </div>
                </div>

                {/* CRM TABS WORKSPACE */}
                <Tabs defaultValue="invoices" className="w-full space-y-4">
                  <TabsList className="bg-muted/80 border border-border/80 p-1 rounded-xl grid grid-cols-4 gap-1">
                    <TabsTrigger value="invoices" className="text-xs font-semibold rounded-lg data-[state=active]:bg-amber-600 data-[state=active]:text-white transition-all py-2">
                      Billing <span className="ml-1.5 px-2 py-0.5 rounded text-[10px] bg-black/10 dark:bg-white/10 font-mono">{custInvoices.length}</span>
                    </TabsTrigger>
                    <TabsTrigger value="orders" className="text-xs font-semibold rounded-lg data-[state=active]:bg-amber-600 data-[state=active]:text-white transition-all py-2">
                      Custom Orders <span className="ml-1.5 px-2 py-0.5 rounded text-[10px] bg-black/10 dark:bg-white/10 font-mono">{custOrders.length}</span>
                    </TabsTrigger>
                    <TabsTrigger value="repairs" className="text-xs font-semibold rounded-lg data-[state=active]:bg-amber-600 data-[state=active]:text-white transition-all py-2">
                      Repairs <span className="ml-1.5 px-2 py-0.5 rounded text-[10px] bg-black/10 dark:bg-white/10 font-mono">{custRepairs.length}</span>
                    </TabsTrigger>
                    <TabsTrigger value="girvi" className="text-xs font-semibold rounded-lg data-[state=active]:bg-amber-600 data-[state=active]:text-white transition-all py-2">
                      Girvi Loans <span className="ml-1.5 px-2 py-0.5 rounded text-[10px] bg-black/10 dark:bg-white/10 font-mono">{custGirvis.length}</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Tab 1: Billing History */}
                  <TabsContent value="invoices" className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-amber-700" /> Sales Invoices &amp; Payment Steps
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 border-amber-500/30 hover:bg-amber-50 text-amber-900 dark:text-amber-300 font-semibold"
                        onClick={() => {
                          setManualDue({
                            ...defaultManualDue,
                            date: new Date().toISOString().slice(0, 10),
                            customerId: selectedCustomer?._id || selectedCustomer?.id || "NEW",
                            customerName: selectedCustomer?.name || "",
                            phone: selectedCustomer?.phone || "",
                            address: selectedCustomer?.address || "",
                          });
                          setManualDueOpen(true);
                        }}
                      >
                        + Manual Due
                      </Button>
                    </div>

                    <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-2xs">
                      <table className="w-full text-xs text-left min-w-[850px]">
                        <thead className="bg-muted/40 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider border-b border-border">
                          <tr>
                            <th className="py-3 px-3.5">Invoice #</th>
                            <th className="py-3 px-3.5">Date</th>
                            <th className="py-3 px-3.5">Items</th>
                            <th className="py-3 px-3.5 text-right">Total</th>
                            <th className="py-3 px-3.5 text-right">Paid</th>
                            <th className="py-3 px-3.5 text-right">Balance Due</th>
                            <th className="py-3 px-3.5 text-center">Status</th>
                            <th className="py-3 px-3.5 text-center">Steps History</th>
                            <th className="py-3 px-3.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {custInvoices.map((inv) => {
                            const due = inv.balanceDue || 0;
                            const paid = inv.amountPaid !== undefined ? inv.amountPaid : inv.total;
                            const isFullyPaid = due <= 0;
                            const isPartial = !isFullyPaid && paid > 0;
                            const stepCount = inv.payments?.length || (paid > 0 ? 1 : 0);

                            return (
                              <tr key={inv._id || inv.id || inv.number} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                                <td className="py-3 px-3.5 font-mono font-bold text-foreground">{inv.number}</td>
                                <td className="py-3 px-3.5 text-muted-foreground font-mono">{formatDate(inv.createdAt)}</td>
                                <td className="py-3 px-3.5 text-foreground font-medium truncate max-w-64">
                                  {formatInvoiceItems(inv.items)}
                                </td>
                                <td className="py-3 px-3.5 text-right font-bold text-foreground font-mono">{inr(inv.total)}</td>
                                <td className="py-3 px-3.5 text-right text-emerald-600 font-bold font-mono">{inr(paid)}</td>
                                <td className="py-3 px-3.5 text-right font-bold font-mono">
                                  {due > 0 ? <span className="text-rose-600">{inr(due)}</span> : <span className="text-slate-400">₹0.00</span>}
                                </td>
                                <td className="py-3 px-3.5 text-center">
                                  {isFullyPaid ? (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Paid
                                    </span>
                                  ) : isPartial ? (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                      Partial
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      Due
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3.5 text-center">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 px-2.5 rounded-lg border border-amber-200/60"
                                    onClick={() => setHistoryInvoice(inv)}
                                  >
                                    <History className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                                    {stepCount} {stepCount === 1 ? "Step" : "Steps"}
                                  </Button>
                                </td>
                                <td className="py-3 px-3.5 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 rounded-lg"
                                      title="Print Full Tax Invoice"
                                      onClick={() => {
                                        setPrintingStepData({
                                          invoice: inv,
                                          step: inv.payments?.[inv.payments.length - 1] || {
                                            date: formatDate(inv.createdAt),
                                            amount: inv.amountPaid || inv.total,
                                            mode: inv.paymentMode || "Cash",
                                            note: "Full Invoice Print",
                                          },
                                          stepIndex: inv.payments?.length || 1,
                                          remainingDueAfterStep: inv.balanceDue || 0,
                                        });
                                      }}
                                    >
                                      <Printer className="w-3.5 h-3.5 mr-1.5 text-slate-600" /> Print
                                    </Button>
                                    {due > 0 ? (
                                      <Button
                                        size="sm"
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3 rounded-lg shadow-xs font-semibold flex items-center gap-1"
                                        onClick={() => {
                                          setPayModalInvoice(inv);
                                          setCollectAmount(due);
                                        }}
                                      >
                                        <CreditCard className="w-3.5 h-3.5" /> Receive
                                      </Button>
                                    ) : (
                                      <span className="text-emerald-600 text-xs font-semibold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Clear
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>

                  {/* Tab 2: Custom Orders */}
                  <TabsContent value="orders" className="space-y-3">
                    <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-blue-600" /> Custom Jewellery Orders
                    </h4>
                    <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-2xs">
                      <table className="w-full text-xs text-left min-w-[750px]">
                        <thead className="bg-muted/40 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider border-b border-border">
                          <tr>
                            <th className="py-3 px-3.5">Order #</th>
                            <th className="py-3 px-3.5">Date</th>
                            <th className="py-3 px-3.5">Item Description</th>
                            <th className="py-3 px-3.5">Due Date</th>
                            <th className="py-3 px-3.5 text-right">Est Amount</th>
                            <th className="py-3 px-3.5 text-right">Advance Paid</th>
                            <th className="py-3 px-3.5 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {custOrders.map((o) => (
                            <tr key={o.id || (o as any)._id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="py-3 px-3.5 font-mono font-bold text-foreground">{o.orderNo}</td>
                              <td className="py-3 px-3.5 text-muted-foreground font-mono">{formatDate(o.date)}</td>
                              <td className="py-3 px-3.5 font-medium">{o.itemDescription}</td>
                              <td className="py-3 px-3.5 text-rose-600 font-bold font-mono">{o.dueDate ? formatDate(o.dueDate) : "—"}</td>
                              <td className="py-3 px-3.5 text-right font-bold font-mono">{inr(o.estimatedTotalAmount || (o as any).estimatedAmount || 0)}</td>
                              <td className="py-3 px-3.5 text-right text-emerald-600 font-bold font-mono">{inr(o.advancePaid)}</td>
                              <td className="py-3 px-3.5 text-center">
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {o.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>

                  {/* Tab 3: Repairs */}
                  <TabsContent value="repairs" className="space-y-3">
                    <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-purple-600" /> Repair Jobs
                    </h4>
                    <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-2xs">
                      <table className="w-full text-xs text-left min-w-[750px]">
                        <thead className="bg-muted/40 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider border-b border-border">
                          <tr>
                            <th className="py-3 px-3.5">Ticket #</th>
                            <th className="py-3 px-3.5">Date</th>
                            <th className="py-3 px-3.5">Repair Item</th>
                            <th className="py-3 px-3.5 text-right">Cost</th>
                            <th className="py-3 px-3.5 text-right">Advance</th>
                            <th className="py-3 px-3.5 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {custRepairs.map((r) => (
                            <tr key={r.id || (r as any)._id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="py-3 px-3.5 font-mono font-bold text-foreground">{r.ticketNo}</td>
                              <td className="py-3 px-3.5 text-muted-foreground font-mono">{formatDate(r.date)}</td>
                              <td className="py-3 px-3.5 font-medium">{r.itemDescription}</td>
                              <td className="py-3 px-3.5 text-right font-bold font-mono">{inr(r.estimate || 0)}</td>
                              <td className="py-3 px-3.5 text-right text-emerald-600 font-bold font-mono">{inr(r.advance)}</td>
                              <td className="py-3 px-3.5 text-center">
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {r.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>

                  {/* Tab 4: Girvi Loans */}
                  <TabsContent value="girvi" className="space-y-3">
                    <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-purple-600" /> Girvi Loan Items
                    </h4>
                    <div className="overflow-x-auto border border-border rounded-xl bg-card shadow-2xs">
                      <table className="w-full text-xs text-left min-w-[750px]">
                        <thead className="bg-muted/40 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider border-b border-border">
                          <tr>
                            <th className="py-3 px-3.5">Girvi No</th>
                            <th className="py-3 px-3.5">Start Date</th>
                            <th className="py-3 px-3.5">Pledged Items</th>
                            <th className="py-3 px-3.5 text-right">Loan Amount</th>
                            <th className="py-3 px-3.5 text-right">Interest Rate</th>
                            <th className="py-3 px-3.5 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {custGirvis.map((g) => (
                            <tr key={g.id || (g as any)._id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="py-3 px-3.5 font-mono font-bold text-foreground">{(g as any).girviNo || (g as any)._id || g.id}</td>
                              <td className="py-3 px-3.5 text-muted-foreground font-mono">{formatDate(g.date)}</td>
                              <td className="py-3 px-3.5 font-medium">{g.itemDescription || (g as any).itemsDescription || "—"}</td>
                              <td className="py-3 px-3.5 text-right font-bold text-purple-600 font-mono">{inr(g.loanAmount || 0)}</td>
                              <td className="py-3 px-3.5 text-right font-mono">{g.interestPct}% / mo</td>
                              <td className="py-3 px-3.5 text-center">
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {g.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* STEP-BY-STEP PAYMENT HISTORY TIMELINE MODAL */}
      <Dialog open={!!historyInvoice} onOpenChange={(val) => !val && setHistoryInvoice(null)}>
        <DialogContent className="w-[95vw] sm:max-w-lg p-0 rounded-2xl border border-border shadow-2xl bg-card overflow-hidden [&>button.absolute]:hidden">
          {historyInvoice && (() => {
            const total = historyInvoice.total || 0;
            const paid = historyInvoice.amountPaid !== undefined ? historyInvoice.amountPaid : total;
            const due = historyInvoice.balanceDue || 0;

            let steps: InvoicePayment[] = historyInvoice.payments && historyInvoice.payments.length > 0
              ? [...historyInvoice.payments]
              : (paid > 0 ? [{
                  date: formatDate(historyInvoice.createdAt),
                  amount: paid,
                  mode: historyInvoice.paymentMode || "Cash",
                  note: "Initial Advance / Payment Step"
                }] : []);

            let runningTotal = 0;

            return (
              <div>
                {/* Header */}
                <div className="bg-slate-900 border-b border-slate-800 p-5 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="w-5 h-5 text-amber-400" />
                      <DialogTitle className="text-lg font-bold text-white">Payment Steps &amp; History</DialogTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-300 font-mono">
                        Bill #{historyInvoice.number}
                      </Badge>
                      <Button
                        size="icon"
                        onClick={() => setHistoryInvoice(null)}
                        className="h-7 w-7 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shrink-0 border-0 transition-transform hover:scale-105"
                        title="Close"
                      >
                        <X className="w-4 h-4 stroke-[2.5]" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Quick Metrics Bar */}
                  <div className="grid grid-cols-3 gap-2 mt-4 text-xs bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                    <div>
                      <div className="text-slate-400 text-[10px]">Total Bill</div>
                      <div className="font-mono font-bold text-white mt-0.5">{inr(total)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px]">Total Paid</div>
                      <div className="font-mono font-bold text-emerald-400 mt-0.5">{inr(paid)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px]">Remaining Due</div>
                      <div className="font-mono font-bold text-rose-400 mt-0.5">{inr(due)}</div>
                    </div>
                  </div>
                </div>

                {/* Timeline Steps Content */}
                <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>Installment Steps ({steps.length})</span>
                    <span className="text-[11px] font-mono text-emerald-600">
                      {Math.round((paid / (total || 1)) * 100)}% Paid
                    </span>
                  </div>

                  {steps.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-xs">
                      No payment steps recorded yet.
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                      {steps.map((step, idx) => {
                        runningTotal += step.amount;
                        const stepDue = Math.max(0, total - runningTotal);

                        return (
                          <div key={idx} className="relative group">
                            {/* Step Timeline Circle Node */}
                            <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold ring-4 ring-background shadow-xs">
                              {idx + 1}
                            </div>

                            <div className="bg-muted/30 border border-border p-3 rounded-xl hover:bg-muted/50 transition-colors space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-amber-600" /> {formatDate(step.date)}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-sm text-emerald-600">
                                    + {inr(step.amount)}
                                  </span>

                                  {/* Step Actions: Print, Edit, Delete */}
                                  <div className="flex items-center gap-0.5 border-l border-border/60 pl-1.5 ml-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md"
                                      title="Print Step Receipt"
                                      onClick={() => {
                                        setPrintingStepData({
                                          invoice: historyInvoice,
                                          step,
                                          stepIndex: idx + 1,
                                          remainingDueAfterStep: stepDue,
                                        });
                                      }}
                                    >
                                      <Printer className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-md"
                                      title="Edit Step"
                                      onClick={() => startEditStep(idx, step)}
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md"
                                      title="Delete Step"
                                      onClick={() => {
                                        if (confirm(`Are you sure you want to delete Step ${idx + 1} (${inr(step.amount)})?`)) {
                                          handleDeleteStep(idx);
                                        }
                                      }}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] bg-background font-medium">
                                    💳 {step.mode || "Cash"}
                                  </Badge>
                                  {step.note && <span className="text-[11px] text-muted-foreground italic">{step.note}</span>}
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  Bal After: <strong className="text-foreground">{inr(stepDue)}</strong>
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <DialogFooter className="p-4 bg-muted/20 border-t border-border flex flex-row items-center justify-between gap-2">
                  <Button variant="outline" size="sm" onClick={() => setHistoryInvoice(null)} className="text-xs">
                    Close
                  </Button>
                  {due > 0 && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                      onClick={() => {
                        setPayModalInvoice(historyInvoice);
                        setCollectAmount(due);
                        setHistoryInvoice(null);
                      }}
                    >
                      <CreditCard className="w-3.5 h-3.5 mr-1" /> Add Payment Step
                    </Button>
                  )}
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* RECEIVE PAYMENT MODAL */}
      <Dialog open={!!payModalInvoice} onOpenChange={(val) => !val && setPayModalInvoice(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" /> Collect Due Payment Step
            </DialogTitle>
          </DialogHeader>
          {payModalInvoice && (
            <div className="space-y-4 py-2 text-sm">
              <div className="bg-muted/40 p-3 rounded-xl border border-border space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice #:</span>
                  <span className="font-mono font-bold">{payModalInvoice.number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Bill Amount:</span>
                  <span className="font-mono">{inr(payModalInvoice.total)}</span>
                </div>
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>Current Outstanding Due:</span>
                  <span className="font-mono">{inr(payModalInvoice.balanceDue || 0)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Payment Amount to Collect (₹) *</Label>
                  <Input
                    type="number"
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value ? Number(e.target.value) : "")}
                    placeholder="Enter amount"
                    className="mt-1 font-mono font-bold text-base"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Payment Date *</Label>
                  <Input
                    type="date"
                    value={collectDate}
                    onChange={(e) => setCollectDate(e.target.value)}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Payment Mode</Label>
                <Select value={collectPaymentMode} onValueChange={setCollectPaymentMode}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI">UPI / GPay / PhonePe</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer / NEFT</SelectItem>
                    <SelectItem value="Card">Credit / Debit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Step Note / Remarks (Optional)</Label>
                <Input
                  value={collectNote}
                  onChange={(e) => setCollectNote(e.target.value)}
                  placeholder="e.g. Received via GPay from Rahul"
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayModalInvoice(null)}>
              Cancel
            </Button>
            <Button onClick={handleCollectPaymentSubmit} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              Save Payment Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT STEP MODAL */}
      <Dialog open={editingStepIndex !== null} onOpenChange={(val) => !val && setEditingStepIndex(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-600" /> Edit Payment Step #{editingStepIndex !== null ? editingStepIndex + 1 : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Payment Step Date *</Label>
              <Input
                type="date"
                value={editingStepDraft.date ? editingStepDraft.date.slice(0, 10) : new Date().toISOString().slice(0, 10)}
                onChange={(e) => setEditingStepDraft({ ...editingStepDraft, date: e.target.value })}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Amount Received (₹) *</Label>
              <Input
                type="number"
                value={editingStepDraft.amount || ""}
                onChange={(e) => setEditingStepDraft({ ...editingStepDraft, amount: Number(e.target.value) })}
                className="mt-1 font-mono font-bold"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Payment Mode</Label>
              <Select value={editingStepDraft.mode} onValueChange={(val) => setEditingStepDraft({ ...editingStepDraft, mode: val })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="UPI">UPI / GPay / PhonePe</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer / NEFT</SelectItem>
                  <SelectItem value="Card">Credit / Debit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Note / Remarks</Label>
              <Input
                value={editingStepDraft.note || ""}
                onChange={(e) => setEditingStepDraft({ ...editingStepDraft, note: e.target.value })}
                placeholder="e.g. Received partial installment"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStepIndex(null)}>
              Cancel
            </Button>
            <Button onClick={saveEditStep} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
              Update Payment Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PRINT STEP RECEIPT VOUCHER & TAX INVOICE MODAL */}
      {printingStepData && (() => {
        const inv = printingStepData.invoice;
        const total = inv.total || 0;
        const paid = inv.amountPaid !== undefined ? inv.amountPaid : total;
        const due = inv.balanceDue || 0;
        const items = inv.items || [];
        const payments = inv.payments && inv.payments.length > 0 ? inv.payments : (paid > 0 ? [{
          date: formatDate(inv.createdAt),
          amount: paid,
          mode: inv.paymentMode || "Cash",
          note: "Initial Advance / Payment Step"
        }] : []);

        return (
          <div className="print-section fixed inset-0 z-100 bg-black/60 flex justify-center items-start p-2 sm:p-4 print:static print:block print:bg-white print:p-0 print:overflow-visible print:h-auto overflow-y-auto pointer-events-auto">
            <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl print:shadow-none print:max-w-none text-slate-900 my-auto relative flex flex-col max-h-[95vh] print:my-0 print:max-h-none print:block overflow-hidden">
              <style>{`@media print { @page { margin: 4mm; } body { zoom: 0.9; } }`}</style>

              {/* Top Toolbar */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between print:hidden shrink-0">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Printer className="w-4 h-4 text-emerald-400" />
                  <span>Print Invoice Bill (#{inv.number})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => triggerPrint()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 px-3.5 shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Invoice
                  </Button>
                  <Button
                    size="icon"
                    onClick={() => setPrintingStepData(null)}
                    className="h-7 w-7 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shrink-0 border-0"
                  >
                    <X className="w-4 h-4 stroke-[2.5]" />
                  </Button>
                </div>
              </div>

              {/* PRINTABLE BILLING INVOICE CONTAINER */}
              <div className="p-6 sm:p-10 print:p-2 bg-white text-slate-900 space-y-6 overflow-y-auto flex-1 print:overflow-visible">
                {/* 1. Official Shop Header */}
                <ShopHeader documentLabel={inv.type === "GST" ? "Invoice" : "Billing Receipt"} />

                {/* 2. Invoice & Customer Meta Grid */}
                <div className="grid grid-cols-2 gap-6 pb-4 border-b border-slate-200 text-xs">
                  <div className="space-y-1">
                    <div className="font-bold text-[10px] uppercase tracking-wider text-slate-500">Billed To (Customer):</div>
                    <div className="font-bold text-base text-slate-900">{inv.customerName}</div>
                    {inv.customerMobile && <div className="text-slate-700 font-mono">Mobile: {inv.customerMobile}</div>}
                    {inv.customerAddress && <div className="text-slate-600">Address: {inv.customerAddress}</div>}
                  </div>

                  <div className="text-right space-y-1">
                    <div className="text-xl font-serif font-bold text-slate-900">
                      {inv.type === "GST" ? "INVOICE" : "ESTIMATE RECEIPT"}
                    </div>
                    <div className="font-mono font-bold text-amber-900 text-sm">Invoice #: {inv.number}</div>
                    <div className="text-slate-600 font-mono">Date: {formatDate(inv.createdAt)}</div>
                    <div className="text-slate-600">Payment Method: <strong>{inv.paymentMode || "Cash"}</strong></div>
                  </div>
                </div>

                {/* 3. Items Billing Table */}
                <div>
                  <div className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2">Itemized Products &amp; Charges:</div>
                  <div className="overflow-x-auto border border-slate-300 rounded-lg">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300">
                        <tr>
                          <th className="py-2.5 px-3 border-r border-slate-300 text-center w-10">#</th>
                          <th className="py-2.5 px-3 border-r border-slate-300">Item Description</th>
                          <th className="py-2.5 px-3 border-r border-slate-300 text-center">Purity</th>
                          <th className="py-2.5 px-3 border-r border-slate-300 text-center">Qty</th>
                          <th className="py-2.5 px-3 border-r border-slate-300 text-right">Net Wt</th>
                          <th className="py-2.5 px-3 border-r border-slate-300 text-right">Rate/g</th>
                          <th className="py-2.5 px-3 border-r border-slate-300 text-right">Making</th>
                          <th className="py-2.5 px-3 text-right">Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it: any, idx: number) => {
                          const isGst = inv.type === "GST";
                          const c = calcItem(it, isGst);
                          const qty = it.qty || 1;
                          const lineTotal = c.line;
                          return (
                            <tr key={idx} className="border-b border-slate-200 last:border-0 font-sans">
                              <td className="py-2 px-3 border-r border-slate-200 text-center text-slate-500 font-mono">{idx + 1}</td>
                              <td className="py-2 px-3 border-r border-slate-200 font-semibold text-slate-900">
                                {it.name}
                                {it.huid && (
                                  <span className="ml-2 text-[10px] font-mono text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                    HUID: {it.huid}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 border-r border-slate-200 text-center font-medium">{it.purity || "22K"}</td>
                              <td className="py-2 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-900">{qty}</td>
                              <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-bold text-amber-900">
                                {it.netWeight || 0} g
                              </td>
                              <td className="py-2 px-3 border-r border-slate-200 text-right font-mono">{inr(it.ratePerGram || 0)}</td>
                              <td className="py-2 px-3 border-r border-slate-200 text-right font-mono">{inr(it.makingCharge || 0)}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{inr(lineTotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Financial Calculations Summary */}
                <div className="flex flex-col sm:flex-row justify-between items-start text-xs gap-6 pt-2">
                  <div className="w-full sm:w-1/2 space-y-2">
                    {inv.oldGoldAmount ? (
                      <div className="p-3 border border-amber-300 rounded-lg bg-amber-50/50">
                        <div className="font-bold text-amber-900 uppercase text-[10px]">Old Gold Trade-in Credit</div>
                        <div className="text-sm font-bold text-amber-800 font-mono">{inr(inv.oldGoldAmount)}</div>
                      </div>
                    ) : null}

                    {/* Step Payments History Summary Table */}
                    {payments.length > 0 && (
                      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-1.5">
                        <div className="font-bold text-[10px] uppercase tracking-wider text-slate-700 flex justify-between">
                          <span>Payment Installment Steps</span>
                          <span className="text-emerald-700 font-mono">{payments.length} Step(s)</span>
                        </div>
                        <div className="space-y-1 text-[11px]">
                          {payments.map((p, idx) => (
                            <div key={idx} className="flex justify-between items-center font-mono border-b border-slate-200/60 pb-0.5 last:border-0">
                              <span className="text-slate-600">Step #{idx + 1} ({formatDate(p.date)} - {p.mode})</span>
                              <span className="font-bold text-emerald-700">+ {inr(p.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-full sm:w-1/2 max-w-sm ml-auto space-y-1.5 border-t-2 border-slate-400 pt-2 text-xs">
                    <div className="flex justify-between text-slate-700">
                      <span>Subtotal Amount:</span>
                      <span className="font-mono font-semibold">{inr(inv.subtotal || total)}</span>
                    </div>
                    {inv.discount ? (
                      <div className="flex justify-between text-rose-600">
                        <span>Discount Applied:</span>
                        <span className="font-mono font-semibold">- {inr(inv.discount)}</span>
                      </div>
                    ) : null}
                    {inv.gstAmount ? (
                      <div className="flex justify-between text-slate-700">
                        <span>GST Amount (3%):</span>
                        <span className="font-mono font-semibold">{inr(inv.gstAmount)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between border-t-2 border-slate-900 pt-2 font-bold text-base text-slate-900">
                      <span>Grand Total Bill:</span>
                      <span className="font-mono text-emerald-800 text-lg">{inr(total)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-bold border-t border-slate-200 pt-1">
                      <span>Total Amount Paid:</span>
                      <span className="font-mono">{inr(paid)}</span>
                    </div>
                    <div className="flex justify-between text-rose-700 font-bold border-t border-rose-200 pt-1 text-sm bg-rose-50 p-1.5 rounded">
                      <span>Remaining Balance Due:</span>
                      <span className="font-mono">{inr(due)}</span>
                    </div>
                  </div>
                </div>

                {/* 5. Terms, Bank Details, UPI QR & Signatures */}
                <div className="pt-6 border-t border-slate-200 text-xs space-y-4">
                  {(() => {
                    const invSettings: InvoiceSettings = { ...defaultInvoiceSettings, ...((tenantSession?.shop as any)?.invoiceSettings || {}) };
                    const qrUrl = getUpiQrCodeUrl({
                      upiId: invSettings.upiId,
                      shopName: tenantSession?.shop?.shopName,
                      phone: tenantSession?.shop?.phone,
                      qrCodeUrl: invSettings.qrCodeUrl,
                      amount: total,
                    });
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <InvoiceTerms compact />
                          {invSettings.bankAccountDetails && (
                            <div className="text-[10px] font-mono text-slate-700 bg-amber-50/60 p-1.5 rounded border border-amber-200 mt-2">
                              <strong>Bank Details:</strong> {invSettings.bankAccountDetails}
                            </div>
                          )}
                        </div>
                        {invSettings.showPaymentQr !== false && qrUrl && (
                          <div className="border border-slate-300 rounded p-2 flex items-center gap-3 bg-slate-50 text-[10px] text-slate-700 h-fit ml-auto">
                            <img
                              src={qrUrl}
                              alt="UPI Payment QR Code"
                              className="w-14 h-14 object-contain rounded border bg-white p-0.5 shrink-0"
                            />
                            <div>
                              <div className="font-bold text-slate-900 uppercase tracking-wider text-[9px]">Scan &amp; Pay via UPI</div>
                              <div className="font-mono text-[9.5px] text-slate-800 font-bold mt-0.5">
                                {invSettings.upiId || (tenantSession?.shop?.phone ? `${tenantSession.shop.phone}@ybl` : "UPI Payment")}
                              </div>
                              <div className="text-[8.5px] text-slate-500 mt-0.5">Accepts GPay, PhonePe, Paytm &amp; BHIM</div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex justify-between items-end pt-4">
                    <div className="text-center border-t border-slate-400 pt-1 w-40">
                      <p className="font-semibold text-slate-800 text-[11px]">Customer Signature</p>
                    </div>
                    <div className="text-center border-t border-slate-400 pt-1 w-48">
                      <p className="font-bold text-slate-900 text-xs">For {shopIdentifier}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Authorized Signatory</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="shrink-0 bg-slate-100 p-4 border-t border-slate-200 rounded-b-xl flex justify-end gap-3 print:hidden">
                <Button variant="outline" onClick={() => setPrintingStepData(null)}>Close</Button>
                <Button onClick={() => triggerPrint()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                  <Printer className="w-4 h-4 mr-2" /> Print Invoice
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CRM NOTE DIALOG */}
      <Dialog open={crmNoteModalOpen} onOpenChange={setCrmNoteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <NotebookPen className="w-5 h-5 text-amber-700" /> Log CRM Interaction Note
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Note / Preference Description</Label>
            <Input
              value={newCrmNoteText}
              onChange={(e) => setNewCrmNoteText(e.target.value)}
              placeholder="e.g. Interested in 22K 40g Bridal Necklace for Nov wedding"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCrmNoteModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addCrmNote} className="bg-amber-700 text-white">
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MANUAL DUE ENTRY DIALOG */}
      <Dialog open={manualDueOpen} onOpenChange={setManualDueOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-display">Add Manual Due Record</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Customer Name *</Label>
              <Input
                value={manualDue.customerName}
                onChange={(e) => setManualDue({ ...manualDue, customerName: e.target.value })}
                placeholder="Enter customer name"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Item Name / Reason *</Label>
              <Input
                value={manualDue.itemName}
                onChange={(e) => setManualDue({ ...manualDue, itemName: e.target.value })}
                placeholder="e.g. Old Bahi-Khata Pending Balance"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Due Amount (₹) *</Label>
              <Input
                type="number"
                value={manualDue.dueAmount}
                onChange={(e) => setManualDue({ ...manualDue, dueAmount: e.target.value ? Number(e.target.value) : "" })}
                placeholder="e.g. 15000"
                className="mt-1 font-mono font-bold"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDueOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveManualDue} className="bg-amber-700 text-white">
              Save Manual Due
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
