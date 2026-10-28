/**
 * Join request and membership hooks.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Membership } from '../useUsers';
import type { JoinRequest } from './types';
import { api } from '@/lib/api';
import { useOrganizationState } from '@/contexts/OrganizationContext';

// Fetch pending join requests for an organization
export const usePendingJoinRequests = (organizationId?: number) => {
  const { activeOrganizationId } = useOrganizationState();
  const effectiveOrgId = organizationId || activeOrganizationId;

  return useQuery({
    queryKey: ['join-requests', 'pending', effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      const response = await api.get(`/join-requests/?organization_id=${effectiveOrgId}&status=Pending`);
      const data = await response.json() as JoinRequest[] | { results: JoinRequest[] };
      return Array.isArray(data) ? data : data.results || [];
    },
    enabled: !!effectiveOrgId
  });
};

// Approve a join request
export const useApproveJoinRequest = () => {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, { id: number; unit_id: number; position_id: number; role?: string }>({
    mutationFn: async ({ id, ...data }) => {
      const response = await api.post(`/join-requests/${id}/approve/`, data);
      return response.json() as Promise<{ message: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['join-requests'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'analytics'] });
    }
  });
};

// Reject a join request
export const useRejectJoinRequest = () => {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, { id: number }>({
    mutationFn: async ({ id }) => {
      const response = await api.post(`/join-requests/${id}/reject/`);
      return response.json() as Promise<{ message: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['join-requests'] });
    }
  });
};

// Update a membership record
export const useUpdateMembership = () => {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, { id: number; data: Partial<Membership> }>({
    mutationFn: async ({ id, data }) => {
      const response = await api.patch(`/memberships/${id}/`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'analytics'] });
    }
  });
};

// Create a membership record
export const useCreateMembership = () => {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, { user_id: number; unit_id: number; position_id: number; role?: string }>({
    mutationFn: async (data) => {
      const response = await api.post(`/memberships/`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'analytics'] });
    }
  });
};
