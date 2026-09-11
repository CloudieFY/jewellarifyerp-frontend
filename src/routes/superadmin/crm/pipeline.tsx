import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { superAdminAPI } from "@/lib/api";
import { OPPORTUNITY_STAGE_LABELS, OPPORTUNITY_STAGE_BADGE, crmMoney, toQuery, type Opportunity, type PipelineSummary, type Paginated } from "@/lib/crm";
import { toast } from "sonner";

interface AdminOpportunity extends Opportunity { shopName: string }

export default function SuperAdminCrmPipelinePage() {
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [open, setOpen] = useState<Paginated<AdminOpportunity> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      superAdminAPI.crm.opportunities.pipeline(),
      superAdminAPI.crm.opportunities.list(toQuery({ limit: 50, sort: "amount", dir: "DESC" })),
    ])
      .then(([s, o]: any[]) => { setSummary(s); setOpen(o); })
      .catch((err: any) => toast.error(err?.message || "Failed to load pipeline"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Pipeline — All Shops</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(summary?.stages ?? []).map((s) => (
          <Card key={s.stage}>
            <CardContent className="p-4">
              <Badge variant={OPPORTUNITY_STAGE_BADGE[s.stage]}>{OPPORTUNITY_STAGE_LABELS[s.stage]}</Badge>
              <div className="text-2xl font-semibold mt-2">{s.count}</div>
              <div className="text-xs text-muted-foreground">{crmMoney(s.amount)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold mb-3">Open Opportunities (by value)</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shop</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Expected Close</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(open?.data ?? []).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.shopName}</TableCell>
                    <TableCell>{o.title}</TableCell>
                    <TableCell><Badge variant={OPPORTUNITY_STAGE_BADGE[o.stage]}>{OPPORTUNITY_STAGE_LABELS[o.stage]}</Badge></TableCell>
                    <TableCell>{crmMoney(o.amount)}</TableCell>
                    <TableCell>{o.expectedCloseDate ? new Date(o.expectedCloseDate).toLocaleDateString() : "—"}</TableCell>
                  </TableRow>
                ))}
                {(open?.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No open opportunities.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
