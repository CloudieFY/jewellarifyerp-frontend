import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Target,
  ListChecks,
  Clock,
  AlertTriangle,
  TrendingUp,
  Trophy,
  Loader2,
  Lock,
} from "lucide-react";

import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useTenantAPI } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/crm/Can";
import { useCrmNameMaps } from "@/components/crm/hooks";
import { CrmNav } from "@/components/crm/CrmNav";
import { crmMoney, type CrmDashboard } from "@/lib/crm";

export default function CrmDashboardPage() {
  const api = useTenantAPI();
  const navigate = useNavigate();
  const can = useCan();
  const { userName } = useCrmNameMaps();
  const allowed = can("report", "view");

  const dashQ = useQuery({
    queryKey: ["crm", "dashboard"],
    queryFn: () => api.crm.dashboard() as Promise<CrmDashboard>,
    enabled: allowed,
    retry: false,
  });

  return (
    <Layout>
      <div className="space-y-4">
        <CrmNav />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">CRM Dashboard</h1>
            <p className="text-sm text-muted-foreground">Leads, pipeline &amp; tasks at a glance</p>
          </div>
        </div>

        {!allowed ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground space-y-2">
              <Lock className="h-6 w-6 mx-auto" />
              <p>You don&apos;t have access to CRM reports.</p>
            </CardContent>
          </Card>
        ) : dashQ.isLoading ? (
          <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin inline" /></div>
        ) : dashQ.isError ? (
          <Card>
            <CardContent className="py-16 text-center text-destructive space-y-2">
              <AlertTriangle className="h-6 w-6 mx-auto" />
              <p>{(dashQ.error as Error)?.message ?? "Failed to load the dashboard."}</p>
              <Button variant="outline" size="sm" onClick={() => dashQ.refetch()}>Retry</Button>
            </CardContent>
          </Card>
        ) : dashQ.data ? (
          <DashboardBody data={dashQ.data} userName={userName} navigate={navigate} />
        ) : null}
      </div>
    </Layout>
  );
}

function DashboardBody({
  data,
  userName,
  navigate,
}: {
  data: CrmDashboard;
  userName: (id: string | null) => string;
  navigate: (to: string) => void;
}) {
  const { leads, opportunities: opp, tasks, recentActivity } = data;

  return (
    <div className="space-y-4">
      {/* Leads */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Users className="h-4 w-4" /> Leads
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <Stat label="Total" value={leads.total} onClick={() => navigate("/crm/leads")} />
          <Stat label="New" value={leads.new} onClick={() => navigate("/crm/leads")} />
          <Stat label="Qualified" value={leads.qualified} onClick={() => navigate("/crm/leads")} />
          <Stat label="Converted" value={leads.converted} tone="green" onClick={() => navigate("/crm/leads")} />
          <Stat label="New · 30d" value={leads.last30} />
        </div>
      </section>

      {/* Opportunities */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Target className="h-4 w-4" /> Opportunities
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <Stat label="Open" value={opp.open} onClick={() => navigate("/crm/pipeline")} />
          <Stat label="Pipeline value" value={crmMoney(opp.openValue)} icon={<TrendingUp className="h-4 w-4" />} onClick={() => navigate("/crm/pipeline")} />
          <Stat label="Won" value={opp.won} tone="green" icon={<Trophy className="h-4 w-4" />} onClick={() => navigate("/crm/opportunities")} />
          <Stat label="Won value" value={crmMoney(opp.wonValue)} tone="green" />
          <Stat label="Lost" value={opp.lost} tone="red" onClick={() => navigate("/crm/opportunities")} />
        </div>
      </section>

      {/* Tasks */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <ListChecks className="h-4 w-4" /> Tasks
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Pending" value={tasks.pending} icon={<Clock className="h-4 w-4" />} onClick={() => navigate("/crm/tasks")} />
          <Stat label="Overdue" value={tasks.overdue} tone="red" icon={<AlertTriangle className="h-4 w-4" />} onClick={() => navigate("/crm/tasks")} />
          <Stat label="Due today" value={tasks.dueToday} onClick={() => navigate("/crm/tasks")} />
          <Stat label="Done · 30d" value={tasks.completed30} tone="green" />
        </div>
      </section>

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Recent CRM activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <ul className="space-y-2">
              {recentActivity.map((a) => {
                const go = () => {
                  if (a.entityType === "lead") navigate(`/crm/leads/${a.entityId}`);
                  else if (a.entityType === "opportunity") navigate(`/crm/opportunities/${a.entityId}`);
                  else if (a.entityType === "customer") navigate(`/customers?customerId=${a.entityId}`);
                };
                return (
                  <li key={a.id} className="text-sm border-l-2 pl-3 py-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">{a.entityType}</Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">{a.type}</Badge>
                      <span className="text-muted-foreground text-xs">
                        {formatDate(a.createdAt)} · {userName(a.actorUserId)}
                      </span>
                      {a.entityType !== "task" && (
                        <button className="text-xs underline text-muted-foreground hover:text-foreground" onClick={go}>
                          open
                        </button>
                      )}
                    </div>
                    {a.body ? <div className="text-[13px]">{a.body}</div> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  icon,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "green" | "red";
  icon?: React.ReactNode;
  onClick?: () => void;
}) {
  const toneCls =
    tone === "green" ? "text-green-600" : tone === "red" ? "text-destructive" : "text-foreground";
  return (
    <Card
      className={onClick ? "cursor-pointer transition-colors hover:border-primary" : ""}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          {icon}
        </div>
        <div className={`text-xl font-semibold mt-1 ${toneCls}`}>{value}</div>
        {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}
