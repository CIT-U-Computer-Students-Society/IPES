import { Children, cloneElement, isValidElement, useId, useState, type ComponentPropsWithoutRef, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import { Box, Modal, Text } from '@mantine/core';
import { Button } from './button';
import { DialogContext, useDialogState } from './dialog-context';
import { cn } from '@/lib/utils';

export type DialogProps = { children?: ReactNode; open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void; alert?: boolean };
export function Dialog({ children, open: controlled, defaultOpen = false, onOpenChange, alert = false }: DialogProps) {
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const id = useId();
  const open = controlled ?? localOpen;
  const setOpen = (next: boolean) => { if (controlled === undefined) setLocalOpen(next); onOpenChange?.(next); };
  return <DialogContext.Provider value={{ open, setOpen, id, alert }}>{children}</DialogContext.Provider>;
}
type TriggerProps = ComponentPropsWithoutRef<'button'> & { asChild?: boolean };
export function DialogTrigger({ asChild, children, onClick, ...props }: TriggerProps) {
  const dialog = useDialogState();
  const activate = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!event.defaultPrevented) { event.currentTarget.focus(); dialog.setOpen(true); }
  };
  if (asChild) {
    const child = Children.only(children) as ReactElement<TriggerProps>;
    if (!isValidElement(child)) throw new Error('DialogTrigger requires an element');
    return cloneElement(child, { ...props, 'aria-haspopup': 'dialog', 'aria-expanded': dialog.open,
      onClick: event => { child.props.onClick?.(event); if (!event.defaultPrevented) activate(event); } });
  }
  return <Button aria-haspopup="dialog" aria-expanded={dialog.open} onClick={activate} {...props}>{children}</Button>;
}
export function DialogContent({ className, children, ...props }: ComponentPropsWithoutRef<'div'>) {
  const dialog = useDialogState();
  return <Modal.Root opened={dialog.open} onClose={() => dialog.setOpen(false)} id={dialog.id}
    centered size="100%" closeOnClickOutside={!dialog.alert} returnFocus trapFocus>
    <Modal.Overlay />
    <Modal.Content classNames={{ content: cn('w-full max-w-lg', className) }} {...props}>
      {!dialog.alert && <Modal.CloseButton aria-label="Close" className="absolute right-3 top-3 z-10" />}
      <Modal.Body className="p-6">{children}</Modal.Body>
    </Modal.Content>
  </Modal.Root>;
}
export function DialogTitle({ className, ...props }: ComponentPropsWithoutRef<'h2'>) {
  return <Modal.Title className={cn('pr-8 text-lg font-semibold leading-tight', className)} {...props} />;
}
export function DialogDescription({ className, ...props }: ComponentPropsWithoutRef<'p'>) { return <Text component="p" size="sm" c="dimmed" className={className} {...props} />; }
export function DialogHeader({ className, ...props }: ComponentPropsWithoutRef<'div'>) { return <Box className={cn('mb-4 flex flex-col gap-1.5', className)} {...props} />; }
export function DialogFooter({ className, ...props }: ComponentPropsWithoutRef<'div'>) { return <Box className={cn('mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />; }
