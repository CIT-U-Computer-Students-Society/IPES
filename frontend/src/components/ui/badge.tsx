import { Badge as MantineBadge } from '@mantine/core';
import type { ComponentPropsWithoutRef } from 'react';
export type BadgeProps = ComponentPropsWithoutRef<'span'> & { variant?: 'default' | 'secondary' | 'destructive' | 'outline' };
export function Badge({ variant = 'default', ...props }: BadgeProps) {
  return <MantineBadge component="span" variant={variant === 'outline' ? 'outline' : variant === 'secondary' ? 'light' : 'filled'}
    color={variant === 'destructive' ? 'red' : variant === 'secondary' ? 'amber' : undefined} tt="none" {...props} />;
}
