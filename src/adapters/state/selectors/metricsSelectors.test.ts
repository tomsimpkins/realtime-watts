import { describe, expect, it } from "vitest";

import { createTestState } from "../test/testUtils";
import { selectRecentPowerHistogram } from "./metricsSelectors";

describe("metricsSelectors", () => {
	it("aggregates recent power into 5-second average bars", () => {
		const state = createTestState({
			metrics: {
				recentPower: [
					{ source: "simulation", timestamp: 1_000, watts: 100 },
					{ source: "simulation", timestamp: 4_900, watts: 140 },
					{ source: "simulation", timestamp: 5_000, watts: 200 },
					{ source: "simulation", timestamp: 9_900, watts: 220 },
					{ source: "simulation", timestamp: 10_300, watts: 300 },
				],
			},
		});

		expect(selectRecentPowerHistogram(state)).toEqual([
			{ timestamp: 0, watts: 120 },
			{ timestamp: 5_000, watts: 210 },
			{ timestamp: 10_000, watts: 300 },
		]);
	});
});
