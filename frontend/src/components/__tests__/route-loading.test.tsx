import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from '@/App';

const analytics = vi.hoisted(() => {
  let resolve: () => void;
  const ready = new Promise<void>((done) => { resolve = done; });
  return { ready, resolve: () => resolve(), loaded: vi.fn() };
});
const animationLoaded = vi.hoisted(() => vi.fn());

vi.mock('@lottiefiles/dotlottie-react', () => {
  animationLoaded();
  return { DotLottieReact: () => <canvas />, setWasmUrl: vi.fn() };
});

vi.mock('@/pages/admin/Analytics', async () => {
  analytics.loaded();
  await analytics.ready;
  return { default: () => <h1>Analytics content</h1> };
});
vi.mock('@/pages/admin/Dashboard', () => ({ default: () => <h1>Admin dashboard content</h1> }));
vi.mock('@/pages/officer/Dashboard', () => ({ default: () => <h1>Member dashboard content</h1> }));
vi.mock('@/hooks/useUsers', () => ({
  useCurrentUser: () => ({ data: window.location.pathname === '/login' ? undefined : { first_name: 'Alex', memberships: [{
    organization_id: 1, organization_name: 'Research Society', role: 'Admin',
    unit_name: 'Research Committee',
  }] }, isLoading: false }),
  useLogout: () => ({ logout: vi.fn() }),
}));
vi.mock('@/hooks/useOrganizations', () => ({
  usePendingJoinRequests: () => ({ data: [] }),
}));
vi.mock('@/hooks/usePortfolio', () => ({
  usePendingAccomplishments: () => ({ data: [] }),
}));
vi.mock('../ProfileEditorDialog', () => ({
  ProfileEditorDialog: ({ children }: { children: React.ReactNode }) => children,
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

it('renders login without loading analytics or the hidden desktop animation', async () => {
  window.history.replaceState(null, '', '/login');
  const { container } = render(<App />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading page');
  expect(await screen.findByLabelText('Institutional Email')).toBeInTheDocument();
  expect(screen.getByLabelText('Password')).toBeInTheDocument();
  expect(container.querySelector('canvas')).toBeNull();
  expect(animationLoaded).not.toHaveBeenCalled();
  expect(analytics.loaded).not.toHaveBeenCalled();
});

it('keeps admin navigation visible while loading a page and supports member overlay routes', async () => {
  localStorage.setItem('activeOrganizationId', '1');
  window.history.replaceState(null, '', '/admin/dashboard');
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Admin dashboard content' })).toBeInTheDocument();
  expect(analytics.loaded).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('link', { name: 'Analytics' }));
  await waitFor(() => expect(analytics.loaded).toHaveBeenCalledTimes(1));
  // Router transitions preserve the previous page until the next chunk is ready.
  expect(screen.getByRole('heading', { name: 'Admin dashboard content' })).toBeVisible();
  expect(screen.getByRole('navigation')).toBeVisible();
  analytics.resolve();
  expect(await screen.findByRole('heading', { name: 'Analytics content' })).toBeInTheDocument();
  expect(analytics.loaded).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getAllByRole('link', { name: 'Dashboard' }).find(
    (link) => link.getAttribute('href') === '/admin/my-dashboard',
  )!);
  expect(await screen.findByRole('heading', { name: 'Member dashboard content' })).toBeInTheDocument();
});
