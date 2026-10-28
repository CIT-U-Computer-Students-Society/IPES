import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notifications, notifications } from '@mantine/notifications';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ThemeProvider } from '../theme-provider';
import { ThemeToggle } from '../theme-toggle';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '../ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { RadioGroup, RadioGroupItem, RadioGroupCard } from '../ui/radio-group';
import { Switch } from '../ui/switch';
import { Progress } from '../ui/progress';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { toast } from '@/lib/notifications';

function RoleSelect({ disabled = false }: { disabled?: boolean }) {
  const [role, setRole] = useState('');
  return <>
    <Select value={role} onValueChange={setRole} disabled={disabled}>
      <SelectTrigger id="role"><SelectValue placeholder="Choose role" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="blocked" disabled>Unavailable</SelectItem>
        <SelectItem value="member">Member</SelectItem>
      </SelectContent>
    </Select>
    <output aria-label="Selected role">{role}</output>
  </>;
}
const schema = z.object({ name: z.string().min(1, 'Name is required') });
function ValidatedForm({ save }: { save: (data: z.infer<typeof schema>) => void }) {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { name: '' } });
  return <Form {...form}><form onSubmit={form.handleSubmit(save)}>
    <FormField control={form.control} name="name" render={({ field }) => <FormItem>
      <FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage />
    </FormItem>} />
    <Button type="submit">Save form</Button>
  </form></Form>;
}
function ToggleFields() {
  const [reminders, setReminders] = useState(false);
  const [score, setScore] = useState('1');
  return <>
    <Switch aria-label="Reminders" checked={reminders} onCheckedChange={setReminders} />
    <RadioGroup value={score} onValueChange={setScore} aria-label="Rating">
      <RadioGroupItem value="1" aria-label="One" /><RadioGroupItem value="2" aria-label="Two" />
    </RadioGroup>
    <Progress value={2} max={4} />
  </>;
}
function mount(children: React.ReactNode) { return render(<ThemeProvider>{children}</ThemeProvider>); }
beforeEach(() => { localStorage.clear(); document.documentElement.classList.remove('dark'); });
afterEach(() => { cleanup(); notifications.clean(); vi.clearAllMocks(); });

describe('Mantine shared UI migration', () => {
  it('selects using the keyboard and skips disabled options', async () => {
    mount(<RoleSelect />);
    const input = screen.getByPlaceholderText('Choose role');
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(screen.getByLabelText('Selected role')).toHaveTextContent('member'));
    expect(input).toHaveValue('Member');
  });

  it('prevents opening a disabled select', () => {
    mount(<RoleSelect disabled />);
    const input = screen.getByPlaceholderText('Choose role');
    expect(input).toBeDisabled();
    fireEvent.click(input);
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('supports selects inside a named modal and returns focus after Escape', async () => {
    mount(<Dialog><DialogTrigger asChild><Button>Manage member</Button></DialogTrigger>
      <DialogContent><DialogTitle>Membership</DialogTitle><RoleSelect /></DialogContent></Dialog>);
    const trigger = screen.getByRole('button', { name: 'Manage member' });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Membership' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.click(screen.getByPlaceholderText('Choose role'));
    fireEvent.click(await screen.findByRole('option', { name: 'Member' }));
    expect(screen.getByLabelText('Selected role')).toHaveTextContent('member');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('focuses cancellation first and does not execute a destructive action when canceled', async () => {
    const remove = vi.fn();
    mount(<AlertDialog><AlertDialogTrigger asChild><Button>Remove member</Button></AlertDialogTrigger>
      <AlertDialogContent><AlertDialogTitle>Confirm removal</AlertDialogTitle>
        <AlertDialogCancel>Cancel removal</AlertDialogCancel><AlertDialogAction onClick={remove}>Confirm</AlertDialogAction>
      </AlertDialogContent></AlertDialog>);
    fireEvent.click(screen.getByRole('button', { name: 'Remove member' }));
    await screen.findByRole('dialog', { name: 'Confirm removal' });
    const cancel = screen.getByRole('button', { name: 'Cancel removal' });
    await waitFor(() => expect(cancel).toHaveFocus());
    fireEvent.click(cancel);
    expect(remove).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps a confirmation open when its action prevents dismissal', async () => {
    mount(<AlertDialog defaultOpen><AlertDialogContent><AlertDialogTitle>Check code</AlertDialogTitle>
      <AlertDialogAction onClick={event => event.preventDefault()}>Validate code</AlertDialogAction>
    </AlertDialogContent></AlertDialog>);
    fireEvent.click(await screen.findByRole('button', { name: 'Validate code' }));
    expect(screen.getByRole('dialog', { name: 'Check code' })).toBeInTheDocument();
  });

  it('skips disabled menu actions and invokes the selected action once', async () => {
    const selected = vi.fn();
    const blocked = vi.fn();
    mount(<DropdownMenu><DropdownMenuTrigger asChild><Button>Actions</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end"><DropdownMenuItem disabled onClick={blocked}>Unavailable action</DropdownMenuItem>
        <DropdownMenuItem onClick={selected}>Export data</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu>);
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    const disabled = await screen.findByRole('menuitem', { name: 'Unavailable action' });
    fireEvent.click(disabled);
    expect(blocked).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export data' }));
    expect(selected).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('preserves saved dark mode, toggles it, and restores the new preference on remount', async () => {
    localStorage.setItem('theme', 'dark');
    const first = mount(<ThemeToggle />);
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'));
    expect(localStorage.getItem('theme')).toBe('light');
    first.unmount();
    mount(<ThemeToggle />);
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('preserves notification titles and descriptions through Mantine', async () => {
    mount(<Notifications />);
    act(() => { toast.error('Save failed', { description: 'Please retry your changes' }); });
    expect(await screen.findByText('Save failed')).toBeInTheDocument();
    expect(screen.getByText('Please retry your changes')).toBeInTheDocument();
  });

  it('updates switch/radio values and normalizes progress counts', () => {
    mount(<ToggleFields />);
    fireEvent.click(screen.getByLabelText('Reminders'));
    expect(screen.getByLabelText('Reminders')).toBeChecked();
    fireEvent.click(screen.getByLabelText('Two'));
    expect(screen.getByLabelText('Two')).toBeChecked();
    expect(screen.getByLabelText('One')).not.toBeChecked();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('keeps React Hook Form refs, labels, and Zod validation connected', async () => {
    const save = vi.fn();
    mount(<ValidatedForm save={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save form' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ava' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save form' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ name: 'Ava' }, expect.anything()));
  });

  it('selects rating cards with visible checked state and preserves disabled ratings', () => {
    function Ratings() {
      const [rating, setRating] = useState('1');
      return <RadioGroup value={rating} onValueChange={setRating} aria-label="Teamwork">
        <RadioGroupCard value="1">Poor</RadioGroupCard>
        <RadioGroupCard value="4">Good</RadioGroupCard>
        <RadioGroupCard value="5" disabled>Excellent</RadioGroupCard>
      </RadioGroup>;
    }
    mount(<Ratings />);
    fireEvent.click(screen.getByRole('radio', { name: 'Good' }));
    expect(screen.getByRole('radio', { name: 'Good' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Good' })).toHaveAttribute('data-checked');
    expect(screen.getByRole('radio', { name: 'Poor' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Excellent' }));
    expect(screen.getByRole('radio', { name: 'Good' })).toBeChecked();
  });
});
