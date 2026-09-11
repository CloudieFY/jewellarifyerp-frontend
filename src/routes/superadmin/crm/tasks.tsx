import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { superAdminAPI } from "@/lib/api";
import { TASK_STATUS_LABELS, TASK_STATUS_BADGE, TASK_PRIORITY_LABELS, TASK_PRIORITY_BADGE, toQuery, type Task, type Paginated } from "@/lib/crm";
import { toast } from "sonner";

interface AdminTask extends Task { shopName: string; shopId: string }

export default function SuperAdminCrmTasksPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState<Paginated<AdminTask> | null>(null);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    superAdminAPI.crm.tasks
      .list(toQuery({ limit: 50, sort: "due_at", dir: "ASC" }))
      .then((d: any) => setPage(d))
      .catch((err: any) => toast.error(err?.message || "Failed to load tasks"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const complete = async (t: AdminTask) => {
    setCompletingId(t.id);
    try {
      await superAdminAPI.crm.tasks.complete(t.shopId, t.id);
      toast.success("Task completed");
      load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to complete task");
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Tasks — All Shops</h1>

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shop</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(page?.data ?? []).map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/superadmin/crm/tasks/${t.shopId}/${t.id}`)}
                    >
                      <TableCell className="font-medium">{t.shopName}</TableCell>
                      <TableCell>{t.title}</TableCell>
                      <TableCell><Badge variant={TASK_PRIORITY_BADGE[t.priority]}>{TASK_PRIORITY_LABELS[t.priority]}</Badge></TableCell>
                      <TableCell><Badge variant={TASK_STATUS_BADGE[t.status]}>{TASK_STATUS_LABELS[t.status]}</Badge></TableCell>
                      <TableCell>{t.dueAt ? new Date(t.dueAt).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-right">
                        {t.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={completingId === t.id}
                            onClick={(e) => { e.stopPropagation(); complete(t); }}
                          >
                            {completingId === t.id ? "…" : "Complete"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(page?.data ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No tasks found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
