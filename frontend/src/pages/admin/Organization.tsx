import type { OrganizationUnit, UnitType, PositionType } from "@/hooks/organizations/types";
import { formatApiError } from "@/lib/api";
import { useState } from "react";
import {
  Building2,
  Plus,
  Search,
  MoreHorizontal,
  Users,
  ChevronRight,
  Edit,
  Trash2,
  UserPlus,
  Check,
  X,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  usePendingJoinRequests,
  useApproveJoinRequest,
  useRejectJoinRequest,
  useOrganizationUnits,
  usePositionTypes,
  useUnitTypes,
  useCreatePositionType,
  useCreateUnitType,
  useCreateOrganizationUnit,
  useDeleteOrganizationUnit,
  useDeletePositionType,
  useDeleteUnitType,
  useUpdateOrganizationUnit,
  useUpdateUnitType,
  useUpdatePositionType
} from "@/hooks/useOrganizations";
import { useOrganizationState } from "@/contexts/OrganizationContext";
import { toast as sonnerToast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AdminOrganization = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const { activeOrganizationId } = useOrganizationState();
  const { data: pendingRequests, isLoading: isLoadingRequests } = usePendingJoinRequests(activeOrganizationId);
  const { data: realUnits } = useOrganizationUnits(activeOrganizationId);
  const { data: realPositions } = usePositionTypes(activeOrganizationId);
  const { data: realUnitTypes } = useUnitTypes(activeOrganizationId);

  // Dynamic Total Members Calculation
  const totalMembers = realUnits?.reduce((sum: number, unit) => sum + (unit.members_count || 0), 0) || 0;

  // --- Mutations ---
  const createPositionMutation = useCreatePositionType();
  const updatePositionMutation = useUpdatePositionType();
  const deletePositionMutation = useDeletePositionType();

  const createUnitTypeMutation = useCreateUnitType();
  const updateUnitTypeMutation = useUpdateUnitType();
  const deleteUnitTypeMutation = useDeleteUnitType();

  const createUnitMutation = useCreateOrganizationUnit();
  const updateUnitMutation = useUpdateOrganizationUnit();
  const deleteUnitMutation = useDeleteOrganizationUnit();

  const approveMutation = useApproveJoinRequest();
  const rejectMutation = useRejectJoinRequest();
  const toast = ({ title, description, variant }: { title: string; description?: string; variant?: string }) => {
    if (variant === "destructive") {
      sonnerToast.error(title, { description });
    } else {
      sonnerToast.success(title, { description });
    }
  };

  // --- Create States ---
  const [newPositionName, setNewPositionName] = useState("");
  const [newPositionWeight, setNewPositionWeight] = useState("5");
  const [isPositionDialogOpen, setIsPositionDialogOpen] = useState(false);

  const [newUnitTypeName, setNewUnitTypeName] = useState("");
  const [isUnitTypeDialogOpen, setIsUnitTypeDialogOpen] = useState(false);

  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitDescription, setNewUnitDescription] = useState("");
  const [newUnitTypeId, setNewUnitTypeId] = useState<string>("");
  const [isUnitDialogOpen, setIsUnitDialogOpen] = useState(false);

  // --- Edit States ---
  const [editUnitId, setEditUnitId] = useState<number | null>(null);
  const [editUnitName, setEditUnitName] = useState("");
  const [editUnitDescription, setEditUnitDescription] = useState("");
  const [editUnitTypeId, setEditUnitTypeId] = useState<string>("");

  const [editUnitTypeIdState, setEditUnitTypeIdState] = useState<number | null>(null);
  const [editUnitTypeName, setEditUnitTypeName] = useState("");

  const [editPositionId, setEditPositionId] = useState<number | null>(null);
  const [editPositionName, setEditPositionName] = useState("");
  const [editPositionWeight, setEditPositionWeight] = useState("5");

  // --- Delete States (Alert Dialogs) ---
  const [deleteUnitId, setDeleteUnitId] = useState<number | null>(null);
  const [deleteUnitTypeIdState, setDeleteUnitTypeIdState] = useState<number | null>(null);
  const [deletePositionId, setDeletePositionId] = useState<number | null>(null);

  // --- Approval State ---
  const [approveDialogId, setApproveDialogId] = useState<number | null>(null);
  const [selectedApproveUnit, setSelectedApproveUnit] = useState<string>("");
  const [selectedApprovePosition, setSelectedApprovePosition] = useState<string>("");
  const [selectedApproveRole, setSelectedApproveRole] = useState<string>("Member");

  // --- Handlers: Create ---
  const handleCreatePositionType = () => {
    if (!newPositionName || !newPositionWeight) return;
    createPositionMutation.mutate({
      name: newPositionName,
      rank: parseInt(newPositionWeight),
    }, {
      onSuccess: () => {
        setIsPositionDialogOpen(false);
        setNewPositionName("");
        setNewPositionWeight("5");
        toast({ title: "Success", description: "Position Type created successfully." });
      },
      onError: (err) => {
        const errorMessage = formatApiError(err);
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
    });
  };

  const handleCreateUnitType = () => {
    if (!newUnitTypeName) return;
    createUnitTypeMutation.mutate({
      name: newUnitTypeName,
    }, {
      onSuccess: () => {
        setIsUnitTypeDialogOpen(false);
        setNewUnitTypeName("");
        toast({ title: "Success", description: "Unit Type defined successfully." });
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });
  };

  const handleCreateUnit = () => {
    if (!newUnitName || !newUnitTypeId) return;
    createUnitMutation.mutate({
      name: newUnitName,
      description: newUnitDescription,
      type_id: parseInt(newUnitTypeId),
    }, {
      onSuccess: () => {
        setIsUnitDialogOpen(false);
        setNewUnitName("");
        setNewUnitDescription("");
        setNewUnitTypeId("");
        toast({ title: "Success", description: "Organization Unit created successfully." });
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });
  };

  // --- Handlers: Edit ---
  const openEditUnit = (unit: OrganizationUnit) => {
    setEditUnitId(unit.id);
    setEditUnitName(unit.name);
    setEditUnitDescription(unit.description || "");
    setEditUnitTypeId(unit.type_id ? unit.type_id.toString() : "");
  };

  const handleUpdateUnit = () => {
    if (!editUnitId || !editUnitName) return;
    updateUnitMutation.mutate({
      id: editUnitId,
      data: {
        name: editUnitName,
        description: editUnitDescription,
        type_id: editUnitTypeId ? parseInt(editUnitTypeId) : undefined
      }
    }, {
      onSuccess: () => {
        setEditUnitId(null);
        toast({ title: "Success", description: "Unit updated successfully." });
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });
  };

  const openEditUnitType = (unitType: UnitType) => {
    setEditUnitTypeIdState(unitType.id);
    setEditUnitTypeName(unitType.name);
  };

  const handleUpdateUnitType = () => {
    if (!editUnitTypeIdState || !editUnitTypeName) return;
    updateUnitTypeMutation.mutate({
      id: editUnitTypeIdState,
      data: { name: editUnitTypeName }
    }, {
      onSuccess: () => {
        setEditUnitTypeIdState(null);
        toast({ title: "Success", description: "Unit Type updated successfully." });
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });
  };

  const openEditPosition = (pos: PositionType) => {
    setEditPositionId(pos.id);
    setEditPositionName(pos.name);
    setEditPositionWeight(pos.rank.toString());
  };

  const handleUpdatePosition = () => {
    if (!editPositionId || !editPositionName || !editPositionWeight) return;
    updatePositionMutation.mutate({
      id: editPositionId,
      data: { name: editPositionName, rank: parseInt(editPositionWeight) }
    }, {
      onSuccess: () => {
        setEditPositionId(null);
        toast({ title: "Success", description: "Position updated successfully." });
      },
      onError: (err) => {
        const errorMessage = formatApiError(err);
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
    });
  };

  // --- Handlers: Delete ---
  const confirmDeleteUnit = () => {
    if (!deleteUnitId) return;
    deleteUnitMutation.mutate(deleteUnitId, {
      onSuccess: () => {
        setDeleteUnitId(null);
        toast({ title: "Unit Deleted", description: "The unit has been removed." });
      },
      onError: (err) => {
        const errorMessage = formatApiError(err);
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
    });
  };

  const confirmDeleteUnitType = () => {
    if (!deleteUnitTypeIdState) return;
    deleteUnitTypeMutation.mutate(deleteUnitTypeIdState, {
      onSuccess: () => {
        setDeleteUnitTypeIdState(null);
        toast({ title: "Type Deleted", description: "The unit type has been removed." });
      },
      onError: (err) => {
        const errorMessage = formatApiError(err);
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
    });
  };

  const confirmDeletePosition = () => {
    if (!deletePositionId) return;
    deletePositionMutation.mutate(deletePositionId, {
      onSuccess: () => {
        setDeletePositionId(null);
        toast({ title: "Position Deleted", description: "The position type has been removed." });
      },
      onError: (err) => {
        const errorMessage = formatApiError(err);
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
    });
  };


  // --- Handlers: Approvals ---
  const handleApproveConfirm = () => {
    if (!approveDialogId || !selectedApproveUnit || !selectedApprovePosition) return;

    approveMutation.mutate({
      id: approveDialogId,
      unit_id: parseInt(selectedApproveUnit),
      position_id: parseInt(selectedApprovePosition),
      role: selectedApproveRole
    }, {
      onSuccess: () => {
        setApproveDialogId(null);
        setSelectedApproveUnit("");
        setSelectedApprovePosition("");
        setSelectedApproveRole("Member");
        toast({
          title: "Request Approved",
          description: "Member has been successfully added to the organization.",
        });
      },
      onError: (err) => {
        toast({
          title: "Approval Failed",
          description: formatApiError(err),
          variant: "destructive",
        });
      }
    });
  };

  const handleReject = (id: number) => {
    rejectMutation.mutate({ id }, {
      onSuccess: () => {
        toast({
          title: "Request Rejected",
          description: "The join request was successfully rejected.",
        });
      },
      onError: (err) => {
        toast({
          title: "Rejection Failed",
          description: formatApiError(err),
          variant: "destructive",
        });
      }
    });
  };

  const filteredUnits = realUnits?.filter((unit) =>
    unit.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organization Structure</h1>
          <p className="text-muted-foreground">Manage units, positions, and memberships</p>
        </div>
        <div className="flex gap-2 flex-wrap">

          {/* Add Position Type Dialog */}
          <Dialog open={isPositionDialogOpen} onOpenChange={setIsPositionDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Position Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Position Type</DialogTitle>
                <DialogDescription>Define a new role that users can hold within the organization.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Position Name</Label>
                  <Input
                    placeholder="e.g., Director"
                    value={newPositionName}
                    onChange={e => setNewPositionName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rank Level (1-100)</Label>
                  <Input
                    type="number"
                    min="1" max="100"
                    placeholder="5"
                    value={newPositionWeight}
                    onChange={e => setNewPositionWeight(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">1 represents the highest rank in. Higher numbers indicate lower ranks.</p>
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreatePositionType}
                  disabled={!newPositionName || !newPositionWeight || createPositionMutation.isPending}
                >
                  Create Position Type
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Unit Type Dialog */}
          <Dialog open={isUnitTypeDialogOpen} onOpenChange={setIsUnitTypeDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Unit Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Unit Type</DialogTitle>
                <DialogDescription>
                  Define top-level categories for organization units. (e.g., 'Department', 'Commission')
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Unit Type Name</Label>
                  <Input
                    placeholder="e.g., Committee"
                    value={newUnitTypeName}
                    onChange={e => setNewUnitTypeName(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreateUnitType}
                  disabled={!newUnitTypeName || createUnitTypeMutation.isPending}
                >
                  Create Unit Type
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Unit Dialog */}
          <Dialog open={isUnitDialogOpen} onOpenChange={setIsUnitDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-hero text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Add Unit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Organization Unit</DialogTitle>
                <DialogDescription>
                  Create a new operational branch within your organization. Requires a predefined Unit Type.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Unit Name</Label>
                  <Input
                    placeholder="e.g., Committee on Education"
                    value={newUnitName}
                    onChange={e => setNewUnitName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Input
                    placeholder="Brief description..."
                    value={newUnitDescription}
                    onChange={e => setNewUnitDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Type</Label>
                  <Select value={newUnitTypeId} onValueChange={setNewUnitTypeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {realUnitTypes?.length === 0 && (
                        <SelectItem value="none" disabled>No Unit Types defined yet.</SelectItem>
                      )}
                      {realUnitTypes?.map((ut) => (
                        <SelectItem key={ut.id} value={ut.id.toString()}>{ut.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreateUnit}
                  disabled={!newUnitName || !newUnitTypeId || createUnitMutation.isPending}
                >
                  Create Unit
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Organization Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl gradient-hero flex items-center justify-center">
                <Building2 className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Organization Overview</h2>
                <p className="text-muted-foreground">Manage your structural hierarchies</p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{pendingRequests?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{realPositions?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Defined Positions</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="structure" className="space-y-6">
        <TabsList>
          <TabsTrigger value="structure">Structure & Members</TabsTrigger>
          <TabsTrigger value="requests">
            Join Requests
            {pendingRequests && pendingRequests.length > 0 && (
              <Badge variant="destructive" className="ml-2 px-1.5 py-0.5 text-[10px] min-w-[20px] rounded-full flex items-center justify-center">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="structure" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* LEFT COLUMN: Units List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search units..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                {filteredUnits.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No units found.</p>
                ) : (
                  filteredUnits.map((unit) => {
                    const typeName = realUnitTypes?.find((ut) => ut.id === unit.type_id)?.name || 'Unknown Type';
                    return (
                      <Card key={unit.id} className="transition-all hover:shadow-md">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 pr-4">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Users className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-medium text-foreground">{unit.name}</h3>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {unit.description || 'No description provided'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <Badge variant="secondary">{typeName}</Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditUnit(unit)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Unit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className={`text-destructive ${unit.members_count && unit.members_count > 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                                    onClick={(e) => {
                                      if (unit.members_count && unit.members_count > 0) {
                                        e.preventDefault();
                                        toast({
                                          title: "Cannot Delete Unit",
                                          description: `This unit currently has ${unit.members_count} active member(s). Please reassign or remove them before deleting.`,
                                          variant: "destructive"
                                        });
                                      } else {
                                        setDeleteUnitId(unit.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Unit
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Position Types & Unit Types */}
            <div className="space-y-6">

              {/* Unit Types Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Unit Types</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {realUnitTypes?.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No Unit Types defined.</p>
                    ) : (
                      realUnitTypes?.map((ut) => (
                        <div key={ut.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div>
                            <p className="font-medium text-foreground">{ut.name}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                              onClick={() => openEditUnitType(ut)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive outline-none border-none hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleteUnitTypeIdState(ut.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Position Types Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Position Types</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {realPositions?.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No Position Types defined.</p>
                    ) : (
                      [...(realPositions || [])].sort((a, b) => b.rank - a.rank).map((pos) => (
                        <div key={pos.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <div>
                            <p className="font-medium text-foreground">{pos.name}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className="mr-2">Weight: {pos.rank}</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                              onClick={() => openEditPosition(pos)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive outline-none border-none hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeletePositionId(pos.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Join Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingRequests ? (
                <p className="text-muted-foreground">Loading pending requests...</p>
              ) : pendingRequests?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No pending requests at this time.</p>
              ) : (
                <div className="space-y-4">
                  {pendingRequests?.map((req) => (
                    <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4">
                      <div>
                        <p className="font-semibold text-foreground">{req.user_first_name} {req.user_last_name}</p>
                        <p className="text-sm text-muted-foreground">{req.user_email}</p>
                        <p className="text-xs text-muted-foreground mt-1">Requested: {new Date(req.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Button size="sm" onClick={() => setApproveDialogId(req.id)} disabled={approveMutation.isPending}>
                          <Check className="w-4 h-4 mr-2" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setApproveDialogId(-req.id)} disabled={rejectMutation.isPending}>
                          <X className="w-4 h-4 mr-2" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- INLINE EDIT DIALOGS --- */}

      {/* Edit Unit Dialog */}
      <Dialog open={editUnitId !== null} onOpenChange={(val) => !val && setEditUnitId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization Unit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Unit Name</Label>
              <Input
                value={editUnitName}
                onChange={e => setEditUnitName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editUnitDescription}
                onChange={e => setEditUnitDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Unit Type</Label>
              <Select value={editUnitTypeId} onValueChange={setEditUnitTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {realUnitTypes?.map((ut) => (
                    <SelectItem key={ut.id} value={ut.id.toString()}>{ut.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUnitId(null)}>Cancel</Button>
            <Button onClick={handleUpdateUnit} disabled={!editUnitName || !editUnitTypeId || updateUnitMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Unit Type Dialog */}
      <Dialog open={editUnitTypeIdState !== null} onOpenChange={(val) => !val && setEditUnitTypeIdState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Unit Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Unit Type Name</Label>
              <Input
                value={editUnitTypeName}
                onChange={e => setEditUnitTypeName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUnitTypeIdState(null)}>Cancel</Button>
            <Button onClick={handleUpdateUnitType} disabled={!editUnitTypeName || updateUnitTypeMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Position Dialog */}
      <Dialog open={editPositionId !== null} onOpenChange={(val) => !val && setEditPositionId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Position Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Position Name</Label>
              <Input
                value={editPositionName}
                onChange={e => setEditPositionName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rank Level (1-100)</Label>
              <Input
                type="number"
                min="1" max="100"
                value={editPositionWeight}
                onChange={e => setEditPositionWeight(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">1 represents the highest rank (Head Administrator). Higher numbers indicate lower ranks.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPositionId(null)}>Cancel</Button>
            <Button onClick={handleUpdatePosition} disabled={!editPositionName || !editPositionWeight || updatePositionMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* --- ALERT DIALOGS FOR DELETION --- */}

      <AlertDialog open={deleteUnitId !== null} onOpenChange={(val) => !val && setDeleteUnitId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization Unit?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this unit? All memberships tied to it will be disabled. This action cannot be fully undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUnitMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); confirmDeleteUnit(); }}
              disabled={deleteUnitMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteUnitTypeIdState !== null} onOpenChange={(val) => !val && setDeleteUnitTypeIdState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Unit Type?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this unit type? Units assigned to this type may lose their categorization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteUnitTypeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); confirmDeleteUnitType(); }}
              disabled={deleteUnitTypeMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deletePositionId !== null} onOpenChange={(val) => !val && setDeletePositionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Position Type?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this position type? All memberships with this position will be disabled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePositionMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); confirmDeletePosition(); }}
              disabled={deletePositionMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* --- Approve Dialog (Join Requests) --- */}
      <Dialog open={approveDialogId !== null && approveDialogId > 0} onOpenChange={(open) => !open && setApproveDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Join Request</DialogTitle>
            <DialogDescription>
              Assign the new member to a specific unit, position, and role within the organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={selectedApproveUnit} onValueChange={setSelectedApproveUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a unit" />
                </SelectTrigger>
                <SelectContent>
                  {realUnits?.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id.toString()}>{unit.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Position</Label>
              <Select value={selectedApprovePosition} onValueChange={setSelectedApprovePosition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a position" />
                </SelectTrigger>
                <SelectContent>
                  {realPositions?.map((pos) => (
                    <SelectItem key={pos.id} value={pos.id.toString()}>{pos.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>System Role</Label>
              <Select value={selectedApproveRole} onValueChange={setSelectedApproveRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Member">Member</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogId(null)}>Cancel</Button>
            <Button
              onClick={handleApproveConfirm}
              disabled={!selectedApproveUnit || !selectedApprovePosition || approveMutation.isPending}
            >
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Alert Dialog */}
      <AlertDialog open={approveDialogId !== null && approveDialogId < 0} onOpenChange={(val) => !val && setApproveDialogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Join Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this request? The user will not be added to the organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejectMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); handleReject(Math.abs(approveDialogId!)); }}
              disabled={rejectMutation.isPending}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default AdminOrganization;
