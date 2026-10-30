import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficerEvaluations from '@/pages/officer/Evaluations';
import { ThemeProvider } from '../theme-provider';
import type { EvaluationAssignment } from '@/hooks/evaluations/types';

const mockState = {
  currentUser: { id: 1, email: 'officer@example.com', first_name: 'Officer' },
  pendingAssignments: [] as EvaluationAssignment[],
  allAssignments: [] as EvaluationAssignment[],
  pendingLoading: false,
  allLoading: false,
};

vi.mock('@/hooks/useUsers', () => ({
  useCurrentUser: () => ({ data: mockState.currentUser }),
}));

vi.mock('@/hooks/useEvaluations', () => ({
  useMyPendingEvaluations: () => ({
    data: mockState.pendingAssignments,
    isLoading: mockState.pendingLoading,
  }),
  useAssignments: () => ({
    data: mockState.allAssignments,
    isLoading: mockState.allLoading,
  }),
}));

describe('OfficerEvaluations queue and closed forms (#237)', () => {
  beforeEach(() => {
    mockState.pendingAssignments = [];
    mockState.allAssignments = [];
    mockState.pendingLoading = false;
    mockState.allLoading = false;
  });

  afterEach(() => {
    cleanup();
  });

  const renderEvaluations = () => {
    return render(
      <MemoryRouter initialEntries={['/member/evaluations']}>
        <ThemeProvider defaultTheme="light">
          <OfficerEvaluations />
        </ThemeProvider>
      </MemoryRouter>
    );
  };

  it('renders Start button for active pending evaluations in pending tab', () => {
    mockState.pendingAssignments = [
      {
        id: 10,
        evaluator_id: 1,
        evaluatee_id: 2,
        evaluatee_name: 'Evaluatee One',
        form_id: 100,
        form_title: 'Active Spring Evaluation',
        status: 'Pending',
        is_closed: false,
        form_is_active: true,
        form_results_released: false,
      },
    ];

    renderEvaluations();

    expect(screen.getByText('Active Spring Evaluation')).toBeInTheDocument();
    expect(screen.getByText('Not Started')).toBeInTheDocument();
    const startBtn = screen.getByRole('button', { name: /Start/i });
    expect(startBtn).toBeInTheDocument();
    expect(startBtn).not.toBeDisabled();
  });

  it('renders Closed badge and disabled Closed button for closed assignments in All tab', async () => {
    mockState.allAssignments = [
      {
        id: 20,
        evaluator_id: 1,
        evaluatee_id: 3,
        evaluatee_name: 'Evaluatee Two',
        form_id: 200,
        form_title: 'Inactive Fall Evaluation',
        status: 'Pending',
        is_closed: true,
        form_is_active: false,
        form_results_released: false,
      },
    ];

    renderEvaluations();

    // Switch to All tab
    const allTab = screen.getByRole('tab', { name: /All/i });
    allTab.click();

    expect(await screen.findByText('Inactive Fall Evaluation')).toBeInTheDocument();
    const closedElements = screen.getAllByText('Closed');
    expect(closedElements.length).toBeGreaterThanOrEqual(2);

    const closedBtn = screen.getByRole('button', { name: 'Closed' });
    expect(closedBtn).toBeInTheDocument();
    expect(closedBtn).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Start/i })).not.toBeInTheDocument();
  });

  it('renders Submitted button for completed assignments', async () => {
    mockState.allAssignments = [
      {
        id: 30,
        evaluator_id: 1,
        evaluatee_id: 4,
        evaluatee_name: 'Evaluatee Three',
        form_id: 300,
        form_title: 'Completed Evaluation',
        status: 'Completed',
        is_closed: true,
        form_is_active: true,
        form_results_released: true,
      },
    ];

    renderEvaluations();

    const allTab = screen.getByRole('tab', { name: /All/i });
    allTab.click();

    expect(await screen.findByText('Completed Evaluation')).toBeInTheDocument();
    const submittedBtn = screen.getByRole('button', { name: /Submitted/i });
    expect(submittedBtn).toBeInTheDocument();
    expect(submittedBtn).toBeDisabled();
  });
});
