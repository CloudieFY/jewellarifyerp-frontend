import { useState, useMemo } from "react";
import { useFormKeyboardNav } from "@/lib/useFormKeyboardNav";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Pencil,
  Search,
  Briefcase,
  IndianRupee,
  Users,
  History,
  Printer,
  X,
  CreditCard,
  Phone,
  UserCheck,
  Award,
} from "lucide-react";
import { inr } from "@/lib/storage";
import { formatDate, triggerPrint } from "@/lib/utils";
import { toast } from "sonner";
import { useTenantAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShopHeader } from "@/components/InvoiceBranding";

export interface SalaryPaymentRecord {
  id?: string;
  date: string;
  monthFor: string;
  amount: number;
  mode: string;
  note?: string;
}

export interface Employee {
  id?: string;
  _id?: string;
  name: string;
  phone: string;
  role: string;
  salary: number;
  joinDate: string;
  status: "Active" | "Inactive";
  totalPaid: number;
  notes?: string;
  aadhaar?: string;
  pan?: string;
  bankDetails?: string;
  upiId?: string;
  address?: string;
  payments?: SalaryPaymentRecord[];
}

const empty: Employee = {
  name: "",
  phone: "",
  role: "Sales Specialist",
  salary: 0,
  joinDate: new Date().toISOString().slice(0, 10),
  status: "Active",
  totalPaid: 0,
  notes: "",
  aadhaar: "",
  pan: "",
  bankDetails: "",
  upiId: "",
  address: "",
  payments: [],
};

function getCompletedMonths(joinDateStr: string) {
  if (!joinDateStr) return 0;
  const joinDate = new Date(joinDateStr);
  const now = new Date();
  if (isNaN(joinDate.getTime())) return 0;
  let months = (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth());
  if (now.getDate() < joinDate.getDate()) {
    months--;
  }
  return Math.max(0, months);
}

const ROLES = [
  "Sales Specialist",
  "Store Manager",
  "Cashier",
  "Karigar / Artisan",
  "Accountant",
  "Security Guard",
  "Cleaner",
  "Other",
];

