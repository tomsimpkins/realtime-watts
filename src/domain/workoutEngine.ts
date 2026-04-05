import type { PowerMeasurement } from "./trainer";
import type { WorkoutBlock, WorkoutDefinition, WorkoutStatus } from "./workout";
import type {
	CyclingPowerCrankData,
	CyclingPowerWheelData,
} from "../protocol/cyclingPower";
import {
	estimateCadenceRpm,
	estimateDistanceKm,
	estimateSpeedKph,
} from "../protocol/cyclingPower";
import { appendAndTrimByTime } from "../utils/ringBuffer";

const MAX_RECENT_POWER_SAMPLES = 240;
const RECENT_POWER_WINDOW_MS = 120_000;
const DEFAULT_FTP_WATTS = 250;

export type WorkoutControlIntent =
	| {
			type: "trainer.control.disable-erg";
	  }
	| {
			type: "trainer.control.set-erg-power";
			payload: {
				watts: number;
			};
	  };

export type WorkoutTelemetryEvent = {
	type: "workout.telemetry";
	payload: {
		cadenceRpm?: number;
		crankRevolutionData?: CyclingPowerCrankData;
		distanceKm?: number;
		source: PowerMeasurement["source"];
		speedKph?: number;
		timestampMs: number;
		watts: number;
		wheelRevolutionData?: CyclingPowerWheelData;
	};
};

export interface WorkoutSessionSnapshot {
	selectedWorkoutId?: string;
	status: WorkoutStatus;
	runningSinceMs?: number;
	accumulatedElapsedMs: number;
	completedAtMs?: number;
}

export interface WorkoutMetricsSnapshot {
	latestPower?: PowerMeasurement;
	recentPower: PowerMeasurement[];
	diagnostics: {
		lastPacketTimestamp?: number;
		sampleCount: number;
	};
}

type WorkoutSelectedEvent = {
	type: "workout.selected";
	payload: {
		workout?: WorkoutDefinition;
	};
};

type WorkoutClockTickedEvent = {
	type: "clock.ticked";
	payload: {
		clockMs: number;
	};
};

type WorkoutStartedEvent = {
	type: "workout.started";
	payload: {
		clockMs: number;
	};
};

type WorkoutPausedEvent = {
	type: "workout.paused";
	payload: {
		clockMs: number;
	};
};

type WorkoutResumedEvent = {
	type: "workout.resumed";
	payload: {
		clockMs: number;
	};
};

type WorkoutEndedEvent = {
	type: "workout.ended";
};

type WorkoutEngineEvent =
	| WorkoutTelemetryEvent
	| WorkoutSelectedEvent
	| WorkoutClockTickedEvent
	| WorkoutStartedEvent
	| WorkoutPausedEvent
	| WorkoutResumedEvent
	| WorkoutEndedEvent
	| { type: "workout.reset" }
	| { type: "workout.stream-idle" };

const initialSnapshot: WorkoutMetricsSnapshot = {
	latestPower: undefined,
	recentPower: [],
	diagnostics: {
		lastPacketTimestamp: undefined,
		sampleCount: 0,
	},
};

const initialWorkoutSnapshot: WorkoutSessionSnapshot = {
	status: "idle",
	accumulatedElapsedMs: 0,
};

function cloneSnapshot(
	snapshot: WorkoutMetricsSnapshot,
): WorkoutMetricsSnapshot {
	return {
		latestPower: snapshot.latestPower,
		recentPower: [...snapshot.recentPower],
		diagnostics: {
			...snapshot.diagnostics,
		},
	};
}

function findCurrentBlock(blocks: WorkoutBlock[], elapsedSeconds: number) {
	let blockStart = 0;

	for (const block of blocks) {
		const blockEnd = blockStart + block.durationSeconds;

		if (elapsedSeconds < blockEnd) {
			return block;
		}

		blockStart = blockEnd;
	}

	return blocks.at(-1);
}

function resolveTargetWatts(block?: WorkoutBlock): number | undefined {
	if (!block?.target || block.target.kind === "none") {
		return undefined;
	}

	if (block.target.kind === "ftpPercent") {
		return Math.round((DEFAULT_FTP_WATTS * (block.target.value ?? 0)) / 100);
	}

	return block.target.value;
}

export class WorkoutEngine {
	private snapshot: WorkoutMetricsSnapshot = cloneSnapshot(initialSnapshot);
	private readonly controlIntentListeners = new Set<
		(intent: WorkoutControlIntent) => void
	>();
	private readonly workoutSnapshotListeners = new Set<
		(snapshot: WorkoutSessionSnapshot) => void
	>();
	private initialWheelData: CyclingPowerWheelData | undefined;
	private lastControlIntentKey: string | undefined;
	private previousCadenceRpm: number | undefined;
	private previousCrankData: CyclingPowerCrankData | undefined;
	private previousSpeedKph: number | undefined;
	private previousWheelData: CyclingPowerWheelData | undefined;
	private workoutDefinition: WorkoutDefinition | undefined;
	private workoutSnapshot: WorkoutSessionSnapshot = {
		...initialWorkoutSnapshot,
	};

