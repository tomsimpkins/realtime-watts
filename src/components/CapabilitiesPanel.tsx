import { SimpleGrid, Text, ThemeIcon } from "@mantine/core";
import {
	IconAdjustments,
	IconBike,
	IconBolt,
	IconGauge,
	IconRotate,
	IconRun,
} from "@tabler/icons-react";

import type { Capability, TrainerCapabilityStatuses } from "../domain/trainer";

interface CapabilitiesPanelProps {
	statuses: TrainerCapabilityStatuses;
}

interface CapabilityConfig {
	icon: typeof IconBolt;
	key: Capability;
	label: string;
}

const CAPABILITIES: CapabilityConfig[] = [
	{ key: "power", label: "Power", icon: IconBolt },
	{ key: "cadence", label: "Cadence", icon: IconRotate },
	{ key: "speed", label: "Speed", icon: IconGauge },
	{
		key: "resistanceControl",
		label: "Resistance Control",
		icon: IconAdjustments,
	},
	{ key: "ergMode", label: "ERG Mode", icon: IconBike },
	{ key: "simulationMode", label: "Simulation Mode", icon: IconRun },
];

function getStatusTone(status: TrainerCapabilityStatuses[Capability]) {
	switch (status) {
		case "available":
			return "available";
		case "checking":
			return "checking";
		case "unavailable":
			return "unavailable";
		default:
			return "unknown";
	}
}

function getIconColor(status: TrainerCapabilityStatuses[Capability]) {
	switch (status) {
		case "available":
			return "accent";
		case "checking":
			return "ember";
		default:
			return "dark";
	}
}

export function CapabilitiesPanel({ statuses }: CapabilitiesPanelProps) {
	return (
		<SimpleGrid
			className="capability-grid capability-grid--compact"
			cols={{ base: 2, sm: 3 }}
			spacing="sm"
		>
			{CAPABILITIES.map((capability) => {
				const Icon = capability.icon;
				const status = statuses[capability.key];
				const tone = getStatusTone(status);

				return (
					<div
						className={`capability-item capability-item--${tone}`}
						key={capability.key}
					>
						<div className="capability-main">
							<ThemeIcon
								color={getIconColor(status)}
								radius="xl"
								size={40}
								variant="light"
							>
								<Icon size={20} stroke={2.2} />
							</ThemeIcon>
							<div className="capability-copy">
								<Text className="capability-title">{capability.label}</Text>
							</div>
						</div>
					</div>
				);
			})}
		</SimpleGrid>
	);
}
