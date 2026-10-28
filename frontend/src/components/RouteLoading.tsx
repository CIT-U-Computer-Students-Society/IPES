import { Center, Loader, Stack, Text } from "@mantine/core";

export function RouteLoading() {
  return (
    <Center mih="12rem" role="status" aria-live="polite">
      <Stack align="center" gap="sm">
        <Loader aria-hidden="true" />
        <Text c="dimmed">Loading page…</Text>
      </Stack>
    </Center>
  );
}
