import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Users, Eye, Phone, Mail, MapPin, Calendar, MessageSquare, Building2, User, Trash2 } from "lucide-react";
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
  message?: string;
  status: 'Pending' | 'Contacted' | 'Closed';
  createdAt: string;
};

export default function SuperAdminDemoRequestsPage() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<DemoRequest | null>(null);

  const { data: requests = [], isLoading } = useQuery<DemoRequest[]>({
    queryKey: ["demoRequests"],
    queryFn: superAdminAPI.demoRequests.getAll,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string, status: DemoRequest['status'] }) => superAdminAPI.demoRequests.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demoRequests"] });
      toast.success("Status updated successfully.");
    },
    onError: () => {
      toast.error("Failed to update status.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => superAdminAPI.demoRequests.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demoRequests"] });
      toast.success("Demo request deleted successfully.");
      setSelectedRequest(null);
    },
    onError: () => {
      toast.error("Failed to delete demo request.");
    }
  });

  const handleStatusChange = (id: string, status: DemoRequest['status']) => {
    updateStatusMutation.mutate({ id, status });
    if (selectedRequest && (selectedRequest.id === id || selectedRequest._id === id)) {
      setSelectedRequest({ ...selectedRequest, status });
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the demo request from "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(requests.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = requests.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Demo Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {requests.length} total request{requests.length !== 1 ? "s" : ""} received from public website & contact forms
          </p>
        </div>
      </div>

      <Card className="bg-card border-border shadow-xs">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-slate-500 text-center py-16">Loading demo requests...</div>
          ) : requests.length === 0 ? (
            <CardContent className="py-16 text-center">
              <Users className="w-12 h-12 mx-auto text-slate-400 mb-4" />
              <p className="text-slate-500 font-medium">No demo requests received yet.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b bg-muted/20">
                  <tr>
                    <th className="p-3.5 font-semibold">Name & Shop</th>
                    <th className="font-semibold">Contact Info</th>
                    <th className="font-semibold">Requirements / Message</th>
                    <th className="font-semibold">Date</th>
                    <th className="text-center font-semibold">Status</th>
                    <th className="text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((req) => (
                    <tr key={req._id || req.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{req.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{req.shopName}</span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-medium text-slate-800">{req.phone}</div>
                        {req.email && <div className="text-xs text-slate-500">{req.email}</div>}
                        {req.address && <div className="text-xs text-slate-400 max-w-40 truncate" title={req.address}>{req.address}</div>}
                      </td>
                      <td className="p-3.5 max-w-xs">
                        {req.message ? (
                          <div className="text-xs text-slate-700 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100 font-normal">
                            {req.message}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No specific message attached</span>
                        )}
                      </td>
                      <td className="p-3.5 whitespace-nowrap text-slate-600">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-center">
                        <Select
                          value={req.status}
                          onValueChange={(v) => handleStatusChange(req.id || req._id, v as DemoRequest['status'])}
                        >
                          <SelectTrigger className="w-28 mx-auto h-8 text-xs font-semibold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Contacted">Contacted</SelectItem>
                            <SelectItem value="Closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedRequest(req)}
                            className="h-8 px-2 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1 text-[#FA8112]" /> View
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(req.id || req._id, req.name)}
                            disabled={deleteMutation.isPending}
                            className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1 text-red-500" /> Delete
                          </Button>
                        </div>
                      </td>
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
                <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  Prev
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FULL DETAILS MODAL */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        {selectedRequest && (
          <DialogContent className="sm:max-w-lg bg-white border-slate-200">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#FA8112]" /> Demo Request Details
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-xs">
                Full submitted request data from {selectedRequest.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Contact Info Card */}
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 border border-slate-100">
                <div>
                  <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-slate-400" /> Full Name
                  </div>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{selectedRequest.name}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" /> Showroom / Shop
                  </div>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{selectedRequest.shopName}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> Phone Number
                  </div>
                  <a href={`tel:${selectedRequest.phone}`} className="font-bold text-[#FA8112] hover:underline text-sm mt-0.5 block">
                    {selectedRequest.phone}
                  </a>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-slate-400" /> Email Address
                  </div>
                  <div className="font-medium text-slate-800 text-xs mt-0.5 break-all">
                    {selectedRequest.email || "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" /> City / Location
                  </div>
                  <div className="font-medium text-slate-800 text-xs mt-0.5">
                    {selectedRequest.address || "N/A"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" /> Date Submitted
                  </div>
                  <div className="font-medium text-slate-800 text-xs mt-0.5">
                    {new Date(selectedRequest.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Message Box */}
              <div>
                <div className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <MessageSquare className="h-4 w-4 text-[#FA8112]" /> User Requirements / Message:
                </div>
                <div className="rounded-xl bg-amber-50/70 p-4 border border-amber-200/80 text-sm text-slate-800 leading-relaxed font-normal">
                  {selectedRequest.message ? selectedRequest.message : "No additional message provided."}
                </div>
              </div>

              {/* Status Selector & Delete Action */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Status:</span>
                  <Select
                    value={selectedRequest.status}
                    onValueChange={(v) => handleStatusChange(selectedRequest.id || selectedRequest._id, v as DemoRequest['status'])}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Contacted">Contacted</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(selectedRequest.id || selectedRequest._id, selectedRequest.name)}
                  disabled={deleteMutation.isPending}
                  className="h-8 px-3 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Request
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}