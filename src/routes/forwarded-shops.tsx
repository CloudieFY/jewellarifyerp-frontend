import { useState, useMemo } from "react";
import { useFormKeyboardNav } from "@/lib/useFormKeyboardNav";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { inr, type Girvi, useLocalState, uid } from "@/lib/storage";
import { calculateCompoundInterest, formatDate, formatCompactIfLarge, triggerPrint } from "@/lib/utils";
import { useTenantAPI } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Store,
  Eye,
  ArrowUpRight,
  Plus,
  MapPin,
  FileText,
  Phone,
  Printer,
  Trash2,
  Pencil,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Building2,
  DollarSign,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { InvoiceTerms, ShopHeader } from "@/components/InvoiceBranding";

function getElapsedMonthsAndDays(dateStr: string) {
  if (!dateStr) return { months: 0, days: 0 };
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (now.getTime() <= start.getTime()) return { months: 0, days: 0 };

  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }

  return { months, days };
}

function getElapsedDays(dateStr: string) {
  if (!dateStr) return 0;
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (now.getTime() <= start.getTime()) return 0;
  return Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function isGirviForwardedSettled(girvi: any) {
  return girvi.isForwardedSettled || (girvi.note && /\[Forwarding to .*? cleared on .*? - Paid .*?\]/.test(girvi.note));
}

function calculateForwardedInterest(girvi: any) {
  if (isGirviForwardedSettled(girvi)) {
    if (girvi.forwardedSettledInterest !== undefined) return girvi.forwardedSettledInterest;
    const match = girvi.note?.match(/cleared on .*? - Paid (.*?)\]/);
    if (match && match[1]) {
      const parsedTotal = parseFloat(match[1].replace(/[^\d.-]/g, ""));
      if (!isNaN(parsedTotal)) return Math.max(0, parsedTotal - (girvi.forwardedAmount || 0));
    }
    return 0;
  }
  if (!girvi.forwardedAmount || !girvi.forwardedInterestPct) return 0;

  const isDaily = girvi.forwardedInterestPeriod === "Daily" || girvi.note?.includes("[FwdIntPeriod:Daily]");
  const P = girvi.forwardedAmount;
  const monthlyRatePct = girvi.forwardedInterestPct;
  const startDate = girvi.forwardedDate || girvi.date;

  if (!startDate) return 0;

  if (isDaily) {
    const elapsedDays = getElapsedDays(startDate);
    const dailyRate = monthlyRatePct / 100;
    return Math.round(Math.pow(1 + dailyRate, elapsedDays) * P - P);
  }

  const { months, days } = getElapsedMonthsAndDays(startDate);
  const totalMonths = months + days / 30;
  return Math.round(calculateCompoundInterest(P, monthlyRatePct, totalMonths).interest);
}

export type ForwardedShopProfile = {
  id: string;
  name: string;
  phone: string;
  address: string;
  gst: string;
};

