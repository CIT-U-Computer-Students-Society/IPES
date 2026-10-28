import { useState } from "react";
import {
  Trophy,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Eye,
  MessageSquare,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccomplishments, useVerifyAccomplishment, Accomplishment } from "@/hooks/usePortfolio";
import { toast } from "sonner";
import { useOrganizationState } from "@/contexts/OrganizationContext";

const AdminAccomplishments = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedAccomplishment, setSelectedAccomplishment] = useState<Accomplishment | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");

  const { activeOrganizationId } = useOrganizationState();
  const { data: accomplishments = [], isLoading } = useAccomplishments({
    organization_id: activeOrganizationId
  });

  const verifyAccomplishment = useVerifyAccomplishment();


  const getStatusColor = (status: string) => {
    // make status badges non-interactive and lighten on hover
    const base = "cursor-default transition-colors";
    switch (status) {
      case "Verified": return `${base} bg-green-100 text-green-700 hover:bg-green-200`;
      case "Pending": return `${base} bg-yellow-100 text-yellow-700 hover:bg-yellow-200`;
      case "Rejected": return `${base} bg-red-100 text-red-700 hover:bg-red-200`;
      default: return `${base} bg-muted text-muted-foreground hover:bg-muted/80`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Verified": return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "Pending": return <Clock className="w-4 h-4 text-yellow-600" />;
      case "Rejected": return <XCircle className="w-4 h-4 text-red-600" />;
      default: return null;
    }
  };

  const filteredAccomplishments = accomplishments.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.user_name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === "all" || a.status.toLowerCase() === activeTab;
    return matchesSearch && matchesTab;
  });

  const handleVerify = async (status: 'Verified' | 'Rejected') => {
    if (!selectedAccomplishment) return;
    try {
      await verifyAccomplishment.mutateAsync({
        id: selectedAccomplishment.id,
        data: {
          status,
          comments: reviewNotes,
        }
      });
      toast.success("Success", {
        description: `Accomplishment ${status.toLowerCase()} successfully.`,
      });
      setReviewDialogOpen(false);
      setReviewNotes("");
    } catch (error) {
      toast.error("Error", {
        description: `Failed to update accomplishment status.`,
      });
    }
  };

  const stats = {
    pending: accomplishments.filter(a => a.status === "Pending").length,
    verified: accomplishments.filter(a => a.status === "Verified").length,
    rejected: accomplishments.filter(a => a.status === "Rejected").length,
    total: accomplishments.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accomplishment Review</h1>
          <p className="text-muted-foreground">Verify and manage officer accomplishments</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.verified}</p>
                <p className="text-sm text-muted-foreground">Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.rejected}</p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
                <TabsTrigger value="verified">Verified</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-10 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Accomplishment</TableHead>
                <TableHead>Officer</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredAccomplishments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No accomplishments found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccomplishments.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="font-medium text-foreground truncate">{acc.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{acc.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>{acc.user_name || 'Unknown Officer'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{acc.type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(acc.date_completed).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(acc.status)}
                        <Badge className={getStatusColor(acc.status)}>{acc.status}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {acc.proof_link && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(acc.proof_link, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedAccomplishment(acc); setReviewDialogOpen(true); }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Accomplishment</DialogTitle>
          </DialogHeader>
          {selectedAccomplishment && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-muted-foreground">Title</Label>
                <p className="font-medium">{selectedAccomplishment.title}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p className="text-sm break-words whitespace-pre-wrap max-h-40 overflow-auto">{selectedAccomplishment.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Officer</Label>
                  <p className="font-medium">{selectedAccomplishment.user_name || 'Unknown Officer'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium capitalize">{selectedAccomplishment.type}</p>
                </div>
              </div>
              {selectedAccomplishment.proof_link && (
                <div>
                  <Label className="text-muted-foreground">Proof Link</Label>
                  <a
                    href={selectedAccomplishment.proof_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    View Documentation <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {selectedAccomplishment.status === "Pending" && (
                <>
                  <div className="space-y-2">
                    <Label>Accomplishment Comments (optional)</Label>
                    <Textarea
                      placeholder="Add any notes about this accomplishment..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => handleVerify("Verified")}
                      disabled={verifyAccomplishment.isPending}
                    >
                      {verifyAccomplishment.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      Verify
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleVerify("Rejected")}
                      disabled={verifyAccomplishment.isPending}
                    >
                      {verifyAccomplishment.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                      Reject
                    </Button>
                  </div>
                </>
              )}

              {selectedAccomplishment.status === "Rejected" && selectedAccomplishment.comments && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <Label className="text-red-700">Rejection Reason</Label>
                  <p className="text-sm text-red-600 break-words whitespace-pre-wrap max-h-40 overflow-auto">
                    {selectedAccomplishment.comments}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAccomplishments;
