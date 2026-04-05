import { describe, expect, it } from "vitest";

import { WorkoutEngine } from "./workoutEngine";
import { WORKOUTS_BY_ID } from "../workouts/catalog";

describe("WorkoutEngine", () => {
	it("derives cadence, speed, and distance from telemetry events", () => {
		const engine = new WorkoutEngine();

		engine.dispatch({
			type: "workout.telemetry",
			payload: {
				source: "ftms",
				timestampMs: 1_000,
				watts: 200,
				wheelRevolutionData: {
					cumulativeWheelRevolutions: 1_000,
					lastWheelEventTime: 2_000,
				},
				crankRevolutionData: {
					cumulativeCrankRevolutions: 500,
					lastCrankEventTime: 3_000,
				},
			},
		});

		engine.dispatch({
			type: "workout.telemetry",
			payload: {
				source: "ftms",
				timestampMs: 2_000,
				watts: 220,
				wheelRevolutionData: {
					cumulativeWheelRevolutions: 1_010,
					lastWheelEventTime: 6_311,
				},
				crankRevolutionData: {
					cumulativeCrankRevolutions: 502,
					lastCrankEventTime: 5_048,
				},
			},
		});

		const snapshot = engine.getSnapshot();

		expect(snapshot.latestPower).toMatchObject({
			cadenceRpm: 60,
			distanceKm: 0.02,
			source: "ftms",
			speedKph: 36,
			timestamp: 2_000,
			watts: 220,
		});
		expect(snapshot.recentPower).toHaveLength(2);
		expect(snapshot.recentPower[0]).toMatchObject({
			distanceKm: 0,
			source: "ftms",
			timestamp: 1_000,
			watts: 200,
		});
		expect(snapshot.diagnostics).toEqual({
			lastPacketTimestamp: 2_000,
			sampleCount: 2,
		});
	});

	it("clears live metrics without losing history when the stream goes idle", () => {
		const engine = new WorkoutEngine();

		engine.dispatch({
			type: "workout.telemetry",
			payload: {
				source: "simulation",
				timestampMs: 1_000,
				watts: 180,
			},
		});

		engine.dispatch({ type: "workout.stream-idle" });

		expect(engine.getSnapshot()).toMatchObject({
			latestPower: undefined,
			recentPower: [
				{
					source: "simulation",
					timestamp: 1_000,
					watts: 180,
				},
			],
			diagnostics: {
				lastPacketTimestamp: 1_000,
				sampleCount: 1,
			},
		});
	});

	it("emits ERG control intents from structured workout session updates", () => {
		const engine = new WorkoutEngine();
		const intents: string[] = [];

		engine.subscribeToControlIntents((intent) => {
			intents.push(JSON.stringify(intent));
		});

		engine.dispatch({
			type: "workout.session-updated",
			payload: {
				elapsedMs: 300_000,
				status: "active",
				workout: WORKOUTS_BY_ID.twoByTwenty,
			},
		});

		engine.dispatch({
			type: "workout.session-updated",
			payload: {
				elapsedMs: 900_000,
				status: "active",
				workout: WORKOUTS_BY_ID.twoByTwenty,
			},
		});

		engine.dispatch({
			type: "workout.session-updated",
			payload: {
				elapsedMs: 2_700_000,
				status: "paused",
				workout: WORKOUTS_BY_ID.twoByTwenty,
			},
		});

		expect(intents).toEqual([
			JSON.stringify({
				type: "trainer.control.set-erg-power",
				payload: { watts: 225 },
			}),
			JSON.stringify({ type: "trainer.control.disable-erg" }),
		]);
	});

	it("deduplicates repeated control intents for the same workout target", () => {
		const engine = new WorkoutEngine();
		const intents: string[] = [];

		engine.subscribeToControlIntents((intent) => {
			intents.push(JSON.stringify(intent));
		});

		engine.dispatch({
			type: "workout.session-updated",
			payload: {
				elapsedMs: 900_000,
				status: "active",
				workout: WORKOUTS_BY_ID.twoByTwenty,
			},
		});

		engine.dispatch({
			type: "workout.session-updated",
			payload: {
				elapsedMs: 1_200_000,
				status: "active",
				workout: WORKOUTS_BY_ID.twoByTwenty,
			},
		});

		expect(intents).toEqual([
			JSON.stringify({
				type: "trainer.control.set-erg-power",
				payload: { watts: 225 },
			}),
		]);
	});
});
