import { describe, expect, it } from "vitest";

import { createTestStore, createTestState } from "../../test/testUtils";
import {
	selectCurrentBlockRemainingLabel,
	selectCurrentBlockRemainingSeconds,
	selectCurrentTargetLabel,
	selectElapsedSeconds,
} from "./selectors/workoutSelectors";
import workoutReducer, {
	clearWorkout,
	setWorkoutSnapshot,
} from "./workoutSlice";

describe("workoutSlice and selectors", () => {
	it("mirrors workout snapshots from the session layer", () => {
		const nextState = workoutReducer(
			undefined,
			setWorkoutSnapshot({
				selectedWorkoutId: "twoByTwenty",
				status: "active",
				runningSinceMs: 1_000,
				accumulatedElapsedMs: 0,
				completedAtMs: undefined,
			}),
		);

		expect(nextState.selectedWorkoutId).toBe("twoByTwenty");
		expect(nextState.status).toBe("active");
		expect(nextState.runningSinceMs).toBe(1_000);
		expect(nextState.accumulatedElapsedMs).toBe(0);
	});

	it("advances workout blocks at the expected time boundaries", () => {
		const store = createTestStore({
			workout: {
				selectedWorkoutId: "twoByTwenty",
				status: "active",
				runningSinceMs: 0,
				accumulatedElapsedMs: 299_000,
			},
		});

		expect(selectCurrentBlockRemainingSeconds(store.getState())).toBe(1);

		store.dispatch(
			setWorkoutSnapshot({
				selectedWorkoutId: "twoByTwenty",
				status: "active",
				runningSinceMs: 300_000,
				accumulatedElapsedMs: 300_000,
				completedAtMs: undefined,
			}),
		);
		expect(selectCurrentBlockRemainingSeconds(store.getState())).toBe(1_200);
	});

	it("formats block remaining as mm:ss and converts ftp targets to watts", () => {
		const store = createTestStore({
			workout: {
				selectedWorkoutId: "twoByTwenty",
				status: "active",
				runningSinceMs: 305_000,
				accumulatedElapsedMs: 305_000,
			},
		});

		expect(selectCurrentBlockRemainingLabel(store.getState())).toBe("19:55");
		expect(selectCurrentTargetLabel(store.getState())).toBe("225 W");
		expect(selectElapsedSeconds(store.getState())).toBe(305);
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

		store.dispatch(clearWorkout());

		expect(store.getState().workout).toEqual(createTestState().workout);
	});
});
