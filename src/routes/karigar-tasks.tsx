import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenantAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { type Repair, type Order, useLocalState } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { Hammer, Wrench, ShoppingBag, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function KarigarTasksPage() {
  const api = useTenantAPI();
  const queryClient = useQueryClient();
  const { data: karigars = [], isLoading: isLoadingK } = useQuery({ queryKey: ["karigars"], queryFn: api.karigars.getAll });
  const { data: repairs = [], isLoading: isLoadingR } = useQuery({ queryKey: ["repairs"], queryFn: api.repairs.getAll });
  const { data: orders = [], isLoading: isLoadingO } = useQuery({ queryKey: ["orders"], queryFn: api.orders.getAll });
  const isLoading = isLoadingK || isLoadingR || isLoadingO;

  const updateRepairMutation = useMutation({ mutationFn: (data: { id: string; body: Repair }) => api.repairs.update(data.id, data.body), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["repairs"] }) });
  const updateOrderMutation = useMutation({ mutationFn: (data: { id: string; body: Order }) => api.orders.update(data.id, data.body), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }) });

  const { tenantSession } = useAuth();
  const [authUser] = useLocalState<any>("ajms.auth", null);
  const currentUser = tenantSession?.user || authUser;
  const isKarigar = currentUser?.role === "karigar";
  const karigarRefId = currentUser?.karigarRefId;

  const [selectedKarigarId, setSelectedKarigarId] = useState<string>("");

  useEffect(() => {
    if (isKarigar && karigarRefId) {
      setSelectedKarigarId(karigarRefId);
    }
  }, [isKarigar, karigarRefId]);

  const [viewingRepair, setViewingRepair] = useState<Repair | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [pageR, setPageR] = useState(1);
  const [pageO, setPageO] = useState(1);

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

  const totalPagesR = Math.ceil(assignedRepairs.length / 10) || 1;
  const currentPageR = Math.min(pageR, totalPagesR);
  const paginatedR = assignedRepairs.slice((currentPageR - 1) * 10, currentPageR * 10);

  const totalPagesO = Math.ceil(assignedOrders.length / 10) || 1;
  const currentPageO = Math.min(pageO, totalPagesO);
  const paginatedO = assignedOrders.slice((currentPageO - 1) * 10, currentPageO * 10);

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

  const shopName = tenantSession?.shop?.shopName || (tenantSession?.shop as any)?.name || (tenantSession?.shop as any)?.companyName || "Arihant Jewellers";

  const pageContent = (
    <>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl font-display">{shopName}</h1>
          <p className="text-muted-foreground mt-1">Assigned repairs & custom orders portal.</p>
        </div>
        {isKarigar ? (
          <div className="bg-primary/10 text-primary px-4 py-2 rounded-md border border-primary/20 font-medium">
            Logged in as: {currentUser?.name || "Karigar"}
          </div>
        ) : (
          <div className="w-full sm:w-72">
            <Select value={selectedKarigarId} onValueChange={setSelectedKarigarId}>
              <SelectTrigger className="h-12 bg-background border-primary shadow-sm">
                <SelectValue placeholder="Select Karigar Profile" />
              </SelectTrigger>
              <SelectContent>
                {karigars.map(k => (
                  <SelectItem key={k._id || k.id} value={k._id || k.id || `unknown-${k.name}`}>
                    {k.name} ({k.specialty || k.category || "General"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      {isLoading ? (
        <p className="text-center py-12 text-muted-foreground">Loading tasks...</p>
      ) : !effectiveKarigarId ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
          <Hammer className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg">Select a Karigar from the dropdown above to view their assigned work.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeKarigar && (
            <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
              <CardContent className="pt-6 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div>
                  <h2 className="text-2xl font-display font-semibold text-primary">{activeKarigar.name}</h2>
                  <p className="text-muted-foreground">{activeKarigar.specialty || "Karigar"} • {activeKarigar.mobile || "No Mobile"}</p>
                </div>
                <div className="flex gap-4">
                  <div className="bg-background rounded-md p-3 border shadow-sm min-w-[120px]">
                    <div className="text-xs text-muted-foreground mb-1">Cash Balance</div>
                    <div className={`font-semibold ${activeKarigar.balance && activeKarigar.balance > 0 ? "text-green-600" : activeKarigar.balance && activeKarigar.balance < 0 ? "text-rose-600" : ""}`}>
                      ₹{(activeKarigar.balance || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-background rounded-md p-3 border shadow-sm min-w-[120px]">
                    <div className="text-xs text-muted-foreground mb-1">Gold Pending</div>
                    <div className={`font-semibold ${activeKarigar.metalBalanceGold && activeKarigar.metalBalanceGold > 0 ? "text-orange-600" : ""}`}>
                      {(activeKarigar.metalBalanceGold || 0).toFixed(3)} g
                    </div>
                  </div>
                  <div className="bg-background rounded-md p-3 border shadow-sm min-w-[120px]">
                    <div className="text-xs text-muted-foreground mb-1">Silver Pending</div>
                    <div className={`font-semibold ${activeKarigar.metalBalanceSilver && activeKarigar.metalBalanceSilver > 0 ? "text-slate-600" : ""}`}>
                      {(activeKarigar.metalBalanceSilver || 0).toFixed(3)} g
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground flex items-center gap-1"><Wrench className="w-4 h-4"/> Active Repairs</div>
                <div className="text-2xl font-display mt-1 text-primary">{activeRepairs.length} <span className="text-sm text-muted-foreground font-normal">assigned</span></div>
                <div className="text-xs font-medium text-muted-foreground mt-2 bg-muted/40 inline-block px-2 py-1 rounded">
                  Total Quantity / Weight: {repairsWeight.toFixed(2)} g
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground flex items-center gap-1"><ShoppingBag className="w-4 h-4"/> Active Orders</div>
                <div className="text-2xl font-display mt-1 text-primary">{activeOrders.length} <span className="text-sm text-muted-foreground font-normal">assigned</span></div>
              </CardContent>
            </Card>

          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* REPAIRS */}
            <Card>
              <CardHeader><CardTitle className="font-display flex items-center gap-2"><Wrench className="w-5 h-5"/> Repairs ({assignedRepairs.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm"><thead className="text-left text-muted-foreground border-b bg-muted/20"><tr><th className="py-2 px-4">Ticket</th><th>Item</th><th>Due</th><th className="px-4 text-right">Status</th><th className="px-4"></th></tr></thead>
                <tbody>{paginatedR.map(r => (<tr key={r._id || r.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2 px-4"><div className="font-medium">{r.ticketNo}</div><div className="text-xs text-muted-foreground">{formatDate(r.date)}</div></td>
                      <td><div className="font-medium">{r.itemDescription}</div><div className="text-xs text-rose-500">{r.problem}</div></td>
                      <td>{r.deliveryDate ? formatDate(r.deliveryDate) : "—"}</td>
                      <td className="px-4 py-2 text-right">
                        <select className={`border rounded px-2 py-1 text-xs cursor-pointer ${r.status === 'Ready' ? 'bg-green-50 text-green-700 border-green-200 font-medium' : r.status === 'Delivered' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-background'}`} value={r.status} onChange={e => updateRepairStatus(r._id || r.id || "", e.target.value as Repair["status"])} disabled={r.status === 'Delivered'}>
                          {['Received', 'In Progress', 'Ready', 'Delivered'].filter(s => s !== "Delivered" || r.status === "Delivered").map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setViewingRepair(r)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>))}
                    {assignedRepairs.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">No repairs assigned.</td></tr>}
                    </tbody></table>
                </div>
            {totalPagesR > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-xs text-muted-foreground">Showing {(currentPageR - 1) * 10 + 1} to {Math.min(currentPageR * 10, assignedRepairs.length)} of {assignedRepairs.length} entries</div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setPageR(p => Math.max(1, p - 1))} disabled={currentPageR === 1}>Prev</Button>
                  <Button size="sm" variant="outline" onClick={() => setPageR(p => Math.min(totalPagesR, p + 1))} disabled={currentPageR === totalPagesR}>Next</Button>
                </div>
              </div>
            )}
              </CardContent>
            </Card>

            {/* ORDERS */}
            <Card>
              <CardHeader><CardTitle className="font-display flex items-center gap-2"><ShoppingBag className="w-5 h-5"/> Custom Orders ({assignedOrders.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm"><thead className="text-left text-muted-foreground border-b bg-muted/20"><tr><th className="py-2 px-4">Order</th><th>Item</th><th>Due</th><th className="px-4 text-right">Status</th><th className="px-4"></th></tr></thead>
                <tbody>{paginatedO.map(o => (<tr key={o._id || o.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2 px-4"><div className="font-medium">{o.orderNo}</div><div className="text-xs text-muted-foreground">{formatDate(o.date)}</div></td>
                      <td><div className="font-medium">{o.itemDescription}</div><div className="text-xs text-muted-foreground">{o.metal} {o.purity}</div></td>
                      <td>{o.dueDate ? formatDate(o.dueDate) : "—"}</td>
                      <td className="px-4 py-2 text-right">
                        <select className={`border rounded px-2 py-1 text-xs cursor-pointer ${o.status === 'Ready' ? 'bg-green-50 text-green-700 border-green-200 font-medium' : o.status === 'Delivered' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-background'}`} value={o.status} onChange={e => updateOrderStatus(o._id || o.id || "", e.target.value as Order["status"])} disabled={o.status === 'Delivered'}>
                          {["Pending","In Progress","Ready","Delivered","Cancelled"].filter(s => s !== "Delivered" || o.status === "Delivered").map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setViewingOrder(o)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>))}
                    {assignedOrders.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">No custom orders assigned.</td></tr>}
                    </tbody></table>
                </div>
            {totalPagesO > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-xs text-muted-foreground">Showing {(currentPageO - 1) * 10 + 1} to {Math.min(currentPageO * 10, assignedOrders.length)} of {assignedOrders.length} entries</div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setPageO(p => Math.max(1, p - 1))} disabled={currentPageO === 1}>Prev</Button>
                  <Button size="sm" variant="outline" onClick={() => setPageO(p => Math.min(totalPagesO, p + 1))} disabled={currentPageO === totalPagesO}>Next</Button>
                </div>
              </div>
            )}
              </CardContent>
            </Card>

          </div>
        </div>
      )}

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
                    <div className="text-xs text-muted-foreground font-medium">Metal & Purity</div>
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
            <Hammer className="w-5 h-5 text-amber-600" /> {shopName} — Karigar Work Portal
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            localStorage.removeItem("ajms.auth");
            localStorage.removeItem("ajms.tenant");
            window.location.href = "/";
          }}>
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