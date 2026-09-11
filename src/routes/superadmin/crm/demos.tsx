import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { superAdminAPI } from "@/lib/api";
import { DEMO_STATUSES, DEMO_STATUS_LABELS, DEMO_STATUS_BADGE, toQuery, type Demo, type Paginated } from "@/lib/crm";
import { toast } from "sonner";

interface AdminDemo extends Demo { shopId: string; shopName: string }

export default function SuperAdminCrmDemosPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState<Paginated<AdminDemo> | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");

  const load = () => {
    setLoading(true);
    superAdminAPI.crm.demos
      .list(toQuery({ status: status || undefined, limit: 50, sort: "scheduled_at", dir: "DESC" }))
      .then((d: any) => setPage(d))
      .catch((err: any) => toast.error(err?.message || "Failed to load demos"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [status]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Demos — All Shops</h1>
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {DEMO_STATUSES.map((s) => <SelectItem key={s} value={s}>{DEMO_STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shop</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(page?.data ?? []).map((d) => (
                    <TableRow
                      key={d.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/superadmin/crm/demos/${d.shopId}/${d.id}`)}
                    >
                      <TableCell className="font-medium">{d.shopName}</TableCell>
                      <TableCell>{new Date(d.scheduledAt).toLocaleString()}</TableCell>
                      <TableCell>{d.mode || "—"}</TableCell>
                      <TableCell><Badge variant={DEMO_STATUS_BADGE[d.status]}>{DEMO_STATUS_LABELS[d.status]}</Badge></TableCell>
                      <TableCell>{d.outcome || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {(page?.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No demos found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {page && page.total > page.data.length && (
            <div className="flex justify-between items-center mt-3 text-sm text-muted-foreground">
              <span>{page.data.length} of {page.total}</span>
              <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
