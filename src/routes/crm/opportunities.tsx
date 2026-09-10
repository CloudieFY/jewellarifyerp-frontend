import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Loader2, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";

import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useTenantAPI } from "@/lib/api";
import { useDebounce, formatDate } from "@/lib/utils";
import { useCan, Can } from "@/components/crm/Can";
import {
  OPPORTUNITY_STAGES,
  OPEN_OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGE_BADGE,
  LEAD_SOURCES,
  toQuery,
  type Opportunity,
  type OpportunityStage,
  type Paginated,
  type PipelineSummary,
} from "@/lib/crm";

const PAGE_SIZE = 25;
const ALL = "__all__";

function money(n: number | null | undefined): string {
  if (n == null) return "—";
  return "₹" + Number(n).toLocaleString("en-IN");
}

export default function CrmOpportunitiesPage() {
  const api = useTenantAPI();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const can = useCan();

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("created_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>(ALL);
  const [assignee, setAssignee] = useState<string>(ALL);
  const [branch, setBranch] = useState<string>(ALL);
  const debouncedSearch = useDebounce(search, 350);

  const [createOpen, setCreateOpen] = useState(false);

  const query = useMemo(
    () =>
      toQuery({
        page,
        limit: PAGE_SIZE,
        sort,
        dir,
        q: debouncedSearch,
        stage: stage === ALL ? "" : stage,
        assigned_to: assignee === ALL ? "" : assignee,
        branch_id: branch === ALL ? "" : branch,
      }),
    [page, sort, dir, debouncedSearch, stage, assignee, branch],
  );

  const oppsQ = useQuery({
    queryKey: ["crm", "opportunities", query],
    queryFn: () => api.crm.opportunities.list(query) as Promise<Paginated<Opportunity>>,
  });
  const pipelineQ = useQuery({
    queryKey: ["crm", "pipeline"],
    queryFn: () => api.crm.opportunities.pipeline() as Promise<PipelineSummary>,
  });
  const usersQ = useQuery({ queryKey: ["crm", "users"], queryFn: () => api.crm.users() });
  const branchesQ = useQuery({ queryKey: ["crm", "branches"], queryFn: () => api.crm.branches() });

  const userName = (id: string | null) =>
    !id ? "—" : usersQ.data?.find((u: any) => u.id === id)?.name ?? id;
  const branchName = (id: string | null) =>
    !id ? "—" : branchesQ.data?.find((b: any) => b.id === id)?.name ?? id;

  const toggleSort = (col: string) => {
    if (sort === col) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setDir("asc");
    }
    setPage(1);
  };

  const rows = oppsQ.data?.data ?? [];
  const totalPages = oppsQ.data?.totalPages ?? 1;
  const total = oppsQ.data?.total ?? 0;

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">Opportunities</h1>
            <p className="text-sm text-muted-foreground">{total} total</p>
          </div>
          <Can entity="opportunity" action="create">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Opportunity
            </Button>
          </Can>
        </div>

        {/* pipeline board */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {(pipelineQ.data?.stages ?? OPPORTUNITY_STAGES.map((s) => ({ stage: s, count: 0, amount: 0 }))).map(
            (s) => (
              <Card
                key={s.stage}
                className={`cursor-pointer transition-colors ${stage === s.stage ? "border-primary" : ""}`}
                onClick={() => {
                  setStage((cur) => (cur === s.stage ? ALL : s.stage));
                  setPage(1);
                }}
              >
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">
                    {OPPORTUNITY_STAGE_LABELS[s.stage as OpportunityStage] ?? s.stage}
                  </div>
                  <div className="text-lg font-semibold">{s.count}</div>
                  <div className="text-xs text-muted-foreground">{money(s.amount)}</div>
                </CardContent>
              </Card>
            ),
          )}
        </div>

        {/* filters */}
        <Card>
          <CardContent className="p-3 flex flex-wrap gap-2 items-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search title / notes"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <FilterSelect label="Stage" value={stage} onChange={(v) => { setStage(v); setPage(1); }}
              options={OPPORTUNITY_STAGES.map((s) => ({ value: s, label: OPPORTUNITY_STAGE_LABELS[s] }))} />
            <FilterSelect label="Assignee" value={assignee} onChange={(v) => { setAssignee(v); setPage(1); }}
              options={(usersQ.data ?? []).map((u: any) => ({ value: u.id, label: u.name }))} />
            <FilterSelect label="Branch" value={branch} onChange={(v) => { setBranch(v); setPage(1); }}
              options={(branchesQ.data ?? []).map((b: any) => ({ value: b.id, label: b.name }))} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Title" col="title" sort={sort} dir={dir} onSort={toggleSort} />
                  <SortableHead label="Stage" col="stage" sort={sort} dir={dir} onSort={toggleSort} />
                  <SortableHead label="Amount" col="amount" sort={sort} dir={dir} onSort={toggleSort} />
                  <TableHead>Assignee</TableHead>
                  <TableHead>Branch</TableHead>
                  <SortableHead label="Close date" col="expected_close_date" sort={sort} dir={dir} onSort={toggleSort} />
                  <SortableHead label="Created" col="created_at" sort={sort} dir={dir} onSort={toggleSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {oppsQ.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin inline" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      No opportunities found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((opp) => (
                    <TableRow
                      key={opp.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/crm/opportunities/${opp.id}`)}
                    >
                      <TableCell className="font-medium">{opp.title}</TableCell>
                      <TableCell>
                        <Badge variant={OPPORTUNITY_STAGE_BADGE[opp.stage] ?? "secondary"}>
                          {OPPORTUNITY_STAGE_LABELS[opp.stage] ?? opp.stage}
                        </Badge>
                      </TableCell>
                      <TableCell>{money(opp.amount)}</TableCell>
                      <TableCell>{userName(opp.assignedTo)}</TableCell>
                      <TableCell>{branchName(opp.branchId)}</TableCell>
                      <TableCell>{opp.expectedCloseDate ? formatDate(opp.expectedCloseDate) : "—"}</TableCell>
                      <TableCell>{formatDate(opp.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <CreateOpportunityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        users={usersQ.data ?? []}
        branches={branchesQ.data ?? []}
        canAssign={can("opportunity", "assign")}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["crm", "opportunities"] });
          qc.invalidateQueries({ queryKey: ["crm", "pipeline"] });
          setCreateOpen(false);
        }}
      />
    </Layout>
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

function SortableHead({
  label,
  col,
  sort,
  dir,
  onSort,
}: {
  label: string;
  col: string;
  sort: string;
  dir: string;
  onSort: (c: string) => void;
}) {
  return (
    <TableHead>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort(col)}>
        {label}
        <ArrowUpDown className="h-3 w-3" />
        {sort === col ? <span className="text-[10px]">{dir}</span> : null}
      </button>
    </TableHead>
  );
}

function CreateOpportunityDialog({
  open,
  onOpenChange,
  users,
  branches,
  canAssign,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  users: any[];
  branches: any[];
  canAssign: boolean;
  onCreated: () => void;
}) {
  const api = useTenantAPI();
  const empty = {
    title: "",
    amount: "",
    probability: "",
    source: "",
    stage: "prospecting",
    expectedCloseDate: "",
    notes: "",
    branchId: "",
    assignedTo: "",
  };
  const [form, setForm] = useState(empty);
  const reset = () => setForm(empty);

  const mut = useMutation({
    mutationFn: () => {
      const body: any = { title: form.title.trim(), stage: form.stage };
      if (form.amount.trim()) body.amount = Number(form.amount);
      if (form.probability.trim()) body.probability = Number(form.probability);
      if (form.source) body.source = form.source;
      if (form.expectedCloseDate) body.expectedCloseDate = form.expectedCloseDate;
      if (form.notes.trim()) body.notes = form.notes.trim();
      if (form.branchId) body.branchId = form.branchId;
      if (canAssign && form.assignedTo) body.assignedTo = form.assignedTo;
      return api.crm.opportunities.create(body);
    },
    onSuccess: () => {
      toast.success("Opportunity created");
      reset();
      onCreated();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create opportunity"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Opportunity</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Title *">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)">
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Probability (%)">
              <Input type="number" value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stage">
              <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPEN_OPPORTUNITY_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{OPPORTUNITY_STAGE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Source">
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expected close">
              <Input type="date" value={form.expectedCloseDate} onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })} />
            </Field>
            <Field label="Branch">
              <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {canAssign && (
            <Field label="Assign to">
              <Select value={form.assignedTo} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Notes">
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!form.title.trim() || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
