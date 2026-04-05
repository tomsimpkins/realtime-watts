import type { AppStartListening } from "../app/listenerMiddleware";
import type { RootState } from "../app/store";
import {
	completeWorkout,
	endWorkout,
	pauseWorkout,
	resumeWorkout,
	selectWorkout,
	startWorkout,
	tickWorkout,
} from "./workoutSlice";
import { syncWorkoutSessionToTrainerState } from "./trainerThunks";
import { selectSelectedWorkout } from "./workoutSelectors";

let workoutIntervalId: ReturnType<typeof globalThis.setInterval> | undefined;

function clearWorkoutTicker() {
	if (typeof workoutIntervalId !== "undefined") {
		globalThis.clearInterval(workoutIntervalId);
		workoutIntervalId = undefined;
	}
}

function ensureWorkoutTicker(dispatch: (action: unknown) => void) {
	clearWorkoutTicker();
	workoutIntervalId = globalThis.setInterval(() => {
		dispatch(tickWorkout(Date.now()));
	}, 1000);
}

export function registerWorkoutListeners(
	startListening: AppStartListening,
): void {
	startListening({
		actionCreator: startWorkout,
		effect: async (_, api) => {
			ensureWorkoutTicker(api.dispatch);
		},
	});

	startListening({
		actionCreator: resumeWorkout,
		effect: async (_, api) => {
			ensureWorkoutTicker(api.dispatch);
		},
	});

	startListening({
		matcher: (action) =>
			pauseWorkout.match(action) ||
			endWorkout.match(action) ||
			completeWorkout.match(action),
		effect: async () => {
			clearWorkoutTicker();
		},
	});

	startListening({
		actionCreator: tickWorkout,
		effect: async (_, api) => {
			const state = api.getState() as RootState;
			const workout = selectSelectedWorkout(state);

			if (!workout || workout.type === "freeRide") {
				return;
			}

			const elapsedSeconds = Math.floor(
				state.workout.accumulatedElapsedMs / 1000,
			);
			if (elapsedSeconds >= workout.durationSeconds) {
				api.dispatch(completeWorkout(Date.now()));
			}
		},
	});

	startListening({
		matcher: (action) =>
			selectWorkout.match(action) ||
			startWorkout.match(action) ||
			pauseWorkout.match(action) ||
			resumeWorkout.match(action) ||
			tickWorkout.match(action) ||
			completeWorkout.match(action) ||
			endWorkout.match(action),
		effect: async (_, api) => {
			syncWorkoutSessionToTrainerState(api.getState() as RootState);
		},
	});
}
