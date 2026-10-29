import { useEffect, useRef, useState } from "react";
import { Mail, Save, Loader2, X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatApiError } from "@/lib/api";
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

const profileSchema = z.object({
    first_name: z.string().max(150, 'Use at most 150 characters.'),
    last_name: z.string().max(150, 'Use at most 150 characters.'),
    display_picture: z.instanceof(File)
        .refine(file => file.size <= 2 * 1024 * 1024, 'Choose an image smaller than 2 MB.')
        .refine(file => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type), 'Use a JPEG, PNG, or WebP image.')
        .nullable().optional(),
});
type ProfileValues = z.infer<typeof profileSchema>;

export function ProfileEditorDialog({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const { data: user, isLoading: isUserLoading } = useCurrentUser();
    const { activeOrganizationId } = useOrganizationState();
    const { mutate: updateProfile, isPending: isUpdating } = useUpdateCurrentUser();

    const [isEditing, setIsEditing] = useState(false);
    const { register, handleSubmit, reset, control, setValue, formState: { errors, isDirty } } = useForm<ProfileValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: { first_name: '', last_name: '' },
    });
    const picture = useWatch({ control, name: 'display_picture' });
    const [preview, setPreview] = useState<string>();
    const fileInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open && user && !isDirty) {
            reset({ first_name: user.first_name || '', last_name: user.last_name || '' });
        }
    }, [user, open, isDirty, reset]);

    useEffect(() => () => {
        if (preview) URL.revokeObjectURL(preview);
    }, [preview]);

    const changeOpen = (nextOpen: boolean) => {
        if (isUpdating) return;
        setOpen(nextOpen);
        setIsEditing(false);
        setPreview(undefined);
        reset({ first_name: user?.first_name || '', last_name: user?.last_name || '' });
    };

    if (isUserLoading || !user) {
        return (
            <Dialog open={open} onOpenChange={changeOpen}>
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

    const handleSave = handleSubmit((values) => {
        updateProfile(values, {
            onSuccess: () => {
                toast.success("Profile updated successfully");
                setIsEditing(false);
                setPreview(undefined);
                reset({ first_name: values.first_name, last_name: values.last_name });
            },
            onError: (error) => {
                toast.error(formatApiError(error));
            }
        });
    });

    const handleCancel = () => {
        setPreview(undefined);
        reset({
            first_name: user.first_name || "",
            last_name: user.last_name || "",
        });
        setIsEditing(false);
    };

    return (
        <Dialog open={open} onOpenChange={changeOpen}>
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
                            <Avatar className="!w-16 !h-16 shrink-0">
                                <AvatarImage src={picture === null ? undefined : preview || user.display_picture || undefined} alt={`${fullName}'s profile picture`} />
                                <AvatarFallback>{initials}</AvatarFallback>
                            </Avatar>
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
                                    <Button aria-label="Cancel profile edits" variant="ghost" size="icon" className="h-8 w-8" onClick={handleCancel} disabled={isUpdating}>
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
                        {isEditing && <div className="grid gap-2">
                            <Label htmlFor="display_picture">Profile picture</Label>
                            <Input ref={fileInput} id="display_picture" type="file" accept="image/jpeg,image/png,image/webp"
                                disabled={isUpdating} aria-invalid={!!errors.display_picture}
                                aria-describedby="picture-help picture-error"
                                onChange={event => {
                                    const file = event.target.files?.[0];
                                    setValue('display_picture', file, { shouldDirty: true, shouldValidate: true });
                                    setPreview(file ? URL.createObjectURL(file) : undefined);
                                }} />
                            <p id="picture-help" className="text-xs text-muted-foreground">JPEG, PNG, or WebP, up to 2 MB. Pictures are cropped to a square.</p>
                            {errors.display_picture && <p id="picture-error" role="alert" className="text-sm text-destructive">{errors.display_picture.message}</p>}
                            {(user.display_picture || picture instanceof File) && <Button variant="outline" size="sm" disabled={isUpdating}
                                onClick={() => {
                                    setValue('display_picture', null, { shouldDirty: true, shouldValidate: true });
                                    setPreview(undefined);
                                    if (fileInput.current) fileInput.current.value = '';
                                }}>Remove picture</Button>}
                        </div>}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="first_name" className="text-xs font-medium">
                                    First Name
                                </Label>
                                <Input
                                    id="first_name"
                                    {...register('first_name')}
                                    disabled={isUpdating}
                                    readOnly={!isEditing}
                                    className={!isEditing ? "bg-muted/50 h-9" : "h-9"}
                                />
                                {errors.first_name && <p role="alert" className="text-sm text-destructive">{errors.first_name.message}</p>}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="last_name" className="text-xs font-medium">
                                    Last Name
                                </Label>
                                <Input
                                    id="last_name"
                                    {...register('last_name')}
                                    disabled={isUpdating}
                                    readOnly={!isEditing}
                                    className={!isEditing ? "bg-muted/50 h-9" : "h-9"}
                                />
                                {errors.last_name && <p role="alert" className="text-sm text-destructive">{errors.last_name.message}</p>}
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
