import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Box, Card as MantineCard, Text, Title } from '@mantine/core';
import { cn } from '@/lib/utils';
type DivProps = ComponentPropsWithoutRef<'div'>;
export const Card = forwardRef<HTMLDivElement, DivProps>(function Card({ className, ...props }, ref) {
  return <MantineCard ref={ref} withBorder padding={0} shadow="xs" className={cn('rounded-xl bg-card text-card-foreground', className)} {...props} />;
});
export function CardHeader({ className, ...props }: DivProps) { return <Box className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />; }
export function CardContent({ className, ...props }: DivProps) { return <Box className={cn('p-6 pt-0', className)} {...props} />; }
export function CardFooter({ className, ...props }: DivProps) { return <Box className={cn('flex items-center p-6 pt-0', className)} {...props} />; }
export function CardTitle({ className, ...props }: ComponentPropsWithoutRef<'h3'>) { return <Title order={3} className={cn('text-xl font-semibold tracking-tight', className)} {...props} />; }
export function CardDescription({ className, ...props }: ComponentPropsWithoutRef<'p'>) { return <Text component="p" size="sm" c="dimmed" className={className} {...props} />; }
