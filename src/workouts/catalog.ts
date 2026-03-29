import type { WorkoutBlock, WorkoutDefinition } from "../domain/workout";

function createNoTargetBlock(
	id: string,
	label: string,
	durationSeconds: number,
): WorkoutBlock {
	return {
		id,
		label,
		durationSeconds,
		target: { kind: "none" },
	};
}

function createFtpTargetBlock(
	id: string,
	label: string,
	durationSeconds: number,
	ftpPercent: number,
): WorkoutBlock {
	return {
		id,
		label,
		durationSeconds,
		target: { kind: "ftpPercent", value: ftpPercent },
	};
}

const tabataBlocks: WorkoutBlock[] = [
	createNoTargetBlock("warmup", "Warm-up", 10),
	...Array.from({ length: 8 }).flatMap((_, index) => [
		createFtpTargetBlock(`tabata-${index + 1}`, `Hard ${index + 1}`, 20, 120),
		createNoTargetBlock(`rest-${index + 1}`, `Rest ${index + 1}`, 10),
	]),
	createNoTargetBlock("cooldown", "Cool-down", 300),
];

export const WORKOUT_CATALOG: WorkoutDefinition[] = [
	{
		id: "freeRide",
		name: "Free Ride",
		type: "freeRide",
		durationSeconds: 0,
		description: "Ride freely with live telemetry and no structured intervals.",
		blocks: [],
	},
	{
		id: "twoByTwenty",
		name: "20 min x 2",
		type: "structured",
		durationSeconds: 3000,
		description: "Two steady threshold-style intervals separated by recovery.",
		blocks: [
			createNoTargetBlock("warmup", "Warm-up", 300),
			createFtpTargetBlock("interval-1", "Interval 1", 1200, 90),
			createNoTargetBlock("recovery", "Recovery", 300),
			createFtpTargetBlock("interval-2", "Interval 2", 1200, 90),
			createNoTargetBlock("cooldown", "Cool-down", 300),
		],
	},
	{
		id: "tabata",
		name: "Tabata",
		type: "structured",
		durationSeconds: 840,
		description: "Short high-intensity intervals with brief recoveries.",
		blocks: tabataBlocks,
	},
];

export const WORKOUTS_BY_ID = Object.fromEntries(
	WORKOUT_CATALOG.map((workout) => [workout.id, workout]),
) as Record<string, WorkoutDefinition>;
