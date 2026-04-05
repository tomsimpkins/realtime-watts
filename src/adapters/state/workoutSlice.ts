import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { WorkoutStatus } from "../../domain/workout";
import type { WorkoutSessionSnapshot } from "../../domain/workoutEngine";

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

const workoutSlice = createSlice({
	name: "workout",
	initialState,
	reducers: {
		setWorkoutSnapshot(_state, action: PayloadAction<WorkoutSessionSnapshot>) {
			return action.payload;
		},
		clearWorkout() {
			return initialState;
		},
	},
});

export const { clearWorkout, setWorkoutSnapshot } = workoutSlice.actions;

export default workoutSlice.reducer;
