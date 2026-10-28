/**
 * Form-related hooks — queries and mutations for EvaluationForm CRUD & lifecycle.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useOrganizationState } from '@/contexts/OrganizationContext';
import type { EvaluationForm, Question } from './types';

// Fetch all forms
export const useForms = (params?: { is_active?: boolean; is_published?: boolean; organization_id?: number }) => {
  const { activeOrganizationId } = useOrganizationState();
  const effectiveParams = { ...params, organization_id: params?.organization_id || activeOrganizationId || undefined };

  const queryString = Object.keys(effectiveParams).length > 0
    ? '?' + new URLSearchParams(
      Object.entries(effectiveParams)
        .filter(([, v]) => v !== undefined)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {})
    ).toString()
    : '';

  return useQuery({
    queryKey: ['forms', effectiveParams],
    queryFn: async () => {
      const response = await api.get(`/forms/${queryString}`);
      const data = await response.json() as { results: EvaluationForm[] } | EvaluationForm[];
      return Array.isArray(data) ? data : data.results || [];
    },
  });
};

// Fetch single form with questions
export const useForm = (id: number) => {
  return useQuery({
    queryKey: ['forms', id],
    queryFn: async () => {
      const response = await api.get(`/forms/${id}/`);
      return response.json() as Promise<EvaluationForm>;
    },
    enabled: !!id,
  });
};

// Fetch form questions
export const useFormQuestions = (formId: number) => {
  return useQuery({
    queryKey: ['forms', formId, 'questions'],
    queryFn: async () => {
      const response = await api.get(`/forms/${formId}/questions/`);
      return response.json() as Promise<Question[]>;
    },
    enabled: !!formId,
    staleTime: 0,
  });
};

// Fetch completed assignment count for a form (for edit warning)
export const useFormCompletedCount = (formId: number) => {
  return useQuery({
    queryKey: ['forms', formId, 'completed_count'],
    queryFn: async () => {
      const response = await api.get(`/forms/${formId}/completed_count/`);
      return response.json() as Promise<{ completed_count: number }>;
    },
    enabled: !!formId,
  });
};

// Activate form
export const useActivateForm = () => {
  const queryClient = useQueryClient();

  return useMutation<EvaluationForm, Error, number>({
    mutationFn: async (id: number) => {
      const response = await api.post(`/forms/${id}/activate/`);
      return response.json() as Promise<EvaluationForm>;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      queryClient.invalidateQueries({ queryKey: ['forms', id] });
    },
  });
};

// Deactivate form
export const useDeactivateForm = () => {
  const queryClient = useQueryClient();

  return useMutation<EvaluationForm, Error, number>({
    mutationFn: async (id: number) => {
      const response = await api.post(`/forms/${id}/deactivate/`);
      return response.json() as Promise<EvaluationForm>;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      queryClient.invalidateQueries({ queryKey: ['forms', id] });
    },
  });
};

// Release results
export const useReleaseResults = () => {
  const queryClient = useQueryClient();

  return useMutation<EvaluationForm, Error, number>({
    mutationFn: async (id: number) => {
      const response = await api.post(`/forms/${id}/release_results/`);
      return response.json() as Promise<EvaluationForm>;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      queryClient.invalidateQueries({ queryKey: ['forms', id] });
    },
  });
};

// Duplicate form
export const useDuplicateForm = () => {
  const queryClient = useQueryClient();

  return useMutation<EvaluationForm, Error, number>({
    mutationFn: async (id: number) => {
      const response = await api.post(`/forms/${id}/duplicate/`);
      return response.json() as Promise<EvaluationForm>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
    },
  });
};

// Create form
export const useCreateForm = () => {
  const queryClient = useQueryClient();

  return useMutation<EvaluationForm, Error, Partial<EvaluationForm>>({
    mutationFn: async (data: Partial<EvaluationForm>) => {
      const response = await api.post('/forms/', data);
      return response.json() as Promise<EvaluationForm>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
    },
  });
};

// Update form
export const useUpdateForm = () => {
  const queryClient = useQueryClient();

  return useMutation<EvaluationForm, Error, { id: number; data: Partial<EvaluationForm> }>({
    mutationFn: async ({ id, data }) => {
      const response = await api.patch(`/forms/${id}/`, data);
      return response.json() as Promise<EvaluationForm>;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      queryClient.invalidateQueries({ queryKey: ['forms', id] });
    },
  });
};

// Delete form
export const useDeleteForm = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async (id: number) => {
      await api.delete(`/forms/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
    },
  });
};

// Fetch form analytics
export const useFormAnalytics = (formId: number | undefined) => {
  return useQuery({
    queryKey: ['forms', formId, 'analytics'],
    queryFn: async () => {
      const response = await api.get(`/forms/${formId}/analytics/`);
      return response.json() as Promise<FormAnalytics>;
    },
    enabled: !!formId,
  });
};

export type FormAnalytics = {
  form_details: {
    title: string;
    description: string;
    created_at: string | null;
    end_date: string | null;
    is_active: boolean;
    results_released: boolean;
  };
  overall_score: number;
  total_evaluations: number;
  participation_rate: number;
  category_data: { name: string; score: number }[];
  trend_data: { month: string; score: number }[];
  top_performers: { rank: number; name: string; unit: string; score: number; trend: string }[];
  unit_breakdown: { unit: string; members: number; avgScore: number; completion: number }[];
  unit_data: { name: string; value: number; color: string }[];
  raw_data: {
    evaluator_name: string;
    evaluatee_name: string;
    question_text: string;
    score: number | null;
    text_response: string | null;
    submitted_at: string | null;
  }[];
};

export const useExportFormAnalytics = () => useMutation({
  mutationFn: async (formId: number) => {
    const response = await api.get(`/forms/${formId}/analytics_export/`);
    return response.json() as Promise<FormAnalytics>;
  },
});
