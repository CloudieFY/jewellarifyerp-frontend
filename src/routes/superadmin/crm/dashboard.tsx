import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { superAdminAPI } from "@/lib/api";
import { crmMoney, type CrmDashboard } from "@/lib/crm";
import { toast } from "sonner";

interface AdminDashboard extends CrmDashboard {
  byShop: { shopId: string; shopName: string; leadCount: number; openOpportunityCount: number; wonValue: number }[];
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function SuperAdminCrmDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    superAdminAPI.crm
      .dashboard()
      .then((d: any) => { if (!cancelled) setData(d); })
      .catch((err: any) => toast.error(err?.message || "Failed to load CRM dashboard"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">CRM Dashboard — All Shops</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Leads" value={data.leads.total} />
        <StatCard label="New (30d)" value={data.leads.last30} />
        <StatCard label="Open Opportunities" value={data.opportunities.open} />
        <StatCard label="Won Value" value={crmMoney(data.opportunities.wonValue)} />
        <StatCard label="Pending Tasks" value={data.tasks.pending} />
        <StatCard label="Overdue Tasks" value={data.tasks.overdue} />
        <StatCard label="Won (30d)" value={crmMoney(data.opportunities.wonValue30)} />
        <StatCard label="Converted Leads" value={data.leads.converted} />
      </div>

      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold mb-3">By Shop</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shop</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Open Opportunities</TableHead>
                  <TableHead>Won Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byShop.map((s) => (
                  <TableRow key={s.shopId}>
                    <TableCell className="font-medium">{s.shopName}</TableCell>
                    <TableCell>{s.leadCount}</TableCell>
                    <TableCell>{s.openOpportunityCount}</TableCell>
                    <TableCell>{crmMoney(s.wonValue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold mb-3">Recent Activity (All Shops)</h2>
          <div className="space-y-2">
            {data.recentActivity.length === 0 && <div className="text-sm text-muted-foreground">No recent activity.</div>}
            {data.recentActivity.map((a: any) => (
              <div key={a.id} className="text-sm border-b border-border/50 pb-2 last:border-0">
                <span className="text-muted-foreground">[{a.shopName}]</span> {a.body}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
