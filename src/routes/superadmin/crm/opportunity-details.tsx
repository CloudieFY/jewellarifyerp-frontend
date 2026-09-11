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
  OPEN_OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABELS, OPPORTUNITY_STAGE_BADGE, crmMoney,
  TASK_STATUS_LABELS, TASK_STATUS_BADGE,
  QUOTATION_STATUS_LABELS, QUOTATION_STATUS_BADGE,
  type Opportunity, type CrmActivity, type CrmUser, type Task, type Lead, type OpportunityStage, type Quotation,
} from "@/lib/crm";
import { toast } from "sonner";

export default function SuperAdminCrmOpportunityDetailsPage() {
  const { shopId, id } = useParams<{ shopId: string; id: string }>();
  const navigate = useNavigate();

  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [followUps, setFollowUps] = useState<Task[]>([]);
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [linkedLead, setLinkedLead] = useState<Lead | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  const [note, setNote] = useState("");
  const [stage, setStage] = useState<OpportunityStage>("prospecting");
  const [assignee, setAssignee] = useState<string>("");
  const [winAmount, setWinAmount] = useState("");
  const [loseReason, setLoseReason] = useState("");
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [quoteTitle, setQuoteTitle] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteValidUntil, setQuoteValidUntil] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!shopId || !id) return;
    setLoading(true);
    Promise.all([
      superAdminAPI.crm.opportunities.get(shopId, id),
      superAdminAPI.crm.opportunities.activities(shopId, id),
      superAdminAPI.crm.tasks.list(`related_type=opportunity&related_id=${id}`),
      superAdminAPI.crm.users(shopId),
      superAdminAPI.crm.quotations.byOpportunity(shopId, id),
    ])
      .then(([o, act, tasks, u, quotes]: any[]) => {
        setOpp(o);
        setActivities(act.data);
        setFollowUps(tasks.data);
        setUsers(u);
        setQuotations(quotes);
        if (o.stage) setStage(o.stage as OpportunityStage);
        if (o.leadId) {
          superAdminAPI.crm.leads.get(shopId, o.leadId).then(setLinkedLead).catch(() => setLinkedLead(null));
        } else {
          setLinkedLead(null);
        }
      })
      .catch((err: any) => toast.error(err?.message || "Failed to load opportunity"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [shopId, id]);

  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;
  }
  if (!opp || !shopId || !id) {
    return <div className="text-muted-foreground">Opportunity not found.</div>;
  }

  const closed = opp.stage === "won" || opp.stage === "lost";

  const addNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await superAdminAPI.crm.opportunities.addActivity(shopId, id, { body: note.trim(), type: "note" });
      setNote("");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add note");
    } finally {
      setBusy(false);
    }
  };

  const changeStage = async () => {
    setBusy(true);
    try {
      await superAdminAPI.crm.opportunities.stage(shopId, id, { stage });
      toast.success("Stage updated");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to change stage");
    } finally {
      setBusy(false);
    }
  };

  const assign = async () => {
    if (!assignee) return;
    setBusy(true);
    try {
      await superAdminAPI.crm.opportunities.assign(shopId, id, { assignedTo: assignee });
      toast.success("Opportunity assigned");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign opportunity");
    } finally {
      setBusy(false);
    }
  };

  const win = async () => {
    setBusy(true);
    try {
      const amount = winAmount.trim() ? Number(winAmount) : undefined;
      await superAdminAPI.crm.opportunities.win(shopId, id, amount !== undefined ? { amount } : {});
      toast.success("Opportunity marked won");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to mark opportunity won");
    } finally {
      setBusy(false);
    }
  };

  const lose = async () => {
    setBusy(true);
    try {
      await superAdminAPI.crm.opportunities.lose(shopId, id, loseReason.trim() ? { reason: loseReason.trim() } : {});
      toast.success("Opportunity marked lost");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to mark opportunity lost");
    } finally {
      setBusy(false);
    }
  };

  const addFollowUp = async () => {
    if (!followUpTitle.trim()) return;
    setBusy(true);
    try {
      await superAdminAPI.crm.tasks.create(shopId, { title: followUpTitle.trim(), relatedType: "opportunity", relatedId: id });
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

  const createQuotation = async () => {
    if (!quoteTitle.trim()) return;
    setBusy(true);
    try {
      await superAdminAPI.crm.quotations.create(shopId, {
        opportunityId: id, title: quoteTitle.trim(),
        amount: quoteAmount.trim() ? Number(quoteAmount) : undefined,
        validUntil: quoteValidUntil || undefined,
      });
      setQuoteTitle(""); setQuoteAmount(""); setQuoteValidUntil("");
      toast.success("Quotation created");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create quotation");
    } finally {
      setBusy(false);
    }
  };

  const sendQuotation = async (quoteId: string) => {
    setBusy(true);
    try {
      await superAdminAPI.crm.quotations.send(shopId, quoteId);
      toast.success("Quotation sent");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to send quotation");
    } finally {
      setBusy(false);
    }
  };

  const acceptQuotation = async (quoteId: string) => {
    setBusy(true);
    try {
      await superAdminAPI.crm.quotations.accept(shopId, quoteId);
      toast.success("Quotation accepted");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to accept quotation");
    } finally {
      setBusy(false);
    }
  };

  const rejectQuotation = async (quoteId: string) => {
    setBusy(true);
    try {
      await superAdminAPI.crm.quotations.reject(shopId, quoteId);
      toast.success("Quotation rejected");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to reject quotation");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/superadmin/crm/pipeline")}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Pipeline
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{opp.title}</h1>
          <div className="text-sm text-muted-foreground">
            {crmMoney(opp.amount)}
            {opp.probability != null && ` · ${opp.probability}% probability`}
            {opp.expectedCloseDate && ` · expected ${new Date(opp.expectedCloseDate).toLocaleDateString()}`}
          </div>
          {linkedLead && (
            <div className="text-xs text-muted-foreground mt-1">
              From lead: <Link className="underline" to={`/superadmin/crm/leads/${shopId}/${linkedLead.id}`}>{linkedLead.name}</Link>
            </div>
          )}
          {opp.customerId && (
            <div className="text-xs text-muted-foreground mt-1">Customer ID: {opp.customerId}</div>
          )}
        </div>
        <Badge variant={OPPORTUNITY_STAGE_BADGE[opp.stage]}>{OPPORTUNITY_STAGE_LABELS[opp.stage]}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">Stage</h2>
            <Select value={stage} onValueChange={(v) => setStage(v as OpportunityStage)} disabled={closed}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OPEN_OPPORTUNITY_STAGES.map((s) => <SelectItem key={s} value={s}>{OPPORTUNITY_STAGE_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={busy || closed} onClick={changeStage}>Update Stage</Button>
            {closed && <div className="text-xs text-muted-foreground">This opportunity is closed ({OPPORTUNITY_STAGE_LABELS[opp.stage]}).</div>}
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
            {opp.assignedTo && <div className="text-xs text-muted-foreground">Currently assigned to {users.find((u) => u.id === opp.assignedTo)?.name ?? opp.assignedTo}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold">Close</h2>
            <div className="flex gap-2 items-center">
              <Input placeholder="Final amount (optional)" value={winAmount} onChange={(e) => setWinAmount(e.target.value)} type="number" disabled={closed} />
              <Button size="sm" disabled={busy || closed} onClick={win}>Mark Won</Button>
            </div>
            <div className="flex gap-2 items-center">
              <Input placeholder="Loss reason (optional)" value={loseReason} onChange={(e) => setLoseReason(e.target.value)} disabled={closed} />
              <Button size="sm" variant="outline" disabled={busy || closed} onClick={lose}>Mark Lost</Button>
            </div>
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
          <h2 className="text-sm font-semibold">Quotations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input placeholder="Title" value={quoteTitle} onChange={(e) => setQuoteTitle(e.target.value)} />
            <Input placeholder="Amount (optional)" type="number" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} />
            <Input placeholder="Valid until (optional)" type="date" value={quoteValidUntil} onChange={(e) => setQuoteValidUntil(e.target.value)} />
          </div>
          <Button size="sm" disabled={busy || !quoteTitle.trim()} onClick={createQuotation}>Create Quotation</Button>

          <div className="space-y-2 pt-2">
            {quotations.length === 0 && <div className="text-sm text-muted-foreground">No quotations yet.</div>}
            {quotations.map((q) => (
              <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-border/50 pb-2 last:border-0">
                <div>
                  <span className="font-medium">{q.title}</span>{" "}
                  <span className="text-muted-foreground">{crmMoney(q.amount)}</span>{" "}
                  {q.validUntil && <span className="text-xs text-muted-foreground">valid until {new Date(q.validUntil).toLocaleDateString()}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={QUOTATION_STATUS_BADGE[q.status]}>{QUOTATION_STATUS_LABELS[q.status]}</Badge>
                  {q.status === "draft" && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => sendQuotation(q.id)}>Send</Button>
                  )}
                  {q.status === "sent" && (
                    <>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => acceptQuotation(q.id)}>Accept</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => rejectQuotation(q.id)}>Reject</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
