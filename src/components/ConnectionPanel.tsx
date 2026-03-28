import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core';
import {
  IconBluetooth,
  IconPlugConnectedX,
  IconRefresh,
} from '@tabler/icons-react';

import type { ConnectionState, TrainerMode } from '../domain/trainer';

interface ConnectionPanelProps {
  canConnect: boolean;
  canDisconnect: boolean;
  canReconnect: boolean;
  connectionState: ConnectionState;
  deviceName?: string;
  mode: TrainerMode;
  onConnect: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
}

export function ConnectionPanel({
  canConnect,
  canDisconnect,
  canReconnect,
  connectionState,
  deviceName,
  mode,
  onConnect,
  onDisconnect,
  onReconnect,
}: ConnectionPanelProps) {
  const isConnecting =
    connectionState === 'requesting' || connectionState === 'connecting';

  return (
    <Paper p="lg" radius="xl" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <div>
            <Text fw={700} size="lg">
              Trainer Connection
            </Text>
            <Text c="dimmed" size="sm">
              Use the browser Bluetooth picker to connect to a smart trainer.
            </Text>
          </div>

          {mode === 'simulate' ? <Badge color="violet">Simulation</Badge> : null}
        </Group>

        <Text size="sm">
          {deviceName ? `Selected device: ${deviceName}` : 'No trainer selected yet.'}
        </Text>

        <Group>
          <Button
            disabled={!canConnect}
            leftSection={<IconBluetooth size={16} />}
            loading={isConnecting}
            onClick={onConnect}
            radius="xl"
          >
            Connect Trainer
          </Button>

          <Button
            disabled={!canReconnect}
            leftSection={<IconRefresh size={16} />}
            loading={connectionState === 'connecting'}
            onClick={onReconnect}
            radius="xl"
            variant="default"
          >
            Reconnect
          </Button>

          <Button
            color="red"
            disabled={!canDisconnect}
            leftSection={<IconPlugConnectedX size={16} />}
            loading={connectionState === 'disconnecting'}
            onClick={onDisconnect}
            radius="xl"
            variant="light"
          >
            Disconnect
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
