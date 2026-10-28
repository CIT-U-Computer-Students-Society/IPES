import { Children, isValidElement, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Select as MantineSelect, type SelectProps, type ComboboxItem } from '@mantine/core';
import { cn } from '@/lib/utils';

type MarkerProps = { children?: ReactNode; value?: string; disabled?: boolean; placeholder?: string };
type TriggerProps = ComponentPropsWithoutRef<'input'>;
// These declarations preserve existing page composition; Mantine renders the actual combobox.
export function SelectItem(_props: MarkerProps & { value: string }) { return null; }
export function SelectTrigger(_props: TriggerProps) { return null; }
export function SelectValue(_props: { placeholder?: string }) { return null; }
export function SelectContent({ children }: { children?: ReactNode }) { return <>{children}</>; }
function textContent(nodes: ReactNode): string {
  return Children.toArray(nodes).map(node => isValidElement<MarkerProps>(node) ? textContent(node.props.children) : String(node)).join('');
}
export function Select({ children, onValueChange, className, ...props }: Omit<SelectProps, 'data' | 'onChange' | 'children'> & { children?: ReactNode; onValueChange?: (value: string) => void }) {
  const data: ComboboxItem[] = [];
  let trigger: TriggerProps = {};
  let placeholder: string | undefined;
  const visit = (nodes: ReactNode) => Children.forEach(nodes, node => {
    if (!isValidElement<MarkerProps & TriggerProps>(node)) return;
    if (node.type === SelectItem) data.push({ value: node.props.value, label: textContent(node.props.children), disabled: node.props.disabled });
    if (node.type === SelectTrigger) trigger = node.props;
    if (node.type === SelectValue) placeholder = node.props.placeholder;
    visit(node.props.children);
  });
  visit(children);
  return <MantineSelect data={data} allowDeselect={false} placeholder={placeholder}
    id={trigger.id} aria-label={trigger['aria-label'] || placeholder || 'Select an option'} aria-labelledby={trigger['aria-labelledby']}
    aria-describedby={trigger['aria-describedby']} onBlur={trigger.onBlur}
    className={cn(trigger.className, className)} onChange={value => { if (value !== null) onValueChange?.(value); }}
    comboboxProps={{ withinPortal: true }} {...props} />;
}
