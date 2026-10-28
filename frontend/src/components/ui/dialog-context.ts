import { createContext, useContext } from 'react';
export type DialogState = { open: boolean; setOpen: (open: boolean) => void; id: string; alert: boolean };
export const DialogContext = createContext<DialogState | null>(null);
export function useDialogState() {
  const value = useContext(DialogContext);
  if (!value) throw new Error('Dialog components must be inside Dialog');
  return value;
}