	dispatch(event: WorkoutEngineEvent): void {
		switch (event.type) {
			case "workout.reset":
				this.reset();
				return;
			case "workout.selected":
				this.reduceSelectedWorkout(event);
				return;
			case "workout.started":
				this.reduceStartedWorkout(event);
				return;
			case "workout.paused":
				this.reducePausedWorkout(event);
				return;
			case "workout.resumed":
				this.reduceResumedWorkout(event);
				return;
			case "clock.ticked":
				this.reduceClockTicked(event);
				return;
			case "workout.ended":
				this.clearWorkout();
				return;
			case "workout.stream-idle":
				this.snapshot = {
					...this.snapshot,
					latestPower: undefined,
				};
				return;
			case "workout.telemetry":
				this.reduceTelemetry(event);
		}
	}

	getSnapshot(): WorkoutMetricsSnapshot {
		return cloneSnapshot(this.snapshot);
	}

	getWorkoutSnapshot(): WorkoutSessionSnapshot {
		return { ...this.workoutSnapshot };
	}

	subscribeToControlIntents(
		listener: (intent: WorkoutControlIntent) => void,
	): () => void {
		this.controlIntentListeners.add(listener);

		return () => {
			this.controlIntentListeners.delete(listener);
		};
	}

	subscribeToWorkoutSnapshots(
		listener: (snapshot: WorkoutSessionSnapshot) => void,
	): () => void {
		this.workoutSnapshotListeners.add(listener);

		return () => {
			this.workoutSnapshotListeners.delete(listener);
		};
	}

	private reduceTelemetry(event: WorkoutTelemetryEvent): void {
		const {
			cadenceRpm: directCadenceRpm,
			crankRevolutionData,
			distanceKm: directDistanceKm,
			source,
			speedKph: directSpeedKph,
			timestampMs,
			watts,
			wheelRevolutionData,
		} = event.payload;

		if (wheelRevolutionData && !this.initialWheelData) {
			this.initialWheelData = wheelRevolutionData;
		}

		const cadenceRpm =
			directCadenceRpm ??
			estimateCadenceRpm(this.previousCrankData, crankRevolutionData) ??
			this.previousCadenceRpm;
		const speedKph =
			directSpeedKph ??
			estimateSpeedKph(this.previousWheelData, wheelRevolutionData) ??
			this.previousSpeedKph;
		const distanceKm =
			directDistanceKm ??
			estimateDistanceKm(this.initialWheelData, wheelRevolutionData);

		if (crankRevolutionData) {
			const crankDataChanged =
				!this.previousCrankData ||
				crankRevolutionData.cumulativeCrankRevolutions !==
					this.previousCrankData.cumulativeCrankRevolutions ||
				crankRevolutionData.lastCrankEventTime !==
					this.previousCrankData.lastCrankEventTime;

			if (crankDataChanged) {
				this.previousCrankData = crankRevolutionData;
			}
		}

		if (wheelRevolutionData) {
			const wheelDataChanged =
				!this.previousWheelData ||
				wheelRevolutionData.cumulativeWheelRevolutions !==
					this.previousWheelData.cumulativeWheelRevolutions ||
				wheelRevolutionData.lastWheelEventTime !==
					this.previousWheelData.lastWheelEventTime;

			if (wheelDataChanged) {
				this.previousWheelData = wheelRevolutionData;
			}
		}

		if (typeof cadenceRpm === "number") {
			this.previousCadenceRpm = cadenceRpm;
		}

		if (typeof speedKph === "number") {
			this.previousSpeedKph = speedKph;
		}

		const measurement: PowerMeasurement = {
			cadenceRpm,
			distanceKm,
			source,
			speedKph,
			timestamp: timestampMs,
			watts,
		};

		this.snapshot = {
			latestPower: measurement,
			recentPower: appendAndTrimByTime(
				this.snapshot.recentPower,
				measurement,
				MAX_RECENT_POWER_SAMPLES,
				RECENT_POWER_WINDOW_MS,
			),
			diagnostics: {
				lastPacketTimestamp: timestampMs,
				sampleCount: this.snapshot.diagnostics.sampleCount + 1,
			},
		};
	}

	private reduceSelectedWorkout(event: WorkoutSelectedEvent): void {
		this.workoutDefinition = event.payload.workout;
		this.workoutSnapshot = {
			selectedWorkoutId: event.payload.workout?.id,
			status: "idle",
			accumulatedElapsedMs: 0,
			runningSinceMs: undefined,
			completedAtMs: undefined,
		};
		this.emitWorkoutSnapshot();
		this.emitResolvedControlIntent();
	}

