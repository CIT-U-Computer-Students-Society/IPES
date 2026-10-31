import { useState, useMemo } from "react";
import {
  History,
  Search,
  Filter,
  LogIn,
  FileEdit,
  Eye,
  UserPlus,
  Trash2,
  Shield,
  Download,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { useAuditLogs } from "@/hooks/useAudit";
import { useOrganizationState } from "@/contexts/OrganizationContext";
import { toast } from "@/lib/notifications";
import api from "@/lib/api";

const actionIcons: Record<string, typeof LogIn> = {
  login: LogIn,
  edit: FileEdit,
  view: Eye,
  create: UserPlus,
  delete: Trash2,
  permission: Shield,
};

const actionColors: Record<string, string> = {
  login: "bg-primary/10 text-primary",
  edit: "bg-warning/10 text-warning",
  view: "bg-muted text-muted-foreground",
  create: "bg-success/10 text-success",
  delete: "bg-destructive/10 text-destructive",
  permission: "bg-accent/10 text-accent",
};

const AuditLog = () => {
  const { activeOrganizationId } = useOrganizationState();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [isExporting, setIsExporting] = useState(false);


  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (activeOrganizationId) params.append("organization_id", String(activeOrganizationId));
      if (searchQuery) params.append("q", searchQuery);
      if (actionFilter !== "all") params.append("action", actionFilter);

      const response = await api.get(`/audit/export_csv/?${params.toString()}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Export Successful", {
        description: "Your audit log CSV has been downloaded.",
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Export Failed", {
        description: "There was an error generating your CSV export.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const {
    data: serverLogs = [],
    isLoading,
    isError,
    error,
    refetch
  } = useAuditLogs({
    organization_id: activeOrganizationId ?? undefined
  });

  const formatAction = (action: string) => {
    return action
      .replace('.', ': ')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const filteredLogs = useMemo(() => {
    return serverLogs.filter((log) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (log.user_email?.toLowerCase().includes(q) || false) ||
        (log.user_name?.toLowerCase().includes(q) || false) ||
        log.action.toLowerCase().includes(q) ||
        (log.ip_address?.toLowerCase().includes(q) || false);

      const categoryMatch = actionFilter === "all" || log.action.includes(actionFilter);

      return matchesSearch && categoryMatch;
    });
  }, [serverLogs, searchQuery, actionFilter]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
            <p className="text-muted-foreground">Immutable record of system events and member actions</p>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-destructive/50 p-8 text-center flex flex-col items-center justify-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">Failed to load audit history</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "An unexpected error occurred while fetching audit logs."}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Audit Log</h1>
          <p className="text-muted-foreground mt-1">Track all system activities and changes</p>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          {isExporting ? "Exporting..." : "Export Log"}
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by user, action, or IP address..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="create">Created</SelectItem>
              <SelectItem value="update">Updated</SelectItem>
              <SelectItem value="delete">Deleted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Timestamp</TableHead>
              <TableHead className="font-semibold">User</TableHead>
              <TableHead className="font-semibold">Action</TableHead>
              <TableHead className="font-semibold">IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map((log) => {
              const actionCategory = log.action.split('.')[1] || log.action;
              const IconComponent = actionIcons[actionCategory] || History;
              const colorClass = actionColors[actionCategory] || "bg-muted text-muted-foreground";

              return (
                <TableRow key={log.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(log.datetime).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {log.user_name || log.user_email || `User #${log.user_id}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`${colorClass} gap-1.5`}>
                      <IconComponent className="w-3 h-3" />
                      {(() => {
                        const formatted = formatAction(log.action);
                        const parenMatch = formatted.match(/\((.*)\)\s*$/);
                        if (parenMatch) {
                          const inside = parenMatch[1];
                          const titleMatch = inside.match(/(?:^|,\s*)(?:title|name)\s*=\s*([^,]+)/i);
                          if (titleMatch) {
                            let title = titleMatch[1].trim();
                            title = title.replace(/^['"]|['"]$/g, '');
                            return formatted.replace(/\s*\(.*\)\s*$/, ` (${title})`);
                          } else if (!inside.includes('=')) {
                            return formatted.replace(/\s*\(.*\)\s*$/, ` (${inside.trim()})`);
                          } else {
                            return formatted.replace(/\s*\(.*\)\s*$/, '');
                          }
                        }
                        return formatted;
                      })()}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {log.ip_address || "N/A"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="w-12 h-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No audit logs found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{serverLogs.filter(l => l.action.includes('login')).length}</p>
          <p className="text-sm text-muted-foreground">Logins</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{serverLogs.filter(l => l.action.includes('update')).length}</p>
          <p className="text-sm text-muted-foreground">Edits Made</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{serverLogs.filter(l => l.action.includes('create')).length}</p>
          <p className="text-sm text-muted-foreground">Creations</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{new Set(serverLogs.map(l => l.user_id)).size}</p>
          <p className="text-sm text-muted-foreground">Active Users</p>
        </div>
      </div>
    </div>
  );
};

export default AuditLog;