export default function ForwardedShopsPage() {
  const api = useTenantAPI();
  const queryClient = useQueryClient();
  const useApiMutation = (mutationFn: (...args: any[]) => Promise<any>, queryKey: string[]) => {
    return useMutation({
      mutationFn,
      onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });
  };

  const { data: girvis = [], isLoading } = useQuery({ queryKey: ["girvis"], queryFn: api.girvi.getAll });
  const updateMutation = useApiMutation(
    (data: { id: string; body: Girvi }) => api.girvi.update(data.id, data.body),
    ["girvis"]
  );
  const [profiles, setProfiles] = useLocalState<ForwardedShopProfile[]>("ajms.forwardedShops", []);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [settlingItem, setSettlingItem] = useState<Girvi | null>(null);
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ForwardedShopProfile | null>(null);
  const [form, setForm] = useState<ForwardedShopProfile>({ id: "", name: "", phone: "", address: "", gst: "" });

  const [searchQ, setSearchQ] = useState("");
  const [shopsPage, setShopsPage] = useState(1);
  const [activePage, setActivePage] = useState(1);
  const [settledPage, setSettledPage] = useState(1);

  const shops = useMemo(() => {
    const map = new Map<string, any>();

    // 1. Initialize with explicitly saved profiles
    profiles.forEach((p) => {
      map.set(p.name.toLowerCase().trim(), {
        profileId: p.id,
        name: p.name,
        phone: p.phone,
        address: p.address,
        gst: p.gst,
        records: [],
      });
    });

    // 2. Group girvis by forwarded shop name
    girvis.forEach((g: Girvi) => {
      const originalName = (g.forwardedShopName || g.forwardedTo)?.trim();
      if (originalName) {
        const key = originalName.toLowerCase();
        const existing = map.get(key);
        const records = existing ? existing.records : [];
        records.push(g);

        map.set(key, {
          ...(existing || {
            name: originalName,
            address: g.forwardedShopAddress,
            gst: g.forwardedShopGstNo,
          }),
          records,
        });
      }
    });

    return Array.from(map.values())
      .map((shop) => {
        const activeRecords = shop.records.filter(
          (r: any) => (r.forwardedAmount || 0) > 0 && !isGirviForwardedSettled(r)
        );
        const settledRecords = shop.records.filter((r: any) => isGirviForwardedSettled(r));
        const totalPrincipal = activeRecords.reduce((s: number, r: Girvi) => s + (r.forwardedAmount || 0), 0);
        const totalInterest = activeRecords.reduce((s: number, r: Girvi) => s + calculateForwardedInterest(r), 0);

        let addr = shop.address;
        let gst = shop.gst;
        if (!shop.profileId && shop.records.length > 0) {
          const latest = [...shop.records].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )[0];
          addr = latest.forwardedShopAddress;
          gst = latest.forwardedShopGstNo;
        }

        return {
          ...shop,
          address: addr,
          gst: gst,
          activeRecords,
          settledRecords,
          totalPrincipal,
          totalInterest,
        };
      })
      .filter((shop) => shop.profileId || shop.records.length > 0)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [girvis, profiles]);

  const filteredShops = useMemo(() => {
    if (!searchQ.trim()) return shops;
    const q = searchQ.toLowerCase().trim();
    return shops.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.gst && s.gst.toLowerCase().includes(q))
    );
  }, [shops, searchQ]);

  const activeProfile = shops.find((s) => s.name === selectedShop);

  const totalMarketOwed = shops.reduce((s, shop) => s + shop.totalPrincipal + shop.totalInterest, 0);
  const totalMarketPrincipal = shops.reduce((s, shop) => s + shop.totalPrincipal, 0);
  const totalActiveForwardedCount = shops.reduce((s, shop) => s + shop.activeRecords.length, 0);

  const shopsTotalPages = Math.ceil(filteredShops.length / 10) || 1;
  const shopsCurrentPage = Math.min(shopsPage, shopsTotalPages);
  const paginatedShops = filteredShops.slice((shopsCurrentPage - 1) * 10, shopsCurrentPage * 10);

  const activeRecords = activeProfile?.activeRecords || [];
  const activeTotalPages = Math.ceil(activeRecords.length / 10) || 1;
  const activeCurrentPage = Math.min(activePage, activeTotalPages);
  const paginatedActiveRecords = activeRecords.slice((activeCurrentPage - 1) * 10, activeCurrentPage * 10);

  const settledRecords = activeProfile?.settledRecords || [];
  const settledTotalPages = Math.ceil(settledRecords.length / 10) || 1;
  const settledCurrentPage = Math.min(settledPage, settledTotalPages);
  const paginatedSettledRecords = settledRecords.slice((settledCurrentPage - 1) * 10, settledCurrentPage * 10);

  const handleSettle = async () => {
    if (!settlingItem) return;
    const principal = settlingItem.forwardedAmount || 0;
    const interest = calculateForwardedInterest(settlingItem);
    const total = principal + interest;

    try {
      const updatedGirvi = {
        ...settlingItem,
        isForwardedSettled: true,
        forwardedSettledDate: new Date().toISOString(),
        forwardedSettledInterest: interest,
        note: `${
          settlingItem.note ? settlingItem.note + "\n" : ""
        }[Forwarding to ${settlingItem.forwardedShopName || settlingItem.forwardedTo} cleared on ${formatDate(
          new Date().toISOString()
        )} - Paid ${inr(total)}]`,
      };

      await updateMutation.mutateAsync({ id: settlingItem.id || (settlingItem as any)._id, body: updatedGirvi });

      setReceiptData({
        girvi: settlingItem,
        principal,
        interest,
        total,
        date: new Date().toISOString(),
      });

      setSettlingItem(null);
      toast.success("Girvi item settled and received back from forwarded shop.");
    } catch (e) {
      toast.error("Failed to settle forwarded girvi.");
    }
  };

  const openNewShopDialog = () => {
    setForm({ id: "", name: "", phone: "", address: "", gst: "" });
    setEditingProfile(null);
    setOpenNew(true);
  };

  const openEditShopDialog = (shop: any) => {
    setForm({
      id: shop.profileId || uid(),
      name: shop.name,
      phone: shop.phone || "",
      address: shop.address || "",
      gst: shop.gst || "",
    });
    setEditingProfile(shop);
    setOpenNew(true);
  };

  const saveShopProfile = () => {
    if (!form.name.trim()) {
      toast.error("Please enter a shop name.");
      return;
    }
    if (form.id) {
      setProfiles(profiles.map((p) => (p.id === form.id ? form : p)));
    } else {
      setProfiles([...profiles, { ...form, id: uid() }]);
    }
    setOpenNew(false);
    toast.success("Forwarded shop profile saved!");
  };

  const handleShopKeyNav = useFormKeyboardNav(saveShopProfile);
  const handleSettleKeyNav = useFormKeyboardNav(handleSettle);

  const handleDelete = (shop: any) => {
    if (shop.records.length > 0) {
      toast.error("Cannot delete a shop that has forwarded items (active or settled).");
      return;
    }
    if (
      window.confirm(
        `Are you sure you want to delete the profile for ${shop.name}? This will not affect existing girvi records.`
      )
    ) {
      setProfiles(profiles.filter((p) => p.id !== shop.profileId));
      toast.success("Shop profile deleted.");
      if (selectedShop === shop.name) setSelectedShop(null);
    }
  };

  const exportShopsToExcel = () => {
    if (shops.length === 0) {
      toast.error("No forwarded shops found to export!");
      return;
    }
    const data = shops.map((s, index) => ({
      "S.No": index + 1,
      "Shop Name": s.name,
      "Phone Number": s.phone || "N/A",
      Address: s.address || "N/A",
      "GSTIN / Reg": s.gst || "N/A",
      "Active Items": s.activeRecords.length,
      "Principal Owed": s.totalPrincipal,
      "Accrued Interest": s.totalInterest,
      "Total Market Payable": s.totalPrincipal + s.totalInterest,
      "Settled Items": s.settledRecords.length,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Forwarded Shops");
    XLSX.writeFile(workbook, `Forwarded_Shops_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Forwarded shops report exported successfully!");
  };

  return (
    <Layout>
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">
              Forwarded Shops &amp; Market Ledger
            </h1>
            <Badge className="bg-amber-100 text-amber-900 border-amber-200 font-medium">
              {shops.length} Partner Shops
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Track girvis re-pledged/forwarded to external markets, accrued interest, and settlement payouts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" onClick={exportShopsToExcel} className="h-9 text-xs gap-2 border-slate-300">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export Excel
          </Button>
          <Button
            onClick={openNewShopDialog}
            className="h-9 text-xs gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Partner Shop Profile
          </Button>
        </div>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border border-amber-200 bg-amber-50/50 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                Total Market Payable
              </span>
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-950 mt-2 font-mono">{inr(totalMarketOwed)}</div>
            <p className="text-[11px] text-amber-700 mt-1">Principal + Accrued Market Interest</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Forwarded Principal
              </span>
              <Building2 className="w-5 h-5 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">{inr(totalMarketPrincipal)}</div>
            <p className="text-[11px] text-slate-500 mt-1">Borrowed from market shops</p>
          </CardContent>
        </Card>

        <Card className="border border-emerald-200 bg-emerald-50/40 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                Active Forwarded Girvis
              </span>
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-950 mt-2 font-mono">{totalActiveForwardedCount}</div>
            <p className="text-[11px] text-emerald-700 mt-1 font-medium">Re-pledged items out in market</p>
          </CardContent>
        </Card>
      </div>

      {/* SEARCH AND SHOPS LIST */}
      <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white mb-6">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/60">
          <h3 className="font-display font-bold text-slate-800 text-sm flex items-center gap-2">
            <Store className="w-4 h-4 text-amber-600" /> Partner Market Shops Directory
          </h3>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9 bg-white text-xs h-9"
              placeholder="Search by shop name, phone, address, or GST..."
              value={searchQ}
              onChange={(e) => {
                setSearchQ(e.target.value);
                setShopsPage(1);
              }}
            />
          </div>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500 text-xs">Loading shop directory...</div>
          ) : filteredShops.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No partner shops found matching your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Shop Name</th>
                    <th className="py-3 px-3">Contact Phone</th>
                    <th className="py-3 px-3">Address &amp; GST</th>
                    <th className="py-3 px-3 text-center">Active Girvis</th>
                    <th className="py-3 px-4 text-right">Principal</th>
                    <th className="py-3 px-4 text-right text-amber-700">Market Interest</th>
                    <th className="py-3 px-4 text-right text-rose-700">Total Owed</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80">
                  {paginatedShops.map((shop) => (
                    <tr
                      key={shop.name}
                      className={`hover:bg-amber-50/40 transition-colors ${
                        selectedShop === shop.name ? "bg-amber-100/50" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-amber-600" />
                          {shop.name}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-700">{shop.phone || "—"}</td>

                      <td className="py-3 px-3 text-slate-600">
                        <div className="truncate max-w-[200px]">{shop.address || "—"}</div>
                        {shop.gst && <div className="text-[10px] text-slate-400 font-mono">GST: {shop.gst}</div>}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <Badge className="bg-slate-100 text-slate-800 font-mono">
                          {shop.activeRecords.length} Active
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-medium">{inr(shop.totalPrincipal)}</td>

                      <td className="py-3 px-4 text-right font-mono font-semibold text-amber-700">
                        {inr(shop.totalInterest)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                        {inr(shop.totalPrincipal + shop.totalInterest)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant={selectedShop === shop.name ? "default" : "outline"}
                            onClick={() => setSelectedShop(shop.name)}
                            className="h-7 text-[11px] px-2.5"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> Ledger
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditShopDialog(shop)}
                            className="h-7 w-7 p-0 text-slate-600 hover:text-slate-900"
                            title="Edit Profile"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {shop.profileId && shop.records.length === 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(shop)}
                              className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
                              title="Delete Profile"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {shopsTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50">
                  <div className="text-xs text-slate-500">
                    Showing {(shopsCurrentPage - 1) * 10 + 1} to{" "}
                    {Math.min(shopsCurrentPage * 10, filteredShops.length)} of {filteredShops.length} shops
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShopsPage((p) => Math.max(1, p - 1))}
                      disabled={shopsCurrentPage === 1}
                      className="h-8 text-xs"
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShopsPage((p) => Math.min(shopsTotalPages, p + 1))}
                      disabled={shopsCurrentPage === shopsTotalPages}
                      className="h-8 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SELECTED SHOP DETAILED LEDGER */}
      {activeProfile && (
        <Card className="border border-slate-200 shadow-md bg-white">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-amber-50/50">
            <div>
              <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
                <Store className="w-5 h-5 text-amber-600" /> {activeProfile.name} — Detailed Girvi Ledger
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Address: {activeProfile.address || "N/A"} | Phone: {activeProfile.phone || "N/A"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedShop(null)}
              className="h-8 text-xs border-slate-300"
            >
              <X className="w-3.5 h-3.5 mr-1" /> Close Ledger
            </Button>
          </div>

          <CardContent className="p-4 space-y-6">
            {/* ACTIVE FORWARDED RECORDS */}
            <div>
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" /> Active Forwarded Items ({activeRecords.length})
              </h4>

              {activeRecords.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs bg-slate-50 rounded-lg border border-dashed">
                  No active forwarded girvis for this shop.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Loan #</th>
                        <th className="py-2.5 px-3">Original Customer</th>
                        <th className="py-2.5 px-3 text-right">Forwarded Amt</th>
                        <th className="py-2.5 px-3 text-right">Interest Rate</th>
                        <th className="py-2.5 px-3 text-right text-amber-700">Market Interest</th>
                        <th className="py-2.5 px-3 text-right text-rose-700">Total Payable</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedActiveRecords.map((r: any) => {
                        const interest = calculateForwardedInterest(r);
                        const total = (r.forwardedAmount || 0) + interest;
                        return (
                          <tr key={r._id || r.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">{formatDate(r.forwardedDate || r.date)}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{r.loanNo}</td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-slate-900">{r.customerName}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{r.customerMobile}</div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium">
                              {inr(r.forwardedAmount || 0)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">{r.forwardedInterestPct || 0}% /mo</td>
                            <td className="py-2.5 px-3 text-right font-mono text-amber-700 font-semibold">
                              {inr(interest)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-rose-700 font-bold">{inr(total)}</td>
                            <td className="py-2.5 px-3 text-center">
                              <Button
                                size="sm"
                                onClick={() => setSettlingItem(r)}
                                className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                              >
                                Settle &amp; Receive
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* SETTLED FORWARDED RECORDS */}
            <div>
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Settled / Cleared History ({settledRecords.length})
              </h4>

              {settledRecords.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs bg-slate-50 rounded-lg border border-dashed">
                  No settled records for this shop yet.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs opacity-90">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                      <tr>
                        <th className="py-2 px-3">Forward Date</th>
                        <th className="py-2 px-3">Loan #</th>
                        <th className="py-2 px-3">Customer</th>
                        <th className="py-2 px-3 text-right">Forwarded Amt</th>
                        <th className="py-2 px-3 text-right">Settled Interest</th>
                        <th className="py-2 px-3 text-right">Total Paid Back</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedSettledRecords.map((r: any) => {
                        const interest = calculateForwardedInterest(r);
                        const total = (r.forwardedAmount || 0) + interest;
                        return (
                          <tr key={r._id || r.id} className="bg-slate-50/50">
                            <td className="py-2 px-3">{formatDate(r.forwardedDate || r.date)}</td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-800">{r.loanNo}</td>
                            <td className="py-2 px-3 font-medium text-slate-800">{r.customerName}</td>
                            <td className="py-2 px-3 text-right font-mono">{inr(r.forwardedAmount || 0)}</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-700">{inr(interest)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{inr(total)}</td>
                            <td className="py-2 px-3 text-center">
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                                Cleared
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL 1: ADD/EDIT PARTNER SHOP */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-600" />
              {form.id ? "Edit Partner Shop Profile" : "Add Partner Market Shop"}
            </DialogTitle>
          </DialogHeader>

          <div onKeyDown={handleShopKeyNav} className="space-y-3.5 text-xs pt-1">
            <div>
              <Label className="text-xs font-semibold text-slate-800">Shop Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Laxmi Jewellers Market"
                className="h-9 text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-800">Phone Number</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. 9876543210"
                className="h-9 text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-800">Address / Location</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="e.g. Zaveri Bazaar, Mumbai"
                className="h-9 text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-800">GSTIN / Registration No.</Label>
              <Input
                value={form.gst}
                onChange={(e) => setForm({ ...form, gst: e.target.value })}
                placeholder="e.g. 27AAAAA0000A1Z5"
                className="h-9 text-xs mt-1 font-mono uppercase"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpenNew(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={saveShopProfile}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs"
            >
              Save Shop Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: SETTLE FORWARDED GIRVI */}
      <Dialog open={!!settlingItem} onOpenChange={(open) => !open && setSettlingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Settle Forwarded Girvi
            </DialogTitle>
          </DialogHeader>

          {settlingItem && (
            <div onKeyDown={handleSettleKeyNav} className="space-y-3.5 text-xs pt-1">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 font-mono">
                <div className="flex justify-between text-slate-700">
                  <span>Loan Number:</span>
                  <strong className="text-slate-900">{settlingItem.loanNo}</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Forwarded To:</span>
                  <strong className="text-slate-900">{settlingItem.forwardedShopName || settlingItem.forwardedTo}</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Forwarded Principal:</span>
                  <span>{inr(settlingItem.forwardedAmount || 0)}</span>
                </div>
                <div className="flex justify-between text-amber-700 font-semibold">
                  <span>Accrued Interest ({settlingItem.forwardedInterestPct}%/mo):</span>
                  <span>{inr(calculateForwardedInterest(settlingItem))}</span>
                </div>
                <div className="flex justify-between text-rose-700 font-bold pt-1 border-t border-slate-200 text-sm">
                  <span>Total Amount Paid to Market:</span>
                  <span>{inr((settlingItem.forwardedAmount || 0) + calculateForwardedInterest(settlingItem))}</span>
                </div>
              </div>

              <p className="text-xs text-slate-600">
                Confirming settlement will mark this girvi as returned back to your shop inventory custody.
              </p>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setSettlingItem(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSettle}
              disabled={updateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
            >
              {updateMutation.isPending ? "Processing..." : "Confirm Settlement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
