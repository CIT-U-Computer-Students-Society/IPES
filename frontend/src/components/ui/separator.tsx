import { Divider, type DividerProps } from '@mantine/core';
export function Separator({ decorative = true, ...props }: DividerProps & { decorative?: boolean }) {
  return <Divider aria-hidden={decorative || undefined} {...props} />;
}
