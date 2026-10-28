import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Button as MantineButton } from '@mantine/core';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
export type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: Variant;
  size?: 'default' | 'sm' | 'lg' | 'icon';
};
const variants = { default: 'filled', destructive: 'filled', outline: 'outline', secondary: 'light', ghost: 'subtle', link: 'subtle' } as const;
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'default', className, children, ...props }, ref,
) {
  return <MantineButton ref={ref} variant={variants[variant]} color={variant === 'destructive' ? 'red' : variant === 'secondary' ? 'amber' : undefined}
    classNames={{ label: 'gap-2' }}
    size={size === 'icon' ? 'sm' : size === 'default' ? 'sm' : size}
    className={cn('inline-flex items-center justify-center gap-2 font-medium [&_svg]:size-4 [&_svg]:shrink-0', size === 'icon' && 'h-10 w-10 p-0', variant === 'link' && 'underline underline-offset-4', className)} {...props}>{children}</MantineButton>;
});
