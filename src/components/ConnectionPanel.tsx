import { Paper, Stack, Text } from '@mantine/core';

import type { TrainerMode } from '../domain/trainer';

interface ConnectionPanelProps {
  deviceName?: string;
  mode: TrainerMode;
}

export function ConnectionPanel({ deviceName, mode }: ConnectionPanelProps) {
  return (
    <Paper className="panel" p="xl" radius="32px">
      <Stack gap="lg">
        <div>
          <Text className="section-title">Trainer Connection</Text>
        </div>

        <div className="data-grid">
          <div className="data-chip data-chip--accent">
            <Text className="data-chip__label">Mode</Text>
            <Text className="data-chip__value">
              {mode === 'simulate' ? 'Simulation' : 'Web Bluetooth'}
            </Text>
          </div>
          <div className="data-chip">
            <Text className="data-chip__label">Device</Text>
            <Text className="data-chip__value">
              {deviceName ?? 'No trainer selected yet'}
            </Text>
          </div>
        </div>
      </Stack>
    </Paper>
  );
}