const MONTHS_LIST = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function EmployeesPage() {
  const api = useTenantAPI();
  const queryClient = useQueryClient();
  const { tenantSession } = useAuth();
  const canManage = tenantSession?.user?.role !== "karigar";

  const shopIdentifier = useMemo(() => {
    return tenantSession?.shop?.shopName || "Jewellery Enterprise";
  }, [tenantSession]);

  const useApiMutation = (mutationFn: (...args: any[]) => Promise<any>, queryKey: string[]) => {
    return useMutation({
      mutationFn,
      onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });
  };

  const { data: list = [], isLoading } = useQuery<Employee[]>({ queryKey: ["employees"], queryFn: api.employees.getAll });
  const createMutation = useApiMutation((data: Employee) => api.employees.create(data), ["employees"]);
  const updateMutation = useApiMutation((data: { id: string; body: Partial<Employee> }) => api.employees.update(data.id, data.body), ["employees"]);
  const deleteMutation = useApiMutation((id: string) => api.employees.remove(id), ["employees"]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Employee>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [dateFocused, setDateFocused] = useState(false);

  // Salary Payment Modal States
  const [payEmp, setPayEmp] = useState<Employee | null>(null);
  const [payAmount, setPayAmount] = useState<number | "">("");
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payMonthFor, setPayMonthFor] = useState<string>(
    `${MONTHS_LIST[new Date().getMonth()]} ${new Date().getFullYear()}`
  );
  const [payMode, setPayMode] = useState<string>("Cash");
  const [payNote, setPayNote] = useState<string>("");

  // Payment History Drawer State
  const [historyEmp, setHistoryEmp] = useState<Employee | null>(null);

  // Print Payslip Voucher State
  const [printingVoucher, setPrintingVoucher] = useState<{
    emp: Employee;
    payment: SalaryPaymentRecord;
  } | null>(null);

  const save = async () => {
    if (!form.name || !form.name.trim() || !form.role || !form.salary) {
      toast.error("Employee Name, Role, and Monthly Salary are required.");
      return;
    }

    const cleanedForm = {
      ...form,
      pan: form.pan ? form.pan.toUpperCase().trim() : "",
      aadhaar: form.aadhaar ? form.aadhaar.trim() : "",
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: cleanedForm });
        toast.success("Employee profile updated successfully");
      } else {
        await createMutation.mutateAsync(cleanedForm);
        toast.success("New employee added successfully");
      }
      setOpen(false);
      setForm(empty);
      setEditingId(null);
    } catch {
      toast.error("Failed to save employee profile");
    }
  };

  const handleKeyNav = useFormKeyboardNav(save);

  const remove = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this employee record?")) {
      try {
        await deleteMutation.mutateAsync(id);
        toast.success("Employee record deleted");
      } catch {
        toast.error("Failed to delete employee");
      }
    }
  };

  const startEdit = (emp: Employee) => {
    setForm(emp);
    setEditingId(emp.id || (emp as any)._id || null);
    setOpen(true);
  };

  // Open Salary Payment Modal
  const openSalaryModal = (emp: Employee) => {
    const completedMonths = getCompletedMonths(emp.joinDate);
    const pending = (completedMonths * emp.salary) - (emp.totalPaid || 0);
    setPayEmp(emp);
    setPayAmount(pending > 0 ? pending : emp.salary);
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayMonthFor(`${MONTHS_LIST[new Date().getMonth()]} ${new Date().getFullYear()}`);
    setPayMode("Cash");
    setPayNote("");
  };

  // Submit Salary Payment
  const handleSalarySubmit = async () => {
    if (!payEmp || !payAmount || Number(payAmount) <= 0) {
      toast.error("Please enter a valid salary payment amount.");
      return;
    }
    const amt = Number(payAmount);
    const targetId = payEmp.id || (payEmp as any)._id;

    const newPaymentRecord: SalaryPaymentRecord = {
      date: payDate || new Date().toISOString().slice(0, 10),
      monthFor: payMonthFor,
      amount: amt,
      mode: payMode,
      note: payNote ? payNote.trim() : `Salary for ${payMonthFor}`,
    };

    const existingPayments = payEmp.payments || [];
    const updatedPayments = [...existingPayments, newPaymentRecord];
    const newTotalPaid = (payEmp.totalPaid || 0) + amt;

    try {
      await updateMutation.mutateAsync({
        id: targetId,
        body: {
          totalPaid: newTotalPaid,
          payments: updatedPayments,
        },
      });

      toast.success(`Disbursed salary of ${inr(amt)} to ${payEmp.name}!`);
      setPayEmp(null);

      // Offer immediate printing
      setPrintingVoucher({
        emp: { ...payEmp, totalPaid: newTotalPaid, payments: updatedPayments },
        payment: newPaymentRecord,
      });
    } catch {
      toast.error("Failed to record salary payment.");
    }
  };

  const filtered = useMemo(() => {
    return list
      .filter((e) => {
        if (!q) return true;
        const search = q.toLowerCase();
        return (
          e.name.toLowerCase().includes(search) ||
          (e.phone && e.phone.includes(search)) ||
          e.role.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [list, q]);

  const activeCount = list.filter((e) => e.status === "Active").length;
  const totalSalaryRoll = list.filter((e) => e.status === "Active").reduce((sum, e) => sum + (e.salary || 0), 0);
  const totalPendingDues = list.filter((e) => e.status === "Active").reduce((sum, e) => {
    const pending = (getCompletedMonths(e.joinDate) * e.salary) - (e.totalPaid || 0);
    return sum + (pending > 0 ? pending : 0);
  }, 0);

  const pageSize = 10;
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold font-display tracking-tight text-foreground flex items-center gap-3">
            <Users className="w-8 h-8 text-amber-600" /> Employees &amp; Payroll Management
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage staff profiles, designations, salary disbursements, and printable payslips.
          </p>
        </div>
        {canManage && (
          <Button
            size="lg"
            className="w-full sm:w-auto bg-amber-700 hover:bg-amber-800 text-white font-semibold shadow-xs"
            onClick={() => {
              setForm(empty);
              setEditingId(null);
              setOpen(true);
            }}
          >
            <Plus className="w-5 h-5 mr-2" /> Add New Staff
          </Button>
        )}
      </header>

      {/* EXECUTIVE DASHBOARD METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-5">
        <Card className="border border-border/80 shadow-2xs hover:border-amber-500/30 transition-all">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between text-muted-foreground text-[11px] sm:text-xs font-semibold">
              <span className="truncate">Total Staff</span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-foreground mt-1 sm:mt-2 font-mono truncate">{list.length}</div>
            <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">Staff Registered</div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-2xs hover:border-emerald-500/30 transition-all">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between text-muted-foreground text-[11px] sm:text-xs font-semibold">
              <span className="truncate">Active Staff</span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 sm:mt-2 font-mono truncate">{activeCount}</div>
            <div className="text-[10px] sm:text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 font-medium truncate">On Active Payroll</div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-2xs hover:border-blue-500/30 transition-all">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between text-muted-foreground text-[11px] sm:text-xs font-semibold">
              <span className="truncate">Monthly Salary</span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1 sm:mt-2 font-mono truncate">{inr(totalSalaryRoll)}</div>
            <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">Total Monthly Base</div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-2xs hover:border-rose-500/30 transition-all">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between text-muted-foreground text-[11px] sm:text-xs font-semibold">
              <span className="truncate">Pending Dues</span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0">
                <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1 sm:mt-2 font-mono truncate">{inr(totalPendingDues)}</div>
            <div className="text-[10px] sm:text-[11px] text-rose-700 dark:text-rose-400 mt-0.5 font-medium truncate">Accumulated Dues</div>
          </CardContent>
        </Card>
      </div>

      {/* SEARCH BAR */}
      <div className="relative mb-4 w-full sm:max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-10 w-full bg-background rounded-xl border-border"
          placeholder="Search staff by name, designation or phone..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* EMPLOYEE DIRECTORY TABLE */}
      <Card className="shadow-xs border-border overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border py-4">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-700" /> Staff Directory &amp; Payroll Ledger
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-12 text-sm">Loading staff directory...</p>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-2">
              <Users className="w-10 h-10 mx-auto opacity-40 text-amber-600" />
              <p className="text-base font-semibold">No employee records found.</p>
            </div>
          ) : (
            <div>
              {/* Mobile Employee Cards (Visible on screens < md) */}
              <div className="block md:hidden divide-y divide-border">
                {paginated.map((e) => {
                  const completedMonths = getCompletedMonths(e.joinDate);
                  const pending = (completedMonths * e.salary) - (e.totalPaid || 0);
                  const empId = e.id || (e as any)._id;

                  return (
                    <div key={empId} className="p-3.5 space-y-3 hover:bg-muted/20">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-amber-600/10 text-amber-800 dark:text-amber-300 font-bold flex items-center justify-center text-base border border-amber-500/20 shrink-0">
                            {e.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-foreground">{e.name}</div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono mt-0.5">
                              <Phone className="w-3 h-3 text-amber-600 shrink-0" />
                              {e.phone ? (
                                <a href={`tel:${e.phone}`} className="hover:underline text-foreground">
                                  {e.phone}
                                </a>
                              ) : (
                                "No Mobile"
                              )}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border shrink-0 ${
                            e.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {e.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/30 p-2.5 rounded-lg border border-border/60 text-xs">
                        <Badge variant="outline" className="text-xs bg-background font-medium border-slate-300">
                          💼 {e.role}
                        </Badge>
                        <span className="text-muted-foreground font-mono text-[11px]">
                          Joined {formatDate(e.joinDate)} ({completedMonths}m)
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-border/60">
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Monthly Base</div>
                          <div className="font-mono font-bold text-foreground text-sm mt-0.5">{inr(e.salary)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Pending Dues</div>
                          <div className="font-mono font-bold text-sm mt-0.5">
                            {pending > 0 ? (
                              <span className="text-rose-600">{inr(pending)}</span>
                            ) : (
                              <span className="text-emerald-600 font-normal text-xs">Up to Date</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Mobile Actions Toolbar */}
                      <div className="flex items-center justify-between pt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 px-2 rounded-lg border border-amber-200/60"
                          onClick={() => setHistoryEmp(e)}
                        >
                          <History className="w-3.5 h-3.5 mr-1 text-amber-600" />
                          {e.payments?.length || 0} Paid
                        </Button>

                        {canManage && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2.5 rounded-lg font-semibold flex items-center gap-1"
                              onClick={() => openSalaryModal(e)}
                            >
                              <CreditCard className="w-3.5 h-3.5" /> Pay
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 rounded-lg text-slate-700 border-slate-300"
                              title="Edit Employee Profile"
                              onClick={() => startEdit(e)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 rounded-lg text-rose-600 border-rose-200 hover:bg-rose-50"
                              title="Delete Employee"
                              onClick={() => remove(empId)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Employee Table (Visible on screens >= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[900px]">
                <thead className="bg-muted/40 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-4 text-left">Staff Member</th>
                    <th className="py-3 px-4 text-left">Designation</th>
                    <th className="py-3 px-4 text-left">Join Date</th>
                    <th className="py-3 px-4 text-right">Monthly Salary</th>
                    <th className="py-3 px-4 text-right">Pending Dues</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Payment History</th>
                    <th className="py-3 px-4 text-right pr-6">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((e) => {
                    const completedMonths = getCompletedMonths(e.joinDate);
                    const pending = (completedMonths * e.salary) - (e.totalPaid || 0);
                    const empId = e.id || (e as any)._id;

                    return (
                      <tr key={empId} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-amber-600/10 text-amber-800 dark:text-amber-300 font-bold flex items-center justify-center text-sm border border-amber-500/20 shrink-0">
                              {e.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-foreground">{e.name}</div>
                              <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                                <Phone className="w-3 h-3 text-amber-600" /> {e.phone || "No Mobile"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-xs bg-background font-medium border-slate-300">
                            💼 {e.role}
                          </Badge>
                        </td>

                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {formatDate(e.joinDate)}
                          <div className="text-[10px] text-muted-foreground/80">{completedMonths} Months Service</div>
                        </td>

                        <td className="py-3 px-4 text-right font-bold text-foreground font-mono text-sm">
                          {inr(e.salary)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-sm">
                          {pending > 0 ? (
                            <span className="text-rose-600">{inr(pending)}</span>
                          ) : (
                            <span className="text-emerald-600 font-normal text-xs">Up to Date</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                              e.status === "Active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {e.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 px-2.5 rounded-lg border border-amber-200/60"
                            onClick={() => setHistoryEmp(e)}
                          >
                            <History className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                            {e.payments?.length || 0} Payments
                          </Button>
                        </td>

                        <td className="py-3 px-4 text-right pr-6 space-x-1.5">
                          {canManage ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2.5 rounded-lg shadow-2xs font-semibold flex items-center gap-1"
                                onClick={() => openSalaryModal(e)}
                              >
                                <CreditCard className="w-3.5 h-3.5" /> Pay Salary
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7 rounded-lg text-slate-700 hover:text-slate-900 border-slate-300"
                                title="Edit Employee Profile"
                                onClick={() => startEdit(e)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-7 w-7 rounded-lg text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50"
                                title="Delete Employee"
                                onClick={() => remove(empId)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">View only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
                  <div className="text-xs text-muted-foreground">
                    Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} entries
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 text-xs">
                      Prev
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 text-xs">
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* NEW / EDIT EMPLOYEE DIALOG */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6" onInteractOutside={(e) => e.preventDefault()} onKeyDown={handleKeyNav}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <Users className="w-6 h-6 text-amber-700" />
              {editingId ? "Edit Employee Profile" : "Register New Staff Member"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Employee Full Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Rajesh Kumar Verma"
                className="mt-1 font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Mobile Number *</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="9876543210"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Role / Designation *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select designation" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Monthly Salary (₹) *</Label>
                <Input
                  type="number"
                  value={form.salary || ""}
                  onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })}
                  placeholder="25000"
                  className="mt-1 font-mono font-bold"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Date of Joining</Label>
                {(() => {
                  let displayValue = form.joinDate;
                  if (!dateFocused && form.joinDate) {
                    const parts = form.joinDate.split("-");
                    if (parts.length === 3) {
                      displayValue = `${parts[2]}/${parts[1]}/${parts[0]}`;
                    }
                  }
                  return (
                    <Input
                      type={dateFocused ? "date" : "text"}
                      placeholder="DD/MM/YYYY"
                      value={displayValue}
                      onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
                      onFocus={() => setDateFocused(true)}
                      onBlur={() => setDateFocused(false)}
                      className="mt-1 font-mono"
                    />
                  );
                })()}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Aadhaar Number</Label>
                <Input
                  value={form.aadhaar || ""}
                  onChange={(e) => setForm({ ...form, aadhaar: e.target.value })}
                  placeholder="12-digit Aadhaar No"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">PAN Card Number</Label>
                <Input
                  value={form.pan || ""}
                  onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                  placeholder="ABCDE1234F"
                  className="mt-1 font-mono uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Bank Account &amp; IFSC</Label>
                <Input
                  value={form.bankDetails || ""}
                  onChange={(e) => setForm({ ...form, bankDetails: e.target.value })}
                  placeholder="A/C No, Bank Name, IFSC"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">UPI ID / GPay Phone</Label>
                <Input
                  value={form.upiId || ""}
                  onChange={(e) => setForm({ ...form, upiId: e.target.value })}
                  placeholder="rajesh@upi / 9876543210"
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Employment Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Employee["status"] })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Additional Notes &amp; Address</Label>
              <Input
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Residential Address or Emergency Contact details"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} className="bg-amber-700 hover:bg-amber-800 text-white font-semibold">
              Save Employee Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DISBURSE SALARY PAYMENT MODAL */}
      <Dialog open={!!payEmp} onOpenChange={(val) => !val && setPayEmp(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" /> Disburse Employee Salary
            </DialogTitle>
          </DialogHeader>
          {payEmp && (
            <div className="space-y-4 py-2 text-sm">
              <div className="bg-muted/40 p-3 rounded-xl border border-border space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Staff Member:</span>
                  <span className="font-bold text-foreground">{payEmp.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Designation:</span>
                  <span className="font-semibold">{payEmp.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base Monthly Salary:</span>
                  <span className="font-mono font-bold text-blue-600">{inr(payEmp.salary)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Amount Paid (₹) *</Label>
                  <Input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value ? Number(e.target.value) : "")}
                    placeholder="Enter amount"
                    className="mt-1 font-mono font-bold text-base"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase">Payment Date *</Label>
                  <Input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Month Paid For *</Label>
                <Input
                  value={payMonthFor}
                  onChange={(e) => setPayMonthFor(e.target.value)}
                  placeholder="e.g. July 2026"
                  className="mt-1 font-semibold"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Payment Mode</Label>
                <Select value={payMode} onValueChange={setPayMode}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="UPI">UPI / GPay / PhonePe</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer / NEFT</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Voucher Remarks / Notes</Label>
                <Input
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="e.g. Monthly salary disbursed in full"
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayEmp(null)}>
              Cancel
            </Button>
            <Button onClick={handleSalarySubmit} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              Disburse Salary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SALARY PAYMENT HISTORY TIMELINE MODAL */}
      <Dialog open={!!historyEmp} onOpenChange={(val) => !val && setHistoryEmp(null)}>
        <DialogContent className="w-[95vw] sm:max-w-lg p-0 rounded-2xl border border-border shadow-2xl bg-card overflow-hidden [&>button.absolute]:hidden">
          {historyEmp && (() => {
            const payments = historyEmp.payments || [];
            return (
              <div>
                {/* Header */}
                <div className="bg-slate-900 border-b border-slate-800 p-5 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History className="w-5 h-5 text-amber-400" />
                      <DialogTitle className="text-lg font-bold text-white">Salary Payment Ledger</DialogTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-300 font-mono">
                        {historyEmp.name}
                      </Badge>
                      <Button
                        size="icon"
                        onClick={() => setHistoryEmp(null)}
                        className="h-7 w-7 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shrink-0 border-0"
                      >
                        <X className="w-4 h-4 stroke-[2.5]" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                    <div>
                      <div className="text-slate-400 text-[10px]">Base Salary</div>
                      <div className="font-mono font-bold text-white mt-0.5">{inr(historyEmp.salary)} / mo</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px]">Total Salary Disbursed</div>
                      <div className="font-mono font-bold text-emerald-400 mt-0.5">{inr(historyEmp.totalPaid || 0)}</div>
                    </div>
                  </div>
                </div>

                {/* Timeline Content */}
                <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>Disbursement Log ({payments.length})</span>
                  </div>

                  {payments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-xs">
                      No salary disbursement payments recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {payments.map((p, idx) => (
                        <div key={idx} className="bg-muted/30 border border-border p-3 rounded-xl flex items-center justify-between">
                          <div>
                            <div className="font-bold text-sm text-foreground">{p.monthFor || "Salary"}</div>
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">
                              {formatDate(p.date)} · Mode: <strong>{p.mode}</strong>
                            </div>
                            {p.note && <div className="text-[11px] text-muted-foreground italic mt-0.5">{p.note}</div>}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-base text-emerald-600">
                              + {inr(p.amount)}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                              title="Print Payslip Voucher"
                              onClick={() => {
                                setPrintingVoucher({
                                  emp: historyEmp,
                                  payment: p,
                                });
                              }}
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <DialogFooter className="p-4 bg-muted/20 border-t border-border flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setHistoryEmp(null)}>
                    Close
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* PRINT SALARY VOUCHER MODAL */}
      {printingVoucher && (
        <div className="print-section fixed inset-0 z-100 bg-black/60 flex justify-center items-start p-2 sm:p-4 print:static print:block print:bg-white print:p-0 print:overflow-visible print:h-auto overflow-y-auto pointer-events-auto">
          <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl print:shadow-none print:max-w-none text-slate-900 my-auto relative flex flex-col max-h-[95vh] print:my-0 print:max-h-none print:block overflow-hidden">
            <style>{`@media print { @page { margin: 4mm; } body { zoom: 0.9; } }`}</style>

            {/* Top Toolbar */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between print:hidden shrink-0">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Print Official Salary Voucher</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => triggerPrint()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 px-3.5"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Payslip
                </Button>
                <Button
                  size="icon"
                  onClick={() => setPrintingVoucher(null)}
                  className="h-7 w-7 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md shrink-0 border-0"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </Button>
              </div>
            </div>

            {/* PRINTABLE SALARY PAYSLIP CONTAINER */}
            <div className="p-6 bg-white text-slate-900 space-y-5 flex-1 overflow-y-auto print:overflow-visible print:p-4 print:text-black">
              <ShopHeader documentLabel="SALARY DISBURSEMENT VOUCHER" />

              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Employee Name:</span>
                  <div className="font-bold text-base text-slate-900">{printingVoucher.emp.name}</div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold mt-1 block">Role / Designation:</span>
                  <div className="font-semibold text-slate-800">{printingVoucher.emp.role}</div>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Salary Month:</span>
                  <div className="font-mono font-bold text-base text-emerald-800">{printingVoucher.payment.monthFor}</div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold mt-1 block">Disbursement Date:</span>
                  <div className="font-mono font-semibold text-slate-800">{formatDate(printingVoucher.payment.date)}</div>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-emerald-800 font-semibold">Base Monthly Salary:</span>
                  <span className="font-mono font-bold text-slate-900">{inr(printingVoucher.emp.salary)}</span>
                </div>
                <div className="flex justify-between items-center text-base font-bold pt-2 border-t border-emerald-200 text-emerald-950">
                  <span>NET AMOUNT DISBURSED:</span>
                  <span className="font-mono text-xl text-emerald-700">{inr(printingVoucher.payment.amount)}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-emerald-200/60 text-slate-700">
                  <span>Payment Mode:</span>
                  <span className="font-semibold text-slate-900">{printingVoucher.payment.mode}</span>
                </div>
              </div>

              {printingVoucher.payment.note && (
                <div className="text-xs text-slate-600 italic">
                  <strong>Remarks / Note:</strong> {printingVoucher.payment.note}
                </div>
              )}

              <div className="pt-8 flex justify-between items-end text-xs text-slate-600">
                <div className="text-center border-t border-slate-400 pt-1 w-36">
                  <p className="font-semibold text-slate-800">Employee Signature</p>
                </div>
                <div className="text-center border-t border-slate-400 pt-1 w-44">
                  <p className="font-bold text-slate-900">For {shopIdentifier}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Authorized Signatory</p>
                </div>
              </div>
            </div>

            {/* Bottom Action Footer */}
            <div className="shrink-0 bg-slate-100 p-4 border-t border-slate-200 rounded-b-xl flex justify-end gap-3 print:hidden">
              <Button variant="outline" onClick={() => setPrintingVoucher(null)}>Close</Button>
              <Button onClick={() => triggerPrint()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                <Printer className="w-4 h-4 mr-2" /> Print Payslip
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}