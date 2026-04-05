import { describe, expect, it } from "vitest";

import {
	createCheckingCapabilityResolution,
	resolveCapabilities,
} from "./capabilityResolver";
import {
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

	it("marks telemetry as available for an FTMS feature topology", () => {
		const result = resolveCapabilities({
			mode: "ble",
			topology: {
				serviceUuids: [FITNESS_MACHINE_SERVICE],
				characteristicUuidsByService: {
					[FITNESS_MACHINE_SERVICE]: [FITNESS_MACHINE_FEATURE_CHARACTERISTIC],
				},
			},
		});

		expect(result.capabilities.power).toBe(true);
		expect(result.capabilities.cadence).toBe(true);
		expect(result.capabilities.speed).toBe(true);
		expect(result.statuses.power).toBe("available");
		expect(result.statuses.cadence).toBe("available");
		expect(result.statuses.speed).toBe("available");
		expect(result.capabilities.resistanceControl).toBe(false);
		expect(result.statuses.ergMode).toBe("unavailable");
	});

	it("marks control-oriented capabilities as available when FTMS is discovered", () => {
		const result = resolveCapabilities({
			mode: "ble",
			topology: {
				serviceUuids: [FITNESS_MACHINE_SERVICE],
				characteristicUuidsByService: {
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
