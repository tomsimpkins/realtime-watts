import { createSelector } from "@reduxjs/toolkit";

import type { RootState } from "../app/store";
import type { WorkoutBlock } from "../domain/workout";
import { WORKOUT_CATALOG, WORKOUTS_BY_ID } from "../workouts/catalog";

const DEFAULT_FTP_WATTS = 250;

function formatSecondsAsClock(totalSeconds: number) {
	const safeSeconds = Math.max(0, totalSeconds);
	const minutes = Math.floor(safeSeconds / 60)
		.toString()
		.padStart(2, "0");
	const seconds = Math.floor(safeSeconds % 60)
		.toString()
		.padStart(2, "0");

	return `${minutes}:${seconds}`;
}

export const selectWorkoutState = (state: RootState) => state.workout;

export const selectWorkoutCatalog = () => WORKOUT_CATALOG;

export const selectSelectedWorkoutId = createSelector(
	[selectWorkoutState],
	(workout) => workout.selectedWorkoutId,
);

export const selectSelectedWorkout = createSelector(
	[selectSelectedWorkoutId],
	(selectedWorkoutId) =>
		selectedWorkoutId ? WORKOUTS_BY_ID[selectedWorkoutId] : undefined,
);

export const selectWorkoutStatus = createSelector(
	[selectWorkoutState],
	(workout) => workout.status,
);

export const selectElapsedMs = createSelector(
	[selectWorkoutState],
	(workout) => workout.accumulatedElapsedMs,
);

export const selectElapsedSeconds = createSelector(
	[selectElapsedMs],
	(elapsedMs) => Math.floor(elapsedMs / 1000),
);

export const selectElapsedTimeLabel = createSelector(
	[selectElapsedSeconds],
	(elapsedSeconds) => formatSecondsAsClock(elapsedSeconds),
);

function findCurrentBlock(blocks: WorkoutBlock[], elapsedSeconds: number) {
	let blockStart = 0;

	for (let index = 0; index < blocks.length; index += 1) {
		const block = blocks[index];
		const blockEnd = blockStart + block.durationSeconds;

		if (elapsedSeconds < blockEnd) {
			return {
				block,
				index,
				remainingSeconds: blockEnd - elapsedSeconds,
			};
		}

		blockStart = blockEnd;
	}

	return {
		block: blocks.at(-1),
		index: blocks.length ? blocks.length - 1 : undefined,
		remainingSeconds: 0,
	};
}

export const selectCurrentBlockDetails = createSelector(
	[selectSelectedWorkout, selectElapsedSeconds],
	(selectedWorkout, elapsedSeconds) => {
		if (!selectedWorkout?.blocks.length) {
			return {
				block: undefined,
				index: undefined,
				remainingSeconds: undefined,
			};
		}

		return findCurrentBlock(selectedWorkout.blocks, elapsedSeconds);
	},
);

export const selectCurrentBlock = createSelector(
	[selectCurrentBlockDetails],
	(details) => details.block,
);

export const selectCurrentBlockIndex = createSelector(
	[selectCurrentBlockDetails],
	(details) => details.index,
);

export const selectCurrentBlockRemainingSeconds = createSelector(
	[selectCurrentBlockDetails],
	(details) => details.remainingSeconds,
);

export const selectCurrentBlockRemainingLabel = createSelector(
	[selectCurrentBlockRemainingSeconds],
	(remainingSeconds) =>
		typeof remainingSeconds === "number"
			? formatSecondsAsClock(remainingSeconds)
			: "—",
);

export const selectCurrentTargetLabel = createSelector(
	[selectCurrentBlock],
	(block) => {
		if (!block?.target || block.target.kind === "none") {
			return "No target";
		}

		if (block.target.kind === "ftpPercent") {
			const ftpPercent = block.target.value ?? 0;
			const targetWatts = Math.round((DEFAULT_FTP_WATTS * ftpPercent) / 100);
			return `${targetWatts} W`;
		}

		return `${block.target.value} W`;
	},
);

export const selectWorkoutProgressPercent = createSelector(
	[selectSelectedWorkout, selectElapsedSeconds],
	(selectedWorkout, elapsedSeconds) => {
		if (!selectedWorkout || selectedWorkout.type === "freeRide") {
			return 0;
		}

		return Math.min(
			100,
			Math.round((elapsedSeconds / selectedWorkout.durationSeconds) * 100),
		);
	},
);

export const selectCanPauseWorkout = createSelector(
	[selectWorkoutStatus],
	(status) => status === "active",
);

export const selectCanResumeWorkout = createSelector(
	[selectWorkoutStatus],
	(status) => status === "paused",
);

export const selectCanEndWorkout = createSelector(
	[selectWorkoutStatus],
	(status) =>
		status === "active" || status === "paused" || status === "completed",
);

export const selectWorkoutSummary = createSelector(
	[
		selectSelectedWorkout,
		selectWorkoutStatus,
		selectElapsedTimeLabel,
		selectCurrentBlock,
		selectCurrentTargetLabel,
		selectWorkoutProgressPercent,
	],
	(
		selectedWorkout,
		status,
		elapsedTimeLabel,
		currentBlock,
		currentTargetLabel,
		progressPercent,
	) => ({
		currentBlockLabel: currentBlock?.label ?? "No current block",
		currentTargetLabel,
		elapsedTimeLabel,
		progressPercent,
		status,
		workoutName: selectedWorkout?.name ?? "No workout selected",
	}),
);
