/**
 * Position type hooks — queries and mutations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PositionType } from './types';
import { api } from '@/lib/api';
import { useOrganizationState } from '@/contexts/OrganizationContext';

export const usePositionTypes = (organizationId?: number) => {
  const { activeOrganizationId } = useOrganizationState();
  const effectiveOrgId = organizationId || activeOrganizationId;

  return useQuery({
    queryKey: ['positions', effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      const response = await api.get(`/positions/?organization_id=${effectiveOrgId}`);
      const data = await response.json() as PositionType[] | { results: PositionType[] };
      return Array.isArray(data) ? data : data.results || [];
    },
    enabled: !!effectiveOrgId
  });
};

export const useCreatePositionType = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useOrganizationState();

  return useMutation<PositionType, Error, { name: string; rank: number }>({
    mutationFn: async (data) => {
      const payload = { ...data, organization_id: activeOrganizationId };
      const response = await api.post('/positions/', payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', activeOrganizationId] });
    },
  });
};

export const useDeletePositionType = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useOrganizationState();

  return useMutation<Response, Error, number>({
    mutationFn: async (id) => {
      const response = await api.delete(`/positions/${id}/`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', activeOrganizationId] });
    },
  });
};

export const useUpdatePositionType = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useOrganizationState();

  return useMutation<PositionType, Error, { id: number; data: { name?: string; rank?: number } }>({
    mutationFn: async ({ id, data }) => {
      const response = await api.patch(`/positions/${id}/`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions', activeOrganizationId] });
    },
  });
};
