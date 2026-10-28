/**
 * Portfolio API Hooks
 * 
 * Hooks for accomplishment management and verification
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useOrganizationState } from '@/contexts/OrganizationContext';

// Accomplishment types
export interface Accomplishment {
  id: number;
  user_id: number;
  user_name?: string;
  title: string;
  description: string;
  type: 'award' | 'certification' | 'project' | 'training' | 'presentation' | 'publication' | 'other';
  date_completed: string;
  proof_link?: string;
  status: 'Pending' | 'Verified' | 'Rejected';
  verified_by?: number;
  verified_by_name?: string;
  verified_at?: string;
  comments?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AccomplishmentCreate {
  title: string;
  description: string;
  type: Accomplishment['type'];
  date_completed: string;
  proof_link?: string;
}

export interface AccomplishmentVerify {
  status: 'Verified' | 'Rejected';
  comments?: string;
}

// ===== Fetch Hooks =====

export interface EvaluateeProfile {
  evaluatee_name: string;
  unit_name: string | null;
  position_name: string | null;
  accomplishments: Accomplishment[];
}

// Fetch all accomplishments
export const useAccomplishments = (params?: { status?: string; type?: string; user_id?: number; organization_id?: number }) => {
  const queryString = params
    ? '?' + new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined).reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {})
    ).toString()
    : '';

  return useQuery({
    queryKey: ['accomplishments', params],
    queryFn: async () => {
      const response = await api.get(`/accomplishments/${queryString}`);
      const data = await response.json() as { results: Accomplishment[] } | Accomplishment[];
      return Array.isArray(data) ? data : data.results || [];
    },
  });
};

// Fetch my accomplishments (current user)
export const useMyAccomplishments = () => {
  const { activeOrganizationId } = useOrganizationState();
  const queryString = activeOrganizationId ? `?organization_id=${activeOrganizationId}` : '';

  return useQuery({
    queryKey: ['accomplishments', 'my', activeOrganizationId],
    queryFn: async () => {
      const response = await api.get(`/accomplishments/my/${queryString}`);
      const data = await response.json() as { results: Accomplishment[] } | Accomplishment[];
      return Array.isArray(data) ? data : data.results || [];
    },
  });
};

// Fetch pending accomplishments (admin)
export const usePendingAccomplishments = (organizationId?: number) => {
  const { activeOrganizationId } = useOrganizationState();
  const effectiveOrgId = organizationId || activeOrganizationId;
  const queryString = effectiveOrgId ? `?organization_id=${effectiveOrgId}` : '';

  return useQuery({
    queryKey: ['accomplishments', 'pending', effectiveOrgId],
    queryFn: async () => {
      const response = await api.get(`/accomplishments/pending/${queryString}`);
      const data = await response.json() as { results: Accomplishment[] } | Accomplishment[];
      return Array.isArray(data) ? data : data.results || [];
    },
  });
};

// Fetch single accomplishment
export const useAccomplishment = (id: number) => {
  return useQuery({
    queryKey: ['accomplishments', id],
    queryFn: async () => {
      const response = await api.get(`/accomplishments/${id}/`);
      return response.json() as Promise<Accomplishment>;
    },
    enabled: !!id,
  });
};

// Filter by type
export const useAccomplishmentsByType = (type: Accomplishment['type']) => {
  return useQuery({
    queryKey: ['accomplishments', 'by_type', type],
    queryFn: async () => {
      const response = await api.get(`/accomplishments/by_type/?type=${type}`);
      const data = await response.json() as { results: Accomplishment[] } | Accomplishment[];
      return Array.isArray(data) ? data : data.results || [];
    },
    enabled: !!type,
  });
};

// Fetch an evaluatee's profile (unit, position, verified accomplishments) for an evaluation form
export const useEvaluateeProfile = (userId: number | undefined, organizationId: number | undefined) => {
  return useQuery({
    queryKey: ['evaluatee-profile', userId, organizationId],
    queryFn: async () => {
      const response = await api.get(
        `/accomplishments/evaluatee_profile/?user_id=${userId}&organization_id=${organizationId}`
      );
      return response.json() as Promise<EvaluateeProfile>;
    },
    enabled: !!userId && !!organizationId,
  });
};

// ===== Mutation Hooks =====

// Create accomplishment
export const useCreateAccomplishment = () => {
  const queryClient = useQueryClient();

  return useMutation<Accomplishment, Error, AccomplishmentCreate>({
    mutationFn: async (data: AccomplishmentCreate) => {
      const response = await api.post('/accomplishments/', data);
      return response.json() as Promise<Accomplishment>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accomplishments'] });
      queryClient.invalidateQueries({ queryKey: ['accomplishments', 'my'] });
    },
  });
};

// Update accomplishment
export const useUpdateAccomplishment = () => {
  const queryClient = useQueryClient();

  return useMutation<Accomplishment, Error, { id: number; data: Partial<AccomplishmentCreate> }>({
    mutationFn: async ({ id, data }) => {
      const response = await api.patch(`/accomplishments/${id}/`, data);
      return response.json() as Promise<Accomplishment>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accomplishments'] });
      queryClient.invalidateQueries({ queryKey: ['accomplishments', 'my'] });
      queryClient.invalidateQueries({ queryKey: ['accomplishments', variables.id] });
    },
  });
};

// Delete accomplishment
export const useDeleteAccomplishment = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async (id: number) => {
      await api.delete(`/accomplishments/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accomplishments'] });
      queryClient.invalidateQueries({ queryKey: ['accomplishments', 'my'] });
    },
  });
};

// Verify accomplishment (admin)
export const useVerifyAccomplishment = () => {
  const queryClient = useQueryClient();

  return useMutation<Accomplishment, Error, { id: number; data: AccomplishmentVerify }>({
    mutationFn: async ({ id, data }) => {
      const response = await api.post(`/accomplishments/${id}/verify/`, data);
      return response.json() as Promise<Accomplishment>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accomplishments'] });
      queryClient.invalidateQueries({ queryKey: ['accomplishments', 'pending'] });
    },
  });
};
