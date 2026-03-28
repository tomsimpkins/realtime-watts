import { Paper, Stack, Text } from '@mantine/core';

interface PowerDisplayProps {
  subtitle?: string;
  wattsDisplay: string;
}

export function PowerDisplay({ subtitle, wattsDisplay }: PowerDisplayProps) {
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
        {subtitle ? (
          <Text c="dimmed" size="sm">
            {subtitle}
          </Text>
        ) : null}
      </Stack>
    </Paper>
  );
}
