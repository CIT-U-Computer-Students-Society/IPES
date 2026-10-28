import { formatApiError } from "@/lib/api";
import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useCurrentUser, Membership, useLogout } from '@/hooks/useUsers';
import { useOrganizationState } from '@/contexts/OrganizationContext';
import { useCreateOrganization, useJoinOrganization } from '@/hooks/useOrganizations';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BuildingIcon, ArrowRight, ShieldIcon, UserIcon, PlusIcon, LogOut } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/lib/notifications';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProfileEditorDialog } from '@/components/ProfileEditorDialog';

const SelectOrganization = () => {
    const navigate = useNavigate();

    const { data: user, isLoading } = useCurrentUser();
    const { setActiveOrganizationId, clearOrganizationState } = useOrganizationState();
    const { logout } = useLogout();

    React.useEffect(() => {
        // Clear active organization state when in the selector page
        clearOrganizationState();
    }, [clearOrganizationState]);

    const [isCreateOpen, setIsCreateOpen] = React.useState(false);
    const [isJoinOpen, setIsJoinOpen] = React.useState(false);

    const [createForm, setCreateForm] = React.useState({
        name: '',
        code: '',
        description: '',
        period_year_start: new Date().toISOString().split('T')[0]
    });
    const [joinCode, setJoinCode] = React.useState('');

    const createOrgMutation = useCreateOrganization();
    const joinOrgMutation = useJoinOrganization();

    // Moved BEFORE the early return - hooks must always be called in the same order
    const memberships = React.useMemo(() => user?.memberships || [], [user?.memberships]);

    // Group memberships by organization
    const groupedOrgs = React.useMemo(() => {
        const groups = new Map<number, {
            orgId: number;
            orgName: string;
            isAdmin: boolean;
            positions: number;
            primaryMembership: Membership;
        }>();

        memberships.forEach(m => {
            if (!groups.has(m.organization_id)) {
                groups.set(m.organization_id, {
                    orgId: m.organization_id,
                    orgName: m.organization_name,
                    isAdmin: m.role === 'Admin',
                    positions: 1,
                    primaryMembership: m
                });
            } else {
                const group = groups.get(m.organization_id)!;
                group.positions += 1;
                if (m.role === 'Admin') {
                    group.isAdmin = true;
                    group.primaryMembership = m; // Prioritize admin routing
                }
            }
        });

        return Array.from(groups.values());
    }, [memberships]);

    const handleSelectOrganization = (membership: Membership) => {
        setActiveOrganizationId(membership.organization_id);

        // Route based on their role IN THIS organization
        if (membership.role === 'Admin') {
            navigate('/admin/dashboard');
        } else {
            navigate('/member/dashboard');
        }
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createOrgMutation.mutate(createForm, {
            onSuccess: () => {
                setIsCreateOpen(false);
                setCreateForm({
                    name: '',
                    code: '',
                    description: '',
                    period_year_start: new Date().toISOString().split('T')[0]
                });
                toast.success("Organization Created", {
                    description: `${createForm.name} was set up successfully.`,
                });
            },
            onError: (err) => {
                const errorMessage = formatApiError(err);
                toast.error("Failed to create organization", {
                    description: errorMessage,
                });
            }
        });
    };

    const handleJoinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!joinCode.trim()) return;
        joinOrgMutation.mutate({ code: joinCode.trim() }, {
            onSuccess: () => {
                setIsJoinOpen(false);
                setJoinCode('');
                toast.success("Join Request Sent", {
                    description: "Waiting for Admin approval.",
                });
            },
            onError: (err) => {
                const errorMessage = formatApiError(err);
                toast.error("Failed to submit join request", {
                    description: errorMessage,
                });
            }
        });
    };

    // Protect against back-button caching unauthenticated states
    if (!localStorage.getItem('authToken')) {
        return <Navigate to="/login" replace />;
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-3xl space-y-6 animate-pulse">
                    <Skeleton className="h-12 w-64 mx-auto" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Skeleton className="h-40 w-full" />
                        <Skeleton className="h-40 w-full" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-3xl space-y-8">

                <div className="text-center space-y-4">
                    <div className="space-y-2">
                        <h1 className="text-4xl font-bold tracking-tight">Select Organization</h1>
                        <p className="text-muted-foreground text-lg">
                            Welcome back, {user?.first_name}. Choose an organization to enter.
                        </p>
                    </div>
                    <ProfileEditorDialog>
                        <Button variant="outline" size="sm" className="gap-2">
                            <UserIcon className="w-4 h-4" />
                            Edit Profile
                        </Button>
                    </ProfileEditorDialog>
                </div>

                <div className="flex justify-center gap-4 mt-4">
                    <Dialog open={isJoinOpen} onOpenChange={setIsJoinOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2 shrink-0">
                                <BuildingIcon className="w-4 h-4" />
                                Join Organization
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Join Organization</DialogTitle>
                                <DialogDescription>
                                    Enter the unique organization code to send a join request.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleJoinSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="join_code">Organization Code</Label>
                                    <Input
                                        id="join_code"
                                        required
                                        value={joinCode}
                                        onChange={e => setJoinCode(e.target.value)}
                                        placeholder="Enter the code..."
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="ghost" onClick={() => setIsJoinOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={joinOrgMutation.isPending}>
                                        {joinOrgMutation.isPending ? "Sending..." : "Submit Request"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-2 shrink-0">
                                <PlusIcon className="w-4 h-4" />
                                Create New Organization
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Organization</DialogTitle>
                                <DialogDescription>
                                    Set up a new organization. You will automatically be assigned as its Admin.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleCreateSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Organization Name</Label>
                                    <Input
                                        id="name"
                                        required
                                        value={createForm.name}
                                        onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. Supreme Student Government"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="code">Code / Acronym</Label>
                                    <Input
                                        id="code"
                                        required
                                        value={createForm.code}
                                        onChange={e => setCreateForm(prev => ({ ...prev, code: e.target.value }))}
                                        placeholder="e.g. SSG"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        required
                                        value={createForm.description}
                                        onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Brief description of your organization"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="period_start">Initial Academic Year / Period Start</Label>
                                    <Input
                                        id="period_start"
                                        type="date"
                                        required
                                        value={createForm.period_year_start}
                                        onChange={e => setCreateForm(prev => ({ ...prev, period_year_start: e.target.value }))}
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                                    <Button type="submit" disabled={createOrgMutation.isPending}>
                                        {createOrgMutation.isPending ? "Creating..." : "Create Organization"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {memberships.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                <BuildingIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold">No Organizations Found</h3>
                            <p className="text-muted-foreground max-w-sm mt-2">
                                You do not currently have an active membership in any organization. Please contact an administrator.
                            </p>
                            <Button onClick={() => logout()} variant="outline" className="mt-6">
                                Return to Login
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {groupedOrgs.map((group) => (
                            <Card
                                key={group.orgId}
                                className="hover:border-primary/50 transition-colors cursor-pointer group hover:shadow-md"
                                onClick={() => handleSelectOrganization(group.primaryMembership)}
                            >
                                <CardHeader className="pb-4">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <CardTitle className="text-xl group-hover:text-primary transition-colors">
                                                {group.orgName}
                                            </CardTitle>
                                            <CardDescription>
                                                {group.positions === 1
                                                    ? group.primaryMembership.unit_name
                                                    : `${group.positions} active positions`
                                                }
                                            </CardDescription>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <BuildingIcon className="h-5 w-5 text-primary" />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2 text-sm">
                                            {group.isAdmin ? (
                                                <ShieldIcon className="h-4 w-4 text-emerald-500" />
                                            ) : (
                                                <UserIcon className="h-4 w-4 text-blue-500" />
                                            )}
                                            <span className="font-medium">
                                                {group.isAdmin ? 'Admin' : 'Member'}
                                            </span>
                                            <span className="text-muted-foreground truncate max-w-[150px] sm:max-w-[200px]">
                                                • {group.positions === 1 ? group.primaryMembership.position_name : 'Multiple Roles'}
                                            </span>
                                        </div>
                                        <Button variant="ghost" size="icon" className="group-hover:translate-x-1 transition-transform">
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                <div className="flex flex-col items-center gap-2 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">Not the right account?</p>
                    <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={logout}>
                        <LogOut className="w-4 h-4" />
                        Sign out
                    </Button>
                </div>

            </div>
        </div>
    );
};

export default SelectOrganization;
