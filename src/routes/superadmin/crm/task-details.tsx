import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { superAdminAPI } from "@/lib/api";
import {
  TASK_OPEN_STATUSES, TASK_STATUS_LABELS, TASK_STATUS_BADGE,
  TASK_PRIORITIES, TASK_PRIORITY_LABELS, TASK_PRIORITY_BADGE,
  type Task, type CrmUser, type TaskStatus, type TaskPriority, type Lead, type Opportunity,
} from "@/lib/crm";
import { toast } from "sonner";

export default function SuperAdminCrmTaskDetailsPage() {
  const { shopId, id } = useParams<{ shopId: string; id: string }>();
  const navigate = useNavigate();

  const [task, setTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [relatedLead, setRelatedLead] = useState<Lead | null>(null);
  const [relatedOpp, setRelatedOpp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("open");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueAt, setDueAt] = useState("");
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!shopId || !id) return;
    setLoading(true);
    Promise.all([superAdminAPI.crm.tasks.get(shopId, id), superAdminAPI.crm.users(shopId)])
      .then(([t, u]: any[]) => {
        setTask(t);
        setUsers(u);
        setTitle(t.title);
        setDescription(t.description ?? "");
        setStatus(t.status);
        setPriority(t.priority);
        setDueAt(t.dueAt ? t.dueAt.slice(0, 10) : "");
        setAssignee(t.assignedTo ?? "");
        setRelatedLead(null);
        setRelatedOpp(null);
        if (t.relatedType === "lead" && t.relatedId) {
          superAdminAPI.crm.leads.get(shopId, t.relatedId).then(setRelatedLead).catch(() => setRelatedLead(null));
        } else if (t.relatedType === "opportunity" && t.relatedId) {
          superAdminAPI.crm.opportunities.get(shopId, t.relatedId).then(setRelatedOpp).catch(() => setRelatedOpp(null));
        }
      })
      .catch((err: any) => toast.error(err?.message || "Failed to load task"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [shopId, id]);

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  }
  if (!task || !shopId || !id) {
    return <div className="text-muted-foreground">Task not found.</div>;
  }

  const save = async () => {
    setBusy(true);
    try {
      await superAdminAPI.crm.tasks.update(shopId, id, {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        dueAt: dueAt || null,
      });
      toast.success("Task updated");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update task");
    } finally {
      setBusy(false);
    }
  };

  const assign = async () => {
    if (!assignee) return;
    setBusy(true);
    try {
      await superAdminAPI.crm.tasks.assign(shopId, id, { assignedTo: assignee });
      toast.success("Task assigned");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign task");
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    setBusy(true);
    try {
      await superAdminAPI.crm.tasks.complete(shopId, id);
      toast.success("Task completed");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to complete task");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/superadmin/crm/tasks")}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Tasks
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{task.title}</h1>
          {relatedLead && (
            <div className="text-xs text-muted-foreground mt-1">
              Follow-up for lead: <Link className="underline" to={`/superadmin/crm/leads/${shopId}/${relatedLead.id}`}>{relatedLead.name}</Link>
            </div>
          )}
          {relatedOpp && (
            <div className="text-xs text-muted-foreground mt-1">
              Follow-up for opportunity: <Link className="underline" to={`/superadmin/crm/opportunities/${shopId}/${relatedOpp.id}`}>{relatedOpp.title}</Link>
            </div>
          )}
          {task.relatedType === "customer" && task.relatedId && (
            <div className="text-xs text-muted-foreground mt-1">Related customer ID: {task.relatedId}</div>
          )}
        </div>
        <div className="flex gap-2">
          <Badge variant={TASK_PRIORITY_BADGE[task.priority]}>{TASK_PRIORITY_LABELS[task.priority]}</Badge>
          <Badge variant={TASK_STATUS_BADGE[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">Details</h2>
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={task.status === "completed"} />
            <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={task.status === "completed"} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)} disabled={task.status === "completed"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_OPEN_STATUSES.map((s) => <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)} disabled={task.status === "completed"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} disabled={task.status === "completed"} />
            <Button size="sm" disabled={busy || task.status === "completed" || !title.trim()} onClick={save}>Save</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">Assign</h2>
            <Select value={assignee} onValueChange={setAssignee} disabled={task.status === "completed"}>
              <SelectTrigger><SelectValue placeholder="Choose a user in this shop" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={busy || !assignee || task.status === "completed"} onClick={assign}>Assign</Button>
            {task.assignedTo && <div className="text-xs text-muted-foreground">Currently assigned to {users.find((u) => u.id === task.assignedTo)?.name ?? task.assignedTo}</div>}

            <h2 className="text-sm font-semibold pt-2">Completion</h2>
            {task.status === "completed" ? (
              <div className="text-xs text-muted-foreground">Completed {task.completedAt ? new Date(task.completedAt).toLocaleString() : ""}</div>
            ) : (
              <Button size="sm" variant="outline" disabled={busy} onClick={complete}>Mark Complete</Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
