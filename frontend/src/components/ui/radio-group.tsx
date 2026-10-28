import { forwardRef } from 'react';
import { Radio, type RadioGroupProps, type RadioProps, type RadioCardProps } from '@mantine/core';
import { cn } from '@/lib/utils';
export function RadioGroup({ onValueChange, className, ...props }: Omit<RadioGroupProps, 'onChange'> & { onValueChange?: (value: string) => void }) {
  return <Radio.Group onChange={onValueChange} {...props}><div className={cn('flex flex-wrap gap-2', className)}>{props.children}</div></Radio.Group>;
}
export const RadioGroupItem = forwardRef<HTMLInputElement, RadioProps>(function RadioGroupItem(props, ref) { return <Radio ref={ref} {...props} />; });
export function RadioGroupCard({ className, ...props }: RadioCardProps) {
  return <Radio.Card className={cn('flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 transition-all data-[checked]:border-primary data-[checked]:bg-primary/10 disabled:opacity-70 enabled:cursor-pointer enabled:hover:bg-accent/50 enabled:hover:border-primary/50', className)} {...props} />;
}
