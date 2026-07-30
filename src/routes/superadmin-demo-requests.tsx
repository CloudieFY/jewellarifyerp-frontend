import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { superAdminAPI } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type DemoRequest = {
  id: string;
  _id: string;
  name: string;
  shopName: string;
  phone: string;
  email?: string;
  address?: string;
  status: 'Pending' | 'Contacted' | 'Closed';
  createdAt: string;
};

export default function SuperAdminDemoRequestsPage() {
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery<DemoRequest[]>({
    queryKey: ["demoRequests"],
    queryFn: superAdminAPI.demoRequests.getAll,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: DemoRequest['status'] }) => superAdminAPI.demoRequests.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demoRequests"] });
      toast.success("Status updated.");
    },
    onError: () => {
      toast.error("Failed to update status.");
    }
  });

  const handleStatusChange = (id: string, status: DemoRequest['status']) => {
    updateStatusMutation.mutate({ id, status });
  };

  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(requests.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = requests.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display text-foreground">Demo Requests</h1>
            <p className="text-muted-foreground text-sm mt-1">{requests.length} request{requests.length !== 1 ? "s" : ""} received</p>
          </div>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-slate-500 text-center py-16">Loading requests...</div>
            ) : requests.length === 0 ? (
              <CardContent className="py-16 text-center">
                <Users className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <p className="text-slate-500">No demo requests yet.</p>
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b bg-muted/20">
                    <tr>
                      <th className="p-3 font-medium">Name</th>
                      <th className="font-medium">Shop Name</th>
                      <th className="font-medium">Contact</th>
                      <th className="font-medium">Date</th>
                      <th className="text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((req) => (
                      <tr key={req._id || req.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="p-3 font-medium">{req.name}</td>
                        <td>{req.shopName}</td>
                        <td><div>{req.phone}</div><div className="text-xs text-muted-foreground">{req.email}</div><div className="text-xs text-muted-foreground max-w-48 truncate" title={req.address}>{req.address}</div></td>
                        <td>{new Date(req.createdAt).toLocaleDateString()}</td>
                        <td className="text-center"><Select value={req.status} onValueChange={(v) => handleStatusChange(req.id, v as DemoRequest['status'])}><SelectTrigger className="w-32 mx-auto h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{['Pending', 'Contacted', 'Closed'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-xs text-muted-foreground">
                  Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, requests.length)} of {requests.length} entries
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                  <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
    </>
  );
}