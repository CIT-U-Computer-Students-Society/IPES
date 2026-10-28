import { Children, isValidElement, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from 'react';
import { Menu, type MenuProps, type MenuDropdownProps } from '@mantine/core';
type ContentProps = MenuDropdownProps & { align?: 'start' | 'end' | 'center' };
export function DropdownMenu({ open, defaultOpen, onOpenChange, children, ...props }: Omit<MenuProps, 'opened' | 'defaultOpened' | 'onChange'> & { open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void }) {
  const content = Children.toArray(children).find(node => isValidElement<ContentProps>(node) && node.type === DropdownMenuContent);
  const align = isValidElement<ContentProps>(content) ? content.props.align : 'start';
  return <Menu opened={open} defaultOpened={defaultOpen} onChange={onOpenChange} position={align === 'end' ? 'bottom-end' : 'bottom-start'} withinPortal {...props}>{children}</Menu>;
}
export function DropdownMenuTrigger({ asChild, children }: { asChild?: boolean; children: ReactNode }) {
  return <Menu.Target>{asChild ? Children.only(children) as ReactElement : <button type="button">{children}</button>}</Menu.Target>;
}
export function DropdownMenuContent({ align: _align, ...props }: ContentProps) { return <Menu.Dropdown {...props} />; }
export function DropdownMenuItem(props: ComponentPropsWithoutRef<'button'>) { return <Menu.Item {...props} />; }
export function DropdownMenuSeparator() { return <Menu.Divider />; }
