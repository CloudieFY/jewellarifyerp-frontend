import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  Pencil,
  Trash2,
} from "lucide-react";

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  TASK_STATUSES,
  TASK_OPEN_STATUSES,
  TASK_STATUS_LABELS,
  TASK_STATUS_BADGE,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_BADGE,
  TASK_RELATED_TYPES,
  toQuery,
  type Task,
  type TaskRelatedType,
  type Paginated,
} from "@/lib/crm";

const PAGE_SIZE = 25;
const ALL = "__all__";
const NONE = "__none__";

export default function CrmTasksPage() {
  const api = useTenantAPI();
  const qc = useQueryClient();
  const can = useCan();
  const { users, branches, userName } = useCrmNameMaps();

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("due_at");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [priority, setPriority] = useState<string>(ALL);
  const [assignee, setAssignee] = useState<string>(ALL);
  const [relatedType, setRelatedType] = useState<string>(ALL);
  const [mine, setMine] = useState(false);
  const [overdue, setOverdue] = useState(false);
  const debouncedSearch = useDebounce(search, 350);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const query = useMemo(
    () =>
      toQuery({
        page,
        limit: PAGE_SIZE,
        sort,
        dir,
        q: debouncedSearch,
        status: status === ALL ? "" : status,
        priority: priority === ALL ? "" : priority,
        assigned_to: assignee === ALL ? "" : assignee,
        related_type: relatedType === ALL ? "" : relatedType,
        mine: mine ? "1" : "",
        overdue: overdue ? "1" : "",
      }),
    [page, sort, dir, debouncedSearch, status, priority, assignee, relatedType, mine, overdue],
  );

  const tasksQ = useQuery({
    queryKey: ["crm", "tasks", query],
    queryFn: () => api.crm.tasks.list(query) as Promise<Paginated<Task>>,
  });

  const toggleSort = (col: string) => {
    if (sort === col) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setDir("asc");
    }
    setPage(1);
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["crm", "tasks"] });

  const rows = tasksQ.data?.data ?? [];
  const totalPages = tasksQ.data?.totalPages ?? 1;
  const total = tasksQ.data?.total ?? 0;

  const isOverdue = (t: Task) =>
    !!t.dueAt && t.status !== "completed" && t.status !== "cancelled" && new Date(t.dueAt) < new Date();

  return (
    <Layout>
      <div className="space-y-4">
        <CrmNav />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">Tasks</h1>
            <p className="text-sm text-muted-foreground">{total} total</p>
          </div>
          <Can entity="task" action="create">
            <Button data-new-button="true" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Task
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
                placeholder="Search title / description"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }}
              options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))} />
            <FilterSelect label="Priority" value={priority} onChange={(v) => { setPriority(v); setPage(1); }}
              options={TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] }))} />
            <FilterSelect label="Assignee" value={assignee} onChange={(v) => { setAssignee(v); setPage(1); }}
              options={users.map((u) => ({ value: u.id, label: u.name }))} />
            <FilterSelect label="Linked to" value={relatedType} onChange={(v) => { setRelatedType(v); setPage(1); }}
              options={TASK_RELATED_TYPES.map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }))} />
            <div className="flex items-center gap-3 pb-1.5">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={mine} onChange={(e) => { setMine(e.target.checked); setPage(1); }} />
                Mine
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={overdue} onChange={(e) => { setOverdue(e.target.checked); setPage(1); }} />
                Overdue
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Title" col="title" sort={sort} dir={dir} onSort={toggleSort} />
                    <SortableHead label="Status" col="status" sort={sort} dir={dir} onSort={toggleSort} />
                    <SortableHead label="Priority" col="priority" sort={sort} dir={dir} onSort={toggleSort} />
                    <SortableHead label="Due" col="due_at" sort={sort} dir={dir} onSort={toggleSort} />
                    <TableHead>Assignee</TableHead>
                    <TableHead>Linked</TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasksQ.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin inline" />
                      </TableCell>
                    </TableRow>
                  ) : tasksQ.isError ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-destructive">
                        <AlertCircle className="h-5 w-5 inline mr-1" />
                        {(tasksQ.error as Error)?.message ?? "Failed to load tasks"}
                        <div className="mt-2">
                          <Button variant="outline" size="sm" onClick={() => tasksQ.refetch()}>Retry</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                        No tasks found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium max-w-[280px]">
                          <button className="text-left hover:underline" onClick={() => setEditTask(task)}>
                            {task.title}
                          </button>
                          {task.description ? (
                            <div className="text-xs text-muted-foreground line-clamp-1">{task.description}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant={TASK_STATUS_BADGE[task.status] ?? "secondary"}>
                            {TASK_STATUS_LABELS[task.status] ?? task.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={TASK_PRIORITY_BADGE[task.priority] ?? "secondary"}>
                            {TASK_PRIORITY_LABELS[task.priority] ?? task.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className={isOverdue(task) ? "text-destructive font-medium" : ""}>
                          {task.dueAt ? formatDate(task.dueAt) : "—"}
                        </TableCell>
                        <TableCell>{userName(task.assignedTo)}</TableCell>
                        <TableCell>
                          <RelatedLink type={task.relatedType} id={task.relatedId} />
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <TaskRowActions
                            task={task}
                            users={users}
                            can={can}
                            onChanged={invalidate}
                            onEdit={() => setEditTask(task)}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
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

      <TaskFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        users={users}
        branches={branches}
        canAssign={can("task", "assign")}
        onSaved={() => { invalidate(); setCreateOpen(false); }}
      />

      <TaskFormDialog
        key={editTask?.id ?? "no-edit"}
        mode="edit"
        task={editTask ?? undefined}
        open={!!editTask}
        onOpenChange={(v) => !v && setEditTask(null)}
        users={users}
        branches={branches}
        canAssign={can("task", "assign")}
        canEdit={can("task", "update")}
        onSaved={() => { invalidate(); setEditTask(null); }}
      />
    </Layout>
  );
}

function RelatedLink({ type, id }: { type: TaskRelatedType | null; id: string | null }) {
  const navigate = useNavigate();
  if (!type || !id) return <span className="text-muted-foreground">—</span>;
  const go = () => {
    if (type === "lead") navigate(`/crm/leads/${id}`);
    else if (type === "opportunity") navigate(`/crm/opportunities/${id}`);
    else navigate(`/customers?customerId=${id}`);
  };
  return (
    <button className="text-xs inline-flex items-center rounded bg-muted px-1.5 py-0.5 hover:underline capitalize" onClick={go}>
      {type}
    </button>
  );
}

function TaskRowActions({
  task,
  users,
  can,
  onChanged,
  onEdit,
}: {
  task: Task;
  users: { id: string; name: string }[];
  can: (e: string, a: string) => boolean;
  onChanged: () => void;
  onEdit: () => void;
}) {
  const api = useTenantAPI();
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignee, setAssignee] = useState(task.assignedTo ?? "");
  const done = task.status === "completed";

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      {can("task", "update") && !done && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
      {can("task", "assign") && !done && (
        <AlertDialog open={assignOpen} onOpenChange={setAssignOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Reassign">
              <UserPlus className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reassign task</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Assign to</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                disabled={!assignee || busy}
                onClick={() => run(() => api.crm.tasks.assign(task.id, { assignedTo: assignee }), "Task reassigned").then(() => setAssignOpen(false))}
              >
                Reassign
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {can("task", "complete") && !done && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-green-600"
          title="Complete"
          disabled={busy}
          onClick={() => run(() => api.crm.tasks.complete(task.id, {}), "Task completed")}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        </Button>
      )}
      {can("task", "delete") && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this task?</AlertDialogTitle>
              <AlertDialogDescription>It will be soft-deleted and hidden from lists.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => run(() => api.crm.tasks.remove(task.id), "Task deleted")}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function TaskFormDialog({
  mode,
  task,
  open,
  onOpenChange,
  users,
  branches,
  canAssign,
  canEdit = true,
  onSaved,
}: {
  mode: "create" | "edit";
  task?: Task;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  users: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  canAssign: boolean;
  canEdit?: boolean;
  onSaved: () => void;
}) {
  const api = useTenantAPI();
  const editing = mode === "edit";
  const readOnly = editing && (!canEdit || task?.status === "completed");

  const initial = useMemo(
    () => ({
      title: task?.title ?? "",
      description: task?.description ?? "",
      status: (task?.status && task.status !== "completed" ? task.status : "open") as Task["status"],
      priority: (task?.priority ?? "medium") as Task["priority"],
      dueAt: task?.dueAt ? task.dueAt.slice(0, 10) : "",
      relatedType: task?.relatedType ?? "",
      relatedId: task?.relatedId ?? "",
      branchId: task?.branchId ?? "",
      assignedTo: task?.assignedTo ?? "",
    }),
    [task],
  );
  // The parent remounts this component (via `key`) whenever the target task
  // changes, so seeding state from `initial` once is enough.
  const [form, setForm] = useState(initial);

  const relOptionsQ = useQuery({
    queryKey: ["crm", "task-rel-options", form.relatedType],
    enabled: open && !!form.relatedType,
    staleTime: 60 * 1000,
    retry: false,
    queryFn: async () => {
      if (form.relatedType === "lead") {
        const r = (await api.crm.leads.list("limit=50&sort=created_at&dir=desc")) as Paginated<{ id: string; name: string }>;
        return r.data.map((x) => ({ id: x.id, label: x.name }));
      }
      if (form.relatedType === "opportunity") {
        const r = (await api.crm.opportunities.list("limit=50&sort=created_at&dir=desc")) as Paginated<{ id: string; title: string }>;
        return r.data.map((x) => ({ id: x.id, label: x.title }));
      }
      const r = (await api.crm.customers.list("limit=50")) as Paginated<{ id: string; name: string }>;
      return r.data.map((x) => ({ id: x.id, label: x.name }));
    },
  });

  const mut = useMutation({
    mutationFn: () => {
      const body: any = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status,
        priority: form.priority,
        dueAt: form.dueAt || null,
        branchId: form.branchId || null,
      };
      if (form.relatedType && form.relatedId) {
        body.relatedType = form.relatedType;
        body.relatedId = form.relatedId;
      } else if (editing && (task?.relatedType || task?.relatedId)) {
        body.relatedType = null;
        body.relatedId = null;
      }
      if (!editing || canAssign) {
        if (form.assignedTo) body.assignedTo = form.assignedTo;
      }
      return editing ? api.crm.tasks.update(task!.id, body) : api.crm.tasks.create(body);
    },
    onSuccess: () => {
      toast.success(editing ? "Task saved" : "Task created");
      if (!editing) setForm(initial);
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save task"),
  });

  const relValid = (!form.relatedType && !form.relatedId) || (!!form.relatedType && !!form.relatedId);
  const canSubmit = form.title.trim().length > 0 && relValid && !readOnly;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? (readOnly ? "Task" : "Edit task") : "New task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Title *">
            <Input disabled={readOnly} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus={!editing} />
          </Field>
          <Field label="Description">
            <Textarea disabled={readOnly} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select disabled={readOnly} value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Task["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_OPEN_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select disabled={readOnly} value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Task["priority"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date">
              <Input type="date" disabled={readOnly} value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
            </Field>
            <Field label="Branch">
              <Select disabled={readOnly} value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Link to">
              <Select
                disabled={readOnly}
                value={form.relatedType || NONE}
                onValueChange={(v) => setForm({ ...form, relatedType: v === NONE ? "" : v, relatedId: "" })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nothing</SelectItem>
                  {TASK_RELATED_TYPES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={form.relatedType ? `Pick ${form.relatedType}` : "Record"}>
              <Select
                disabled={readOnly || !form.relatedType}
                value={form.relatedId}
                onValueChange={(v) => setForm({ ...form, relatedId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={relOptionsQ.isLoading ? "Loading…" : "Select…"} />
                </SelectTrigger>
                <SelectContent>
                  {(relOptionsQ.data ?? []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                  ))}
                  {editing && form.relatedId && !(relOptionsQ.data ?? []).some((o) => o.id === form.relatedId) && (
                    <SelectItem value={form.relatedId}>{form.relatedId}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {(!editing || canAssign) && (
            <Field label="Assign to">
              <Select disabled={readOnly} value={form.assignedTo} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {!relValid && <p className="text-[11px] text-destructive">Pick a record for the linked type, or set link to “Nothing”.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {!readOnly && (
            <Button disabled={!canSubmit || mut.isPending} onClick={() => mut.mutate()}>
              {mut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Save" : "Create"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <div className="min-w-[140px]">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder={`All ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
