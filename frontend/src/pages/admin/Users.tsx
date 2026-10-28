import { formatApiError } from "@/lib/api";
import { useState } from "react";
import {
  Users,
  Search,
  MoreHorizontal,
  Shield,
  ShieldCheck,
  UserCheck,
  Settings2,
  UserPlus,
  UserMinus,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast as sonnerToast } from "@/lib/notifications";
import { useUsers, useCurrentUser, type User } from "@/hooks/useUsers";

// Organization unit options
const ORGANIZATION_UNITS = [
  { value: "executive", label: "Executive Committee" },
  { value: "legislative", label: "Legislative Council" },
  { value: "academics", label: "Committee on Academics" },
  { value: "finance", label: "Committee on Finance" },
  { value: "external", label: "Committee on External Affairs" },
  { value: "internal", label: "Committee on Internal Affairs" },
];

// Position options
const POSITIONS = [
  { value: "president", label: "President" },
  { value: "vp", label: "Vice President" },
  { value: "chair", label: "Chairperson" },
  { value: "secretary", label: "Secretary" },
  { value: "treasurer", label: "Treasurer" },
  { value: "member", label: "Member" },
];

import { useOrganizationState } from "@/contexts/OrganizationContext";
import { useUpdateMembership, useOrganizationUnits, usePositionTypes, useCreateMembership, useRemoveMember, useSetMemberRole } from "@/hooks/useOrganizations";

