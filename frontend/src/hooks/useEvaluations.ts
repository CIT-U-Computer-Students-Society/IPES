/**
 * Evaluations API Hooks — Barrel re-export.
 *
 * All hooks and types are split into domain-specific modules under
 * ``./evaluations/``.
 */

// Types
export type {
  Question,
  EvaluationForm,
  Response,
  EvaluationAssignment,
  EvaluationSubmitData,
  AssignmentRule,
  AssignmentRuleCreateData,
  MyPerformanceData,
} from './evaluations/types';

// Form hooks
export {
  useForms,
  useForm,
  useFormQuestions,
  useFormCompletedCount,
  useActivateForm,
  useDeactivateForm,
  useReleaseResults,
  useDuplicateForm,
  useCreateForm,
  useUpdateForm,
  useDeleteForm,
  useFormAnalytics,
  useExportFormAnalytics,
} from './evaluations/useFormHooks';

// Assignment rule hooks
export {
  useFormRules,
  useCreateRule,
  useDeleteRule,
  useGenerateAssignments,
} from './evaluations/useRuleHooks';

// Question hooks
export {
  useCreateQuestions,
  useUpdateQuestion,
  useDeleteQuestion,
} from './evaluations/useQuestionHooks';

// Assignment hooks
export {
  useAssignments,
  useMyPendingEvaluations,
  useMyCompletedEvaluations,
  useMyPerformance,
  useAssignment,
  useSubmitEvaluation,
} from './evaluations/useAssignmentHooks';

// Response hooks
export {
  useAssignmentResponses,
  useSaveDraftResponses,
} from './evaluations/useResponseHooks';
