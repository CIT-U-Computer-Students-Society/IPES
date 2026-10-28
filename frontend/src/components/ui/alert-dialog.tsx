import type { ComponentPropsWithoutRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter, DialogTrigger, type DialogProps } from './dialog';
import { Button, type ButtonProps } from './button';
import { useDialogState } from './dialog-context';
export function AlertDialog(props: DialogProps) { return <Dialog {...props} alert />; }
export const AlertDialogContent = DialogContent;
export const AlertDialogTitle = DialogTitle;
export const AlertDialogDescription = DialogDescription;
export const AlertDialogHeader = DialogHeader;
export const AlertDialogFooter = DialogFooter;
export const AlertDialogTrigger = DialogTrigger;
function ConfirmationButton({ onClick, ...props }: ButtonProps & { 'data-autofocus'?: boolean }) {
  const dialog = useDialogState();
  const handleClick: ComponentPropsWithoutRef<'button'>['onClick'] = event => {
    onClick?.(event);
    if (!event.defaultPrevented) dialog.setOpen(false);
  };
  return <Button onClick={handleClick} {...props} />;
}
export function AlertDialogAction(props: ButtonProps) { return <ConfirmationButton {...props} />; }
export function AlertDialogCancel(props: ButtonProps) { return <ConfirmationButton variant="outline" data-autofocus {...props} />; }