const StatsSkeleton = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {[1, 2, 3, 4].map((i) => (
      <Card key={i}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div>
              <Skeleton className="h-8 w-12 mb-1" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

// Loading skeleton for table
const TableSkeleton = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>User</TableHead>
        <TableHead>Role</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Org Unit / Position</TableHead>
        <TableHead className="text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {[1, 2, 3, 4, 5].map((i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div>
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </TableCell>
          <TableCell><Skeleton className="h-6 w-20" /></TableCell>
          <TableCell><Skeleton className="h-6 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);


const AdminUsers = () => {
  const { activeOrganizationId } = useOrganizationState();
  const { data: currentUser } = useCurrentUser();

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isManageMembershipOpen, setIsManageMembershipOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    unit_id: undefined as number | undefined,
    position_id: undefined as number | undefined,
  });

  const toast = ({ title, description, variant }: { title: string; description?: string; variant?: string }) => {
    if (variant === "destructive") {
      sonnerToast.error(title, { description });
    } else {
      sonnerToast.success(title, { description });
    }
  };

  // Fetch users from API (Filtered by Organization ID)
  const { data: users, isLoading, error, refetch } = useUsers({ organization_id: activeOrganizationId });
  const { data: units } = useOrganizationUnits(activeOrganizationId);
  const { data: positions } = usePositionTypes(activeOrganizationId);

  // Mutations
  const updateMembership = useUpdateMembership();
  const createMembership = useCreateMembership();
  const removeMember = useRemoveMember();
  const setMemberRole = useSetMemberRole();

  // Filter users
  const filteredUsers = users?.filter((user: User) => {
    const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    // Determine the user's role in the active organization
    const activeMembership = user.memberships?.find(m => m.organization_id === activeOrganizationId);
    const userRole = activeMembership ? activeMembership.role : "Member";

    // When filtering by "member", show users who are NOT admin
    const matchesRole = roleFilter === "all" ||
      (roleFilter === "admin" && userRole.toLowerCase() === "admin") ||
      (roleFilter === "member" && userRole.toLowerCase() !== "admin");
    return matchesSearch && matchesRole;
  }) || [];

  // Calculate stats — role is injected by the server from OrganizationRole
  const stats = {
    total: filteredUsers.length || 0,
    admins: filteredUsers.filter((u: User) => u.memberships?.some(m => m.organization_id === activeOrganizationId && m.role === 'Admin')).length || 0,
    nonAdmins: filteredUsers.filter((u: User) => !u.memberships?.some(m => m.organization_id === activeOrganizationId && m.role === 'Admin')).length || 0,
    active: filteredUsers.filter((u: User) => u.is_active).length || 0,
  };


  // Handle adding new role
  const handleAddRole = async () => {
    if (!selectedUser || !formData.unit_id || !formData.position_id) return;

    try {
      await createMembership.mutateAsync({
        user_id: selectedUser.id,
        unit_id: formData.unit_id,
        position_id: formData.position_id
      });
      toast({
        title: "Success",
        description: "Role added successfully",
      });
      setFormData({ unit_id: undefined, position_id: undefined });
    } catch (error) {
      toast({
        title: "Error",
        description: formatApiError(error),
        variant: "destructive",
      });
    }
  };

  // Handle removing a specific role
  const handleRemoveRole = async (membershipId: number) => {
    try {
      await updateMembership.mutateAsync({
        id: membershipId,
        data: { is_active: false }
      });
      toast({
        title: "Success",
        description: "Role removed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove role",
        variant: "destructive",
      });
    }
  };

  // Handle granting or revoking privileges
  const handleToggleAdminStatus = async (user: User) => {
    const membership = user.memberships?.find(m => m.organization_id === activeOrganizationId);
    if (!membership) return;

    const isCurrentlyAdmin = membership.role === 'Admin';

    // Prevent an admin from revoking their own adminship
    if (isCurrentlyAdmin && user.id === currentUser?.id) {
      toast({
        title: "Action Blocked",
        description: "You cannot revoke your own admin privileges.",
        variant: "destructive",
      });
      return;
    }

    try {
      await setMemberRole.mutateAsync({
        user_id: user.id,
        role: isCurrentlyAdmin ? 'Member' : 'Admin'
      });
      toast({
        title: "Success",
        description: `Admin privileges ${isCurrentlyAdmin ? "revoked" : "granted"} successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update privileges",
        variant: "destructive",
      });
    }
  };

  // Handle removal from org — opens confirmation dialog
  const handleRemoveFromOrganization = (user: User) => {
    if (user.id === currentUser?.id) {
      toast({
        title: "Action Blocked",
        description: "You cannot remove yourself from the organization.",
        variant: "destructive",
      });
      return;
    }
    setUserToRemove(user);
  };

  const confirmRemoveFromOrganization = async () => {
    if (!userToRemove) return;
    try {
      await removeMember.mutateAsync({
        user_id: userToRemove.id
      });
      toast({
        title: "Success",
        description: "User removed from organization",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove user",
        variant: "destructive",
      });
    } finally {
      setUserToRemove(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organization Members</h1>
          <p className="text-muted-foreground">Manage system users currently enrolled in your organization.</p>
        </div>
      </div>

      {/* Stats */}
      {isLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.admins}</p>
                  <p className="text-sm text-muted-foreground">Admins</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.nonAdmins}</p>
                  <p className="text-sm text-muted-foreground">Non-Admins</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="text-center py-4">
              <p className="text-destructive">Failed to load users</p>
              <Button variant="outline" onClick={() => refetch()} className="mt-2">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>All Users</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="pl-10 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Non-Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Org Unit / Position</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <p className="text-muted-foreground">No users found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const activeMemberships = user.memberships?.filter(m => m.organization_id === activeOrganizationId) || [];
                    // role is populated by the server from OrganizationRole
                    const isAdmin = activeMemberships.some(m => m.role === 'Admin');
                    const isActive = activeMemberships.some(m => m.is_active);

                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={user.display_picture || undefined} alt={`${user.first_name} ${user.last_name}'s profile picture`} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {user.first_name[0]}{user.last_name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">
                                {user.first_name} {user.last_name}
                              </p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isAdmin ? "default" : "secondary"}>
                            {isAdmin && <Shield className="w-3 h-3 mr-1" />}
                            {isAdmin ? "Admin" : "Member"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={isActive ? "outline" : "secondary"}
                            className={isActive ? "text-green-600 border-green-600" : ""}
                          >
                            {isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {activeMemberships.length === 0 ? "Unassigned" : (
                            <div className="space-y-2">
                              {activeMemberships.map((m, idx: number) => (
                                <div key={idx} className="leading-tight">
                                  {m.unit_name}
                                  <br />
                                  <span className="text-xs opacity-80">{m.position_name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setSelectedUser(user);
                                setIsManageMembershipOpen(true);
                              }}>
                                <Settings2 className="w-4 h-4 mr-2" />
                                Manage Roles
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleAdminStatus(user)}
                                disabled={user.id === currentUser?.id && isAdmin}
                              >
                                {isAdmin ? (
                                  <>
                                    <UserMinus className="w-4 h-4 mr-2" />
                                    <span>Revoke Admin Privileges</span>
                                  </>
                                ) : (
                                  <>
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Grant Admin Privileges
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleRemoveFromOrganization(user)}
                                disabled={user.id === currentUser?.id}
                              >
                                <AlertTriangle className="w-4 h-4 mr-2" />
                                Remove from Organization
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Manage Roles Dialog */}
      <Dialog open={isManageMembershipOpen} onOpenChange={setIsManageMembershipOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Roles: {selectedUser?.first_name} {selectedUser?.last_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Current Roles Section */}
            <div className="space-y-3">
              <Label>Current Assignments</Label>
              {(() => {
                const activeRoles = selectedUser?.memberships?.filter(m => m.organization_id === activeOrganizationId && m.is_active) || [];

                if (activeRoles.length === 0) {
                  return <p className="text-sm text-muted-foreground italic">No active roles in this organization.</p>;
                }

                return (
                  <div className="space-y-2">
                    {activeRoles.map(role => {
                      return (
                        <div key={role.id} className="flex items-center justify-between p-3 border rounded-lg bg-card text-card-foreground">
                          <div>
                            <p className="font-medium text-sm">{role.unit_name}</p>
                            <p className="text-xs text-muted-foreground">{role.position_name}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveRole(role.id)}
                            disabled={updateMembership.isPending}
                            title="Remove role"
                          >
                            <UserMinus className="w-4 h-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Add New Role Section */}
            <div className="space-y-4 pt-6 border-t">
              <Label className="text-base">Grant New Role</Label>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Organization Unit</Label>
                  <Select
                    value={formData.unit_id?.toString() || ""}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, unit_id: value ? parseInt(value) : undefined }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit..." />
                    </SelectTrigger>
                    <SelectContent>
                      {units?.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id.toString()}>
                          {unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Position</Label>
                  <Select
                    value={formData.position_id?.toString() || ""}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, position_id: value ? parseInt(value) : undefined }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select position..." />
                    </SelectTrigger>
                    <SelectContent>
                      {positions?.map((pos) => (
                        <SelectItem key={pos.id} value={pos.id.toString()}>
                          {pos.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleAddRole}
                disabled={createMembership.isPending || !formData.unit_id || !formData.position_id}
                className="w-full mt-2"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Role Assignment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove from Organization Confirmation Dialog */}
      <AlertDialog open={userToRemove !== null} onOpenChange={(open) => !open && setUserToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Organization?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{userToRemove?.first_name} {userToRemove?.last_name}</strong> from the organization? All their active memberships will be deactivated. This action can only be undone by re-approving a new join request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateMembership.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); confirmRemoveFromOrganization(); }}
              disabled={updateMembership.isPending}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
