import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Input as MantineInput } from '@mantine/core';
import { cn } from '@/lib/utils';
export type InputProps = Omit<ComponentPropsWithoutRef<'input'>, 'size'>;
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return <MantineInput ref={ref} error={props['aria-invalid'] === true || props['aria-invalid'] === 'true'} attributes={{ input: { 'aria-describedby': props['aria-describedby'] } }} classNames={{ input: cn('h-10 text-sm', className) }} {...props} />;
});
