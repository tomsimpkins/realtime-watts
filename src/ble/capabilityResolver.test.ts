import { describe, expect, it } from "vitest";

import {
	createCheckingCapabilityResolution,
	resolveCapabilities,
} from "./capabilityResolver";
import {
	CYCLING_POWER_MEASUREMENT_CHARACTERISTIC,
	CYCLING_POWER_SERVICE,
	FITNESS_MACHINE_CONTROL_POINT_CHARACTERISTIC,
	FITNESS_MACHINE_FEATURE_CHARACTERISTIC,
	FITNESS_MACHINE_SERVICE,
} from "./uuids";

describe("resolveCapabilities", () => {
	it("returns all unavailable when no topology is present for BLE mode", () => {
		expect(resolveCapabilities({ mode: "ble" })).toEqual({
			capabilities: {
				power: false,
				cadence: false,
				speed: false,
				resistanceControl: false,
				ergMode: false,
				simulationMode: false,
			},
			statuses: {
				power: "unavailable",
				cadence: "unavailable",
				speed: "unavailable",
				resistanceControl: "unavailable",
				ergMode: "unavailable",
				simulationMode: "unavailable",
			},
		});
	});

	it("returns checking statuses while setup is in progress", () => {
		expect(createCheckingCapabilityResolution().statuses).toEqual({
			power: "checking",
			cadence: "checking",
			speed: "checking",
			resistanceControl: "checking",
			ergMode: "checking",
			simulationMode: "checking",
		});
	});

	it("marks only power as available for a cycling-power-only topology", () => {
		const result = resolveCapabilities({
			mode: "ble",
			topology: {
				serviceUuids: [CYCLING_POWER_SERVICE],
				characteristicUuidsByService: {
					[CYCLING_POWER_SERVICE]: [CYCLING_POWER_MEASUREMENT_CHARACTERISTIC],
				},
			},
		});

		expect(result.capabilities.power).toBe(true);
		expect(result.statuses.power).toBe("available");
		expect(result.capabilities.resistanceControl).toBe(false);
		expect(result.statuses.ergMode).toBe("unavailable");
	});

	it("marks control-oriented capabilities as available when FTMS is discovered", () => {
		const result = resolveCapabilities({
			mode: "ble",
			topology: {
				serviceUuids: [CYCLING_POWER_SERVICE, FITNESS_MACHINE_SERVICE],
				characteristicUuidsByService: {
					[CYCLING_POWER_SERVICE]: [CYCLING_POWER_MEASUREMENT_CHARACTERISTIC],
					[FITNESS_MACHINE_SERVICE]: [
						FITNESS_MACHINE_CONTROL_POINT_CHARACTERISTIC,
						FITNESS_MACHINE_FEATURE_CHARACTERISTIC,
					],
				},
			},
		});

		expect(result.capabilities).toMatchObject({
			power: true,
			resistanceControl: true,
			ergMode: true,
			simulationMode: true,
		});
		expect(result.statuses).toMatchObject({
			power: "available",
			resistanceControl: "available",
			ergMode: "available",
			simulationMode: "available",
		});
	});

	it("uses simulation defaults when the app is in simulate mode", () => {
		expect(resolveCapabilities({ mode: "simulate" })).toEqual({
			capabilities: {
				power: true,
				cadence: true,
				speed: true,
				resistanceControl: false,
				ergMode: false,
				simulationMode: false,
			},
			statuses: {
				power: "available",
				cadence: "available",
				speed: "available",
				resistanceControl: "unavailable",
				ergMode: "unavailable",
				simulationMode: "unavailable",
			},
		});
	});
});
