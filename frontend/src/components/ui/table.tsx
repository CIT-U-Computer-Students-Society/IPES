import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Table as MantineTable } from '@mantine/core';
import { cn } from '@/lib/utils';
export const Table = forwardRef<HTMLTableElement, ComponentPropsWithoutRef<'table'>>(function Table({ className, ...props }, ref) {
  return <div className="relative w-full overflow-auto"><MantineTable ref={ref} highlightOnHover className={cn('w-full text-sm', className)} {...props} /></div>;
});
export function TableHeader(props: ComponentPropsWithoutRef<'thead'>) { return <MantineTable.Thead {...props} />; }
export function TableBody(props: ComponentPropsWithoutRef<'tbody'>) { return <MantineTable.Tbody {...props} />; }
export function TableFooter(props: ComponentPropsWithoutRef<'tfoot'>) { return <MantineTable.Tfoot {...props} />; }
export function TableRow(props: ComponentPropsWithoutRef<'tr'>) { return <MantineTable.Tr {...props} />; }
export function TableHead({ className, ...props }: ComponentPropsWithoutRef<'th'>) { return <MantineTable.Th className={cn('h-12 px-4 text-left font-medium text-muted-foreground', className)} {...props} />; }
export function TableCell({ className, ...props }: ComponentPropsWithoutRef<'td'>) { return <MantineTable.Td className={cn('p-4', className)} {...props} />; }
export function TableCaption(props: ComponentPropsWithoutRef<'caption'>) { return <MantineTable.Caption {...props} />; }
