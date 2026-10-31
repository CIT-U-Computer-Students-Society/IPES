import { useState } from "react";
import {
  Settings,
  Save,
  Bell,
  Shield,
  Database,
  Mail,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert } from "@/components/ui/alert";
import {
  useDeleteOrganization,
  useUpdateOrganization,
  useOrganization,
} from "@/hooks/useOrganizations";
import { useCurrentMembership } from "@/hooks/useUsers";
import { useNavigate } from "react-router-dom";
import { useOrganizationState } from "@/contexts/OrganizationContext";
import { formatApiError } from "@/lib/api";
import { toast as sonnerToast } from "@/lib/notifications";

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    autoReminders: true,
    reminderDaysBefore: "3",
  });
  const navigate = useNavigate();
  const { activeOrganizationId } = useOrganizationState();
  const { data: currentMembership } = useCurrentMembership();
  const { mutate: deleteOrganization, isPending: isDeleting } = useDeleteOrganization();
  const { mutate: updateOrganization, isPending: isUpdatingOrg } = useUpdateOrganization();
  const { data: organization } = useOrganization();
  const toast = ({ title, description, variant }: { title: string; description?: string; variant?: string }) => {
    if (variant === "destructive") {
      sonnerToast.error(title, { description });
    } else {
      sonnerToast.success(title, { description });
    }
  };
  const [codeCopied, setCodeCopied] = useState(false);

  // Dialog states for deleting organization
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteOrgCode, setDeleteOrgCode] = useState("");
  const [deleteAdminPassword, setDeleteAdminPassword] = useState("");

  const [orgData, setOrgData] = useState({
    name: organization?.name || currentMembership?.organization_name || "",
    description: organization?.description || "",
    email: organization?.email || currentMembership?.organization_email || "",
  });

  const [orgSource, setOrgSource] = useState({ currentMembership, organization });
  if (orgSource.currentMembership !== currentMembership || orgSource.organization !== organization) {
    setOrgSource({ currentMembership, organization });
    if (currentMembership || organization) {
      setOrgData({
        name: organization?.name || currentMembership?.organization_name || "",
        description: organization?.description || "",
        email: organization?.email || currentMembership?.organization_email || "",
      });
    }
  }

  const handleSaveOrganization = () => {
    if (!activeOrganizationId) return;

    updateOrganization({
      id: activeOrganizationId,
      data: {
        name: orgData.name,
        description: orgData.description,
        email: orgData.email,
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Organization details updated successfully."
        });
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Error",
          description: formatApiError(error)
        });
      }
    });
  };

  const isAdmin = currentMembership?.role === 'Admin';

  const handleDeleteOrganization = () => {
    if (!activeOrganizationId) return;

    deleteOrganization(
      {
        id: activeOrganizationId,
        data: { code: deleteOrgCode, password: deleteAdminPassword }
      },
      {
        onSuccess: (response) => {
          toast({
            title: "Success",
            description: response.message || "Organization successfully deleted.",
          });
          setDeleteDialogOpen(false);
          setDeleteOrgCode("");
          setDeleteAdminPassword("");
          navigate("/select-organization");
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Error",
            description: error.message || "Please check your code and password and try again.",
          });
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
          <p className="text-muted-foreground">Configure evaluation system behavior and your profile</p>
        </div>
        <Button
          className="gradient-hero text-primary-foreground"
          onClick={handleSaveOrganization}
          disabled={isUpdatingOrg}
        >
          <Save className="w-4 h-4 mr-2" />
          {isUpdatingOrg ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>


        <TabsContent value="general" className="space-y-6">
          {/* Organization Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                <CardTitle>Organization Information</CardTitle>
              </div>
              <CardDescription>
                Basic organization details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Organization Name</Label>
                <Input
                  value={orgData.name}
                  onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                  placeholder="e.g. University Student Council"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={orgData.description}
                  onChange={(e) => setOrgData({ ...orgData, description: e.target.value })}
                  placeholder="Brief description of your organization"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Organization Code</Label>
                <p className="text-xs text-muted-foreground">Share this code with members so they can join your organization</p>
                <div className="flex gap-2">
                  <Input
                    value={organization?.code || ''}
                    readOnly
                    className="font-mono bg-muted"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (organization?.code) {
                        navigator.clipboard.writeText(organization.code);
                        setCodeCopied(true);
                        setTimeout(() => setCodeCopied(false), 2000);
                        toast({
                          title: "Copied!",
                          description: "Organization code copied to clipboard.",
                        });
                      }
                    }}
                  >
                    {codeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive bg-destructive/5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-destructive" />
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
              </div>
              <CardDescription className="text-destructive/80">
                Destructive actions that permanently affect the organization and its data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-destructive/20 rounded-lg bg-background">
                <div className="space-y-1">
                  <h4 className="font-medium text-destructive">Delete Organization</h4>
                  <p className="text-sm text-muted-foreground">
                    Permanently close this organization and deactivate all associated accounts, units, and structural models. <strong>This action cannot be undone.</strong>
                  </p>
                  {!isAdmin && (
                    <p className="text-xs font-semibold text-destructive mt-2">
                      You must be an Administrator to perform this action.
                    </p>
                  )}
                </div>

                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={!isAdmin}>
                      Delete Organization
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-destructive">Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-4">
                        <p>
                          This action cannot be undone. This will permanently soft-delete the organization, deactivate all active unit architectures, and instantly log out all current members.
                        </p>
                        <Alert className="bg-destructive/10 text-destructive border-destructive/30 border">
                          Please enter the <strong>Organization Code</strong> and your <strong>Admin Password</strong> to confirm destruction.
                        </Alert>
                        <div className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label className="text-foreground">Organization Code</Label>
                            <Input
                              placeholder="e.g. 5x8TqP"
                              value={deleteOrgCode}
                              onChange={(e) => setDeleteOrgCode(e.target.value)}
                              autoComplete="off"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-foreground">Your Password</Label>
                            <Input
                              type="password"
                              placeholder="Enter your password"
                              value={deleteAdminPassword}
                              onChange={(e) => setDeleteAdminPassword(e.target.value)}
                            />
                          </div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => {
                        setDeleteOrgCode("");
                        setDeleteAdminPassword("");
                      }}>Cancel</AlertDialogCancel>
                      <Button
                        variant="destructive"
                        onClick={handleDeleteOrganization}
                        disabled={!deleteOrgCode || !deleteAdminPassword || isDeleting}
                      >
                        {isDeleting ? "Deleting..." : "Permanently Delete"}
                      </Button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <CardTitle>Notification Settings</CardTitle>
                <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded ml-2 font-medium">Upcoming Feature</span>
              </div>
              <CardDescription>
                Configure system notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Automatic Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Send email reminders for pending evaluations
                  </p>
                </div>
                <Switch
                  checked={settings.autoReminders}
                  onCheckedChange={(checked) => setSettings({ ...settings, autoReminders: checked })}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Reminder Days Before Deadline</Label>
                <Select
                  value={settings.reminderDaysBefore}
                  onValueChange={(value) => setSettings({ ...settings, reminderDaysBefore: value })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="2">2 days</SelectItem>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="5">5 days</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Email Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                <CardTitle>Email Configuration</CardTitle>
              </div>
              <CardDescription>
                Email notification settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Organization Email Address</Label>
                <p className="text-sm text-muted-foreground mb-2">This email will be used as the sender when sending out automated emails and notifications.</p>
                <Input
                  value={orgData.email}
                  onChange={(e) => setOrgData({ ...orgData, email: e.target.value })}
                  placeholder="noreply@ipes.university.edu"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
