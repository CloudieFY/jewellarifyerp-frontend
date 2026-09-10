import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Loader2, Trophy, XCircle, ArrowRightLeft, AlertCircle, ExternalLink } from "lucide-react";

import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useTenantAPI } from "@/lib/api";
import { useDebounce, formatDate } from "@/lib/utils";
import { useCan } from "@/components/crm/Can";
import { useCrmNameMaps } from "@/components/crm/hooks";
import { CrmNav } from "@/components/crm/CrmNav";
import {
  OPEN_OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGE_BADGE,
  crmMoney,
  toQuery,
  type Opportunity,
  type OpportunityStage,
  type Paginated,
  type PipelineSummary,
} from "@/lib/crm";

const COLUMN_LIMIT = 50;
const ALL = "__all__";

export default function CrmPipelinePage() {
  const api = useTenantAPI();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const can = useCan();
  const { users, branches, userName } = useCrmNameMaps();

  const [search, setSearch] = useState("");
  const [assignee, setAssignee] = useState<string>(ALL);
  const [branch, setBranch] = useState<string>(ALL);
  const debouncedSearch = useDebounce(search, 350);

  const baseParams = useMemo(
    () => ({
      q: debouncedSearch,
      assigned_to: assignee === ALL ? "" : assignee,
      branch_id: branch === ALL ? "" : branch,
    }),
    [debouncedSearch, assignee, branch],
  );

  const pipelineQ = useQuery({
    queryKey: ["crm", "pipeline", baseParams],
    queryFn: () => api.crm.opportunities.pipeline(toQuery(baseParams)) as Promise<PipelineSummary>,
  });

  // A named customer map for the cards (best-effort; bounded to one page).
  const custQ = useQuery({
    queryKey: ["crm", "customers", "namemap"],
    queryFn: () => api.crm.customers.list("limit=100") as Promise<Paginated<{ id: string; name: string }>>,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const customerName = (id: string | null) =>
    !id ? null : custQ.data?.data?.find((c) => c.id === id)?.name ?? "Customer";

  const columnQueries = useQueries({
    queries: OPEN_OPPORTUNITY_STAGES.map((stage) => ({
      queryKey: ["crm", "pipeline-column", stage, baseParams],
      queryFn: () =>
        api.crm.opportunities.list(
          toQuery({ ...baseParams, stage, limit: COLUMN_LIMIT, sort: "updated_at", dir: "desc" }),
        ) as Promise<Paginated<Opportunity>>,
    })),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["crm", "pipeline"] });
    qc.invalidateQueries({ queryKey: ["crm", "pipeline-column"] });
    qc.invalidateQueries({ queryKey: ["crm", "opportunities"] });
  };

  const stageAmount = (stage: OpportunityStage) =>
    pipelineQ.data?.stages?.find((s) => s.stage === stage)?.amount ?? 0;

  const summary = pipelineQ.data;
  const anyError = columnQueries.some((q) => q.isError) || pipelineQ.isError;

  return (
    <Layout>
      <div className="space-y-4">
        <CrmNav />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              {summary
                ? `${summary.open.count} open · ${crmMoney(summary.open.amount)}`
                : "Sales pipeline by stage"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/crm/opportunities")}>
            <ExternalLink className="h-4 w-4 mr-1" /> Table view
          </Button>
        </div>

        {/* won / lost summary */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <MiniStat label="Open value" value={crmMoney(summary.open.amount)} sub={`${summary.open.count} deals`} />
            <MiniStat label="Won" value={crmMoney(summary.won.amount)} sub={`${summary.won.count} deals`} tone="green" />
            <MiniStat label="Lost" value={crmMoney(summary.lost.amount)} sub={`${summary.lost.count} deals`} tone="red" />
          </div>
        )}

        {/* filters */}
        <Card>
          <CardContent className="p-3 flex flex-wrap gap-2 items-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search title / notes"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <FilterSelect label="Assignee" value={assignee} onChange={setAssignee}
              options={users.map((u) => ({ value: u.id, label: u.name }))} />
            <FilterSelect label="Branch" value={branch} onChange={setBranch}
              options={branches.map((b) => ({ value: b.id, label: b.name }))} />
          </CardContent>
        </Card>

        {anyError && (
          <div className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Some pipeline data failed to load.
            <Button variant="outline" size="sm" onClick={invalidate}>Retry</Button>
          </div>
        )}

        {/* kanban columns */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {OPEN_OPPORTUNITY_STAGES.map((stage, i) => {
            const q = columnQueries[i];
            const items = q.data?.data ?? [];
            const colTotal = q.data?.total ?? items.length;
            return (
              <div key={stage} className="rounded-lg border bg-muted/30 flex flex-col min-h-[200px]">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Badge variant={OPPORTUNITY_STAGE_BADGE[stage] ?? "secondary"}>
                      {OPPORTUNITY_STAGE_LABELS[stage]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{colTotal}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{crmMoney(stageAmount(stage))}</span>
                </div>

                <div className="p-2 space-y-2 flex-1">
                  {q.isLoading ? (
                    <div className="py-8 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
                  ) : items.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No deals</p>
                  ) : (
                    items.map((opp) => (
                      <PipelineCard
                        key={opp.id}
                        opp={opp}
                        userName={userName}
                        customerName={customerName}
                        canStage={can("opportunity", "stage")}
                        canWin={can("opportunity", "win")}
                        canLose={can("opportunity", "lose")}
                        onOpen={() => navigate(`/crm/opportunities/${opp.id}`)}
                        onChanged={invalidate}
                      />
                    ))
                  )}
                  {colTotal > items.length && (
                    <p className="text-[11px] text-muted-foreground text-center pt-1">
                      +{colTotal - items.length} more — open table view
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

function MiniStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "green" | "red";
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={
            tone === "green"
              ? "text-lg font-semibold text-green-600"
              : tone === "red"
                ? "text-lg font-semibold text-destructive"
                : "text-lg font-semibold"
          }
        >
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

function PipelineCard({
  opp,
  userName,
  customerName,
  canStage,
  canWin,
  canLose,
  onOpen,
  onChanged,
}: {
  opp: Opportunity;
  userName: (id: string | null) => string;
  customerName: (id: string | null) => string | null;
  canStage: boolean;
  canWin: boolean;
  canLose: boolean;
  onOpen: () => void;
  onChanged: () => void;
}) {
  const api = useTenantAPI();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const cName = customerName(opp.customerId);

  return (
    <div className="rounded-md border bg-card p-2.5 space-y-2 shadow-xs">
      <button className="text-left w-full" onClick={onOpen}>
        <div className="font-medium text-sm leading-snug line-clamp-2">{opp.title}</div>
      </button>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">{crmMoney(opp.amount)}</span>
        {opp.probability != null && <span>· {opp.probability}%</span>}
      </div>

      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {cName && (
          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5">{cName}</span>
        )}
        {opp.leadId && (
          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5">From lead</span>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{userName(opp.assignedTo)}</span>
        <span>{opp.expectedCloseDate ? formatDate(opp.expectedCloseDate) : "—"}</span>
      </div>

      {(canStage || canWin || canLose) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t">
          {canStage && (
            <Select
              value={opp.stage}
              onValueChange={(v) => {
                if (v !== opp.stage) run(() => api.crm.opportunities.stage(opp.id, { stage: v }), "Stage updated");
              }}
              disabled={busy}
            >
              <SelectTrigger className="h-7 text-[11px] w-[130px]">
                <ArrowRightLeft className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPEN_OPPORTUNITY_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{OPPORTUNITY_STAGE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canWin && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px] text-green-600"
              disabled={busy}
              onClick={() => run(() => api.crm.opportunities.win(opp.id, {}), "Marked won 🎉")}
            >
              <Trophy className="h-3 w-3 mr-1" /> Win
            </Button>
          )}
          {canLose && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px] text-destructive"
              disabled={busy}
              onClick={() => run(() => api.crm.opportunities.lose(opp.id, {}), "Marked lost")}
            >
              <XCircle className="h-3 w-3 mr-1" /> Lose
            </Button>
          )}
          {busy && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="min-w-[150px]">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder={`All ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
