/**
 * Assignment-related hooks — queries and mutations for EvaluationAssignment.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fetchAllPages } from '@/lib/pagination';
import { useOrganizationState } from '@/contexts/OrganizationContext';
import type { EvaluationAssignment, EvaluationSubmitData, MyPerformanceData } from './types';

// Fetch all assignments
export const useAssignments = (params?: { status?: string; form_id?: number; organization_id?: number; evaluator_id?: number }) => {
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
    queryKey: ['assignments', effectiveParams],
    queryFn: () => fetchAllPages<EvaluationAssignment>(`/assignments/${queryString}`),
  });
};

// Fetch pending assignments for current user
export const useMyPendingEvaluations = (params?: { organization_id?: number }) => {
  const { activeOrganizationId } = useOrganizationState();
  const orgId = params?.organization_id || activeOrganizationId;

  return useQuery({
    queryKey: ['assignments', 'my_pending', orgId],
    queryFn: () => {
      const url = orgId ? `/assignments/my_pending/?organization_id=${orgId}` : '/assignments/my_pending/';
      return fetchAllPages<EvaluationAssignment>(url);
    },
  });
};

// Fetch my completed evaluations
export const useMyCompletedEvaluations = (params?: { organization_id?: number }) => {
  const { activeOrganizationId } = useOrganizationState();
  const orgId = params?.organization_id || activeOrganizationId;

  return useQuery({
    queryKey: ['assignments', 'my_completed', orgId],
    queryFn: () => {
      const url = orgId ? `/assignments/my_completed/?organization_id=${orgId}` : '/assignments/my_completed/';
      return fetchAllPages<EvaluationAssignment>(url);
    },
  });
};

// Fetch aggregated performance data
export const useMyPerformance = (formId?: number, organizationId?: number) => {
  const { activeOrganizationId } = useOrganizationState();
  const orgId = organizationId || activeOrganizationId;

  return useQuery({
    queryKey: ['assignments', 'my_performance', formId, orgId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (formId) params.append('form_id', String(formId));
      if (orgId) params.append('organization_id', String(orgId));

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get(`/assignments/my_performance/${queryString}`);
      return response.json() as Promise<MyPerformanceData>;
    },
  });
};

// Fetch single assignment
export const useAssignment = (id: number) => {
  return useQuery({
    queryKey: ['assignments', id],
    queryFn: async () => {
      const response = await api.get(`/assignments/${id}/`);
      return response.json() as Promise<EvaluationAssignment>;
    },
    enabled: !!id,
  });
};

// Submit evaluation
export const useSubmitEvaluation = () => {
  const queryClient = useQueryClient();

  return useMutation<EvaluationAssignment, Error, { id: number; data: EvaluationSubmitData }>({
    mutationFn: async ({ id, data }) => {
      const response = await api.post(`/assignments/${id}/submit/`, data);
      return response.json() as Promise<EvaluationAssignment>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['assignments', 'my_pending'] });
    },
  });
};
