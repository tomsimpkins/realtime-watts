import { Paper, Stack, Text } from '@mantine/core';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { PowerMeasurement } from '../domain/trainer';

interface PowerChartProps {
  samples: PowerMeasurement[];
}

export function PowerChart({ samples }: PowerChartProps) {
  const chartData = samples.map((sample) => ({
    label: new Date(sample.timestamp).toLocaleTimeString([], {
      minute: '2-digit',
      second: '2-digit',
    }),
    watts: sample.watts,
  }));

  return (
    <Paper p="lg" radius="xl" withBorder>
      <Stack gap="md">
        <div>
          <Text fw={700} size="lg">
            Recent Power
          </Text>
          <Text c="dimmed" size="sm">
            Rolling wattage history from the current session.
          </Text>
        </div>

        {chartData.length ? (
          <div style={{ height: 240, width: '100%' }}>
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="powerGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#94d82d" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#94d82d" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#2b2f3b" strokeDasharray="3 3" />
                <XAxis dataKey="label" minTickGap={28} stroke="#9ca3af" />
                <YAxis allowDecimals={false} stroke="#9ca3af" width={44} />
                <Tooltip
                  formatter={(value: number) => [`${value} W`, 'Power']}
                  labelFormatter={(label) => `Time ${label}`}
                />
                <Area
                  dataKey="watts"
                  fill="url(#powerGradient)"
                  fillOpacity={1}
                  stroke="#94d82d"
                  strokeWidth={3}
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Text c="dimmed" size="sm">
            No power samples yet. Start pedaling to see the chart fill in.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
