import { forwardRef } from 'react';
import { Switch as MantineSwitch, type SwitchProps } from '@mantine/core';
type Props = Omit<SwitchProps, 'onChange'> & { onCheckedChange?: (checked: boolean) => void };
export const Switch = forwardRef<HTMLInputElement, Props>(function Switch({ onCheckedChange, ...props }, ref) {
  return <MantineSwitch ref={ref} onChange={event => onCheckedChange?.(event.currentTarget.checked)} {...props} />;
});
