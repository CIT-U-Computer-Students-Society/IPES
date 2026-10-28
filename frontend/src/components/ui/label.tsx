import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Input } from '@mantine/core';
import { cn } from '@/lib/utils';
export const Label = forwardRef<HTMLLabelElement, ComponentPropsWithoutRef<'label'>>(function Label({ className, ...props }, ref) {
  return <Input.Label ref={ref} className={cn('text-sm font-medium', className)} {...props} />;
});
