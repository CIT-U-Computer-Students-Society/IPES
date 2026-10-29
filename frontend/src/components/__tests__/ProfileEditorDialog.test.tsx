import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../theme-provider';
import { ProfileEditorDialog } from '../ProfileEditorDialog';

const { updateProfile, user } = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  user: { id: 1, first_name: 'Ava', last_name: 'Cruz', email: 'ava@example.com', memberships: [], display_picture: 'https://example.com/signed-avatar' },
}));

vi.mock('@/hooks/useUsers', () => ({
  useCurrentUser: () => ({ data: user, isLoading: false }),
  useUpdateCurrentUser: () => ({ mutate: updateProfile, isPending: false }),
}));
vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganizationState: () => ({ activeOrganizationId: 1 }),
}));

describe('ProfileEditorDialog', () => {
  beforeEach(() => {
    updateProfile.mockClear();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }));
  });

  it('seeds cached profile data when opened and preserves edits across rerenders', async () => {
    const view = <ThemeProvider><ProfileEditorDialog><button>Open profile</button></ProfileEditorDialog></ThemeProvider>;
    const { rerender } = render(view);
    fireEvent.click(screen.getByRole('button', { name: 'Open profile' }));
    expect(screen.getByLabelText('First Name')).toHaveValue('Ava');
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Ana' } });
    rerender(view);
    expect(screen.getByLabelText('First Name')).toHaveValue('Ana');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith(
      { first_name: 'Ana', last_name: 'Cruz' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    ));
  });

  const openEditor = () => {
    render(<ThemeProvider><ProfileEditorDialog><button>Open profile</button></ProfileEditorDialog></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Open profile' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  };

  it('previews an image and submits the file with profile values', async () => {
    openEditor();
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Profile picture'), { target: { files: [file] } });
    expect(await screen.findByAltText("Ava Cruz's profile picture")).toHaveAttribute('src', 'blob:preview');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith(
      { first_name: 'Ava', last_name: 'Cruz', display_picture: file }, expect.any(Object),
    ));
  });

  it.each([
    new File(['bad'], 'avatar.svg', { type: 'image/svg+xml' }),
    new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
  ])('blocks invalid image uploads', async file => {
    openEditor();
    fireEvent.change(screen.getByLabelText('Profile picture'), { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('submits removal and restores the existing picture when edits are canceled', async () => {
    openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Remove picture' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ display_picture: null }), expect.any(Object),
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel profile edits' }));
    expect(await screen.findByAltText("Ava Cruz's profile picture")).toHaveAttribute('src', user.display_picture);
  });
});
