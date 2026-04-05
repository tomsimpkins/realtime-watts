import { describe, expect, it } from "vitest";

import {
	estimateCadenceRpm,
	estimateDistanceKm,
	estimateSpeedKph,
} from "./telemetry";

describe("telemetry", () => {
	it("estimates cadence from crank revolution deltas", () => {
		expect(
			estimateCadenceRpm(
				{
					cumulativeCrankRevolutions: 10,
					lastCrankEventTime: 1024,
				},
				{
					cumulativeCrankRevolutions: 11,
					lastCrankEventTime: 2048,
				},
			),
		).toBe(60);
	});

	it("estimates speed and distance from wheel revolution deltas", () => {
		expect(
			estimateSpeedKph(
				{
					cumulativeWheelRevolutions: 100,
					lastWheelEventTime: 2048,
				},
				{
					cumulativeWheelRevolutions: 110,
					lastWheelEventTime: 4096,
				},
			),
		).toBe(75.8);

		expect(
			estimateDistanceKm(
				{
					cumulativeWheelRevolutions: 100,
					lastWheelEventTime: 2048,
				},
				{
					cumulativeWheelRevolutions: 110,
					lastWheelEventTime: 4096,
				},
			),
		).toBe(0.02);
	});
});
