/**
 * Core organization hooks — CRUD, join, analytics, member management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useOrganizationState } from '@/contexts/OrganizationContext';
import type { Organization, UnitCompletionStats, AnalyticsSummary } from './types';

// Fetch unit completion stats
export const useUnitCompletionStats = (organizationId?: number) => {
  const { activeOrganizationId } = useOrganizationState();
  const effectiveOrgId = organizationId || activeOrganizationId;

  const queryString = effectiveOrgId ? `?organization_id=${effectiveOrgId}` : '';

  return useQuery({
    queryKey: ['organizations', 'unit-completion', organizationId],
    queryFn: async () => {
      const response = await api.get(`/organizations/unit_completion_stats/${queryString}`);
      return response.json() as Promise<UnitCompletionStats[]>;
    },
  });
};

// Fetch analytics summary
export const useAnalyticsSummary = (organizationId?: number) => {
  const { activeOrganizationId } = useOrganizationState();
  const effectiveOrgId = organizationId || activeOrganizationId;

  const queryString = effectiveOrgId ? `?organization_id=${effectiveOrgId}` : '';

  return useQuery({
    queryKey: ['organizations', 'analytics', organizationId],
    queryFn: async () => {
      const response = await api.get(`/organizations/analytics_summary/${queryString}`);
      return response.json() as Promise<AnalyticsSummary>;
    },
  });
};

// Fetch single organization by ID
export const useOrganization = (organizationId?: number) => {
  const { activeOrganizationId } = useOrganizationState();
  const effectiveOrgId = organizationId || activeOrganizationId;

  return useQuery({
    queryKey: ['organizations', effectiveOrgId],
    queryFn: async () => {
      const response = await api.get(`/organizations/${effectiveOrgId}/`);
      return response.json() as Promise<Organization>;
    },
    enabled: !!effectiveOrgId,
  });
};

// Create new organization
export const useCreateOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation<Response, Error, { name: string; code: string; description: string; period_year_start: string; period_year_end?: string }>({
    mutationFn: async (data) => {
      const result = await api.post('/organizations/', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'current'] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
};

// Update Organization
export const useUpdateOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation<Organization, Error, { id: number; data: Partial<{ name: string; code: string; description: string; email: string }> }>({
    mutationFn: async ({ id, data }) => {
      const response = await api.patch(`/organizations/${id}/`, data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['organizations', data.id], data);
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'current'] });
    },
  });
};

// Delete Current Organization
export const useDeleteOrganization = () => {
  const queryClient = useQueryClient();
  const { clearOrganizationState } = useOrganizationState();

  return useMutation<{ message: string }, Error, { id: number; data: { code: string; password: string } }>({
    mutationFn: async ({ id, data }) => {
      const response = await api.post(`/organizations/${id}/delete-organization/`, data);
      return response.json();
    },
    onSuccess: () => {
      clearOrganizationState();
      queryClient.invalidateQueries({ queryKey: ['users', 'current'] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
};

// Join an organization via code
export const useJoinOrganization = () => {
  return useMutation<{ message: string }, Error, { code: string }>({
    mutationFn: async (data) => {
      const response = await api.post('/organizations/join_by_code/', data);
      return response.json() as Promise<{ message: string }>;
    }
  });
};

// Remove a member from the organization
export const useRemoveMember = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useOrganizationState();

  return useMutation<{ message: string }, Error, { user_id: number }>({
    mutationFn: async (data) => {
      const response = await api.post(`/organizations/${activeOrganizationId}/remove-member/`, data);
      return response.json() as Promise<{ message: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'analytics'] });
    }
  });
};

// Set a member's role (Admin / Member) within the active organization
export const useSetMemberRole = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useOrganizationState();

  return useMutation<{ message: string }, Error, { user_id: number; role: 'Admin' | 'Member' }>({
    mutationFn: async (data) => {
      const response = await api.post(`/organizations/${activeOrganizationId}/set-member-role/`, data);
      return response.json() as Promise<{ message: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });
};
