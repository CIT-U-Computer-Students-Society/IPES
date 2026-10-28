import { notifications } from '@mantine/notifications';
import type { ReactNode } from 'react';
type Options = { description?: ReactNode; duration?: number };
const show = (color: string, title: string, options: Options = {}) => notifications.show({
  color, title: options.description ? title : undefined, message: options.description || title,
  autoClose: options.duration ?? 5000, withCloseButton: true,
});
export const toast = {
  success: (title: string, options?: Options) => show('teal', title, options),
  error: (title: string, options?: Options) => show('red', title, options),
  info: (title: string, options?: Options) => show('blue', title, options),
  warning: (title: string, options?: Options) => show('yellow', title, options),
};
