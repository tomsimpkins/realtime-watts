import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createTestStore, createTestState } from "../test/testUtils";
import {
	selectCurrentBlockIndex,
	selectCurrentBlockRemainingLabel,
	selectCurrentBlockRemainingSeconds,
	selectCurrentTargetLabel,
	selectElapsedSeconds,
} from "./workoutSelectors";
import workoutReducer, {
	endWorkout,
	pauseWorkout,
	resumeWorkout,
	selectWorkout,
	startWorkout,
	tickWorkout,
} from "./workoutSlice";

describe("workoutSlice and selectors", () => {
	it("selects and starts a workout", () => {
		const selected = workoutReducer(undefined, selectWorkout("twoByTwenty"));
		const started = workoutReducer(selected, startWorkout(1_000));

		expect(started.selectedWorkoutId).toBe("twoByTwenty");
		expect(started.status).toBe("active");
		expect(started.runningSinceMs).toBe(1_000);
		expect(started.accumulatedElapsedMs).toBe(0);
	});

	it("advances workout blocks at the expected time boundaries", () => {
		const store = createTestStore({
			workout: {
				selectedWorkoutId: "twoByTwenty",
				status: "active",
				runningSinceMs: 0,
				accumulatedElapsedMs: 0,
			},
		});

		store.dispatch(tickWorkout(299_000));
		expect(selectCurrentBlockIndex(store.getState())).toBe(0);
		expect(selectCurrentBlockRemainingSeconds(store.getState())).toBe(1);

		store.dispatch(tickWorkout(300_000));
		expect(selectCurrentBlockIndex(store.getState())).toBe(1);
		expect(selectCurrentBlockRemainingSeconds(store.getState())).toBe(1_200);
	});

	it("formats block remaining as mm:ss and converts ftp targets to watts", () => {
		const store = createTestStore({
			workout: {
				selectedWorkoutId: "twoByTwenty",
				status: "active",
				runningSinceMs: 0,
				accumulatedElapsedMs: 305_000,
			},
		});

		expect(selectCurrentBlockRemainingLabel(store.getState())).toBe("19:55");
		expect(selectCurrentTargetLabel(store.getState())).toBe("225 W");
	});

	it("pauses and resumes without losing elapsed time", () => {
		const store = createTestStore({
			workout: {
				selectedWorkoutId: "tabata",
				status: "active",
				runningSinceMs: 0,
				accumulatedElapsedMs: 0,
			},
		});

		store.dispatch(pauseWorkout(120_000));
		expect(selectElapsedSeconds(store.getState())).toBe(120);

		store.dispatch(resumeWorkout(240_000));
		store.dispatch(tickWorkout(300_000));
		expect(selectElapsedSeconds(store.getState())).toBe(180);
	});

	it("auto-completes structured workouts once their duration is reached", async () => {
		const store = createTestStore({
			workout: {
				selectedWorkoutId: "tabata",
				status: "active",
				runningSinceMs: 0,
				accumulatedElapsedMs: 839_000,
			},
		});

		store.dispatch(tickWorkout(840_000));

		await waitFor(() => {
			expect(store.getState().workout.status).toBe("completed");
		});
	});

	it("does not auto-complete free ride workouts", async () => {
		const store = createTestStore({
			workout: {
				selectedWorkoutId: "freeRide",
				status: "active",
				runningSinceMs: 0,
				accumulatedElapsedMs: 3_600_000,
			},
		});

		store.dispatch(tickWorkout(3_660_000));

		await waitFor(() => {
			expect(store.getState().workout.status).toBe("active");
		});
	});

	it("clears workout state when the ride ends", () => {
		const store = createTestStore({
			workout: {
				selectedWorkoutId: "twoByTwenty",
				status: "paused",
				runningSinceMs: undefined,
				accumulatedElapsedMs: 120_000,
				completedAtMs: 121_000,
			},
		});

		store.dispatch(endWorkout());

		expect(store.getState().workout).toEqual(createTestState().workout);
	});
});
