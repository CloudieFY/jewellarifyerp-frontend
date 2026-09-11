import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { superAdminAPI } from "@/lib/api";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_STATUS_BADGE, sourceLabel, toQuery, type Lead, type Paginated } from "@/lib/crm";
import { toast } from "sonner";

interface AdminLead extends Lead {
  shopName: string;
}

export default function SuperAdminCrmLeadsPage() {
  const [page, setPage] = useState<Paginated<AdminLead> | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("");

  const load = () => {
    setLoading(true);
    superAdminAPI.crm.leads
      .list(toQuery({ status: status || undefined, limit: 50 }))
      .then((d: any) => setPage(d))
      .catch((err: any) => toast.error(err?.message || "Failed to load leads"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [status]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-semibold">Leads — All Shops</h1>
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{LEAD_STATUS_LABELS[s]}</SelectItem>)}
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
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(page?.data ?? []).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.shopName}</TableCell>
                      <TableCell>{l.name}</TableCell>
                      <TableCell>{l.phone || "—"}</TableCell>
                      <TableCell>{sourceLabel(l.source)}</TableCell>
                      <TableCell><Badge variant={LEAD_STATUS_BADGE[l.status]}>{LEAD_STATUS_LABELS[l.status]}</Badge></TableCell>
                      <TableCell>{l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {(page?.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No leads found.</TableCell></TableRow>
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
