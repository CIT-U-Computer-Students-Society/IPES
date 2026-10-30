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
  const queryString = params
    ? '?' + new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined).reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {})
    ).toString()
    : '';

  return useQuery({
    queryKey: ['audit', 'logs', params],
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
  const effectiveOrgId = organizationId || activeOrganizationId;
  const queryString = effectiveOrgId ? `?organization_id=${effectiveOrgId}` : '';

  return useQuery({
    queryKey: ['audit', 'recent', effectiveOrgId],
    queryFn: async () => {
      const response = await api.get(`/audit/recent/${queryString}`);
      const data = await response.json() as { results: AuditLog[] } | AuditLog[];
      return Array.isArray(data) ? data : data.results || [];
    },
    staleTime: 30 * 1000,
  });
};

// Filter by user
export const useAuditLogsByUser = (userId: number) => {
  return useQuery({
    queryKey: ['audit', 'by_user', userId],
    queryFn: async () => {
      const response = await api.get(`/audit/by_user/?user_id=${userId}`);
      const data = await response.json() as { results: AuditLog[] } | AuditLog[];
      return Array.isArray(data) ? data : data.results || [];
    },
    enabled: !!userId,
  });
};

// Filter by action type
export const useAuditLogsByAction = (action: string) => {
  return useQuery({
    queryKey: ['audit', 'by_action', action],
    queryFn: async () => {
      const response = await api.get(`/audit/by_action/?action=${action}`);
      const data = await response.json() as { results: AuditLog[] } | AuditLog[];
      return Array.isArray(data) ? data : data.results || [];
    },
    enabled: !!action,
  });
};

// Filter by date range
export const useAuditLogsByDate = (startDate: string, endDate: string) => {
  return useQuery({
    queryKey: ['audit', 'by_date', startDate, endDate],
    queryFn: async () => {
      const response = await api.get(`/audit/by_date/?start_date=${startDate}&end_date=${endDate}`);
      const data = await response.json() as { results: AuditLog[] } | AuditLog[];
      return Array.isArray(data) ? data : data.results || [];
    },
    enabled: !!startDate && !!endDate,
  });
};

// Single audit log
export const useAuditLog = (id: number) => {
  return useQuery({
    queryKey: ['audit', id],
    queryFn: async () => {
      const response = await api.get(`/audit/${id}/`);
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
} as const;
