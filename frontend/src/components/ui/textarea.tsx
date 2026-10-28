import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Textarea as MantineTextarea } from '@mantine/core';
import { cn } from '@/lib/utils';
export type TextareaProps = ComponentPropsWithoutRef<'textarea'>;
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, ...props }, ref) {
  return <MantineTextarea ref={ref} error={props['aria-invalid'] === true || props['aria-invalid'] === 'true'} attributes={{ input: { 'aria-describedby': props['aria-describedby'] } }} classNames={{ input: cn('min-h-20 text-sm', className) }} {...props} />;
});
