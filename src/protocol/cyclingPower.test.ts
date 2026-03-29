import { describe, expect, it } from "vitest";

import {
	decodeCyclingPowerMeasurement,
	decodeCyclingPowerPacket,
	estimateCadenceRpm,
	estimateDistanceKm,
	estimateSpeedKph,
} from "./cyclingPower";

function createDataView(values: number[]): DataView {
	return new DataView(Uint8Array.from(values).buffer);
}

describe("decodeCyclingPowerMeasurement", () => {
	it("reads watts from a valid cycling power packet", () => {
		const measurement = decodeCyclingPowerMeasurement(
			createDataView([0x00, 0x00, 0x2c, 0x01]),
			1234,
		);

		expect(measurement).toEqual({
			timestamp: 1234,
			watts: 300,
			source: "cps",
		});
	});

	it("returns null when the packet is too short", () => {
		expect(
			decodeCyclingPowerMeasurement(createDataView([0x00, 0x00, 0x2c])),
		).toBeNull();
	});

	it("returns null for an empty payload", () => {
		expect(
			decodeCyclingPowerMeasurement(new DataView(new ArrayBuffer(0))),
		).toBe(null);
	});

	it("ignores unsupported flags safely while still decoding watts", () => {
		const decoded = decodeCyclingPowerPacket(
			createDataView([0x30, 0x00, 0x64, 0x00, 0x00, 0x00]),
			5678,
		);

		expect(decoded).toEqual({
			flags: 0x0030,
			measurement: {
				timestamp: 5678,
				watts: 100,
				source: "cps",
			},
		});
	});

	it("extracts crank revolution data when present", () => {
		const decoded = decodeCyclingPowerPacket(
			createDataView([0x20, 0x00, 0x90, 0x01, 0x0a, 0x00, 0x00, 0x04]),
			5678,
		);

		expect(decoded).toEqual({
			flags: 0x0020,
			crankRevolutionData: {
				cumulativeCrankRevolutions: 10,
				lastCrankEventTime: 1024,
			},
			measurement: {
				timestamp: 5678,
				watts: 400,
				source: "cps",
			},
		});
	});

	it("extracts wheel revolution data when present", () => {
		const decoded = decodeCyclingPowerPacket(
			createDataView([
				0x10, 0x00, 0xc8, 0x00, 0x2c, 0x01, 0x00, 0x00, 0x00, 0x08,
			]),
			5678,
		);

		expect(decoded).toEqual({
			flags: 0x0010,
			measurement: {
				timestamp: 5678,
				watts: 200,
				source: "cps",
			},
			wheelRevolutionData: {
				cumulativeWheelRevolutions: 300,
				lastWheelEventTime: 2048,
			},
		});
	});

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
