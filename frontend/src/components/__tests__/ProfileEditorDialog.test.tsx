import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../theme-provider';
import { ProfileEditorDialog } from '../ProfileEditorDialog';

const { updateProfile, user } = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  user: { id: 1, first_name: 'Ava', last_name: 'Cruz', email: 'ava@example.com', memberships: [] },
}));

vi.mock('@/hooks/useUsers', () => ({
  useCurrentUser: () => ({ data: user, isLoading: false }),
  useUpdateCurrentUser: () => ({ mutate: updateProfile, isPending: false }),
}));
vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganizationState: () => ({ activeOrganizationId: 1 }),
}));

describe('ProfileEditorDialog', () => {
  it('seeds cached profile data when opened and preserves edits across rerenders', () => {
    const view = <ThemeProvider><ProfileEditorDialog><button>Open profile</button></ProfileEditorDialog></ThemeProvider>;
    const { rerender } = render(view);
    fireEvent.click(screen.getByRole('button', { name: 'Open profile' }));
    expect(screen.getByLabelText('First Name')).toHaveValue('Ava');
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Ana' } });
    rerender(view);
    expect(screen.getByLabelText('First Name')).toHaveValue('Ana');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(updateProfile).toHaveBeenCalledWith(
      { first_name: 'Ana', last_name: 'Cruz' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
