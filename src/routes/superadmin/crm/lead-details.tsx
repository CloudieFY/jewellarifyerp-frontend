import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { superAdminAPI } from "@/lib/api";
import {
  LEAD_STATUS_LABELS, LEAD_STATUS_BADGE, sourceLabel,
  QUALIFICATION_STATUSES, QUALIFICATION_STATUS_LABELS, QUALIFICATION_STATUS_BADGE,
  TASK_STATUS_LABELS, TASK_STATUS_BADGE,
  type Lead, type CrmActivity, type CrmUser, type Task, type QualificationStatus,
} from "@/lib/crm";
import { toast } from "sonner";

export default function SuperAdminCrmLeadDetailsPage() {
  const { shopId, id } = useParams<{ shopId: string; id: string }>();
  const navigate = useNavigate();

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [followUps, setFollowUps] = useState<Task[]>([]);
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [note, setNote] = useState("");
  const [qualOutcome, setQualOutcome] = useState<QualificationStatus>("qualified");
  const [qualReason, setQualReason] = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!shopId || !id) return;
    setLoading(true);
    Promise.all([
      superAdminAPI.crm.leads.get(shopId, id),
      superAdminAPI.crm.leads.activities(shopId, id),
      superAdminAPI.crm.tasks.list(`related_type=lead&related_id=${id}`),
      superAdminAPI.crm.users(shopId),
    ])
      .then(([l, act, tasks, u]: any[]) => {
        setLead(l);
        setActivities(act.data);
        setFollowUps(tasks.data);
        setUsers(u);
      })
      .catch((err: any) => toast.error(err?.message || "Failed to load lead"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [shopId, id]);

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  }
  if (!lead || !shopId || !id) {
    return <div className="text-muted-foreground">Lead not found.</div>;
  }

  const addNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await superAdminAPI.crm.leads.addActivity(shopId, id, { body: note.trim(), type: "note" });
      setNote("");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add note");
    } finally {
      setBusy(false);
    }
  };

  const qualify = async () => {
    setBusy(true);
    try {
      await superAdminAPI.crm.leads.qualify(shopId, id, {
        outcome: qualOutcome,
        reason: qualOutcome === "disqualified" ? qualReason || undefined : undefined,
      });
      toast.success("Lead qualification updated");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to qualify lead");
    } finally {
      setBusy(false);
    }
  };

  const assign = async () => {
    if (!assignee) return;
    setBusy(true);
    try {
      await superAdminAPI.crm.leads.assign(shopId, id, { assignedTo: assignee });
      toast.success("Lead assigned");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign lead");
    } finally {
      setBusy(false);
    }
  };

  const promote = async () => {
    setBusy(true);
    try {
      const r: any = await superAdminAPI.crm.leads.promote(shopId, id, {});
      toast.success(r.alreadyPromoted ? "Already promoted to an opportunity" : "Promoted to opportunity");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to promote lead");
    } finally {
      setBusy(false);
    }
  };

  const convert = async () => {
    setBusy(true);
    try {
      await superAdminAPI.crm.leads.convert(shopId, id);
      toast.success("Lead converted to customer");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to convert lead");
    } finally {
      setBusy(false);
    }
  };

  const addFollowUp = async () => {
    if (!followUpTitle.trim()) return;
    setBusy(true);
    try {
      await superAdminAPI.crm.tasks.create(shopId, { title: followUpTitle.trim(), relatedType: "lead", relatedId: id });
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
      <Button variant="ghost" size="sm" onClick={() => navigate("/superadmin/crm/leads")}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Leads
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{lead.name}</h1>
          <div className="text-sm text-muted-foreground">{lead.phone || "—"} · {lead.email || "—"} · {sourceLabel(lead.source)}</div>
        </div>
        <div className="flex gap-2">
          <Badge variant={LEAD_STATUS_BADGE[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
          {lead.qualificationStatus && (
            <Badge variant={QUALIFICATION_STATUS_BADGE[lead.qualificationStatus]}>
              {QUALIFICATION_STATUS_LABELS[lead.qualificationStatus]}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">Qualification</h2>
            <Select value={qualOutcome} onValueChange={(v) => setQualOutcome(v as QualificationStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {QUALIFICATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{QUALIFICATION_STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            {qualOutcome === "disqualified" && (
              <Textarea placeholder="Reason (required to disqualify)" value={qualReason} onChange={(e) => setQualReason(e.target.value)} />
            )}
            <Button size="sm" disabled={busy} onClick={qualify}>Save Qualification</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">Assign</h2>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger><SelectValue placeholder="Choose a user in this shop" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={busy || !assignee} onClick={assign}>Assign</Button>
            {lead.assignedTo && <div className="text-xs text-muted-foreground">Currently assigned to {users.find((u) => u.id === lead.assignedTo)?.name ?? lead.assignedTo}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">Pipeline</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy || lead.status === "converted"} onClick={promote}>Promote to Opportunity</Button>
              <Button size="sm" variant="outline" disabled={busy || lead.status === "converted"} onClick={convert}>Convert to Customer</Button>
            </div>
            {lead.status === "converted" && <div className="text-xs text-muted-foreground">Already converted.</div>}
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
