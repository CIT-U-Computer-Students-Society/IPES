/**
 * Audit API Hooks
 * 
 * Hooks for audit log viewing and filtering
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useOrganizationState } from '@/contexts/OrganizationContext';
import { fetchAllPages } from '@/lib/pagination';

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


export function formatAuditAction(rawAction: string): string {
  if (!rawAction) return '';

  const parenMatch = rawAction.match(/^(.*?)(?:\s*\((.*)\)\s*)?$/);
  const base = parenMatch?.[1]?.trim() || rawAction;
  const parenContent = parenMatch?.[2]?.trim();

  const formattedBase = base
    .replace('.', ': ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  if (!parenContent) {
    return formattedBase;
  }

  const metadata: Record<string, string> = {};
  const kvRegex = /(?:^|,\s*)([a-zA-Z0-9_]+)\s*=\s*([^,]+)/g;
  let match: RegExpExecArray | null;
  let hasKeyValue = false;

  while ((match = kvRegex.exec(parenContent)) !== null) {
    hasKeyValue = true;
    const key = match[1].toLowerCase();
    const val = match[2].trim().replace(/^['"]|['"]$/g, '');
    metadata[key] = val;
  }

  if (!hasKeyValue) {
    const plain = parenContent.replace(/^['"]|['"]$/g, '').trim();
    return plain ? `${formattedBase} (${plain})` : formattedBase;
  }

  const titleValues: string[] = [];
  if (metadata.form_title) titleValues.push(metadata.form_title);
  else if (metadata.title) titleValues.push(metadata.title);
  else if (metadata.org_name) titleValues.push(metadata.org_name);
  else if (metadata.name) titleValues.push(metadata.name);

  if (metadata.unit_name && metadata.position_name) {
    titleValues.push(`${metadata.unit_name} / ${metadata.position_name}`);
  } else if (metadata.unit_name) {
    titleValues.push(metadata.unit_name);
  } else if (metadata.position_name) {
    titleValues.push(metadata.position_name);
  }

  const userKey = ['target_user_email', 'user_email', 'target_user_name', 'target_user']
    .find((k) => metadata[k]);
  const detailKey = ['detail', 'reason', 'notes']
    .find((k) => metadata[k]);

  const detailParts: string[] = [];
  if (titleValues.length > 0) {
    detailParts.push(titleValues.join(' — '));
  }
  if (userKey) {
    detailParts.push(metadata[userKey]);
  }
  if (detailKey) {
    detailParts.push(metadata[detailKey]);
  }

  if (detailParts.length === 0) {
    const secondaryKeys = Object.keys(metadata).filter(
      (k) => !k.endsWith('_id') && k !== 'id'
    );
    for (const k of secondaryKeys) {
      detailParts.push(`${k}: ${metadata[k]}`);
    }
  }

  if (detailParts.length > 0) {
    return `${formattedBase} (${detailParts.join(' — ')})`;
  }

  const idEntries = Object.entries(metadata).map(([k, v]) => `${k}=${v}`);
  return idEntries.length > 0 ? `${formattedBase} (${idEntries.join(', ')})` : formattedBase;
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
      return fetchAllPages<AuditLog>(`/audit/${queryString}`);
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
      return fetchAllPages<AuditLog>(`/audit/by_user/?${searchParams.toString()}`);
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
      return fetchAllPages<AuditLog>(`/audit/by_action/?${searchParams.toString()}`);
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
      return fetchAllPages<AuditLog>(`/audit/by_date/?${searchParams.toString()}`);
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
