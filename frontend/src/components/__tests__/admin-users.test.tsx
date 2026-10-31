import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminUsers from '@/pages/admin/Users';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { ThemeProvider } from '../theme-provider';
import type { User } from '@/hooks/useUsers';

let mockUsersState: User[] = [];

vi.mock('@/hooks/useUsers', () => ({
  useCurrentUser: () => ({
    data: { id: 1, email: 'admin@cit.edu', first_name: 'Admin', last_name: 'User', memberships: [] },
  }),
  useUsers: () => ({
    data: mockUsersState,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useOrganizations', () => ({
  useOrganizationUnits: () => ({
    data: [{ id: 10, name: 'Executive' }, { id: 11, name: 'Logistics' }],
    isLoading: false,
  }),
  usePositionTypes: () => ({
    data: [{ id: 20, name: 'President' }, { id: 21, name: 'Officer' }],
    isLoading: false,
  }),
  useUpdateMembership: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreateMembership: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRemoveMember: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSetMemberRole: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <OrganizationProvider>{children}</OrganizationProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </MemoryRouter>
    );
  };
}

describe('AdminUsers role dialog live derivation (#276)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('activeOrganizationId', '1');
    mockUsersState = [
      {
        id: 2,
        email: 'member@cit.edu',
        first_name: 'Member',
        last_name: 'User',
        is_active: true,
        display_picture: '',
        memberships: [
          {
            id: 102,
            organization_id: 1,
            organization_name: 'Test Org',
            unit_id: 11,
            unit_name: 'Logistics',
            position_id: 21,
            position_name: 'Officer',
            role: 'Member',
            is_active: true,
          },
        ],
      },
    ];
  });

  afterEach(() => {
    cleanup();
  });

  it('updates the open Manage Roles dialog assignments when directory query data changes', async () => {
    const wrapper = createWrapper();
    const { container, rerender } = render(<AdminUsers />, { wrapper });

    // Open row dropdown menu
    const moreBtn = container.querySelector('.lucide-more-horizontal')?.closest('button');
    expect(moreBtn).not.toBeNull();
    fireEvent.click(moreBtn!);

    // Click "Manage Roles"
    const manageRolesBtn = await screen.findByText('Manage Roles');
    fireEvent.click(manageRolesBtn);

    // Dialog should display Current Assignments: "Logistics" and "Officer"
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Manage Roles: Member User')).toBeInTheDocument();

    const assignmentsHeading = within(dialog).getByText('Current Assignments');
    const assignmentsContainer = assignmentsHeading.parentElement!;
    expect(within(assignmentsContainer).getByText('Logistics')).toBeInTheDocument();
    expect(within(assignmentsContainer).getByText('Officer')).toBeInTheDocument();

    // Directory refetches / query data updates while dialog remains open
    mockUsersState = [
      {
        ...mockUsersState[0],
        memberships: [
          {
            id: 102,
            organization_id: 1,
            organization_name: 'Test Org',
            unit_id: 11,
            unit_name: 'Logistics',
            position_id: 21,
            position_name: 'Officer',
            role: 'Member',
            is_active: true,
          },
          {
            id: 103,
            organization_id: 1,
            organization_name: 'Test Org',
            unit_id: 10,
            unit_name: 'Executive',
            position_id: 20,
            position_name: 'President',
            role: 'Admin',
            is_active: true,
          },
        ],
      },
    ];

    rerender(<AdminUsers />);

    // Dialog should dynamically reflect the newly added role without reopen
    expect(within(assignmentsContainer).getByText('Executive')).toBeInTheDocument();
    expect(within(assignmentsContainer).getByText('President')).toBeInTheDocument();
  });
});
