import { Tabs as MantineTabs, type TabsProps, type TabsListProps, type TabsPanelProps, type TabsTabProps } from '@mantine/core';
import { cn } from '@/lib/utils';
export function Tabs({ onValueChange, ...props }: Omit<TabsProps, 'onChange'> & { onValueChange?: (value: string) => void }) {
  return <MantineTabs variant="pills" keepMounted={false} onChange={value => { if (value !== null) onValueChange?.(value); }} {...props} />;
}
export function TabsList({ className, ...props }: TabsListProps) { return <MantineTabs.List className={cn('rounded-md bg-muted p-1', className)} {...props} />; }
export function TabsTrigger(props: TabsTabProps) { return <MantineTabs.Tab {...props} />; }
export function TabsContent({ className, ...props }: TabsPanelProps) { return <MantineTabs.Panel className={cn('mt-2', className)} {...props} />; }
