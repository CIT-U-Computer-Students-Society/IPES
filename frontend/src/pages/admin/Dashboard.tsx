import { Link } from "react-router-dom";
import {
  Users,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  BarChart3,
  Clock,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsers } from "@/hooks/useUsers";
import { useAssignments } from "@/hooks/useEvaluations";
import { usePendingAccomplishments } from "@/hooks/usePortfolio";
import { useRecentAuditLogs } from "@/hooks/useAudit";
import { useUnitCompletionStats, useAnalyticsSummary } from "@/hooks/useOrganizations";
import type { User } from "@/hooks/useUsers";
import { type EvaluationAssignment } from "@/hooks/useEvaluations";
import { type AuditLog } from "@/hooks/useAudit";
import { type UnitCompletionStats } from "@/hooks/useOrganizations";

// Stats card component
const StatCard = ({
  label,
  value,
  change,
  icon: Icon,
  color,
  isLoading
}: {
  label: string;
  value: string | number;
  change: string;
  icon: React.ElementType;
  color: string;
  isLoading?: boolean;
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="w-10 h-10 rounded-lg" />
          </div>
          <div className="mt-4">
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-20 mt-1" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className={`w-10 h-10 rounded-lg bg-${color}/10 flex items-center justify-center`}>
            <Icon className={`w-5 h-5 text-${color}`} />
          </div>
        </div>
        <div className="mt-4">
          <p className="text-3xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground mt-1">{label}</p>
          <p className="text-xs text-muted-foreground mt-1">{change}</p>
        </div>
      </CardContent>
    </Card>
  );
};

