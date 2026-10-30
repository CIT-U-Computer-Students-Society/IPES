/**
 * Evaluation domain types.
 */

// Evaluation Form types
export interface Question {
  id: number;
  form_id: number;
  text: string;
  input_type: 'rating' | 'text' | 'dropdown' | 'checkbox' | 'number' | 'textarea';
  order: number;
  weight: number;
  is_required?: boolean;
  min_value?: number;
  max_value?: number;
  options?: string[]; // For dropdown/checkbox types
}

export interface EvaluationForm {
  id: number;
  organization_id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  created_by: number;
  is_active: boolean;
  is_deleted: boolean;
  results_released: boolean;
  questions?: Question[];
  created_at: string;
  updated_at: string;
}

// Evaluation Assignment types
export interface Response {
  id: number;
  assignment_id: number;
  question_id: number;
  score_value?: number;
  text?: string;
}

export interface EvaluationAssignment {
  id: number;
  evaluator_id: number;
  evaluator_email?: string;
  evaluator_name?: string;
  evaluatee_id: number;
  evaluatee_email?: string;
  evaluatee_name?: string;
  form_id: number;
  form_title?: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  submitted_at?: string;
  total_score?: number;
  responses?: Response[];
  due_date?: string;
}

// Submit evaluation data
export interface EvaluationSubmitData {
  responses: {
    question_id: number;
    score_value?: number;
    text?: string;
  }[];
}

// Assignment Rule types
export interface AssignmentRule {
  id: number;
  form_id: number;
  evaluator_unit: number | null;
  evaluator_unit_name: string | null;
  evaluator_position: number | null;
  evaluator_position_name: string | null;
  evaluatee_unit: number | null;
  evaluatee_unit_name: string | null;
  evaluatee_position: number | null;
  evaluatee_position_name: string | null;
  exclude_self: boolean;
}

export interface AssignmentRuleCreateData {
  form_id: number;
  evaluator_unit?: number | null;
  evaluator_position?: number | null;
  evaluatee_unit?: number | null;
  evaluatee_position?: number | null;
  exclude_self?: boolean;
}

export type MyPerformanceData = {
  overallScore: number;
  overallMaxScore: number;
  categoryScores: { name: string; score: number; maxScore: number }[];
  feedbackComments: { id: number; text: string; type: string }[];
  evaluationHistory: { period: string; score: number; evaluators: number }[];
  available_forms: { id: number; title: string }[];
  evaluatorCount: number;
  selectedFormId: number | null;
};
