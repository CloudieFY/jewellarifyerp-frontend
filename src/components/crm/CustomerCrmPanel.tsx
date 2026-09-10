/**
 * CRM section for the existing Customer 360 dialog (src/routes/customers.tsx).
 *
 * It does NOT create a second customer store — it reads the CRM view over the
 * same ERP `customers` row (`/api/crm/customers/:id`) plus the leads,
 * opportunities, tasks and activity timeline linked to that customer id. Every
 * request is permission-gated + RLS-scoped by the backend.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient, useQueries } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Lock, Users, Target, ListChecks, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useTenantAPI } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/crm/Can";
import { useCrmNameMaps } from "@/components/crm/hooks";
import {
  crmMoney,
  sourceLabel,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_BADGE,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGE_BADGE,
  TASK_STATUS_LABELS,
  TASK_STATUS_BADGE,
  type Lead,
  type Opportunity,
  type Task,
  type CrmActivity,
  type Paginated,
} from "@/lib/crm";

export function CustomerCrmPanel({ customerId }: { customerId: string }) {
  const api = useTenantAPI();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const can = useCan();
  const { userName, branchName } = useCrmNameMaps();

  if (!can("customer", "view")) {
    return (
      <div className="py-10 text-center text-muted-foreground text-sm space-y-2">
        <Lock className="h-5 w-5 mx-auto" />
        <p>You don&apos;t have access to CRM customer data.</p>
      </div>
    );
  }

  return (
    <CustomerCrmBody
      customerId={customerId}
      api={api}
      navigate={navigate}
      qc={qc}
      can={can}
      userName={userName}
      branchName={branchName}
    />
  );
}

function CustomerCrmBody({
  customerId,
  api,
  navigate,
  qc,
  can,
  userName,
  branchName,
}: {
  customerId: string;
  api: ReturnType<typeof useTenantAPI>;
  navigate: (to: string) => void;
  qc: ReturnType<typeof useQueryClient>;
  can: (e: string, a: string) => boolean;
  userName: (id: string | null) => string;
  branchName: (id: string | null) => string;
}) {
  const crmQ = useQuery({
    queryKey: ["crm", "customer", customerId],
    queryFn: () => api.crm.customers.get(customerId) as Promise<any>,
    retry: false,
  });
  const actQ = useQuery({
    queryKey: ["crm", "customer", customerId, "activities"],
    queryFn: () => api.crm.customers.activities(customerId) as Promise<{ data: CrmActivity[]; total: number }>,
    retry: false,
  });

  const [convLeadsQ, custLeadsQ, oppsQ, tasksQ] = useQueries({
    queries: [
      {
        queryKey: ["crm", "customer", customerId, "leads-converted"],
        queryFn: () => api.crm.leads.list(`converted_customer_id=${customerId}&limit=25`) as Promise<Paginated<Lead>>,
        retry: false,
        enabled: can("lead", "view"),
      },
      {
        queryKey: ["crm", "customer", customerId, "leads-linked"],
        queryFn: () => api.crm.leads.list(`customer_id=${customerId}&limit=25`) as Promise<Paginated<Lead>>,
        retry: false,
        enabled: can("lead", "view"),
      },
      {
        queryKey: ["crm", "customer", customerId, "opps"],
        queryFn: () => api.crm.opportunities.list(`customer_id=${customerId}&limit=25&sort=created_at&dir=desc`) as Promise<Paginated<Opportunity>>,
        retry: false,
        enabled: can("opportunity", "view"),
      },
      {
        queryKey: ["crm", "customer", customerId, "tasks"],
        queryFn: () => api.crm.tasks.list(`related_type=customer&related_id=${customerId}&limit=25&sort=due_at&dir=asc`) as Promise<Paginated<Task>>,
        retry: false,
        enabled: can("task", "view"),
      },
    ],
  });

  const leads = useMemo(() => {
    const map = new Map<string, Lead>();
    for (const l of convLeadsQ.data?.data ?? []) map.set(l.id, l);
    for (const l of custLeadsQ.data?.data ?? []) map.set(l.id, l);
    return [...map.values()];
  }, [convLeadsQ.data, custLeadsQ.data]);

  const opps = oppsQ.data?.data ?? [];
  const tasks = tasksQ.data?.data ?? [];
  const activities = actQ.data?.data ?? [];
  const crm = crmQ.data;

  const [note, setNote] = useState("");
  const noteMut = useMutation({
    mutationFn: () => api.crm.customers.addActivity(customerId, { body: note.trim(), type: "note" }),
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["crm", "customer", customerId, "activities"] });
      toast.success("Note added");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to add note"),
  });

  return (
    <div className="space-y-4">
      {/* CRM master snapshot */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">CRM overview</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {crmQ.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : crmQ.isError || !crm ? (
            <p className="text-muted-foreground">No CRM record for this customer yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
              <Info k="Status" v={crm.status ? String(crm.status) : "—"} />
              <Info k="Source" v={sourceLabel(crm.source)} />
              <Info k="Assigned to" v={userName(crm.assignedTo ?? null)} />
              <Info k="Branch" v={branchName(crm.branchId ?? null)} />
              <Info k="DOB" v={crm.dob ? formatDate(crm.dob) : "—"} />
              <Info k="Anniversary" v={crm.anniversary ? formatDate(crm.anniversary) : "—"} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leads */}
      {can("lead", "view") && (
        <MiniList
          icon={<Users className="h-4 w-4" />}
          title="Leads"
          loading={convLeadsQ.isLoading || custLeadsQ.isLoading}
          empty={leads.length === 0}
          emptyText="No leads linked to this customer."
        >
          {leads.map((l) => (
            <Row key={l.id} onClick={() => navigate(`/crm/leads/${l.id}`)}>
              <span className="font-medium">{l.name}</span>
              <Badge variant={LEAD_STATUS_BADGE[l.status] ?? "secondary"} className="text-[10px]">
                {LEAD_STATUS_LABELS[l.status] ?? l.status}
              </Badge>
              <span className="text-xs text-muted-foreground ml-auto">{formatDate(l.createdAt)}</span>
            </Row>
          ))}
        </MiniList>
      )}

      {/* Opportunities */}
      {can("opportunity", "view") && (
        <MiniList
          icon={<Target className="h-4 w-4" />}
          title="Opportunities"
          loading={oppsQ.isLoading}
          empty={opps.length === 0}
          emptyText="No opportunities for this customer."
        >
          {opps.map((o) => (
            <Row key={o.id} onClick={() => navigate(`/crm/opportunities/${o.id}`)}>
              <span className="font-medium">{o.title}</span>
              <Badge variant={OPPORTUNITY_STAGE_BADGE[o.stage] ?? "secondary"} className="text-[10px]">
                {OPPORTUNITY_STAGE_LABELS[o.stage] ?? o.stage}
              </Badge>
              <span className="text-xs text-muted-foreground ml-auto">{crmMoney(o.amount)}</span>
            </Row>
          ))}
        </MiniList>
      )}

      {/* Tasks */}
      {can("task", "view") && (
        <MiniList
          icon={<ListChecks className="h-4 w-4" />}
          title="Tasks"
          loading={tasksQ.isLoading}
          empty={tasks.length === 0}
          emptyText="No tasks linked to this customer."
        >
          {tasks.map((t) => (
            <Row key={t.id} onClick={() => navigate("/crm/tasks")}>
              <span className="font-medium">{t.title}</span>
              <Badge variant={TASK_STATUS_BADGE[t.status] ?? "secondary"} className="text-[10px]">
                {TASK_STATUS_LABELS[t.status] ?? t.status}
              </Badge>
              <span className="text-xs text-muted-foreground ml-auto">
                {t.dueAt ? `Due ${formatDate(t.dueAt)}` : "—"}
              </span>
            </Row>
          ))}
        </MiniList>
      )}

      {/* Recent interactions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" /> Recent interactions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {can("customer", "update") && (
            <div className="flex gap-2">
              <Input
                placeholder="Log an interaction…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && note.trim()) noteMut.mutate();
                }}
              />
              <Button disabled={!note.trim() || noteMut.isPending} onClick={() => noteMut.mutate()}>
                {noteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </div>
          )}
          {actQ.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : actQ.isError ? (
            <p className="text-sm text-destructive">Failed to load activity.</p>
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No interactions logged yet.</p>
          ) : (
            <ul className="space-y-2">
              {activities.map((a) => (
                <li key={a.id} className="text-sm border-l-2 pl-3 py-0.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] capitalize">{a.type}</Badge>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(a.createdAt)} · {userName(a.actorUserId)}
                    </span>
                  </div>
                  {a.body ? <div>{a.body}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{k}</div>
      <div className="capitalize">{v}</div>
    </div>
  );
}

function MiniList({
  icon,
  title,
  loading,
  empty,
  emptyText,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  loading: boolean;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">{icon} {title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : empty ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="divide-y">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      className="w-full flex items-center gap-2 py-2 text-left hover:bg-muted/40 px-1 -mx-1 rounded"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
