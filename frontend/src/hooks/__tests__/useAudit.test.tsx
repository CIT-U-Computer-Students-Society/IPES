import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { api } from '@/lib/api';
import {
  useAuditLogs,
  useRecentAuditLogs,
  useAuditLogsByUser,
  useAuditLogsByAction,
  useAuditLogsByDate,
  useAuditLog,
  formatAuditAction,
} from '../useAudit';

let mockActiveOrgId: number | null = 42;

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganizationState: () => ({ activeOrganizationId: mockActiveOrgId }),
}));

describe('useAudit hooks tenant scoping and query keys', () => {
  beforeEach(() => {
    mockActiveOrgId = 42;
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockResolvedValue({
      json: async () => ({ results: [] }),
    } as Response);
  });

  const createWrapper = () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { wrapper, client };
  };

  it('useAuditLogs includes tenant in queryKey and request params', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAuditLogs({ action: 'form.created' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith(
      '/audit/?action=form.created&organization_id=42'
    );
  });

  it('useRecentAuditLogs includes tenant in queryKey and request params', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRecentAuditLogs(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/audit/recent/?organization_id=42');
  });

  it('useAuditLogsByUser includes tenant in queryKey and request params', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAuditLogsByUser(10), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith(
      '/audit/by_user/?user_id=10&organization_id=42'
    );
  });

  it('useAuditLogsByAction includes tenant in queryKey and request params', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAuditLogsByAction('evaluation.submitted'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith(
      '/audit/by_action/?action=evaluation.submitted&organization_id=42'
    );
  });

  it('useAuditLogsByDate includes tenant in queryKey and request params', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAuditLogsByDate('2026-01-01', '2026-01-31'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith(
      '/audit/by_date/?start_date=2026-01-01&end_date=2026-01-31&organization_id=42'
    );
  });

  it('useAuditLog (detail) scopes request by tenant parameter', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      json: async () => ({ id: 5, action: 'form.created' }),
    } as Response);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAuditLog(5), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/audit/5/?organization_id=42');
  });

  it('allows overriding organizationId explicitly across hooks', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useAuditLogsByUser(10, 99),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith(
      '/audit/by_user/?user_id=10&organization_id=99'
    );
  });

  it('handles null activeOrganizationId without appending organization_id param', async () => {
    mockActiveOrgId = null;
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRecentAuditLogs(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/audit/recent/');
  });
});

describe('formatAuditAction (#264)', () => {
  it('preserves form_title and form identity from form_created action', () => {
    expect(
      formatAuditAction('evaluation.form_created (form_title=Annual Review, form_id=7)')
    ).toBe('Evaluation: Form Created (Annual Review)');
  });

  it('preserves target_user_email and role-change detail from user.updated action', () => {
    expect(
      formatAuditAction(
        'user.updated (target_user_email=target@example.test, detail=Role changed to Admin in A)'
      )
    ).toBe('User: Updated (target@example.test — Role changed to Admin in A)');
  });

  it('formats basic action without metadata', () => {
    expect(formatAuditAction('user.login')).toBe('User: Login');
  });

  it('preserves plain parenthetical detail without key=value syntax', () => {
    expect(formatAuditAction('user.login (Campus Wi-Fi)')).toBe(
      'User: Login (Campus Wi-Fi)'
    );
  });
});
