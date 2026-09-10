import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Loader2, ChevronLeft, ChevronRight, ArrowUpDown, AlertCircle } from "lucide-react";

import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useCrmNameMaps } from "@/components/crm/hooks";
import { CrmNav } from "@/components/crm/CrmNav";
import {
  LEAD_STATUSES,
  LEAD_OPEN_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_BADGE,
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  sourceLabel,
  toQuery,
  type Lead,
  type Paginated,
} from "@/lib/crm";

const PAGE_SIZE = 25;
const ALL = "__all__";

export default function CrmLeadsPage() {
  const api = useTenantAPI();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const can = useCan();
  const { users, branches, userName, branchName } = useCrmNameMaps();

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("created_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [source, setSource] = useState<string>(ALL);
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
        status: status === ALL ? "" : status,
        source: source === ALL ? "" : source,
        assigned_to: assignee === ALL ? "" : assignee,
        branch_id: branch === ALL ? "" : branch,
      }),
    [page, sort, dir, debouncedSearch, status, source, assignee, branch],
  );

  const leadsQ = useQuery({
    queryKey: ["crm", "leads", query],
    queryFn: () => api.crm.leads.list(query) as Promise<Paginated<Lead>>,
  });

  const toggleSort = (col: string) => {
    if (sort === col) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setDir("asc");
    }
    setPage(1);
  };

  const rows = leadsQ.data?.data ?? [];
  const totalPages = leadsQ.data?.totalPages ?? 1;
  const total = leadsQ.data?.total ?? 0;

  return (
    <Layout>
      <div className="space-y-4">
        <CrmNav />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">Leads</h1>
            <p className="text-sm text-muted-foreground">{total} total</p>
          </div>
          <Can entity="lead" action="create">
            <Button data-new-button="true" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Lead
            </Button>
          </Can>
        </div>

        {/* filters */}
        <Card>
          <CardContent className="p-3 flex flex-wrap gap-2 items-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search name / phone / email / company"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <FilterSelect
              label="Status"
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))}
            />
            <FilterSelect
              label="Source"
              value={source}
              onChange={(v) => { setSource(v); setPage(1); }}
              options={LEAD_SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABELS[s] ?? s }))}
            />
            <FilterSelect
              label="Assignee"
              value={assignee}
              onChange={(v) => { setAssignee(v); setPage(1); }}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
            />
            <FilterSelect
              label="Branch"
              value={branch}
              onChange={(v) => { setBranch(v); setPage(1); }}
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Name" col="name" sort={sort} dir={dir} onSort={toggleSort} />
                    <TableHead>Phone</TableHead>
                    <SortableHead label="Status" col="status" sort={sort} dir={dir} onSort={toggleSort} />
                    <TableHead>Source</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Branch</TableHead>
                    <SortableHead label="Last activity" col="last_activity_at" sort={sort} dir={dir} onSort={toggleSort} />
                    <SortableHead label="Created" col="created_at" sort={sort} dir={dir} onSort={toggleSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsQ.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin inline" />
                      </TableCell>
                    </TableRow>
                  ) : leadsQ.isError ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-destructive">
                        <AlertCircle className="h-5 w-5 inline mr-1" />
                        {(leadsQ.error as Error)?.message ?? "Failed to load leads"}
                        <div className="mt-2">
                          <Button variant="outline" size="sm" onClick={() => leadsQ.refetch()}>Retry</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        No leads found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((lead) => (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/crm/leads/${lead.id}`)}
                      >
                        <TableCell className="font-medium">
                          {lead.name}
                          {lead.company ? (
                            <span className="text-muted-foreground"> · {lead.company}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="tabular-nums">{lead.phone ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={LEAD_STATUS_BADGE[lead.status] ?? "secondary"}>
                            {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{sourceLabel(lead.source)}</TableCell>
                        <TableCell>{userName(lead.assignedTo)}</TableCell>
                        <TableCell>{branchName(lead.branchId)}</TableCell>
                        <TableCell>{lead.lastActivityAt ? formatDate(lead.lastActivityAt) : "—"}</TableCell>
                        <TableCell>{formatDate(lead.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
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

      <CreateLeadDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        users={users}
        branches={branches}
        canAssign={can("lead", "assign")}
        onCreated={(id) => {
          qc.invalidateQueries({ queryKey: ["crm", "leads"] });
          setCreateOpen(false);
          if (id) navigate(`/crm/leads/${id}`);
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

function CreateLeadDialog({
  open,
  onOpenChange,
  users,
  branches,
  canAssign,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  users: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  canAssign: boolean;
  onCreated: (id?: string) => void;
}) {
  const api = useTenantAPI();
  const empty = {
    name: "",
    phone: "",
    email: "",
    company: "",
    source: "",
    status: "new",
    notes: "",
    branchId: "",
    assignedTo: "",
  };
  const [form, setForm] = useState(empty);
  const reset = () => setForm(empty);

  const emailValid = !form.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const canSubmit = form.name.trim().length > 0 && emailValid;

  const mut = useMutation({
    mutationFn: () => {
      const body: any = { name: form.name.trim(), status: form.status };
      if (form.phone.trim()) body.phone = form.phone.trim();
      if (form.email.trim()) body.email = form.email.trim();
      if (form.company.trim()) body.company = form.company.trim();
      if (form.source) body.source = form.source;
      if (form.notes.trim()) body.notes = form.notes.trim();
      if (form.branchId) body.branchId = form.branchId;
      if (canAssign && form.assignedTo) body.assignedTo = form.assignedTo;
      return api.crm.leads.create(body) as Promise<{ id: string }>;
    },
    onSuccess: (lead) => {
      toast.success("Lead created");
      reset();
      onCreated(lead?.id);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create lead"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Name *">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                aria-invalid={!emailValid}
              />
              {!emailValid && <p className="text-[11px] text-destructive">Enter a valid email address.</p>}
            </Field>
          </div>
          <Field label="Company">
            <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAD_OPEN_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{LEAD_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Source">
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{LEAD_SOURCE_LABELS[s] ?? s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
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
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canSubmit || mut.isPending} onClick={() => mut.mutate()}>
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
