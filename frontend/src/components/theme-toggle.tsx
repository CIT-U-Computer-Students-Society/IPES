import { Moon, Sun } from 'lucide-react';
import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
export function ThemeToggle() {
  const scheme = useComputedColorScheme('light');
  const { setColorScheme } = useMantineColorScheme();
  return <ActionIcon variant="subtle" radius="xl" size="lg" aria-label="Toggle theme"
    onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}>
    {scheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
  </ActionIcon>;
}
