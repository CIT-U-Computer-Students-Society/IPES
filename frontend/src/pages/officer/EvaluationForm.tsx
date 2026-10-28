import { formatApiError } from "@/lib/api";
import { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, User, Trophy, Save, Send, Clock, ChevronRight, AlertCircle, Building2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast as sonnerToast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  useAssignment,
  useForm,
  useFormQuestions,
  useAssignmentResponses,
  useSubmitEvaluation,
  useSaveDraftResponses,
  type Question
} from "@/hooks/useEvaluations";
import { useEvaluateeProfile } from "@/hooks/usePortfolio";
import { useOrganizationState } from "@/contexts/OrganizationContext";

// Generate rating label ranges dynamically based on max value
const getRatingContext = (min: number | undefined, max: number | undefined) => {
  const minVal = min ?? 0;
  const maxVal = max ?? 10;
  const range = maxVal - minVal;

  if (range <= 5) {
    return Array.from({ length: range + 1 }).map((_, i) => ({
      value: String(minVal + i),
      label: i === 0 ? "Poor" : (i === range ? "Excellent" : "")
    }));
  }

  return Array.from({ length: range + 1 }).map((_, i) => ({
    value: String(minVal + i),
    label: ""
  }));
};

const EvaluationForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin/my-' : '/member/';
  const { id } = useParams();
  const toast = ({ title, description, variant }: { title: string; description?: string; variant?: string }) => {
    if (variant === "destructive") {
      sonnerToast.error(title, { description });
    } else {
      sonnerToast.success(title, { description });
    }
  };
  const { activeOrganizationId } = useOrganizationState();

  // API Hooks
  const { data: assignment, isLoading: aLoading, error: aError } = useAssignment(Number(id));
  const { data: form } = useForm(assignment?.form_id || 0);
  const { data: questions, isLoading: qLoading } = useFormQuestions(assignment?.form_id || 0);
  const { data: responses, isLoading: rLoading } = useAssignmentResponses(Number(id));

  const isSelfEval = assignment ? assignment.evaluatee_id === assignment.evaluator_id : false;
  const { data: evaluateeProfile, isLoading: profileLoading } = useEvaluateeProfile(
    assignment && !isSelfEval ? assignment.evaluatee_id : undefined,
    activeOrganizationId ?? undefined
  );

  const submitMutation = useSubmitEvaluation();
  const draftMutation = useSaveDraftResponses();

  const [currentSection, setCurrentSection] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [textAnswers, setTextAnswers] = useState<Record<number, string>>({});
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [initializedAssignmentId, setInitializedAssignmentId] = useState<string | null>(null);

  // Sync incoming responses initially
  if (id && responses && questions && initializedAssignmentId !== id) {
      const initialAnswers: Record<number, string> = {};
      const initialTexts: Record<number, string> = {};

      responses.forEach((r) => {
        if (r.score_value !== null && r.score_value !== undefined) {
          initialAnswers[r.question_id] = String(r.score_value);
        }
        if (r.text) {
          initialTexts[r.question_id] = r.text;
        }
      });
      setAnswers(initialAnswers);
      setTextAnswers(initialTexts);
      setInitializedAssignmentId(id);
  }

  // Loading and Error States
  if (aLoading || qLoading || rLoading || !assignment || !questions) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center text-muted-foreground animate-pulse">
        Loading evaluation data...
      </div>
    );
  }

  if (aError) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center text-destructive">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold">Error</h2>
        <p>Could not load this evaluation. It may not exist or you don't have access.</p>
        <Button onClick={() => navigate(`${basePath}evaluations`)} className="mt-6" variant="outline">
          Return to My Evaluations
        </Button>
      </div>
    );
  }

  const isCompleted = assignment.status === 'Completed';

  const sections = [
    { name: "Evaluatee Info", questions: [] as Question[] },
    { name: "Evaluation Questions", questions: questions },
  ];

  const answeredCount = Object.keys(answers).length +
    Object.keys(textAnswers).filter(id => textAnswers[Number(id)]?.trim() !== "").length;
  const totalQuestions = questions.length;
  const progressPercentage = totalQuestions === 0 ? 0 : Math.min(100, (answeredCount / totalQuestions) * 100);

  const handleRatingChange = (questionId: number, value: string) => {
    if (isCompleted) return;
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleTextChange = (questionId: number, value: string) => {
    if (isCompleted) return;
    setTextAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const formatPayload = () => {
    return questions.map((q) => {
      const resp: { question_id: number; score_value?: number; text?: string } = { question_id: q.id };
      if (answers[q.id]) {
        resp.score_value = Number(answers[q.id]);
      }
      if (textAnswers[q.id]) {
        resp.text = textAnswers[q.id];
      }
      return resp;
    }).filter(r => r.score_value !== undefined || r.text !== undefined);
  };

  const handleSaveDraft = async () => {
    try {
      await draftMutation.mutateAsync({
        assignment_id: Number(id),
        responses: formatPayload()
      });
      toast({
        title: "Draft Saved",
        description: "Your recent answers have been saved securely.",
      });
    } catch (err) {
      toast({
        title: "Error Saving Draft",
        description: formatApiError(err),
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async () => {
    // Front-end requirement checks before hitting the API
    const missingRequired = questions.find((q) => {
      if (q.is_required) {
        const hasScore = answers[q.id] !== undefined;
        const hasText = textAnswers[q.id] && textAnswers[q.id].trim() !== "";

        if (q.input_type === 'rating' || q.input_type === 'number') {
          return !hasScore;
        }
        if (q.input_type === 'text' || q.input_type === 'textarea') {
          return !hasText;
        }
      }
      return false;
    });

    if (missingRequired) {
      setShowSubmitDialog(false);
      toast({
        title: "Missing Required Fields",
        description: `Please answer question #${missingRequired.order}: "${missingRequired.text}"`,
        variant: "destructive"
      });
      return;
    }

    try {
      await submitMutation.mutateAsync({
        id: Number(id),
        data: { responses: formatPayload() }
      });

      toast({
        title: "Evaluation Submitted",
        description: "Thank you for completing this peer evaluation.",
      });
      setShowSubmitDialog(false);
      navigate(`${basePath}evaluations`);
    } catch (err) {
      toast({
        title: "Submission Error",
        description: formatApiError(err),
        variant: "destructive"
      });
    }
  };

  const renderSection = () => {
    if (currentSection === 0) {
      // Self-evaluation: simplified view
      if (isSelfEval) {
        return (
          <div className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-5 flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {assignment.evaluatee_name || `User #${assignment.evaluatee_id}`}
                </h3>
                <Badge variant="secondary" className="mt-1">Self-Evaluation</Badge>
                <p className="text-muted-foreground mt-2 text-sm">
                  You are evaluating <strong>yourself</strong> for the <strong>{assignment.form_title}</strong> module.
                </p>
              </div>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm text-foreground">
                <strong>Reminder:</strong> Be objective and honest when rating your own performance.
              </p>
            </div>
          </div>
        );
      }

      // Peer evaluation: rich evaluatee info
      return (
        <div className="space-y-5">
          {/* Identity card */}
          <div className="bg-muted/50 rounded-lg p-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-7 h-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                {profileLoading ? (
                  <>
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold text-foreground">
                      {evaluateeProfile?.evaluatee_name || assignment.evaluatee_name || `User #${assignment.evaluatee_id}`}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {evaluateeProfile?.unit_name && (
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Building2 className="w-3.5 h-3.5" />
                          {evaluateeProfile.unit_name}
                        </span>
                      )}
                      {evaluateeProfile?.position_name && (
                        <Badge variant="outline" className="text-xs">
                          {evaluateeProfile.position_name}
                        </Badge>
                      )}
                    </div>
                  </>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  You are evaluating this peer for the <strong>{assignment.form_title}</strong> module.
                </p>
              </div>
            </div>
          </div>

          {/* Verified Accomplishments */}
          <div className="rounded-lg border border-border">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Trophy className="w-4 h-4 text-primary" />
              <h4 className="font-medium text-foreground text-sm">Accomplishments</h4>
            </div>
            <div className="divide-y divide-border max-h-64 overflow-y-auto">
              {profileLoading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              ) : !evaluateeProfile?.accomplishments?.length ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  <Star className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  No accomplishments yet
                </div>
              ) : (
                evaluateeProfile.accomplishments.map((acc) => (
                  <div key={acc.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{acc.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{acc.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge variant="secondary" className="text-xs capitalize">{acc.type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(acc.date_completed).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Reminder */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <p className="text-sm text-foreground">
              <strong>Reminder:</strong> Please evaluate objectively based on the officer's performance.
              Your feedback helps improve our organization.
            </p>
          </div>
        </div>
      );
    }


    const sectionQuestions = sections[currentSection].questions;
    return (
      <div className="space-y-8">
        {sectionQuestions.map((q) => (
          <div key={q.id} className="space-y-4">
            <p className="font-medium text-foreground">
              {q.order}. {q.text} {q.is_required && <span className="text-destructive">*</span>}
            </p>

            {q.input_type === 'rating' || q.input_type === 'number' ? (
              <RadioGroup
                value={answers[q.id] || ""}
                onValueChange={(value) => handleRatingChange(q.id, value)}
                className="flex flex-wrap gap-2"
                disabled={isCompleted}
              >
                {getRatingContext(q.min_value, q.max_value).map((rating) => (
                  <div key={rating.value} className="flex-1 min-w-[60px]">
                    <RadioGroupItem
                      value={rating.value}
                      id={`q${q.id}-${rating.value}`}
                      className="peer sr-only"
                      disabled={isCompleted}
                    />
                    <Label
                      htmlFor={`q${q.id}-${rating.value}`}
                      className={`flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 transition-all ${isCompleted ? 'opacity-70 cursor-not-allowed' : 'hover:bg-accent/50 hover:border-primary/50 cursor-pointer'}`}
                    >
                      <span className="text-lg font-semibold">{rating.value}</span>
                      {rating.label && <span className="text-xs text-muted-foreground mt-1">{rating.label}</span>}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <Textarea
                value={textAnswers[q.id] || ""}
                onChange={(e) => handleTextChange(q.id, e.target.value)}
                placeholder="Elaborate here..."
                className="min-h-[100px]"
                disabled={isCompleted}
              />
            )}

          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`${basePath}evaluations`)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to evaluations
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">{assignment.form_title}</h1>
          {isCompleted && (
            <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded border border-green-200 uppercase tracking-wider font-bold">Completed</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
          <Clock className="w-4 h-4" />
          {form?.end_date ? `Due ${new Date(form.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : "No specific deadline"}
        </div>
      </div>

      {/* Progress */}
      <div className="bg-card rounded-xl border border-border p-4 mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Completion</span>
          <span className="font-medium text-foreground">{answeredCount}/{totalQuestions} questions</span>
        </div>
        <Progress value={progressPercentage} className="h-2" indicatorClassName={progressPercentage < 50 ? 'bg-warning' : progressPercentage >= 80 ? 'bg-success' : 'bg-primary'} />

        {/* Section tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto pb-1">
          {sections.map((section, index) => (
            <button
              key={index}
              onClick={() => setCurrentSection(index)}
              className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${currentSection === index
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
            >
              {section.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <h2 className="text-lg font-medium text-foreground mb-6">
          {sections[currentSection].name}
        </h2>
        {renderSection()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
          disabled={currentSection === 0}
        >
          Previous
        </Button>

        <div className="flex gap-2">
          {!isCompleted && (
            <Button variant="outline" onClick={handleSaveDraft} disabled={draftMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {draftMutation.isPending ? "Saving..." : "Save Draft"}
            </Button>
          )}

          {currentSection === sections.length - 1 ? (
            !isCompleted && (
              <Button onClick={() => setShowSubmitDialog(true)} disabled={submitMutation.isPending}>
                <Send className="w-4 h-4 mr-2" />
                Submit
              </Button>
            )
          ) : (
            <Button onClick={() => setCurrentSection(currentSection + 1)}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Submit confirmation dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Evaluation?</DialogTitle>
            <DialogDescription>
              You've answered {answeredCount} out of {totalQuestions} questions.
              Once submitted, you won't be able to edit your responses.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              Confirm Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EvaluationForm;
