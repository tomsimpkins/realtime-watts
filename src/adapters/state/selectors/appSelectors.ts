import { createSelector } from "@reduxjs/toolkit";

import type { RootState } from "../../../app/store";
import type { AppScreen } from "../appSlice";
import {
	selectDegradedDuringRide,
	selectIsTrainerReady,
} from "./trainerSelectors";
import {
	selectSelectedWorkoutId,
	selectWorkoutStatus,
} from "./workoutSelectors";

export const selectAppState = (state: RootState) => state.app;

export const selectCurrentScreen = createSelector(
	[selectAppState],
	(app) => app.currentScreen,
);

export const selectCanAccessWorkouts = selectIsTrainerReady;

export const selectCanAccessRide = createSelector(
	[
		selectIsTrainerReady,
		selectDegradedDuringRide,
		selectSelectedWorkoutId,
		selectWorkoutStatus,
	],
	(isTrainerReady, degradedDuringRide, selectedWorkoutId, workoutStatus) => {
		const hasWorkout = Boolean(selectedWorkoutId) && workoutStatus !== "idle";
		return hasWorkout && (isTrainerReady || degradedDuringRide);
	},
);

const STEP_INDEX_BY_SCREEN: Record<AppScreen, number> = {
	connect: 0,
	workouts: 1,
	ride: 2,
};

export const selectFlowStepperModel = createSelector(
	[selectCurrentScreen, selectCanAccessWorkouts, selectCanAccessRide],
	(currentScreen, canAccessWorkouts, canAccessRide) => ({
		activeStep: STEP_INDEX_BY_SCREEN[currentScreen],
		currentScreen,
		rideUnlocked: currentScreen === "ride" || canAccessRide,
		workoutsUnlocked: currentScreen === "workouts" || canAccessWorkouts,
	}),
);

export function getScreenFromPath(pathname: string): AppScreen {
	if (pathname.startsWith("/ride")) {
		return "ride";
	}

	if (pathname.startsWith("/workouts")) {
		return "workouts";
	}

	return "connect";
}
