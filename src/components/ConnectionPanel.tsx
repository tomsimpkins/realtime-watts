import { Badge, Group, Paper, Stack, Text } from '@mantine/core';

import type { TrainerMode } from '../domain/trainer';

interface ConnectionPanelProps {
  deviceName?: string;
  mode: TrainerMode;
}

export function ConnectionPanel({ deviceName, mode }: ConnectionPanelProps) {
  return (
    <Paper p="lg" radius="xl" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <div>
            <Text fw={700} size="lg">
              Trainer Connection
            </Text>
            <Text c="dimmed" size="sm">
              Connect a smart trainer, inspect capabilities, and continue only when live power is available.
            </Text>
          </div>

          {mode === 'simulate' ? <Badge color="violet">Simulation</Badge> : null}
        </Group>

        <Text size="sm">
          {deviceName ? `Selected device: ${deviceName}` : 'No trainer selected yet.'}
        </Text>
      </Stack>
    </Paper>
  );
}
