import { Paper, SimpleGrid, Stack, Text } from '@mantine/core';

interface PowerDisplayProps {
  cadenceDisplay: string;
  powerDisplay: string;
}

function getCadenceMetric(cadenceDisplay: string) {
  if (cadenceDisplay === 'Unavailable') {
    return {
      unit: 'Unavailable',
      value: '--',
    };
  }

  const match = cadenceDisplay.match(/^(.+?)\s*rpm$/i);

  return {
    unit: match ? 'RPM' : '',
    value: match?.[1] ?? cadenceDisplay,
  };
}

export function PowerDisplay({ cadenceDisplay, powerDisplay }: PowerDisplayProps) {
  const cadenceMetric = getCadenceMetric(cadenceDisplay);

  return (
    <SimpleGrid className="power-display" cols={{ base: 1, sm: 2 }} spacing="md">
      <Paper className="power-card power-card--primary" p="xl" radius="32px">
        <Stack gap="sm">
          <div className="power-label">
            <span aria-hidden="true" className="power-dot power-dot--primary" />
            <span>Power</span>
          </div>
          <Text aria-live="polite" className="power-value">
            {powerDisplay}
          </Text>
          <Text className="power-unit">Watts</Text>
        </Stack>
      </Paper>

      <Paper className="power-card power-card--secondary" p="xl" radius="32px">
        <Stack gap="sm">
          <div className="power-label">
            <span aria-hidden="true" className="power-dot power-dot--secondary" />
            <span>Cadence</span>
          </div>
          <Text aria-live="polite" className="power-value">
            {cadenceMetric.value}
          </Text>
          <Text className="power-unit">{cadenceMetric.unit || 'RPM'}</Text>
        </Stack>
      </Paper>
    </SimpleGrid>
  );
}
