import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  UserPlus,
  Trash2,
  Save,
  Clock,
  BadgeCheck,
  BadgeX,
  UserRoundCheck,
  Target,
  Sprout,
  TrendingUp,
} from "lucide-react";

import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

import { useTenantAPI } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useCan } from "@/components/crm/Can";
import { useCrmNameMaps } from "@/components/crm/hooks";
import { CrmNav } from "@/components/crm/CrmNav";
import {
  LEAD_OPEN_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_BADGE,
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  sourceLabel,
  QUALIFICATION_STATUS_LABELS,
  QUALIFICATION_STATUS_BADGE,
  QUALIFICATION_AUTHORITY,
  QUALIFICATION_NEED,
  QUALIFICATION_TIMELINE,
  QUALIFICATION_AUTHORITY_LABELS,
  QUALIFICATION_NEED_LABELS,
  QUALIFICATION_TIMELINE_LABELS,
  type Lead,
  type CrmActivity,
  type QualificationStatus,
  type QualificationData,
} from "@/lib/crm";

export default function CrmLeadDetailsPage() {
  const { id = "" } = useParams();
  const api = useTenantAPI();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const can = useCan();
  const { users, branches, userName } = useCrmNameMaps();

  const leadQ = useQuery({
    queryKey: ["crm", "lead", id],
    queryFn: () => api.crm.leads.get(id) as Promise<Lead>,
    retry: false,
  });
  const actQ = useQuery({
    queryKey: ["crm", "lead", id, "activities"],
    queryFn: () => api.crm.leads.activities(id) as Promise<{ data: CrmActivity[]; total: number }>,
    enabled: !!leadQ.data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["crm", "lead", id] });
    qc.invalidateQueries({ queryKey: ["crm", "leads"] });
  };

  if (leadQ.isLoading) {
    return (
      <Layout>
        <CrmNav />
        <div className="py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin inline" />
        </div>
      </Layout>
    );
  }
  if (leadQ.isError || !leadQ.data) {
    return (
      <Layout>
        <CrmNav />
        <div className="py-16 text-center text-muted-foreground space-y-3">
          <p>Lead not found or you don&apos;t have access.</p>
          <Button variant="outline" onClick={() => navigate("/crm/leads")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to leads
          </Button>
        </div>
      </Layout>
    );
  }

  const lead = leadQ.data;
  const isConverted = lead.status === "converted";
  const editable = can("lead", "update") && !isConverted;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4">
        <CrmNav />

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/crm/leads")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Leads
          </Button>
          <h1 className="text-xl font-semibold">{lead.name}</h1>
          <Badge variant={LEAD_STATUS_BADGE[lead.status] ?? "secondary"}>
            {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
          </Badge>
          {lead.company ? <span className="text-sm text-muted-foreground">{lead.company}</span> : null}
        </div>

        {/* action bar */}
        <div className="flex flex-wrap gap-2">
          {can("lead", "assign") && !isConverted && (
            <AssignAction lead={lead} users={users} branches={branches} onDone={invalidate} />
          )}
          {can("lead", "qualify") && !isConverted && (
            <QualifyAction lead={lead} onDone={invalidate} />
          )}
          {can("opportunity", "create") &&
            (lead.qualificationStatus === "qualified" || lead.status === "qualified") && (
              <PromoteAction leadId={id} onDone={invalidate} />
            )}
          {can("lead", "convert") && (
            <ConvertAction
              leadId={id}
              disabled={isConverted}
              onDone={(customerId) => {
                invalidate();
                if (customerId) {
                  toast.success("Lead converted — opening customer");
                }
              }}
            />
          )}
          {can("lead", "delete") && !isConverted && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                  <AlertDialogDescription>It will be soft-deleted and hidden from lists.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        await api.crm.leads.remove(id);
                        toast.success("Lead deleted");
                        navigate("/crm/leads");
                      } catch (e: any) {
                        toast.error(e?.message ?? "Failed");
                      }
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {isConverted && (
          <Card>
            <CardContent className="p-3 text-sm flex items-center gap-2">
              <UserRoundCheck className="h-4 w-4 text-green-600" />
              Converted{lead.convertedAt ? ` on ${formatDate(lead.convertedAt)}` : ""}
              {lead.convertedCustomerId ? (
                <button
                  className="underline"
                  onClick={() => navigate(`/customers?customerId=${lead.convertedCustomerId}`)}
                >
                  view customer
                </button>
              ) : null}
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <EditCard lead={lead} branches={branches} editable={editable} onSaved={invalidate} />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1.5">
              <Row k="Phone" v={lead.phone ?? "—"} />
              <Row k="Email" v={lead.email ?? "—"} />
              <Row k="Source" v={sourceLabel(lead.source)} />
              <Row k="Assignee" v={userName(lead.assignedTo)} />
              <Row k="Created by" v={userName(lead.createdBy)} />
              <Row k="Qualified" v={lead.qualifiedAt ? formatDate(lead.qualifiedAt) : "—"} />
              <Row k="Created" v={formatDate(lead.createdAt)} />
              <Row k="Last activity" v={lead.lastActivityAt ? formatDate(lead.lastActivityAt) : "—"} />
            </CardContent>
          </Card>
        </div>

        {lead.qualificationStatus && <QualificationCard lead={lead} userName={userName} />}

        <ActivityCard
          leadId={id}
          activities={actQ.data?.data ?? []}
          loading={actQ.isLoading}
          canAdd={can("lead", "update") && !isConverted}
          userName={userName}
          onAdded={() => qc.invalidateQueries({ queryKey: ["crm", "lead", id, "activities"] })}
        />
      </div>
    </Layout>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}

function EditCard({
  lead,
  branches,
  editable,
  onSaved,
}: {
  lead: Lead;
  branches: { id: string; name: string }[];
  editable: boolean;
  onSaved: () => void;
}) {
  const api = useTenantAPI();
  const [form, setForm] = useState({
    name: lead.name ?? "",
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    company: lead.company ?? "",
    source: lead.source ?? "",
    status: lead.status,
    notes: lead.notes ?? "",
    branchId: lead.branchId ?? "",
  });

  const emailValid = !form.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const statusOptions = LEAD_OPEN_STATUSES.includes(form.status as any)
    ? LEAD_OPEN_STATUSES
    : ([form.status, ...LEAD_OPEN_STATUSES] as readonly string[]);

  const mut = useMutation({
    mutationFn: () =>
      api.crm.leads.update(lead.id, {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        company: form.company.trim() || null,
        source: form.source || null,
        status: form.status,
        notes: form.notes.trim() || null,
        branchId: form.branchId || null,
      }),
    onSuccess: () => {
      toast.success("Saved");
      onSaved();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Lead</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input disabled={!editable} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Phone</Label>
            <Input disabled={!editable} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input
              type="email"
              disabled={!editable}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              aria-invalid={!emailValid}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Company</Label>
          <Input disabled={!editable} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select disabled={!editable} value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Lead["status"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>{LEAD_STATUS_LABELS[s as Lead["status"]] ?? s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Source</Label>
            <Select disabled={!editable} value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>{LEAD_SOURCE_LABELS[s] ?? s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Branch</Label>
          <Select disabled={!editable} value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Notes</Label>
          <Textarea disabled={!editable} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
        </div>
        {editable && (
          <Button size="sm" disabled={mut.isPending || !form.name.trim() || !emailValid} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function AssignAction({
  lead,
  users,
  branches,
  onDone,
}: {
  lead: Lead;
  users: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  onDone: () => void;
}) {
  const api = useTenantAPI();
  const [open, setOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState(lead.assignedTo ?? "");
  const [branchId, setBranchId] = useState(lead.branchId ?? "");
  const mut = useMutation({
    mutationFn: () => api.crm.leads.assign(lead.id, { assignedTo, ...(branchId ? { branchId } : {}) }),
    onSuccess: () => {
      toast.success("Lead assigned");
      setOpen(false);
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to assign"),
  });
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-1" /> {lead.assignedTo ? "Reassign" : "Assign"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Assign lead</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Assign to</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Branch (optional)</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button disabled={!assignedTo || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Assign
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const OUTCOME_META: Record<
  QualificationStatus,
  { label: string; icon: typeof BadgeCheck }
> = {
  qualified: { label: "Qualified", icon: BadgeCheck },
  nurture: { label: "Nurture", icon: Sprout },
  disqualified: { label: "Disqualified", icon: BadgeX },
};

function QualifyAction({ lead, onDone }: { lead: Lead; onDone: () => void }) {
  const api = useTenantAPI();
  const [open, setOpen] = useState(false);
  const d = lead.qualificationData ?? {};
  const [outcome, setOutcome] = useState<QualificationStatus>(
    lead.qualificationStatus ?? "qualified",
  );
  const [score, setScore] = useState(
    lead.qualificationScore == null ? "" : String(lead.qualificationScore),
  );
  const [notes, setNotes] = useState(lead.qualificationNotes ?? "");
  const [reason, setReason] = useState(lead.disqualifiedReason ?? "");
  const [nurtureUntil, setNurtureUntil] = useState(lead.nurtureUntil ?? "");
  const [budget, setBudget] = useState(d.budget ?? "");
  const [authority, setAuthority] = useState(d.authority ?? "");
  const [need, setNeed] = useState(d.need ?? "");
  const [timeline, setTimeline] = useState(d.timeline ?? "");
  const [interest, setInterest] = useState(d.interest ?? "");
  const [objections, setObjections] = useState(d.objections ?? "");

  const scoreNum = score.trim() === "" ? null : Number(score);
  const scoreValid =
    scoreNum == null || (Number.isInteger(scoreNum) && scoreNum >= 0 && scoreNum <= 100);
  const reasonMissing = outcome === "disqualified" && !reason.trim();

  const mut = useMutation({
    mutationFn: () => {
      const data: QualificationData = {};
      if (budget.trim()) data.budget = budget.trim();
      if (authority) data.authority = authority;
      if (need) data.need = need;
      if (timeline) data.timeline = timeline;
      if (interest.trim()) data.interest = interest.trim();
      if (objections.trim()) data.objections = objections.trim();
      return api.crm.leads.qualify(lead.id, {
        outcome,
        ...(scoreNum != null ? { score: scoreNum } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(outcome === "disqualified" && reason.trim() ? { reason: reason.trim() } : {}),
        ...(outcome === "nurture" && nurtureUntil ? { nurtureUntil } : {}),
        ...(Object.keys(data).length ? { data } : {}),
      });
    },
    onSuccess: () => {
      toast.success(`Lead marked ${OUTCOME_META[outcome].label.toLowerCase()}`);
      setOpen(false);
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to qualify lead"),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Target className="h-4 w-4 mr-1" /> Qualify
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Qualify lead</AlertDialogTitle>
          <AlertDialogDescription>
            Record a qualification outcome. Structured fields are optional.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(OUTCOME_META) as QualificationStatus[]).map((o) => {
              const Icon = OUTCOME_META[o].icon;
              return (
                <Button
                  key={o}
                  type="button"
                  variant={outcome === o ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOutcome(o)}
                >
                  <Icon className="h-4 w-4 mr-1" /> {OUTCOME_META[o].label}
                </Button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Score (0–100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                aria-invalid={!scoreValid}
              />
            </div>
            {outcome === "nurture" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Follow up on</Label>
                <Input
                  type="date"
                  value={nurtureUntil}
                  onChange={(e) => setNurtureUntil(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Budget</Label>
              <Input value={budget} onChange={(e) => setBudget(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Authority</Label>
              <Select value={authority} onValueChange={setAuthority}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {QUALIFICATION_AUTHORITY.map((v) => (
                    <SelectItem key={v} value={v}>{QUALIFICATION_AUTHORITY_LABELS[v]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Need</Label>
              <Select value={need} onValueChange={setNeed}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {QUALIFICATION_NEED.map((v) => (
                    <SelectItem key={v} value={v}>{QUALIFICATION_NEED_LABELS[v]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Timeline</Label>
              <Select value={timeline} onValueChange={setTimeline}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {QUALIFICATION_TIMELINE.map((v) => (
                    <SelectItem key={v} value={v}>{QUALIFICATION_TIMELINE_LABELS[v]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Interest</Label>
            <Input value={interest} onChange={(e) => setInterest(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Objections</Label>
            <Textarea
              value={objections}
              onChange={(e) => setObjections(e.target.value)}
              maxLength={500}
              rows={2}
            />
          </div>

          {outcome === "disqualified" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Reason (required)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-invalid={reasonMissing}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            disabled={mut.isPending || !scoreValid || reasonMissing}
            onClick={() => mut.mutate()}
          >
            {mut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PromoteAction({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const api = useTenantAPI();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      api.crm.leads.promote(leadId, {
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(amount.trim() ? { amount: Number(amount) } : {}),
      }) as Promise<{ opportunity: { id: string }; alreadyPromoted: boolean }>,
    onSuccess: (res) => {
      setOpen(false);
      onDone();
      toast.success(
        res?.alreadyPromoted
          ? "Lead already has an opportunity — opening it"
          : "Opportunity created from lead",
      );
      if (res?.opportunity?.id) navigate(`/crm/opportunities/${res.opportunity.id}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to promote lead"),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm">
          <TrendingUp className="h-4 w-4 mr-1" /> Promote to opportunity
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Promote this lead to an opportunity?</AlertDialogTitle>
          <AlertDialogDescription>
            Creates a pipeline opportunity linked to this lead. Branch, assignee, source and
            customer are carried over. If an opportunity already exists for this lead, it is
            opened instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Opportunity title (optional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Defaults to the lead name"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Estimated amount (optional)</Label>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Promote
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function QualificationCard({
  lead,
  userName,
}: {
  lead: Lead;
  userName: (id: string | null) => string;
}) {
  const qs = lead.qualificationStatus as QualificationStatus;
  const d = lead.qualificationData ?? {};
  const bant: Array<[string, string | undefined]> = [
    ["Budget", d.budget],
    ["Authority", d.authority ? QUALIFICATION_AUTHORITY_LABELS[d.authority] ?? d.authority : undefined],
    ["Need", d.need ? QUALIFICATION_NEED_LABELS[d.need] ?? d.need : undefined],
    ["Timeline", d.timeline ? QUALIFICATION_TIMELINE_LABELS[d.timeline] ?? d.timeline : undefined],
    ["Interest", d.interest],
    ["Objections", d.objections],
  ];
  const shown = bant.filter(([, v]) => v);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" /> Qualification
          <Badge variant={QUALIFICATION_STATUS_BADGE[qs] ?? "secondary"}>
            {QUALIFICATION_STATUS_LABELS[qs] ?? qs}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-1.5">
        {lead.qualificationScore != null && (
          <Row k="Score" v={`${lead.qualificationScore} / 100`} />
        )}
        {qs === "qualified" && (
          <Row k="Qualified" v={lead.qualifiedAt ? formatDate(lead.qualifiedAt) : "—"} />
        )}
        {qs === "qualified" && lead.qualifiedBy && (
          <Row k="Qualified by" v={userName(lead.qualifiedBy)} />
        )}
        {qs === "nurture" && lead.nurtureUntil && (
          <Row k="Follow up on" v={formatDate(lead.nurtureUntil)} />
        )}
        {qs === "disqualified" && (
          <Row k="Disqualified" v={lead.disqualifiedAt ? formatDate(lead.disqualifiedAt) : "—"} />
        )}
        {qs === "disqualified" && lead.disqualifiedReason && (
          <Row k="Reason" v={lead.disqualifiedReason} />
        )}
        {shown.map(([k, v]) => (
          <Row key={k} k={k} v={v as string} />
        ))}
        {lead.qualificationNotes && (
          <div className="pt-1 text-muted-foreground whitespace-pre-wrap">
            {lead.qualificationNotes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConvertAction({
  leadId,
  disabled,
  onDone,
}: {
  leadId: string;
  disabled: boolean;
  onDone: (customerId?: string) => void;
}) {
  const api = useTenantAPI();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const mut = useMutation({
    mutationFn: () =>
      api.crm.leads.convert(leadId) as Promise<{
        customer: { id: string };
        customerCreated: boolean;
        alreadyConverted: boolean;
      }>,
    onSuccess: (res) => {
      setOpen(false);
      const cid = res?.customer?.id;
      toast.success(
        res?.alreadyConverted
          ? "Lead was already converted"
          : res?.customerCreated
            ? "Customer created from lead"
            : "Lead linked to existing customer",
      );
      onDone(cid);
      if (cid) navigate(`/customers?customerId=${cid}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to convert"),
  });
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <UserRoundCheck className="h-4 w-4 mr-1" /> Convert to customer
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Convert this lead to a customer?</AlertDialogTitle>
          <AlertDialogDescription>
            This creates (or links) an ERP customer record and marks the lead converted. It cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Convert
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ActivityCard({
  leadId,
  activities,
  loading,
  canAdd,
  userName,
  onAdded,
}: {
  leadId: string;
  activities: CrmActivity[];
  loading: boolean;
  canAdd: boolean;
  userName: (id: string | null) => string;
  onAdded: () => void;
}) {
  const api = useTenantAPI();
  const [note, setNote] = useState("");
  const [type, setType] = useState("note");
  const mut = useMutation({
    mutationFn: () => api.crm.leads.addActivity(leadId, { body: note.trim(), type }),
    onSuccess: () => {
      setNote("");
      onAdded();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to add note"),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" /> Activity timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {canAdd && (
          <div className="flex flex-wrap gap-2">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["note", "call", "email", "meeting"].map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="flex-1 min-w-[180px]"
              placeholder="Add a note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && note.trim()) mut.mutate();
              }}
            />
            <Button disabled={!note.trim() || mut.isPending} onClick={() => mut.mutate()}>
              Add
            </Button>
          </div>
        )}
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
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
  );
}
