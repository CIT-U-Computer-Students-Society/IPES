import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminAccomplishments from '@/pages/admin/AdminAccomplishments';
import OfficerAccomplishments from '@/pages/officer/Accomplishments';
import { ThemeProvider } from '../theme-provider';
import type { Accomplishment } from '@/hooks/usePortfolio';

const mockAccomplishments: Accomplishment[] = [];

vi.mock('@/contexts/OrganizationContext', () => ({
  useOrganizationState: () => ({ activeOrganizationId: 1 }),
  useOrganization: () => ({ currentOrganization: { id: 1, name: 'Test Org' } }),
}));

vi.mock('@/hooks/useUsers', () => ({
  useCurrentUser: () => ({
    data: { id: 1, email: 'officer@example.com', first_name: 'Officer' },
  }),
}));

vi.mock('@/hooks/usePortfolio', () => ({
  useAccomplishments: () => ({
    data: mockAccomplishments,
    isLoading: false,
  }),
  useMyAccomplishments: () => ({
    data: mockAccomplishments,
    isLoading: false,
  }),
  useVerifyAccomplishment: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreateAccomplishment: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUpdateAccomplishment: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeleteAccomplishment: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe('Accomplishment Verification Comments (#251)', () => {
  beforeEach(() => {
    mockAccomplishments.length = 0;
  });

  afterEach(() => {
    cleanup();
  });

  it('displays Verification Notes on verified accomplishment in Admin review dialog', () => {
    const verifiedItem: Accomplishment = {
      id: 101,
      user_id: 2,
      user_name: 'Jane Doe',
      organization_id: 1,
      title: 'ML Research Publication',
      description: 'Accepted paper at IEEE conference',
      type: 'publication',
      date_completed: '2026-05-10',
      status: 'Verified',
      comments: 'Verified against IEEE publication DOI index.',
      proof_link: 'https://example.com/paper',
    };
    mockAccomplishments.push(verifiedItem);

    render(
      <MemoryRouter initialEntries={['/admin/accomplishments']}>
        <ThemeProvider defaultTheme="light">
          <AdminAccomplishments />
        </ThemeProvider>
      </MemoryRouter>
    );

    // Switch to All tab to view verified item
    const allTab = screen.getByRole('tab', { name: /all/i });
    fireEvent.click(allTab);

    // Click the view button (eye icon button in the table row)
    const viewButtons = screen.getAllByRole('button');
    const eyeBtn = viewButtons.find(b => b.querySelector('svg.lucide-eye'));
    expect(eyeBtn).toBeDefined();
    fireEvent.click(eyeBtn!);

    // Verify dialog opens and displays Verification Notes label and comments text
    expect(screen.getByText('Verification Notes')).toBeInTheDocument();
    expect(
      screen.getByText('Verified against IEEE publication DOI index.')
    ).toBeInTheDocument();
  });

  it('displays Rejection Reason on rejected accomplishment in Admin review dialog', () => {
    const rejectedItem: Accomplishment = {
      id: 102,
      user_id: 3,
      user_name: 'John Smith',
      organization_id: 1,
      title: 'Incomplete Workshop',
      description: 'Attended external training',
      type: 'training',
      date_completed: '2026-04-12',
      status: 'Rejected',
      comments: 'Missing certificate of participation.',
    };
    mockAccomplishments.push(rejectedItem);

    render(
      <MemoryRouter initialEntries={['/admin/accomplishments']}>
        <ThemeProvider defaultTheme="light">
          <AdminAccomplishments />
        </ThemeProvider>
      </MemoryRouter>
    );

    const allTab = screen.getByRole('tab', { name: /all/i });
    fireEvent.click(allTab);

    const viewButtons = screen.getAllByRole('button');
    const eyeBtn = viewButtons.find(b => b.querySelector('svg.lucide-eye'));
    expect(eyeBtn).toBeDefined();
    fireEvent.click(eyeBtn!);

    expect(screen.getByText('Rejection Reason')).toBeInTheDocument();
    expect(
      screen.getByText('Missing certificate of participation.')
    ).toBeInTheDocument();
  });

  it('displays verification notes and rejection reasons in Officer portfolio list', () => {
    mockAccomplishments.push(
      {
        id: 201,
        user_id: 1,
        user_name: 'Officer User',
        organization_id: 1,
        title: 'Project Alpha Deployment',
        description: 'Successfully deployed version 1.0',
        type: 'project',
        date_completed: '2026-06-01',
        status: 'Verified',
        comments: 'Verified with lead advisor.',
      },
      {
        id: 202,
        user_id: 1,
        user_name: 'Officer User',
        organization_id: 1,
        title: 'Design Workshop',
        description: 'UI/UX workshop attendance',
        type: 'training',
        date_completed: '2026-06-05',
        status: 'Rejected',
        comments: 'Proof document is corrupted.',
      }
    );

    render(
      <MemoryRouter initialEntries={['/member/portfolio']}>
        <ThemeProvider defaultTheme="light">
          <OfficerAccomplishments />
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Notes: Verified with lead advisor.')).toBeInTheDocument();
    expect(screen.getByText('Reason: Proof document is corrupted.')).toBeInTheDocument();
  });
});
