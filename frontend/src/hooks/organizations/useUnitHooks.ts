/**
 * Unit & UnitType hooks — queries and mutations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { OrganizationUnit, UnitType } from './types';
import { api } from '@/lib/api';
import { useOrganizationState } from '@/contexts/OrganizationContext';

// ===== Organization Units =====

export const useOrganizationUnits = (organizationId?: number) => {
  const { activeOrganizationId } = useOrganizationState();
  const effectiveOrgId = organizationId || activeOrganizationId;

  return useQuery({
    queryKey: ['units', effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      const response = await api.get(`/units/?organization_id=${effectiveOrgId}`);
      const data = await response.json() as OrganizationUnit[] | { results: OrganizationUnit[] };
      return Array.isArray(data) ? data : data.results || [];
    },
    enabled: !!effectiveOrgId
  });
};

export const useCreateOrganizationUnit = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useOrganizationState();

  return useMutation<OrganizationUnit, Error, { name: string; description?: string; type_id: number }>({
    mutationFn: async (data) => {
      const payload = { ...data, organization_id: activeOrganizationId };
      const response = await api.post('/units/', payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'analytics'] });
    },
  });
};

export const useDeleteOrganizationUnit = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useOrganizationState();

  return useMutation<Response, Error, number>({
    mutationFn: async (id) => {
      const response = await api.delete(`/units/${id}/`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'analytics'] });
    },
  });
};

export const useUpdateOrganizationUnit = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useOrganizationState();

  return useMutation<OrganizationUnit, Error, { id: number; data: { name?: string; description?: string; type_id?: number } }>({
    mutationFn: async ({ id, data }) => {
      const response = await api.patch(`/units/${id}/`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'analytics'] });
    },
  });
};

// ===== Unit Types =====

export const useUnitTypes = (organizationId?: number) => {
  const { activeOrganizationId } = useOrganizationState();
  const effectiveOrgId = organizationId || activeOrganizationId;

  return useQuery({
    queryKey: ['unit-types', effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      const response = await api.get(`/unit-types/?organization_id=${effectiveOrgId}`);
      const data = await response.json() as UnitType[] | { results: UnitType[] };
      return Array.isArray(data) ? data : data.results || [];
    },
    enabled: !!effectiveOrgId
  });
};

export const useCreateUnitType = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useOrganizationState();

  return useMutation<UnitType, Error, { name: string }>({
    mutationFn: async (data) => {
      const payload = { ...data, organization_id: activeOrganizationId };
      const response = await api.post('/unit-types/', payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-types', activeOrganizationId] });
    },
  });
};

export const useDeleteUnitType = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useOrganizationState();

  return useMutation<Response, Error, number>({
    mutationFn: async (id) => {
      const response = await api.delete(`/unit-types/${id}/`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-types', activeOrganizationId] });
    },
  });
};

export const useUpdateUnitType = () => {
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useOrganizationState();

  return useMutation<UnitType, Error, { id: number; data: { name?: string } }>({
    mutationFn: async ({ id, data }) => {
      const response = await api.patch(`/unit-types/${id}/`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-types', activeOrganizationId] });
    },
  });
};
