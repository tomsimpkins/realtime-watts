import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { WorkoutStatus } from "../domain/workout";

export interface WorkoutState {
	selectedWorkoutId?: string;
	status: WorkoutStatus;
	runningSinceMs?: number;
	accumulatedElapsedMs: number;
	completedAtMs?: number;
}

const initialState: WorkoutState = {
	status: "idle",
	accumulatedElapsedMs: 0,
};

function flushElapsed(state: WorkoutState, nowMs: number): void {
	if (typeof state.runningSinceMs === "number") {
		state.accumulatedElapsedMs += Math.max(0, nowMs - state.runningSinceMs);
		state.runningSinceMs = nowMs;
	}
}

const workoutSlice = createSlice({
	name: "workout",
	initialState,
	reducers: {
		selectWorkout(state, action: PayloadAction<string>) {
			state.selectedWorkoutId = action.payload;
			state.status = "idle";
			state.accumulatedElapsedMs = 0;
			state.runningSinceMs = undefined;
			state.completedAtMs = undefined;
		},
		startWorkout(state, action: PayloadAction<number>) {
			state.status = "active";
			state.accumulatedElapsedMs = 0;
			state.runningSinceMs = action.payload;
			state.completedAtMs = undefined;
		},
		pauseWorkout(state, action: PayloadAction<number>) {
			flushElapsed(state, action.payload);
			state.runningSinceMs = undefined;
			state.status = "paused";
		},
		resumeWorkout(state, action: PayloadAction<number>) {
			state.runningSinceMs = action.payload;
			state.status = "active";
		},
		tickWorkout(state, action: PayloadAction<number>) {
			if (state.status !== "active") {
				return;
			}

			flushElapsed(state, action.payload);
		},
		completeWorkout(state, action: PayloadAction<number>) {
			flushElapsed(state, action.payload);
			state.runningSinceMs = undefined;
			state.status = "completed";
			state.completedAtMs = action.payload;
		},
		endWorkout(state) {
			state.status = "idle";
			state.selectedWorkoutId = undefined;
			state.runningSinceMs = undefined;
			state.accumulatedElapsedMs = 0;
			state.completedAtMs = undefined;
		},
		clearWorkout() {
			return initialState;
		},
	},
});

export const {
	clearWorkout,
	completeWorkout,
	endWorkout,
	pauseWorkout,
	resumeWorkout,
	selectWorkout,
	startWorkout,
	tickWorkout,
} = workoutSlice.actions;

export default workoutSlice.reducer;