	private reduceStartedWorkout(event: WorkoutStartedEvent): void {
		this.workoutSnapshot = {
			...this.workoutSnapshot,
			status: "active",
			accumulatedElapsedMs: 0,
			runningSinceMs: event.payload.clockMs,
			completedAtMs: undefined,
		};
		this.emitWorkoutSnapshot();
		this.emitResolvedControlIntent();
	}

	private reducePausedWorkout(event: WorkoutPausedEvent): void {
		const nextAccumulatedElapsedMs = this.getElapsedAt(event.payload.clockMs);
		this.workoutSnapshot = {
			...this.workoutSnapshot,
			status: "paused",
			accumulatedElapsedMs: nextAccumulatedElapsedMs,
			runningSinceMs: undefined,
		};
		this.emitWorkoutSnapshot();
		this.emitResolvedControlIntent();
	}

	private reduceResumedWorkout(event: WorkoutResumedEvent): void {
		this.workoutSnapshot = {
			...this.workoutSnapshot,
			status: "active",
			runningSinceMs: event.payload.clockMs,
		};
		this.emitWorkoutSnapshot();
		this.emitResolvedControlIntent();
	}

	private reduceClockTicked(event: WorkoutClockTickedEvent): void {
		if (this.workoutSnapshot.status !== "active") {
			return;
		}

		const elapsedMs = this.getElapsedAt(event.payload.clockMs);
		const structuredWorkout =
			this.workoutDefinition?.type === "structured"
				? this.workoutDefinition
				: undefined;
		const shouldComplete =
			typeof structuredWorkout !== "undefined" &&
			elapsedMs >= structuredWorkout.durationSeconds * 1000;

		if (shouldComplete) {
			this.workoutSnapshot = {
				...this.workoutSnapshot,
				status: "completed",
				accumulatedElapsedMs: structuredWorkout.durationSeconds * 1000,
				runningSinceMs: undefined,
				completedAtMs: event.payload.clockMs,
			};
		} else {
			this.workoutSnapshot = {
				...this.workoutSnapshot,
				accumulatedElapsedMs: elapsedMs,
				runningSinceMs: event.payload.clockMs,
			};
		}

		this.emitWorkoutSnapshot();
		this.emitResolvedControlIntent();
	}

	private emitResolvedControlIntent(): void {
		const intent = this.resolveControlIntent();
		const nextIntentKey = JSON.stringify(intent);

		if (nextIntentKey === this.lastControlIntentKey) {
			return;
		}

		this.lastControlIntentKey = nextIntentKey;
		this.controlIntentListeners.forEach((listener) => listener(intent));
	}

	private resolveControlIntent(): WorkoutControlIntent {
		if (
			this.workoutSnapshot.status !== "active" ||
			!this.workoutDefinition ||
			this.workoutDefinition.type !== "structured" ||
			!this.workoutDefinition.blocks.length
		) {
			return { type: "trainer.control.disable-erg" };
		}

		const currentBlock = findCurrentBlock(
			this.workoutDefinition.blocks,
			Math.floor(this.workoutSnapshot.accumulatedElapsedMs / 1000),
		);
		const targetWatts = resolveTargetWatts(currentBlock);

		if (typeof targetWatts !== "number") {
			return { type: "trainer.control.disable-erg" };
		}

		return {
			type: "trainer.control.set-erg-power",
			payload: {
				watts: targetWatts,
			},
		};
	}

	private reset(): void {
		this.snapshot = cloneSnapshot(initialSnapshot);
		this.workoutDefinition = undefined;
		this.workoutSnapshot = {
			...initialWorkoutSnapshot,
		};
		this.lastControlIntentKey = undefined;
		this.initialWheelData = undefined;
		this.previousCadenceRpm = undefined;
		this.previousCrankData = undefined;
		this.previousSpeedKph = undefined;
		this.previousWheelData = undefined;
	}

	private clearWorkout(): void {
		this.workoutDefinition = undefined;
		this.workoutSnapshot = {
			...initialWorkoutSnapshot,
		};
		this.emitWorkoutSnapshot();
		this.emitResolvedControlIntent();
	}

	private emitWorkoutSnapshot(): void {
		const snapshot = this.getWorkoutSnapshot();
		this.workoutSnapshotListeners.forEach((listener) => listener(snapshot));
	}

	private getElapsedAt(clockMs: number): number {
		if (
			this.workoutSnapshot.status !== "active" ||
			typeof this.workoutSnapshot.runningSinceMs !== "number"
		) {
			return this.workoutSnapshot.accumulatedElapsedMs;
		}

		return (
			this.workoutSnapshot.accumulatedElapsedMs +
			Math.max(0, clockMs - this.workoutSnapshot.runningSinceMs)
		);
	}
}
