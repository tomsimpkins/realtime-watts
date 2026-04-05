import { Paper, SimpleGrid, Stack, Text } from "@mantine/core";

interface RideStatsDisplayProps {
	distanceDisplay: string;
	speedDisplay: string;
}

function splitMetric(display: string, defaultUnit: string) {
	if (display === "Unavailable") {
		return {
			unit: "Unavailable",
			value: "--",
		};
	}

	const match = display.match(/^(.+?)\s(.+)$/);

	return {
		unit: match?.[2] ?? defaultUnit,
		value: match?.[1] ?? display,
	};
}

export function RideStatsDisplay({
	distanceDisplay,
	speedDisplay,
}: RideStatsDisplayProps) {
	const speedMetric = splitMetric(speedDisplay, "km/h");
	const distanceMetric = splitMetric(distanceDisplay, "km");

	return (
		<Paper className="panel panel-muted" p="xl" radius="32px">
			<SimpleGrid
				className="summary-grid"
				cols={{ base: 1, sm: 2 }}
				spacing="md"
			>
				<div className="summary-card summary-card--metric">
					<Stack gap="xs">
						<Text className="summary-card__label">Speed</Text>
						<Text className="summary-card__value">{speedMetric.value}</Text>
						<Text className="summary-card__meta">{speedMetric.unit}</Text>
					</Stack>
				</div>
				<div className="summary-card summary-card--metric">
					<Stack gap="xs">
						<Text className="summary-card__label">Distance</Text>
						<Text className="summary-card__value">{distanceMetric.value}</Text>
						<Text className="summary-card__meta">{distanceMetric.unit}</Text>
					</Stack>
				</div>
			</SimpleGrid>
		</Paper>
	);
}
