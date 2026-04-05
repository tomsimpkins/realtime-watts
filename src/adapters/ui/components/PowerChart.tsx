import { Paper, Stack, Text } from "@mantine/core";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

import type { PowerHistogramBin } from "../state/metricsSelectors";

interface PowerChartProps {
	bins: PowerHistogramBin[];
}

export function PowerChart({ bins }: PowerChartProps) {
	const chartData = bins.map((bin) => ({
		label: new Date(bin.timestamp).toLocaleTimeString([], {
			minute: "2-digit",
			second: "2-digit",
		}),
		watts: bin.watts,
	}));

	return (
		<Paper className="chart-shell" p="xl" radius="32px">
			<Stack gap="md">
				<div>
					<Text className="section-title">Recent Power</Text>
					<Text className="section-copy">
						Average wattage in 5-second bars from the current session.
					</Text>
				</div>

				{chartData.length ? (
					<div style={{ height: 240, width: "100%" }}>
						<ResponsiveContainer>
							<BarChart data={chartData}>
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
									cursor={{ fill: "rgba(255,255,255,0.06)" }}
									contentStyle={{
										background: "#101821",
										border: "1px solid rgba(255,255,255,0.05)",
										borderRadius: "16px",
									}}
									formatter={(value: number) => [`${value} W`, "Avg Power"]}
									labelFormatter={(label) => `Time ${label}`}
								/>
								<Bar
									dataKey="watts"
									fill="#00d4bb"
									maxBarSize={28}
									radius={[8, 8, 0, 0]}
								/>
							</BarChart>
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
