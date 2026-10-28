import { Progress as MantineProgress, type ProgressProps } from '@mantine/core';
type Props = Omit<ProgressProps, 'value' | 'classNames'> & { value?: number; max?: number; indicatorClassName?: string };
export function Progress({ value = 0, max = 100, indicatorClassName, ...props }: Props) {
  const percentage = max > 0 ? Math.min(100, Math.max(0, value / max * 100)) : 0;
  return <MantineProgress value={percentage} aria-label="Completion progress" aria-valuetext={`${value} of ${max}`}
    classNames={{ section: indicatorClassName }} {...props} />;
}
