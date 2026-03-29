import { Paper, Stack, Text } from "@mantine/core";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

import type { PowerMeasurement } from "../domain/trainer";

interface PowerChartProps {
	samples: PowerMeasurement[];
}

export function PowerChart({ samples }: PowerChartProps) {
	const chartData = samples.map((sample) => ({
		label: new Date(sample.timestamp).toLocaleTimeString([], {
			minute: "2-digit",
			second: "2-digit",
		}),
		watts: sample.watts,
	}));

	return (
		<Paper className="chart-shell" p="xl" radius="32px">
			<Stack gap="md">
				<div>
					<Text className="section-title">Recent Power</Text>
					<Text className="section-copy">
						Rolling wattage history from the current session.
					</Text>
				</div>

				{chartData.length ? (
					<div style={{ height: 240, width: "100%" }}>
						<ResponsiveContainer>
							<AreaChart data={chartData}>
								<CartesianGrid
									stroke="rgba(255,255,255,0.06)"
									strokeDasharray="3 3"
									vertical={false}
								/>
								<XAxis
									dataKey="label"
									minTickGap={28}
									stroke="rgba(255,255,255,0.42)"
								/>
								<YAxis
									allowDecimals={false}
									stroke="rgba(255,255,255,0.42)"
									width={44}
								/>
								<Tooltip
									contentStyle={{
										background: "#101821",
										border: "1px solid rgba(255,255,255,0.05)",
										borderRadius: "16px",
									}}
									formatter={(value: number) => [`${value} W`, "Power"]}
									labelFormatter={(label) => `Time ${label}`}
								/>
								<Area
									dataKey="watts"
									fill="rgba(0, 212, 187, 0.14)"
									fillOpacity={1}
									stroke="#00d4bb"
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
