export type WorkoutType = "freeRide" | "structured";

export interface WorkoutDefinition {
	id: string;
	name: string;
	type: WorkoutType;
	durationSeconds: number;
	description: string;
	blocks: WorkoutBlock[];
}

export interface WorkoutBlock {
	id: string;
	label: string;
	durationSeconds: number;
	target?: {
		kind: "none" | "ftpPercent" | "watts";
		value?: number;
	};
}

export type WorkoutStatus = "idle" | "active" | "paused" | "completed";
