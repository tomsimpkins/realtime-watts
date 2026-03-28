import {
  Accordion,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core';

import type { TrainerMode } from '../domain/trainer';

interface DiagnosticsPanelProps {
  averageWatts10s?: number;
  deviceName?: string;
  isSecureContext: boolean;
  isWebBluetoothSupported: boolean;
  lastPacketTimestamp?: number;
  mode: TrainerMode;
  sampleCount: number;
}

function formatValue(value: string) {
  return (
    <Text fw={700} size="sm">
      {value}
    </Text>
  );
}

export function DiagnosticsPanel({
  averageWatts10s,
  deviceName,
  isSecureContext,
  isWebBluetoothSupported,
  lastPacketTimestamp,
  mode,
  sampleCount,
}: DiagnosticsPanelProps) {
  const lastPacketText = lastPacketTimestamp
    ? new Date(lastPacketTimestamp).toLocaleTimeString()
    : 'No packets yet';

  return (
    <Paper p="lg" radius="xl" withBorder>
      <Accordion radius="md" variant="contained">
        <Accordion.Item value="diagnostics">
          <Accordion.Control>Diagnostics</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <Text c="dimmed" size="sm">
                Quick visibility into browser support, device state, and stream health.
              </Text>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <div>
                  <Text c="dimmed" size="xs" tt="uppercase">
                    Mode
                  </Text>
                  {formatValue(mode === 'simulate' ? 'Simulation' : 'Web Bluetooth')}
                </div>
                <div>
                  <Text c="dimmed" size="xs" tt="uppercase">
                    Browser Support
                  </Text>
                  {formatValue(isWebBluetoothSupported ? 'Supported' : 'Missing')}
                </div>
                <div>
                  <Text c="dimmed" size="xs" tt="uppercase">
                    Secure Context
                  </Text>
                  {formatValue(isSecureContext ? 'Yes' : 'No')}
                </div>
                <div>
                  <Text c="dimmed" size="xs" tt="uppercase">
                    Device
                  </Text>
                  {formatValue(deviceName ?? 'None selected')}
                </div>
                <div>
                  <Text c="dimmed" size="xs" tt="uppercase">
                    Last Packet
                  </Text>
                  {formatValue(lastPacketText)}
                </div>
                <div>
                  <Text c="dimmed" size="xs" tt="uppercase">
                    Sample Count
                  </Text>
                  {formatValue(String(sampleCount))}
                </div>
              </SimpleGrid>

              <Group justify="space-between">
                <div>
                  <Text c="dimmed" size="xs" tt="uppercase">
                    Avg Power (10s)
                  </Text>
                  {formatValue(
                    typeof averageWatts10s === 'number'
                      ? `${averageWatts10s} W`
                      : 'Waiting for samples'
                  )}
                </div>
              </Group>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Paper>
  );
}
