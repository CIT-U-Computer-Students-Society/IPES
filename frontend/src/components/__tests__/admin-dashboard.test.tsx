import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminDashboard from '@/pages/admin/Dashboard';
import { ThemeProvider } from '../theme-provider';
import type { EvaluationAssignment } from '@/hooks/evaluations/types';
import type { User } from '@/hooks/useUsers';
import type { AuditLog } from '@/hooks/useAudit';
import type { UnitCompletionStats } from '@/hooks/useOrganizations';
import type { Accomplishment } from '@/hooks/usePortfolio';

const mockState = {
  users: [] as Partial<User>[],
  assignments: [] as EvaluationAssignment[],
  pendingAccomplishments: [] as Partial<Accomplishment>[],
  recentActivity: [] as Partial<AuditLog>[],
  unitStats: [] as Partial<UnitCompletionStats>[],
  isLoading: false,
};

vi.mock('@/hooks/useUsers', () => ({
  useUsers: () => ({ data: mockState.users, isLoading: mockState.isLoading }),
}));

vi.mock('@/hooks/useEvaluations', () => ({
  useAssignments: () => ({ data: mockState.assignments, isLoading: mockState.isLoading }),
}));

vi.mock('@/hooks/usePortfolio', () => ({
  usePendingAccomplishments: () => ({
    data: mockState.pendingAccomplishments,
    isLoading: mockState.isLoading,
  }),
}));

vi.mock('@/hooks/useAudit', () => ({
  useRecentAuditLogs: () => ({ data: mockState.recentActivity, isLoading: mockState.isLoading }),
}));

vi.mock('@/hooks/useOrganizations', () => ({
  useUnitCompletionStats: () => ({ data: mockState.unitStats, isLoading: mockState.isLoading }),
  useAnalyticsSummary: () => ({ data: null, isLoading: mockState.isLoading }),
}));

describe('AdminDashboard completion rate and stats', () => {
  beforeEach(() => {
    mockState.users = [{ id: 1, first_name: 'Admin', is_active: true }];
    mockState.assignments = [];
    mockState.pendingAccomplishments = [];
    mockState.recentActivity = [];
    mockState.unitStats = [];
    mockState.isLoading = false;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('reports zero completions and 0% rate when assignments list is empty', () => {
    mockState.assignments = [];
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AdminDashboard />
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('0 completed')).toBeInTheDocument();
    expect(screen.getByText('Active Evaluations')).toBeInTheDocument();
  });

  it('correctly calculates partially completed assignments using Completed status', () => {
    mockState.assignments = [
      { id: 101, evaluator_id: 1, evaluatee_id: 2, form_id: 1, status: 'Completed' },
      { id: 102, evaluator_id: 2, evaluatee_id: 1, form_id: 1, status: 'Pending' },
      { id: 103, evaluator_id: 3, evaluatee_id: 1, form_id: 1, status: 'In Progress' },
    ];

    render(
      <MemoryRouter>
        <ThemeProvider>
          <AdminDashboard />
        </ThemeProvider>
      </MemoryRouter>
    );

    // 1 out of 3 completed = 33%
    expect(screen.getByText('33%')).toBeInTheDocument();
    expect(screen.getByText('1 completed')).toBeInTheDocument();
    expect(screen.getByText('Active Evaluations')).toBeInTheDocument();
  });

  it('correctly calculates 100% completion rate for fully complete data', () => {
    mockState.assignments = [
      { id: 201, evaluator_id: 1, evaluatee_id: 2, form_id: 1, status: 'Completed' },
      { id: 202, evaluator_id: 2, evaluatee_id: 1, form_id: 1, status: 'Completed' },
    ];

    render(
      <MemoryRouter>
        <ThemeProvider>
          <AdminDashboard />
        </ThemeProvider>
      </MemoryRouter>
    );

    // 2 out of 2 completed = 100%
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('2 completed')).toBeInTheDocument();
  });

  it('ignores unsupported or non-completed status variants for completion count', () => {
    mockState.assignments = [
      { id: 301, evaluator_id: 1, evaluatee_id: 2, form_id: 1, status: 'Pending' },
      { id: 302, evaluator_id: 2, evaluatee_id: 1, form_id: 1, status: 'In Progress' },
    ];

    render(
      <MemoryRouter>
        <ThemeProvider>
          <AdminDashboard />
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('0 completed')).toBeInTheDocument();
  });
});
