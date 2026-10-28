import { useLayoutEffect, type ReactNode } from 'react';
import { createTheme, localStorageColorSchemeManager, MantineProvider, useComputedColorScheme } from '@mantine/core';

const theme = createTheme({
  primaryColor: 'navy',
  colors: {
    navy: ['#eef4f9', '#dce6f0', '#b8cbdf', '#90aecf', '#7095c0', '#5985b7', '#4b7db4', '#3d6a9d', '#335f8d', '#293f55'],
    amber: ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12'],
  },
  primaryShade: { light: 9, dark: 4 },
  fontFamily: 'Montserrat, ui-sans-serif, system-ui, sans-serif',
  defaultRadius: 'md',
  focusRing: 'auto',
  components: {
    Button: { defaultProps: { fw: 500 } },
    Modal: { defaultProps: { centered: true, radius: 'lg', overlayProps: { backgroundOpacity: 0.55, blur: 2 } } },
  },
});
const colorSchemeManager = localStorageColorSchemeManager({ key: 'theme' });
function PageColorScheme({ children }: { children: ReactNode }) {
  const scheme = useComputedColorScheme('light', { getInitialValueInEffect: false });
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', scheme === 'dark');
  }, [scheme]);
  return children;
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <MantineProvider env={import.meta.env.MODE === 'test' ? 'test' : undefined} theme={theme} defaultColorScheme="auto" colorSchemeManager={colorSchemeManager}>
    <PageColorScheme>{children}</PageColorScheme>
  </MantineProvider>;
}
