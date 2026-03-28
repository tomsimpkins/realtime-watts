import { Paper, Stack, Text } from '@mantine/core';

interface PowerDisplayProps {
  deviceName?: string;
  wattsDisplay: string;
}

export function PowerDisplay({ deviceName, wattsDisplay }: PowerDisplayProps) {
  return (
    <Paper className="power-display" p="xl" radius="xl" withBorder>
      <Stack align="center" gap="xs">
        <Text c="dimmed" size="lg" tt="uppercase">
          Live Power
        </Text>
        <Text aria-live="polite" className="power-value">
          {wattsDisplay}
        </Text>
        <Text c="dimmed" size="xl">
          Watts
        </Text>
        <Text c="dimmed" size="sm">
          {deviceName
            ? `Streaming from ${deviceName}`
            : 'Waiting for a trainer connection.'}
        </Text>
      </Stack>
    </Paper>
  );
}
