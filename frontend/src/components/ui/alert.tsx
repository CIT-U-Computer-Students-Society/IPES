import { Alert as MantineAlert, Text, type AlertProps } from '@mantine/core';
import type { ComponentPropsWithoutRef } from 'react';
export function Alert({ variant = 'default', ...props }: Omit<AlertProps, 'variant'> & { variant?: 'default' | 'destructive' }) {
  return <MantineAlert role="alert" color={variant === 'destructive' ? 'red' : undefined} variant="light" {...props} />;
}
export function AlertTitle(props: ComponentPropsWithoutRef<'h5'>) { return <Text component="h5" fw={600} {...props} />; }
export function AlertDescription(props: ComponentPropsWithoutRef<'div'>) { return <Text component="div" size="sm" {...props} />; }
