/**
 * Audit API Hooks
 * 
 * Hooks for audit log viewing and filtering
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useOrganizationState } from '@/contexts/OrganizationContext';

// Audit log types
export interface AuditLog {
  id: number;
  user_id: number;
  user_email?: string;
  user_name?: string;
  action: string;
  ip_address?: string;
  details?: Record<string, unknown>;
  datetime: string;
}

// ===== Fetch Hooks =====

// Fetch all audit logs
export const useAuditLogs = (params?: {
  user_id?: number;
  action?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  organization_id?: number;
}) => {
  const { activeOrganizationId } = useOrganizationState();
  const effectiveOrgId = params?.organization_id ?? (activeOrganizationId ?? undefined);
  const mergedParams = {
    ...params,
    ...(effectiveOrgId !== undefined ? { organization_id: effectiveOrgId } : {}),
  };
  const queryString = Object.keys(mergedParams).length > 0
    ? '?' + new URLSearchParams(
      Object.entries(mergedParams)
        .filter(([, v]) => v !== undefined)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {})
    ).toString()
    : '';

  return useQuery({
    queryKey: ['audit', 'logs', effectiveOrgId ?? null, mergedParams],
    queryFn: async () => {
      const response = await api.get(`/audit/${queryString}`);
      const data = await response.json() as { results: AuditLog[] } | AuditLog[];
      return Array.isArray(data) ? data : data.results || [];
    },
    staleTime: 30 * 1000, // 30 seconds for audit logs
  });
};

// Fetch recent audit logs (last 100)
export const useRecentAuditLogs = (organizationId?: number) => {
  const { activeOrganizationId } = useOrganizationState();
  const effectiveOrgId = organizationId ?? (activeOrganizationId ?? undefined);
  const queryString = effectiveOrgId !== undefined ? `?organization_id=${effectiveOrgId}` : '';

  return useQuery({
    queryKey: ['audit', 'recent', effectiveOrgId ?? null],
    queryFn: async () => {
      const response = await api.get(`/audit/recent/${queryString}`);
      const data = await response.json() as { results: AuditLog[] } | AuditLog[];
      return Array.isArray(data) ? data : data.results || [];
    },
    staleTime: 30 * 1000,
  });
};

// Filter by user
export const useAuditLogsByUser = (userId: number, organizationId?: number) => {
  const { activeOrganizationId } = useOrganizationState();
  const effectiveOrgId = organizationId ?? (activeOrganizationId ?? undefined);
  const searchParams = new URLSearchParams({ user_id: String(userId) });
  if (effectiveOrgId !== undefined) {
    searchParams.append('organization_id', String(effectiveOrgId));
  }

  return useQuery({
    queryKey: ['audit', 'by_user', effectiveOrgId ?? null, userId],
    queryFn: async () => {
      const response = await api.get(`/audit/by_user/?${searchParams.toString()}`);
      const data = await response.json() as { results: AuditLog[] } | AuditLog[];
      return Array.isArray(data) ? data : data.results || [];
    },
    enabled: !!userId,
  });
};

// Filter by action type
export const useAuditLogsByAction = (action: string, organizationId?: number) => {
  const { activeOrganizationId } = useOrganizationState();
  const effectiveOrgId = organizationId ?? (activeOrganizationId ?? undefined);
  const searchParams = new URLSearchParams({ action });
  if (effectiveOrgId !== undefined) {
    searchParams.append('organization_id', String(effectiveOrgId));
  }

  return useQuery({
    queryKey: ['audit', 'by_action', effectiveOrgId ?? null, action],
    queryFn: async () => {
      const response = await api.get(`/audit/by_action/?${searchParams.toString()}`);
      const data = await response.json() as { results: AuditLog[] } | AuditLog[];
      return Array.isArray(data) ? data : data.results || [];
    },
    enabled: !!action,
  });
};

// Filter by date range
export const useAuditLogsByDate = (startDate: string, endDate: string, organizationId?: number) => {
  const { activeOrganizationId } = useOrganizationState();
  const effectiveOrgId = organizationId ?? (activeOrganizationId ?? undefined);
  const searchParams = new URLSearchParams({ start_date: startDate, end_date: endDate });
  if (effectiveOrgId !== undefined) {
    searchParams.append('organization_id', String(effectiveOrgId));
  }

  return useQuery({
    queryKey: ['audit', 'by_date', effectiveOrgId ?? null, startDate, endDate],
    queryFn: async () => {
      const response = await api.get(`/audit/by_date/?${searchParams.toString()}`);
      const data = await response.json() as { results: AuditLog[] } | AuditLog[];
      return Array.isArray(data) ? data : data.results || [];
    },
    enabled: !!startDate && !!endDate,
  });
};

// Single audit log
export const useAuditLog = (id: number, organizationId?: number) => {
  const { activeOrganizationId } = useOrganizationState();
  const effectiveOrgId = organizationId ?? (activeOrganizationId ?? undefined);
  const queryString = effectiveOrgId !== undefined ? `?organization_id=${effectiveOrgId}` : '';

  return useQuery({
    queryKey: ['audit', effectiveOrgId ?? null, id],
    queryFn: async () => {
      const response = await api.get(`/audit/${id}/${queryString}`);
      return response.json() as Promise<AuditLog>;
    },
    enabled: !!id,
  });
};

// Common action types for filtering
export const AUDIT_ACTIONS = {
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  FORM_CREATED: 'form.created',
  FORM_PUBLISHED: 'form.published',
  FORM_RESULTS_RELEASED: 'evaluation.results_released',
  FORM_UPDATED: 'form.updated',
  FORM_DELETED: 'form.deleted',
  EVALUATION_SUBMITTED: 'evaluation.submitted',
  EVALUATION_STARTED: 'evaluation.started',
  ACCOMPLISHMENT_CREATED: 'accomplishment.created',
  ACCOMPLISHMENT_VERIFIED: 'accomplishment.verified',
  ACCOMPLISHMENT_REJECTED: 'accomplishment.rejected',
  ACCOMPLISHMENT_DELETED: 'accomplishment.deleted',
} as const;