// Activity item component
const ActivityItem = ({ activity }: { activity: AuditLog }) => {
  const formatAction = (action: string) => {
    return action
      .replace('.', ': ')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  // Render formatted action but simplify parenthetical metadata.
  // If the action contains a parenthesis with key=value pairs (e.g. "(title=My Form, id=123)")
  // prefer to show only the title value in parentheses: "(My Form)".
  const formatted = formatAction(activity.action);
  let displayAction = formatted;

  // Extract trailing parenthetical if present
  const parenMatch = formatted.match(/\((.*)\)\s*$/);
  if (parenMatch) {
    const inside = parenMatch[1];

    // Try to find a title or name key inside the parenthetical
    const titleMatch = inside.match(/(?:^|,\s*)(?:title|name)\s*=\s*([^,]+)/i);
    if (titleMatch) {
      let title = titleMatch[1].trim();
      // Strip surrounding quotes if any
      title = title.replace(/^['"]|['"]$/g, '');
      displayAction = formatted.replace(/\s*\(.*\)\s*$/, ` (${title})`);
    } else if (!inside.includes('=')) {
      // If the parenthetical is already a plain label (no key=), keep it as-is
      displayAction = formatted.replace(/\s*\(.*\)\s*$/, ` (${inside.trim()})`);
    } else {
      // If no title found, drop the key=value list to keep the action concise
      displayAction = formatted.replace(/\s*\(.*\)\s*$/, '');
    }
  }

  return (
    <div className="flex gap-3">
      <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">{displayAction}</p>
        {activity.user_name && (
          <p className="text-sm text-muted-foreground truncate">{activity.user_name}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {new Date(activity.datetime).toLocaleString()}
        </p>
      </div>
    </div>
  );
};

// Unit progress component
const UnitProgress = ({ name, completed, isLoading }: {
  name: string;
  completed: number;
  isLoading?: boolean;
}) => {
  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between text-sm mb-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-2 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-foreground font-medium">{name}</span>
        <span className="text-muted-foreground">{completed}%</span>
      </div>
      <Progress
        value={completed}
        className="h-2"
        indicatorClassName={completed < 50 ? 'bg-warning' : completed >= 80 ? 'bg-success' : 'bg-primary'}
      />
    </div>
  );
};

const AdminDashboard = () => {
  // Fetch data from API
  const { data: users, isLoading: usersLoading } = useUsers({ is_active: true });
  const { data: assignments, isLoading: assignmentsLoading } = useAssignments();
  const { data: pendingAccomplishments, isLoading: accomplishmentsLoading } = usePendingAccomplishments();
  const { data: recentActivity, isLoading: activityLoading } = useRecentAuditLogs();
  const { data: unitStats, isLoading: unitStatsLoading } = useUnitCompletionStats();

  // Calculate stats
  const totalOfficers = users?.length || 0;
  const activeEvaluations = assignments?.filter(a => a.status === "Pending" || a.status === "In Progress").length || 0;
  const completedEvaluations = assignments?.filter(a => a.status === "Completed").length || 0;
  const completionRate = assignments?.length
    ? Math.round((completedEvaluations / assignments.length) * 100)
    : 0;
  const pendingReview = pendingAccomplishments?.length || 0;



  // Use real unit progress data from API
  const unitProgress = unitStats?.map((stat: UnitCompletionStats) => ({
    name: stat.unit_name,
    completed: stat.completion_percentage
  })) || [];

  // Generate alerts based on data
  const alerts = [
    ...(pendingReview > 0 ? [{
      id: 1,
      type: "warning" as const,
      message: `${pendingReview} accomplishments pending review`,
      action: "Review now",
      link: "/admin/accomplishments"
    }] : []),
    ...(activeEvaluations > 20 ? [{
      id: 2,
      type: "info" as const,
      message: `${activeEvaluations} active evaluations ongoing`,
      action: "View details",
      link: "/admin/assignments"
    }] : []),
  ];

  const isLoading = usersLoading || assignmentsLoading || accomplishmentsLoading || activityLoading || unitStatsLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of evaluation activities</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Officers"
          value={totalOfficers}
          change="Active users"
          icon={Users}
          color="primary"
          isLoading={usersLoading}
        />
        <StatCard
          label="Active Evaluations"
          value={activeEvaluations}
          change="In progress"
          icon={ClipboardList}
          color="warning"
          isLoading={assignmentsLoading}
        />
        <StatCard
          label="Completion Rate"
          value={`${completionRate}%`}
          change={`${completedEvaluations} completed`}
          icon={CheckCircle2}
          color="success"
          isLoading={assignmentsLoading}
        />
        <StatCard
          label="Pending Review"
          value={pendingReview}
          change="Accomplishments"
          icon={AlertTriangle}
          color="accent"
          isLoading={accomplishmentsLoading}
        />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center justify-between p-4 rounded-lg border ${alert.type === 'warning'
                ? 'bg-warning/5 border-warning/20'
                : 'bg-primary/5 border-primary/20'
                }`}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-5 h-5 ${alert.type === 'warning' ? 'text-warning' : 'text-primary'
                  }`} />
                <span className="text-sm text-foreground">{alert.message}</span>
              </div>
              <Link to={alert.link}>
                <Button variant="ghost" size="sm">
                  {alert.action}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Unit Progress */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
              Completion by Unit
            </h2>
            <Link to="/admin/analytics" className="text-sm text-primary hover:underline">
              View analytics
            </Link>
          </div>

          <div className="space-y-5">
            {unitProgress.map((unit) => (
              <UnitProgress
                key={unit.name}
                name={unit.name}
                completed={unit.completed}
                isLoading={isLoading}
              />
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Recent Activity
            </h2>
          </div>

          <div className="space-y-4">
            {activityLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : recentActivity && recentActivity.length > 0 ? (
              recentActivity.slice(0, 5).map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent activity
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link to="/admin/accomplishments">
            <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-xs">Review Accomplishments</span>
            </Button>
          </Link>
          <Link to="/admin/forms">
            <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
              <ClipboardList className="w-5 h-5" />
              <span className="text-xs">Create Form</span>
            </Button>
          </Link>
          <Link to="/admin/assignments">
            <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
              <Users className="w-5 h-5" />
              <span className="text-xs">View Assignments</span>
            </Button>
          </Link>
          <Link to="/admin/analytics">
            <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-xs">View Reports</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
