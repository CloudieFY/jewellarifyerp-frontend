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
  DEMO_STATUS_LABELS, DEMO_STATUS_BADGE,
  TASK_STATUS_LABELS, TASK_STATUS_BADGE,
  type Demo, type CrmActivity, type CrmUser, type Task, type Lead, type Opportunity,
} from "@/lib/crm";
import { toast } from "sonner";

export default function SuperAdminCrmDemoDetailsPage() {
  const { shopId, id } = useParams<{ shopId: string; id: string }>();
  const navigate = useNavigate();

  const [demo, setDemo] = useState<Demo | null>(null);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [followUps, setFollowUps] = useState<Task[]>([]);
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [linkedLead, setLinkedLead] = useState<Lead | null>(null);
  const [linkedOpp, setLinkedOpp] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);

  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState("");
  const [outcome, setOutcome] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [completeNotes, setCompleteNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!shopId || !id) return;
    setLoading(true);
    Promise.all([
      superAdminAPI.crm.demos.get(shopId, id),
      superAdminAPI.crm.demos.activities(shopId, id),
      superAdminAPI.crm.tasks.list(`related_type=demo&related_id=${id}`),
      superAdminAPI.crm.users(shopId),
    ])
      .then(([d, act, tasks, u]: any[]) => {
        setDemo(d);
        setActivities(act.data);
        setFollowUps(tasks.data);
        setUsers(u);
        setLinkedLead(null);
        setLinkedOpp(null);
        if (d.leadId) superAdminAPI.crm.leads.get(shopId, d.leadId).then(setLinkedLead).catch(() => setLinkedLead(null));
        if (d.opportunityId) superAdminAPI.crm.opportunities.get(shopId, d.opportunityId).then(setLinkedOpp).catch(() => setLinkedOpp(null));
      })
      .catch((err: any) => toast.error(err?.message || "Failed to load demo"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [shopId, id]);

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  }
  if (!demo || !shopId || !id) {
    return <div className="text-muted-foreground">Demo not found.</div>;
  }

  const closed = demo.status !== "scheduled";

  const addNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await superAdminAPI.crm.demos.addActivity(shopId, id, { body: note.trim(), type: "note" });
      setNote("");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add note");
    } finally {
      setBusy(false);
    }
  };

  const assign = async () => {
    if (!assignee) return;
    setBusy(true);
    try {
      await superAdminAPI.crm.demos.assign(shopId, id, { assignedTo: assignee });
      toast.success("Demo assigned");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign demo");
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!outcome.trim()) return;
    setBusy(true);
    try {
      await superAdminAPI.crm.demos.complete(shopId, id, {
        outcome: outcome.trim(),
        nextAction: nextAction.trim() || undefined,
        notes: completeNotes.trim() || undefined,
      });
      toast.success("Demo marked complete");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to complete demo");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (noShow: boolean) => {
    setBusy(true);
    try {
      await superAdminAPI.crm.demos.cancel(shopId, id, { reason: cancelReason.trim() || undefined, noShow });
      toast.success(noShow ? "Demo marked no-show" : "Demo cancelled");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel demo");
    } finally {
      setBusy(false);
    }
  };

  const addFollowUp = async () => {
    if (!followUpTitle.trim()) return;
    setBusy(true);
    try {
      await superAdminAPI.crm.tasks.create(shopId, { title: followUpTitle.trim(), relatedType: "demo", relatedId: id });
      setFollowUpTitle("");
      toast.success("Follow-up task created");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create follow-up");
    } finally {
      setBusy(false);
    }
  };

  const completeFollowUp = async (taskId: string) => {
    setBusy(true);
    try {
      await superAdminAPI.crm.tasks.complete(shopId, taskId);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to complete task");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/superadmin/crm/demos")}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Demos
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Demo — {new Date(demo.scheduledAt).toLocaleString()}</h1>
          <div className="text-sm text-muted-foreground">{demo.mode || "Mode not set"}</div>
          {linkedLead && (
            <div className="text-xs text-muted-foreground mt-1">
              Lead: <Link className="underline" to={`/superadmin/crm/leads/${shopId}/${linkedLead.id}`}>{linkedLead.name}</Link>
            </div>
          )}
          {linkedOpp && (
            <div className="text-xs text-muted-foreground mt-1">
              Opportunity: <Link className="underline" to={`/superadmin/crm/opportunities/${shopId}/${linkedOpp.id}`}>{linkedOpp.title}</Link>
            </div>
          )}
          {demo.customerId && <div className="text-xs text-muted-foreground mt-1">Customer ID: {demo.customerId}</div>}
        </div>
        <Badge variant={DEMO_STATUS_BADGE[demo.status]}>{DEMO_STATUS_LABELS[demo.status]}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">Assign</h2>
            <Select value={assignee} onValueChange={setAssignee} disabled={closed}>
              <SelectTrigger><SelectValue placeholder="Choose a user in this shop" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={busy || !assignee || closed} onClick={assign}>Assign</Button>
            {demo.assignedTo && <div className="text-xs text-muted-foreground">Currently assigned to {users.find((u) => u.id === demo.assignedTo)?.name ?? demo.assignedTo}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">Complete</h2>
            <Input placeholder="Outcome (e.g. interested, not interested)" value={outcome} onChange={(e) => setOutcome(e.target.value)} disabled={closed} />
            <Input placeholder="Next action" value={nextAction} onChange={(e) => setNextAction(e.target.value)} disabled={closed} />
            <Textarea placeholder="Notes" value={completeNotes} onChange={(e) => setCompleteNotes(e.target.value)} disabled={closed} />
            <Button size="sm" disabled={busy || closed || !outcome.trim()} onClick={complete}>Mark Complete</Button>
            {demo.status === "completed" && (
              <div className="text-xs text-muted-foreground">
                Outcome: {demo.outcome} {demo.nextAction && `· Next: ${demo.nextAction}`}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">Cancel / No-show</h2>
            <Input placeholder="Reason (optional)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} disabled={closed} />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy || closed} onClick={() => cancel(false)}>Cancel Demo</Button>
              <Button size="sm" variant="outline" disabled={busy || closed} onClick={() => cancel(true)}>Mark No-show</Button>
            </div>
            {closed && <div className="text-xs text-muted-foreground">This demo is {DEMO_STATUS_LABELS[demo.status].toLowerCase()}.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">Follow-up Tasks</h2>
            <div className="flex gap-2">
              <Textarea rows={1} placeholder="New follow-up..." value={followUpTitle} onChange={(e) => setFollowUpTitle(e.target.value)} className="min-h-0" />
              <Button size="sm" disabled={busy || !followUpTitle.trim()} onClick={addFollowUp}>Add</Button>
            </div>
            <div className="space-y-1">
              {followUps.length === 0 && <div className="text-xs text-muted-foreground">No follow-up tasks yet.</div>}
              {followUps.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-1 last:border-0">
                  <div>
                    <Badge variant={TASK_STATUS_BADGE[t.status]} className="mr-2">{TASK_STATUS_LABELS[t.status]}</Badge>
                    {t.title}
                  </div>
                  {t.status !== "completed" && (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => completeFollowUp(t.id)}>Complete</Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-semibold">Activity Timeline</h2>
          <div className="flex gap-2">
            <Textarea rows={2} placeholder="Add a note..." value={note} onChange={(e) => setNote(e.target.value)} />
            <Button size="sm" disabled={busy || !note.trim()} onClick={addNote}>Add Note</Button>
          </div>
          <div className="space-y-2">
            {activities.length === 0 && <div className="text-sm text-muted-foreground">No activity yet.</div>}
            {activities.map((a) => (
              <div key={a.id} className="text-sm border-b border-border/50 pb-2 last:border-0">
                <span className="text-xs text-muted-foreground mr-2">{new Date(a.createdAt).toLocaleString()}</span>
                <Badge variant="outline" className="mr-2">{a.type}</Badge>
                {a.body}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
