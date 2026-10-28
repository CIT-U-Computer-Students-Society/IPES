import { useState } from "react";
import { User, Mail, Building2, Shield, Save, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useCurrentUser, useUpdateCurrentUser } from "@/hooks/useUsers";
import { useOrganizationState } from "@/contexts/OrganizationContext";
import { toast } from "@/lib/notifications";

export function ProfileEditorDialog({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const { data: user, isLoading: isUserLoading } = useCurrentUser();
    const { activeOrganizationId } = useOrganizationState();
    const { mutate: updateProfile, isPending: isUpdating } = useUpdateCurrentUser();

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
    });

    const [formSource, setFormSource] = useState({ user, open });
    // Synchronize before rendering instead of painting stale values and then resetting in an effect.
    if (formSource.user !== user || formSource.open !== open) {
        setFormSource({ user, open });
        if (user && open) {
            setFormData({
                first_name: user.first_name || "",
                last_name: user.last_name || "",
            });
            setIsEditing(false); // Reset edit state when opening dialog
        }
    }

    if (isUserLoading || !user) {
        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>{children}</DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    const initials = `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase() || "U";
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;

    // Filter memberships for the current active organization
    const activeOrgMemberships = user.memberships?.filter(
        (m) => m.organization_id === activeOrganizationId
    ) || [];

    const displayMemberships = activeOrgMemberships.slice(0, 3);
    const extraMembershipsCount = activeOrgMemberships.length > 3 ? activeOrgMemberships.length - 3 : 0;

    const handleSave = () => {
        updateProfile(formData, {
            onSuccess: () => {
                toast.success("Profile updated successfully");
                setIsEditing(false);
            },
            onError: () => {
                toast.error("Failed to update profile");
            }
        });
    };

    const handleCancel = () => {
        setFormData({
            first_name: user.first_name || "",
            last_name: user.last_name || "",
        });
        setIsEditing(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>My Profile</DialogTitle>
                    <DialogDescription>
                        View and manage your account information.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-6 min-w-0">
                    <div className="flex items-start justify-between gap-4 w-full min-w-0">
                        <div className="flex items-center gap-4 flex-1 min-w-0 overflow-hidden">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-xl font-semibold text-primary">{initials}</span>
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden pr-4">
                                <h2 className="text-lg font-semibold text-foreground truncate w-full">{fullName}</h2>
                                {activeOrganizationId ? (
                                    <div className="mt-1 space-y-0.5 w-full">
                                        {displayMemberships.map((m) => (
                                            <p key={m.id} className="text-xs text-muted-foreground truncate" title={`${m.role} • ${m.position_name} in ${m.unit_name}`}>
                                                <span className="font-medium text-foreground/80">{m.role}</span> • {m.position_name} in <span className="italic">{m.unit_name}</span>
                                            </p>
                                        ))}
                                        {extraMembershipsCount > 0 && (
                                            <p className="text-xs text-muted-foreground italic mt-1 truncate">
                                                ... and {extraMembershipsCount} more position{extraMembershipsCount !== 1 ? 's' : ''}
                                            </p>
                                        )}
                                        {activeOrgMemberships.length === 0 && (
                                            <p className="text-sm text-muted-foreground">System Administrator</p>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                        <div className="shrink-0">
                            {!isEditing ? (
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                    Edit
                                </Button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCancel} disabled={isUpdating}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" onClick={handleSave} disabled={isUpdating}>
                                        {isUpdating ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Save className="w-3 h-3 mr-2" />}
                                        Save
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-4 py-4 border-t border-border/50">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="first_name" className="text-xs font-medium">
                                    First Name
                                </Label>
                                <Input
                                    id="first_name"
                                    value={formData.first_name}
                                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                    readOnly={!isEditing}
                                    className={!isEditing ? "bg-muted/50 h-9" : "h-9"}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="last_name" className="text-xs font-medium">
                                    Last Name
                                </Label>
                                <Input
                                    id="last_name"
                                    value={formData.last_name}
                                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                    readOnly={!isEditing}
                                    className={!isEditing ? "bg-muted/50 h-9" : "h-9"}
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="email" className="text-xs font-medium flex items-center gap-1.5">
                                <Mail className="w-3 h-3 text-muted-foreground" />
                                Email Address
                            </Label>
                            <Input id="email" value={user.email} readOnly className="bg-muted/50 h-9" />
                            <p className="text-[10px] text-muted-foreground">Email address cannot be changed.</p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
