import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Clock, CheckCircle2, AlertCircle, Search, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useMyPendingEvaluations, useAssignments, type EvaluationAssignment } from "@/hooks/useEvaluations";
import { useCurrentUser } from "@/hooks/useUsers";
// Helper to format status
const getStatusInfo = (status: string, isClosed: boolean = false) => {
  if (isClosed && status.toLowerCase() !== "completed" && status.toLowerCase() !== "submitted") {
    return { label: "Closed", className: "bg-gray-100 text-gray-800" };
  }
  switch (status.toLowerCase()) {
    case "pending":
      return { label: "Not Started", className: "bg-yellow-100 text-yellow-800" };
    case "in progress":
      return { label: "In Progress", className: "bg-blue-100 text-blue-800" };
    case "completed":
      return { label: "Completed", className: "bg-green-100 text-green-800" };
    case "submitted":
      return { label: "Submitted", className: "bg-green-100 text-green-800" };
    case "reviewed":
      return { label: "Reviewed", className: "bg-purple-100 text-purple-800" };
    default:
      return { label: status, className: "bg-gray-100 text-gray-800" };
  }
};

// Helper to check if evaluation is urgent (due within 3 days)
const isUrgent = (dueDate: string) => {
  const due = new Date(dueDate);
  const now = new Date();
  const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff <= 3 && diff >= 0;
};

// Format date for display
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Evaluation card component
const EvaluationCard = ({ evaluation, basePath }: { evaluation: EvaluationAssignment, basePath: string }) => {
  const isClosed = Boolean(
    evaluation.is_closed ?? (
      evaluation.form_is_active === false || evaluation.form_results_released === true
    )
  );
  const statusInfo = getStatusInfo(evaluation.status, isClosed);
  const urgent = evaluation.due_date ? isUrgent(evaluation.due_date) : false;
  const isSelfEvaluation = evaluation.evaluatee_id === evaluation.evaluator_id;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-foreground truncate">
                {evaluation.form_title || `Evaluation Form #${evaluation.form_id}`}
              </h3>
              {urgent && !isClosed && (
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Badge className={statusInfo.className}>
                {statusInfo.label}
              </Badge>
              <Badge variant="outline">
                {evaluation.form_id ? "Evaluation" : "Form"}
              </Badge>
              {evaluation.due_date && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Due {formatDate(evaluation.due_date)}
                </span>
              )}
            </div>
            {(!isSelfEvaluation && (evaluation.evaluatee_name || evaluation.evaluatee_email)) && (
              <p className="text-sm text-muted-foreground mt-2">
                Evaluating: <span className="text-foreground">{evaluation.evaluatee_name || evaluation.evaluatee_email}</span>
              </p>
            )}
            {isSelfEvaluation && (
              <p className="text-sm text-muted-foreground mt-2">
                <Badge variant="secondary">Self-Evaluation</Badge>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {evaluation.status === "Completed" ? (
              <Button variant="outline" size="sm" disabled>
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Submitted
              </Button>
            ) : isClosed ? (
              <Button variant="outline" size="sm" disabled>
                Closed
              </Button>
            ) : (
              <Link to={`${basePath}evaluations/${evaluation.id}`}>
                <Button size="sm">
                  {evaluation.status === "In Progress" ? "Continue" : "Start"}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Loading skeleton for evaluation card
const EvaluationCardSkeleton = () => (
  <Card>
    <CardContent className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-32 mt-2" />
        </div>
        <Skeleton className="h-9 w-20" />
      </div>
    </CardContent>
  </Card>
);

const OfficerEvaluations = () => {
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin/my-' : '/member/';
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch data from API
  const { data: currentUser } = useCurrentUser();
  const { data: pendingAssignments, isLoading: pendingLoading } = useMyPendingEvaluations();
  const { data: allAssignments, isLoading: allLoading } = useAssignments({
    evaluator_id: currentUser?.id
  });

  // Combine and filter assignments
  const getFilteredEvaluations = (status: string) => {
    let evaluations: EvaluationAssignment[] = [];

    if (status === "pending") {
      evaluations = pendingAssignments?.filter(a => a.status === "Pending") || [];
    } else if (status === "inprogress") {
      evaluations = pendingAssignments?.filter(a => a.status === "In Progress") || [];
    } else if (status === "completed") {
      evaluations = allAssignments?.filter(a => a.status === "Completed") || [];
    } else {
      evaluations = allAssignments || [];
    }

    // Apply search filter
    if (searchQuery) {
      evaluations = evaluations.filter(e =>
        (e.form_title?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
        (e.evaluatee_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
        (e.evaluatee_email?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
      );
    }

    return evaluations;
  };

  const pendingCount = pendingAssignments?.filter(a => a.status === "Pending").length || 0;
  const inProgressCount = pendingAssignments?.filter(a => a.status === "In Progress").length || 0;
  const completedCount = allAssignments?.filter(a => a.status === "Completed").length || 0;
  const totalCount = allAssignments?.length || 0;

  const renderEvaluationsList = (evaluations: EvaluationAssignment[], isLoading: boolean) => (
    <div className="space-y-3">
      {isLoading ? (
        <>
          <EvaluationCardSkeleton />
          <EvaluationCardSkeleton />
          <EvaluationCardSkeleton />
        </>
      ) : evaluations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No evaluations found
        </div>
      ) : (
        evaluations.map((evaluation) => (
          <EvaluationCard key={evaluation.id} evaluation={evaluation} basePath={basePath} />
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">My Evaluations</h1>
        <p className="page-description">Complete your assigned evaluation forms</p>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search evaluations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="pending" className="flex-1 sm:flex-none">
            Pending ({pendingCount})
          </TabsTrigger>
          <TabsTrigger value="inprogress" className="flex-1 sm:flex-none">
            In Progress ({inProgressCount})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1 sm:flex-none">
            Completed ({completedCount})
          </TabsTrigger>
          <TabsTrigger value="all" className="flex-1 sm:flex-none">
            All ({totalCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {renderEvaluationsList(getFilteredEvaluations("pending"), pendingLoading)}
        </TabsContent>

        <TabsContent value="inprogress" className="mt-4">
          {renderEvaluationsList(getFilteredEvaluations("inprogress"), pendingLoading)}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {renderEvaluationsList(getFilteredEvaluations("completed"), allLoading)}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {renderEvaluationsList(getFilteredEvaluations("all"), allLoading)}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OfficerEvaluations;
