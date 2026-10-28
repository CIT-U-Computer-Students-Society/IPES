import { useState } from "react";
import { Trophy, Plus, ExternalLink, Clock, CheckCircle2, XCircle, Pencil, Loader2, AlertCircle, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyAccomplishments, useCreateAccomplishment, useUpdateAccomplishment, AccomplishmentCreate, Accomplishment } from "@/hooks/usePortfolio";
import { toast as sonnerToast } from "@/lib/notifications";
import { formatApiError } from "@/lib/api";

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Verified":
      return (
        <span className="status-badge status-completed flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Verified
        </span>
      );
    case "Pending":
      return (
        <span className="status-badge status-pending flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
    case "Rejected":
      return (
        <span className="status-badge bg-destructive/10 text-destructive flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          Rejected
        </span>
      );
    default:
      return null;
  }
};

const OfficerAccomplishments = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [newAccomplishment, setNewAccomplishment] = useState<AccomplishmentCreate>({
    title: "",
    description: "",
    type: "project",
    date_completed: new Date().toISOString().split('T')[0],
    proof_link: ""
  });
  const [editingAccomplishment, setEditingAccomplishment] = useState<Accomplishment | null>(null);
  const [originalAccomplishment, setOriginalAccomplishment] = useState<Accomplishment | null>(null);

  const { data: accomplishments = [], isLoading } = useMyAccomplishments();
  const createAccomplishment = useCreateAccomplishment();
  const updateAccomplishment = useUpdateAccomplishment();
  const toast = ({ title, description, variant }: { title: string; description?: string; variant?: string }) => {
    if (variant === "destructive") {
      sonnerToast.error(title, { description });
    } else {
      sonnerToast.success(title, { description });
    }
  };

  // determine if the user has changed any editable fields compared to when the dialog opened
  const hasChanges = !!editingAccomplishment && !!originalAccomplishment && (
    editingAccomplishment.title !== originalAccomplishment.title ||
    editingAccomplishment.description !== originalAccomplishment.description ||
    editingAccomplishment.type !== originalAccomplishment.type ||
    editingAccomplishment.date_completed !== originalAccomplishment.date_completed ||
    (editingAccomplishment.proof_link || "") !== (originalAccomplishment.proof_link || "")
  );

  // filter accomplishments by status
  const filteredAccomplishments = accomplishments.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === "all") return matchesSearch;
    return a.status.toLowerCase() === activeTab && matchesSearch;
  });

  const stats = {
    pending: accomplishments.filter(a => a.status === "Pending").length,
    verified: accomplishments.filter(a => a.status === "Verified").length,
    rejected: accomplishments.filter(a => a.status === "Rejected").length,
    total: accomplishments.length,
  };

  const handleSubmit = async () => {
    try {
      await createAccomplishment.mutateAsync(newAccomplishment);
      toast({
        title: "Success",
        description: "Accomplishment submitted successfully.",
      });
      setIsDialogOpen(false);
      setNewAccomplishment({ title: "", description: "", type: "project", date_completed: new Date().toISOString().split('T')[0], proof_link: "" });
    } catch (error) {
      toast({
        title: "Error",
        description: formatApiError(error),
        variant: "destructive",
      });
    }
  };

  const handleEdit = (accomplishment: Accomplishment) => {
    // Format the date to YYYY-MM-DD for the date input
    const formattedDate = accomplishment.date_completed 
      ? new Date(accomplishment.date_completed).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    
    const editData = { ...accomplishment, date_completed: formattedDate };
    setEditingAccomplishment(editData);
    setOriginalAccomplishment(editData);
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingAccomplishment) return;
    try {
      await updateAccomplishment.mutateAsync({
        id: editingAccomplishment.id,
        data: {
          title: editingAccomplishment.title,
          description: editingAccomplishment.description,
          type: editingAccomplishment.type,
          date_completed: editingAccomplishment.date_completed,
          proof_link: editingAccomplishment.proof_link
        }
      });
      toast({
        title: "Success",
        description: "Accomplishment updated successfully.",
      });
      setIsEditDialogOpen(false);
      setEditingAccomplishment(null);
    } catch (error) {
      toast({
        title: "Error",
        description: formatApiError(error),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="page-header mb-0">
          <h1 className="page-title">My Accomplishments</h1>
          <p className="page-description">Track and showcase your contributions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Accomplishment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Accomplishment</DialogTitle>
              <DialogDescription>
                Submit your accomplishment for verification
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Led Research Week 2025"
                  value={newAccomplishment.title}
                  onChange={(e) => setNewAccomplishment(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={newAccomplishment.type} onValueChange={(val) => setNewAccomplishment(prev => ({ ...prev, type: val as Accomplishment['type'] }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="award">Award</SelectItem>
                    <SelectItem value="certification">Certification</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="presentation">Presentation</SelectItem>
                    <SelectItem value="publication">Publication</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_completed">Date Completed</Label>
                <Input
                  id="date_completed"
                  type="date"
                  value={newAccomplishment.date_completed}
                  onChange={(e) => setNewAccomplishment(prev => ({ ...prev, date_completed: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your accomplishment..."
                  value={newAccomplishment.description}
                  onChange={(e) => setNewAccomplishment(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proof">Proof Link (optional)</Label>
                <Input
                  id="proof"
                  placeholder="https://..."
                  value={newAccomplishment.proof_link}
                  onChange={(e) => setNewAccomplishment(prev => ({ ...prev, proof_link: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={createAccomplishment.isPending}>
                {createAccomplishment.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingAccomplishment?.status === 'Rejected' ? 'Resubmit Accomplishment' : 'Edit Accomplishment'}
              </DialogTitle>
              <DialogDescription>
                {editingAccomplishment?.status === 'Rejected'
                  ? 'Address the feedback below and resubmit for verification.'
                  : 'Update your accomplishment details'}
              </DialogDescription>
            </DialogHeader>
            {editingAccomplishment?.status === 'Rejected' && (
              <div className="mx-6 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">Rejected</p>
                  <p className="text-xs text-destructive/80 leading-relaxed">
                    Reason: {editingAccomplishment.comments || 'No feedback provided.'}
                  </p>
                  <p className="text-[10px] text-destructive/60 mt-1 uppercase tracking-wider font-semibold">
                    Resubmitting will reset the status to Pending
                  </p>
                </div>
              </div>
            )}
            {editingAccomplishment && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    placeholder="e.g., Led Research Week 2025"
                    value={editingAccomplishment.title}
                    onChange={(e) => setEditingAccomplishment(prev => prev ? { ...prev, title: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Type</Label>
                  <Select value={editingAccomplishment.type} onValueChange={(val) => setEditingAccomplishment(prev => prev ? { ...prev, type: val as Accomplishment['type'] } : null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="award">Award</SelectItem>
                      <SelectItem value="certification">Certification</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="training">Training</SelectItem>
                      <SelectItem value="presentation">Presentation</SelectItem>
                      <SelectItem value="publication">Publication</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Date Completed</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editingAccomplishment.date_completed}
                    onChange={(e) => setEditingAccomplishment(prev => prev ? { ...prev, date_completed: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    placeholder="Describe your accomplishment..."
                    value={editingAccomplishment.description}
                    onChange={(e) => setEditingAccomplishment(prev => prev ? { ...prev, description: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-proof">Proof Link (optional)</Label>
                  <Input
                    id="edit-proof"
                    placeholder="https://..."
                    value={editingAccomplishment.proof_link || ""}
                    onChange={(e) => setEditingAccomplishment(prev => prev ? { ...prev, proof_link: e.target.value } : null)}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditSubmit} disabled={updateAccomplishment.isPending || !hasChanges}>
                {updateAccomplishment.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : editingAccomplishment?.status === 'Rejected' ? (
                  <RotateCcw className="w-4 h-4 mr-2" />
                ) : null}
                {editingAccomplishment?.status === 'Rejected' ? 'Resubmit' : 'Update'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {stats.verified}
              </p>
              <p className="text-sm text-muted-foreground">Verified</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {stats.pending}
              </p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Accomplishments List */}
      <div className="bg-card rounded-xl border border-border">
        <div className="p-4 border-b border-border flex items-center justify-between gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
              <TabsTrigger value="verified">Verified ({stats.verified})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({stats.rejected})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search accomplishments..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="p-8 flex justify-center text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : accomplishments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No accomplishments found.
            </div>
          ) : filteredAccomplishments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No {activeTab} accomplishments found.
            </div>
          ) : (
            filteredAccomplishments.map((item) => (
              <div key={item.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground">{item.title}</h3>
                      {getStatusBadge(item.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{new Date(item.date_completed).toLocaleDateString()}</span>
                      <span className="capitalize px-2 py-0.5 rounded-full bg-secondary/50 text-secondary-foreground">{item.type}</span>
                      {item.proof_link && (
                        <a
                          href={item.proof_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View proof
                        </a>
                      )}
                    </div>
                    {item.status === 'Rejected' && item.comments && (
                      <p className="text-xs text-destructive mt-2">
                        Reason: {item.comments}
                      </p>
                    )}
                  </div>
                  {item.status === 'Pending' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(item)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                  {item.status === 'Rejected' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(item)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-sm text-muted-foreground text-center">
          Verified accomplishments will be visible to evaluators.
          Make sure to provide accurate information and valid proof links.
        </p>
      </div>
    </div>
  );
};

export default OfficerAccomplishments;
