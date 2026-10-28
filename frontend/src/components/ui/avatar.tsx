import { Children, isValidElement, type ComponentPropsWithoutRef } from 'react';
import { Avatar as MantineAvatar } from '@mantine/core';
type ImageProps = ComponentPropsWithoutRef<'img'>;
export function AvatarImage(_props: ImageProps) { return null; }
export function AvatarFallback({ children, ...props }: ComponentPropsWithoutRef<'span'>) { return <span {...props}>{children}</span>; }
export function Avatar({ children, ...props }: ComponentPropsWithoutRef<'div'>) {
  const nodes = Children.toArray(children);
  const image = nodes.find(node => isValidElement<ImageProps>(node) && node.type === AvatarImage);
  const fallback = nodes.find(node => isValidElement(node) && node.type === AvatarFallback);
  return <MantineAvatar radius="xl" src={isValidElement<ImageProps>(image) ? image.props.src : undefined}
    alt={isValidElement<ImageProps>(image) ? image.props.alt : undefined} {...props}>{fallback}</MantineAvatar>;
}
