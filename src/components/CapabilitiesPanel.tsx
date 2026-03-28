import { Badge, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconAdjustments,
  IconBike,
  IconBolt,
  IconGauge,
  IconRotate,
  IconRun,
} from '@tabler/icons-react';

import type { Capability, TrainerCapabilityStatuses } from '../domain/trainer';

interface CapabilitiesPanelProps {
  statuses: TrainerCapabilityStatuses;
}

interface CapabilityConfig {
  description: string;
  icon: typeof IconBolt;
  key: Capability;
  label: string;
}

const CAPABILITIES: CapabilityConfig[] = [
  {
    key: 'power',
    label: 'Power',
    description: 'Live cycling power measurement',
    icon: IconBolt,
  },
  {
    key: 'cadence',
    label: 'Cadence',
    description: 'Pedal cadence telemetry',
    icon: IconRotate,
  },
  {
    key: 'speed',
    label: 'Speed',
    description: 'Virtual speed telemetry',
    icon: IconGauge,
  },
  {
    key: 'resistanceControl',
    label: 'Resistance Control',
    description: 'Control-oriented FTMS features',
    icon: IconAdjustments,
  },
  {
    key: 'ergMode',
    label: 'ERG Mode',
    description: 'Best-effort ERG support detection',
    icon: IconBike,
  },
  {
    key: 'simulationMode',
    label: 'Simulation Mode',
    description: 'Best-effort simulation support detection',
    icon: IconRun,
  },
];

function getStatusColor(status: TrainerCapabilityStatuses[Capability]) {
  switch (status) {
    case 'available':
      return 'green';
    case 'checking':
      return 'yellow';
    case 'unavailable':
      return 'gray';
    default:
      return 'dark';
  }
}

export function CapabilitiesPanel({ statuses }: CapabilitiesPanelProps) {
  return (
    <Paper p="lg" radius="xl" withBorder>
      <Stack gap="md">
        <div>
          <Text fw={700} size="lg">
            Detected Capabilities
          </Text>
          <Text c="dimmed" size="sm">
            Capability availability is inferred from discovered BLE services and characteristics.
          </Text>
        </div>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {CAPABILITIES.map((capability) => {
            const Icon = capability.icon;
            const status = statuses[capability.key];

            return (
              <Paper key={capability.key} p="md" radius="lg" withBorder>
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon color={getStatusColor(status)} radius="xl" variant="light">
                      <Icon size={18} />
                    </ThemeIcon>
                    <div>
                      <Text fw={700} size="sm">
                        {capability.label}
                      </Text>
                      <Text c="dimmed" size="xs">
                        {capability.description}
                      </Text>
                    </div>
                  </Group>
                  <Badge color={getStatusColor(status)} variant="light">
                    {status}
                  </Badge>
                </Group>
              </Paper>
            );
          })}
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}
