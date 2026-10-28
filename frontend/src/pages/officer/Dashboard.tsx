import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Calendar,
  Trophy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  useMyPendingEvaluations,
  useMyCompletedEvaluations,
  useMyPerformance,
  type EvaluationAssignment
} from "@/hooks/useEvaluations";

import { useMyAccomplishments } from "@/hooks/usePortfolio";
import { useCurrentUser } from "@/hooks/useUsers";
import type { Accomplishment } from "@/hooks/usePortfolio";
import type { User } from "@/hooks/useUsers";

// Stats card component
const StatCard = ({
  label,
  value,
  suffix,
  icon: Icon,
  color,
  isLoading,
  badge
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: React.ElementType;
  color: string;
  isLoading?: boolean;
  badge?: string;
}) => {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="w-10 h-10 rounded-lg" />
            {badge && <Skeleton className="h-5 w-20" />}
          </div>
          <div className="mt-4">
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-4 w-28" />
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
          {badge && (
            <span className="text-xs font-medium text-warning bg-warning/10 px-2 py-1 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <div className="mt-4">
          <p className="text-3xl font-bold text-foreground">
            {value}{suffix && <span className="text-lg font-normal text-muted-foreground">{suffix}</span>}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
};

// Pending evaluation card
const PendingEvaluationCard = ({ evaluation, basePath }: { evaluation: EvaluationAssignment, basePath: string }) => {
  const [now] = useState(Date.now);
  const isUrgent = evaluation.due_date && new Date(evaluation.due_date) <= new Date(now + 3 * 24 * 60 * 60 * 1000);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="evaluation-card flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium text-foreground truncate">
            {evaluation.form_title || `Evaluation #${evaluation.id}`}
          </h3>
          {isUrgent && (
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="outline">{evaluation.form_id ? "Evaluation" : "Form"}</Badge>
          {evaluation.due_date && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Due {formatDate(evaluation.due_date)}
            </span>
          )}
        </div>
      </div>
      <Link to={`${basePath}evaluations/${evaluation.id}`}>
        <Button size="sm">
          {evaluation.status === "In Progress" ? "Continue" : "Start"}
        </Button>
      </Link>

    </div>
  );
};

// Notification item
const NotificationItem = ({
  message,
  time,
  type
}: {
  message: string;
  time: string;
  type: 'success' | 'warning' | 'info'
}) => (
  <div className="flex gap-3">
    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${type === 'success' ? 'bg-success' :
      type === 'warning' ? 'bg-warning' :
        'bg-primary'
      }`} />
    <div>
      <p className="text-sm text-foreground">{message}</p>
      <p className="text-xs text-muted-foreground mt-1">{time}</p>
    </div>
  </div>
);

// Calculate days until deadline
const getDaysUntilDeadline = (dueDate: string | undefined) => {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
};

const OfficerDashboard = () => {
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin/my-' : '/member/';

  // Fetch data from API
  const { data: currentUser } = useCurrentUser();
  const { data: pendingEvaluations, isLoading: pendingLoading } = useMyPendingEvaluations();
  const { data: completedEvaluations, isLoading: completedLoading } = useMyCompletedEvaluations();
  const { data: accomplishments, isLoading: accomplishmentsLoading } = useMyAccomplishments();
  const { data: performanceData, isLoading: performanceLoading } = useMyPerformance();

  // Calculate stats
  const pendingCount = pendingEvaluations?.length || 0;
  const completedCount = completedEvaluations?.length || 0;
  const verifiedAccomplishments = accomplishments?.filter(a => a.status === 'Verified').length || 0;
  const totalAccomplishments = accomplishments?.length || 0;

  // Calculate average rating from received evaluations
  const averageRating = performanceData?.overallScore || 0;

  // Get days until nearest deadline
  const nearestDeadline = pendingEvaluations?.reduce((nearest, item) => {
    if (!item.due_date) return nearest;
    const itemDate = new Date(item.due_date).getTime();
    const nearestDate = nearest ? new Date(nearest).getTime() : Infinity;
    return itemDate < nearestDate ? item.due_date : nearest;
  }, undefined as string | undefined);

  const daysUntilDeadline = getDaysUntilDeadline(nearestDeadline);

  // Generate notifications from data
  const notifications = [
    ...(verifiedAccomplishments > 0 ? [{
      id: 1,
      message: `${verifiedAccomplishments} accomplishment${verifiedAccomplishments > 1 ? 's' : ''} verified`,
      time: "Recent",
      type: "success" as const
    }] : []),
    ...(pendingCount > 0 ? [{
      id: 2,
      message: `${pendingCount} evaluation${pendingCount > 1 ? 's' : ''} pending`,
      time: "Action needed",
      type: "warning" as const
    }] : []),
  ];

  const isLoading = pendingLoading || completedLoading || accomplishmentsLoading || performanceLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Good{new Date().getHours() < 12 ? ' morning' : new Date().getHours() < 18 ? ' afternoon' : ' evening'}, {currentUser?.first_name || 'Officer'}!
          </h1>
          <p className="text-muted-foreground mt-1">Here's an overview of your evaluation tasks.</p>
        </div>
        <Link to={`${basePath}evaluations`}>
          <Button>
            Start Evaluating
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pending Evaluations"
          value={pendingCount}
          icon={ClipboardList}
          color="warning"
          isLoading={pendingLoading}
          badge={pendingCount > 0 ? "Action needed" : undefined}
        />
        <StatCard
          label="Completed This Term"
          value={completedCount}
          icon={CheckCircle2}
          color="success"
          isLoading={completedLoading}
        />
        <StatCard
          label="Average Rating"
          value={averageRating}
          suffix={`/${performanceData?.overallMaxScore || 5}`}
          icon={TrendingUp}
          color="primary"
          isLoading={performanceLoading}
        />
        <StatCard
          label={daysUntilDeadline !== null ? "Days Until Deadline" : "No Deadlines"}
          value={daysUntilDeadline !== null ? daysUntilDeadline : "—"}
          icon={Calendar}
          color="accent"
          isLoading={pendingLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending evaluations */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-foreground">Pending Evaluations</h2>
            <Link to={`${basePath}evaluations`} className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            ) : pendingEvaluations && pendingEvaluations.length > 0 ? (
              pendingEvaluations.slice(0, 5).map((evaluation) => (
                <PendingEvaluationCard key={evaluation.id} evaluation={evaluation} basePath={basePath} />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-success" />
                <p>No pending evaluations!</p>
                <p className="text-sm">You're all caught up.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Progress card */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="font-semibold text-foreground mb-4">Term Progress</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Evaluations Completed</span>
                  <span className="font-medium text-foreground">
                    {completedCount}/{completedCount + pendingCount}
                  </span>
                </div>
                <Progress
                  value={completedCount}
                  max={completedCount + pendingCount || 1}
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Accomplishments Verified</span>
                  <span className="font-medium text-foreground">
                    {verifiedAccomplishments}/{totalAccomplishments}
                  </span>
                </div>
                <Progress
                  value={verifiedAccomplishments}
                  max={totalAccomplishments || 1}
                  className="h-2"
                />
              </div>
            </div>
          </div>

          {/* Recent notifications */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="font-semibold text-foreground mb-4">Notifications</h2>
            <div className="space-y-4">
              {isLoading ? (
                <>
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </>
              ) : notifications.length > 0 ? (
                notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    message={notification.message}
                    time={notification.time}
                    type={notification.type}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No new notifications
                </p>
              )}
            </div>
          </div>

          {/* Accomplishments highlight */}
          {verifiedAccomplishments > 0 && (
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{verifiedAccomplishments}</p>
                  <p className="text-sm text-muted-foreground">Accomplishments Verified</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfficerDashboard;
