import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trophy, XCircle, UserPlus, Trash2, Save, Clock, MoveRight } from "lucide-react";

import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  OPEN_OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGE_BADGE,
  type Opportunity,
  type CrmActivity,
} from "@/lib/crm";

function money(n: number | null | undefined): string {
  if (n == null) return "—";
  return "₹" + Number(n).toLocaleString("en-IN");
}

export default function CrmOpportunityDetailsPage() {
  const { id = "" } = useParams();
  const api = useTenantAPI();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const can = useCan();

  const oppQ = useQuery({
    queryKey: ["crm", "opportunity", id],
    queryFn: () => api.crm.opportunities.get(id) as Promise<Opportunity>,
    retry: false,
  });
  const actQ = useQuery({
    queryKey: ["crm", "opportunity", id, "activities"],
    queryFn: () => api.crm.opportunities.activities(id) as Promise<{ data: CrmActivity[]; total: number }>,
    enabled: !!oppQ.data,
  });
  const usersQ = useQuery({ queryKey: ["crm", "users"], queryFn: () => api.crm.users() });
  const branchesQ = useQuery({ queryKey: ["crm", "branches"], queryFn: () => api.crm.branches() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["crm", "opportunity", id] });
    qc.invalidateQueries({ queryKey: ["crm", "opportunities"] });
    qc.invalidateQueries({ queryKey: ["crm", "pipeline"] });
  };

  const userName = (uid: string | null) =>
    !uid ? "—" : usersQ.data?.find((u: any) => u.id === uid)?.name ?? uid;

  if (oppQ.isLoading) {
    return (
      <Layout>
        <div className="py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin inline" />
        </div>
      </Layout>
    );
  }
  if (oppQ.isError || !oppQ.data) {
    return (
      <Layout>
        <div className="py-16 text-center text-muted-foreground space-y-3">
          <p>Opportunity not found or you don't have access.</p>
          <Button variant="outline" onClick={() => navigate("/crm/opportunities")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to opportunities
          </Button>
        </div>
      </Layout>
    );
  }

  const opp = oppQ.data;
  const isClosed = opp.stage === "won" || opp.stage === "lost";

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/crm/opportunities")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Opportunities
          </Button>
          <h1 className="text-xl font-semibold">{opp.title}</h1>
          <Badge variant={OPPORTUNITY_STAGE_BADGE[opp.stage] ?? "secondary"}>
            {OPPORTUNITY_STAGE_LABELS[opp.stage] ?? opp.stage}
          </Badge>
          <span className="text-sm text-muted-foreground">{money(opp.amount)}</span>
        </div>

        {/* action bar */}
        <div className="flex flex-wrap gap-2">
          {can("opportunity", "stage") && !isClosed && (
            <StageAction opp={opp} onDone={invalidate} />
          )}
          {can("opportunity", "assign") && !isClosed && (
            <AssignAction opp={opp} users={usersQ.data ?? []} branches={branchesQ.data ?? []} onDone={invalidate} />
          )}
          {can("opportunity", "win") && !isClosed && <WinAction oppId={id} onDone={invalidate} />}
          {can("opportunity", "lose") && !isClosed && <LoseAction oppId={id} onDone={invalidate} />}
          {can("opportunity", "delete") && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this opportunity?</AlertDialogTitle>
                  <AlertDialogDescription>It will be soft-deleted and hidden from lists.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        await api.crm.opportunities.remove(id);
                        toast.success("Opportunity deleted");
                        navigate("/crm/opportunities");
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

        {isClosed && (
          <Card>
            <CardContent className="p-3 text-sm flex items-center gap-2">
              {opp.stage === "won" ? (
                <>
                  <Trophy className="h-4 w-4 text-green-600" /> Won{opp.wonAt ? ` on ${formatDate(opp.wonAt)}` : ""} · {money(opp.amount)}
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-destructive" /> Lost{opp.lostAt ? ` on ${formatDate(opp.lostAt)}` : ""}
                  {opp.lostReason ? ` — ${opp.lostReason}` : ""}
                </>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <EditCard opp={opp} branches={branchesQ.data ?? []} editable={can("opportunity", "update") && !isClosed} onSaved={invalidate} />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1.5">
              <Row k="Assignee" v={userName(opp.assignedTo)} />
              <Row k="Created by" v={userName(opp.createdBy)} />
              <Row k="Probability" v={opp.probability != null ? `${opp.probability}%` : "—"} />
              <Row k="Expected close" v={opp.expectedCloseDate ? formatDate(opp.expectedCloseDate) : "—"} />
              <Row k="Created" v={formatDate(opp.createdAt)} />
              <Row k="Last activity" v={opp.lastActivityAt ? formatDate(opp.lastActivityAt) : "—"} />
              {opp.leadId ? (
                <Row
                  k="From lead"
                  v={
                    <button className="underline" onClick={() => navigate(`/crm/leads/${opp.leadId}`)}>
                      view lead
                    </button>
                  }
                />
              ) : null}
            </CardContent>
          </Card>
        </div>

        <ActivityCard
          oppId={id}
          activities={actQ.data?.data ?? []}
          loading={actQ.isLoading}
          canAdd={can("opportunity", "update") && !isClosed}
          userName={userName}
          onAdded={() => qc.invalidateQueries({ queryKey: ["crm", "opportunity", id, "activities"] })}
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
  opp,
  branches,
  editable,
  onSaved,
}: {
  opp: Opportunity;
  branches: any[];
  editable: boolean;
  onSaved: () => void;
}) {
  const api = useTenantAPI();
  const [form, setForm] = useState({
    title: opp.title ?? "",
    amount: opp.amount != null ? String(opp.amount) : "",
    probability: opp.probability != null ? String(opp.probability) : "",
    source: opp.source ?? "",
    notes: opp.notes ?? "",
    expectedCloseDate: opp.expectedCloseDate ? opp.expectedCloseDate.slice(0, 10) : "",
    branchId: opp.branchId ?? "",
  });

  const mut = useMutation({
    mutationFn: () =>
      api.crm.opportunities.update(opp.id, {
        title: form.title.trim(),
        amount: form.amount.trim() === "" ? null : Number(form.amount),
        probability: form.probability.trim() === "" ? null : Number(form.probability),
        source: form.source || null,
        notes: form.notes.trim() || null,
        expectedCloseDate: form.expectedCloseDate || null,
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
        <CardTitle className="text-base">Opportunity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Title</Label>
          <Input disabled={!editable} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Amount (₹)</Label>
            <Input type="number" disabled={!editable} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Probability (%)</Label>
            <Input type="number" disabled={!editable} value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Expected close</Label>
          <Input type="date" disabled={!editable} value={form.expectedCloseDate} onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })} />
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
          <Input disabled={!editable} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        {editable && (
          <Button size="sm" disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function StageAction({ opp, onDone }: { opp: Opportunity; onDone: () => void }) {
  const api = useTenantAPI();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<string>(opp.stage);
  const mut = useMutation({
    mutationFn: () => api.crm.opportunities.stage(opp.id, { stage }),
    onSuccess: () => {
      toast.success("Stage updated");
      setOpen(false);
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MoveRight className="h-4 w-4 mr-1" /> Move stage
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move to stage</AlertDialogTitle>
        </AlertDialogHeader>
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {OPEN_OPPORTUNITY_STAGES.map((s) => (
              <SelectItem key={s} value={s}>{OPPORTUNITY_STAGE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button disabled={mut.isPending || stage === opp.stage} onClick={() => mut.mutate()}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Move
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AssignAction({
  opp,
  users,
  branches,
  onDone,
}: {
  opp: Opportunity;
  users: any[];
  branches: any[];
  onDone: () => void;
}) {
  const api = useTenantAPI();
  const [open, setOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState(opp.assignedTo ?? "");
  const [branchId, setBranchId] = useState(opp.branchId ?? "");
  const mut = useMutation({
    mutationFn: () => api.crm.opportunities.assign(opp.id, { assignedTo, ...(branchId ? { branchId } : {}) }),
    onSuccess: () => {
      toast.success("Opportunity assigned");
      setOpen(false);
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to assign"),
  });
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-1" /> Assign
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Assign opportunity</AlertDialogTitle>
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

function WinAction({ oppId, onDone }: { oppId: string; onDone: () => void }) {
  const api = useTenantAPI();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const mut = useMutation({
    mutationFn: () => api.crm.opportunities.win(oppId, amount.trim() ? { amount: Number(amount) } : {}),
    onSuccess: () => {
      toast.success("Marked won 🎉");
      setOpen(false);
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm">
          <Trophy className="h-4 w-4 mr-1" /> Mark won
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark this opportunity won?</AlertDialogTitle>
          <AlertDialogDescription>This closes the opportunity. You can record a final amount.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Final amount (₹, optional)</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Mark won
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function LoseAction({ oppId, onDone }: { oppId: string; onDone: () => void }) {
  const api = useTenantAPI();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const mut = useMutation({
    mutationFn: () => api.crm.opportunities.lose(oppId, reason.trim() ? { reason: reason.trim() } : {}),
    onSuccess: () => {
      toast.success("Marked lost");
      setOpen(false);
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <XCircle className="h-4 w-4 mr-1" /> Mark lost
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark this opportunity lost?</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Mark lost
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ActivityCard({
  oppId,
  activities,
  loading,
  canAdd,
  userName,
  onAdded,
}: {
  oppId: string;
  activities: CrmActivity[];
  loading: boolean;
  canAdd: boolean;
  userName: (id: string | null) => string;
  onAdded: () => void;
}) {
  const api = useTenantAPI();
  const [note, setNote] = useState("");
  const mut = useMutation({
    mutationFn: () => api.crm.opportunities.addActivity(oppId, { body: note.trim(), type: "note" }),
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
          <div className="flex gap-2">
            <Input
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
                  <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
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
