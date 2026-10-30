import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminAccomplishments from '@/pages/admin/AdminAccomplishments';
import { ThemeProvider } from '../theme-provider';
import type { Accomplishment } from '@/hooks/usePortfolio';

const mockAccomplishments: Accomplishment[] = [];
const mockMutateAsync = vi.fn();

vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganizationState: () => ({ activeOrganizationId: 1 }),
  useOrganization: () => ({ currentOrganization: { id: 1, name: 'Test Org' } }),
}));

vi.mock('@/hooks/useUsers', () => ({
  useCurrentUser: () => ({
    data: { id: 1, email: 'admin@example.com', first_name: 'Admin' },
  }),
}));

vi.mock('@/hooks/usePortfolio', () => ({
  useAccomplishments: () => ({
    data: mockAccomplishments,
    isLoading: false,
  }),
  useVerifyAccomplishment: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

describe('Accomplishment Review Draft Reset (#247)', () => {
  const itemA: Accomplishment = {
    id: 10,
    user_id: 101,
    user_name: 'Alice Cooper',
    organization_id: 1,
    title: 'Research Paper Alpha',
    description: 'First paper draft',
    type: 'publication',
    date_completed: '2026-04-01',
    status: 'Pending',
  };

  const itemB: Accomplishment = {
    id: 20,
    user_id: 102,
    user_name: 'Bob Marley',
    organization_id: 1,
    title: 'Community Outreach Beta',
    description: 'Second outreach event',
    type: 'project',
    date_completed: '2026-04-05',
    status: 'Pending',
  };

  beforeEach(() => {
    mockAccomplishments.length = 0;
    mockAccomplishments.push(itemA, itemB);
    mockMutateAsync.mockReset();
    mockMutateAsync.mockResolvedValue({ id: 10, status: 'Verified' });
  });

  afterEach(() => {
    cleanup();
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={['/admin/accomplishments']}>
        <ThemeProvider defaultTheme="light">
          <AdminAccomplishments />
        </ThemeProvider>
      </MemoryRouter>
    );
  };

  it('resets drafted notes when opening a different accomplishment', () => {
    renderComponent();

    const viewButtons = screen.getAllByRole('button');
    const eyeButtons = viewButtons.filter(b => b.querySelector('svg.lucide-eye'));
    expect(eyeButtons.length).toBe(2);

    // 1. Open Item A dialog
    fireEvent.click(eyeButtons[0]);
    expect(screen.getAllByText('Research Paper Alpha').length).toBeGreaterThan(0);

    // 2. Type draft comment for Item A
    const textarea = screen.getByPlaceholderText(
      'Add any notes about this accomplishment...'
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Drafted feedback meant only for Alice' } });
    expect(textarea.value).toBe('Drafted feedback meant only for Alice');

    // 3. Cancel Item A review dialog
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // 4. Open Item B dialog
    fireEvent.click(eyeButtons[1]);
    expect(screen.getAllByText('Community Outreach Beta').length).toBeGreaterThan(0);

    // 5. Ensure textarea is reset to empty string, not Alice's comment
    const textareaB = screen.getByPlaceholderText(
      'Add any notes about this accomplishment...'
    ) as HTMLTextAreaElement;
    expect(textareaB.value).toBe('');

    // 6. Click Reject on Item B
    const rejectButton = screen.getByRole('button', { name: /reject/i });
    fireEvent.click(rejectButton);

    // 7. Verify mutation was called with item B id and empty comments
    expect(mockMutateAsync).toHaveBeenCalledWith({
      id: itemB.id,
      data: {
        status: 'Rejected',
        comments: '',
      },
    });
  });

  it('resets review notes when dialog is closed via Cancel button', () => {
    renderComponent();

    const viewButtons = screen.getAllByRole('button');
    const eyeButtons = viewButtons.filter(b => b.querySelector('svg.lucide-eye'));

    // Open Item A
    fireEvent.click(eyeButtons[0]);
    const textarea = screen.getByPlaceholderText(
      'Add any notes about this accomplishment...'
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Unsaved notes that should clear' } });

    // Click Cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Re-open Item A
    fireEvent.click(eyeButtons[0]);
    const textareaReopened = screen.getByPlaceholderText(
      'Add any notes about this accomplishment...'
    ) as HTMLTextAreaElement;
    expect(textareaReopened.value).toBe('');
  });

  it('preserves review notes on mutation failure so reviewer can retry', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('Network error'));
    renderComponent();

    const viewButtons = screen.getAllByRole('button');
    const eyeButtons = viewButtons.filter(b => b.querySelector('svg.lucide-eye'));

    fireEvent.click(eyeButtons[0]);
    const textarea = screen.getByPlaceholderText(
      'Add any notes about this accomplishment...'
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Detailed rejection notes to retry' } });

    const rejectButton = screen.getByRole('button', { name: /reject/i });
    fireEvent.click(rejectButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });

    // Dialog remains open and notes are retained for retry
    expect(textarea.value).toBe('Detailed rejection notes to retry');
  });

  it('clears review notes and closes dialog on successful verification', async () => {
    renderComponent();

    const viewButtons = screen.getAllByRole('button');
    const eyeButtons = viewButtons.filter(b => b.querySelector('svg.lucide-eye'));

    fireEvent.click(eyeButtons[0]);
    const textarea = screen.getByPlaceholderText(
      'Add any notes about this accomplishment...'
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Approved with honors' } });

    const verifyButton = screen.getByRole('button', { name: /verify/i });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: itemA.id,
        data: {
          status: 'Verified',
          comments: 'Approved with honors',
        },
      });
    });

    // Re-opening Item B has empty notes
    fireEvent.click(eyeButtons[1]);
    const textareaB = screen.getByPlaceholderText(
      'Add any notes about this accomplishment...'
    ) as HTMLTextAreaElement;
    expect(textareaB.value).toBe('');
  });
});
