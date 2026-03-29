import type { PowerMeasurement } from "../domain/trainer";

const FLAGS_OFFSET = 0;
const INSTANTANEOUS_POWER_OFFSET = 2;
const MIN_PACKET_LENGTH = 4;
const WHEEL_REVOLUTION_DATA_PRESENT_FLAG = 1 << 4;
const CRANK_REVOLUTION_DATA_PRESENT_FLAG = 1 << 5;
const WHEEL_REVOLUTION_DATA_OFFSET = 4;
const WHEEL_REVOLUTION_DATA_LENGTH = 6;
const CRANK_REVOLUTION_DATA_LENGTH = 4;
const UINT16_ROLLOVER = 0x1_0000;
const UINT32_ROLLOVER = 0x1_0000_0000;
const CRANK_EVENT_TIME_UNITS_PER_SECOND = 1024;
const WHEEL_EVENT_TIME_UNITS_PER_SECOND = 2048;
const DEFAULT_WHEEL_CIRCUMFERENCE_METERS = 2.105;

export interface CyclingPowerWheelData {
	cumulativeWheelRevolutions: number;
	lastWheelEventTime: number;
}

export interface CyclingPowerCrankData {
	cumulativeCrankRevolutions: number;
	lastCrankEventTime: number;
}

export interface DecodeResult {
	flags: number;
	crankRevolutionData?: CyclingPowerCrankData;
	measurement: PowerMeasurement;
	wheelRevolutionData?: CyclingPowerWheelData;
}

function hasFlag(flags: number, mask: number): boolean {
	return (flags & mask) === mask;
}

function getCrankDataOffset(flags: number): number {
	return hasFlag(flags, WHEEL_REVOLUTION_DATA_PRESENT_FLAG)
		? WHEEL_REVOLUTION_DATA_OFFSET + WHEEL_REVOLUTION_DATA_LENGTH
		: WHEEL_REVOLUTION_DATA_OFFSET;
}

function readWheelRevolutionData(
	dataView: DataView,
	flags: number,
): CyclingPowerWheelData | undefined {
	if (!hasFlag(flags, WHEEL_REVOLUTION_DATA_PRESENT_FLAG)) {
		return undefined;
	}

	if (
		dataView.byteLength <
		WHEEL_REVOLUTION_DATA_OFFSET + WHEEL_REVOLUTION_DATA_LENGTH
	) {
		return undefined;
	}

	return {
		cumulativeWheelRevolutions: dataView.getUint32(
			WHEEL_REVOLUTION_DATA_OFFSET,
			true,
		),
		lastWheelEventTime: dataView.getUint16(
			WHEEL_REVOLUTION_DATA_OFFSET + 4,
			true,
		),
	};
}

function readCrankRevolutionData(
	dataView: DataView,
	flags: number,
): CyclingPowerCrankData | undefined {
	if (!hasFlag(flags, CRANK_REVOLUTION_DATA_PRESENT_FLAG)) {
		return undefined;
	}

	const crankDataOffset = getCrankDataOffset(flags);

	if (dataView.byteLength < crankDataOffset + CRANK_REVOLUTION_DATA_LENGTH) {
		return undefined;
	}

	return {
		cumulativeCrankRevolutions: dataView.getUint16(crankDataOffset, true),
		lastCrankEventTime: dataView.getUint16(crankDataOffset + 2, true),
	};
}

function getRolledUint16Delta(next: number, previous: number): number {
	return next >= previous ? next - previous : UINT16_ROLLOVER - previous + next;
}

function getRolledUint32Delta(next: number, previous: number): number {
	return next >= previous ? next - previous : UINT32_ROLLOVER - previous + next;
}

export function estimateCadenceRpm(
	previousCrankData?: CyclingPowerCrankData,
	currentCrankData?: CyclingPowerCrankData,
): number | undefined {
	if (!previousCrankData || !currentCrankData) {
		return undefined;
	}

	const revolutionDelta = getRolledUint16Delta(
		currentCrankData.cumulativeCrankRevolutions,
		previousCrankData.cumulativeCrankRevolutions,
	);
	const eventTimeDelta = getRolledUint16Delta(
		currentCrankData.lastCrankEventTime,
		previousCrankData.lastCrankEventTime,
	);

	if (revolutionDelta <= 0 || eventTimeDelta <= 0) {
		return undefined;
	}

	return Math.round(
		(revolutionDelta * 60 * CRANK_EVENT_TIME_UNITS_PER_SECOND) / eventTimeDelta,
	);
}

export function estimateSpeedKph(
	previousWheelData?: CyclingPowerWheelData,
	currentWheelData?: CyclingPowerWheelData,
	wheelCircumferenceMeters = DEFAULT_WHEEL_CIRCUMFERENCE_METERS,
): number | undefined {
	if (!previousWheelData || !currentWheelData) {
		return undefined;
	}

	const revolutionDelta = getRolledUint32Delta(
		currentWheelData.cumulativeWheelRevolutions,
		previousWheelData.cumulativeWheelRevolutions,
	);
	const eventTimeDelta = getRolledUint16Delta(
		currentWheelData.lastWheelEventTime,
		previousWheelData.lastWheelEventTime,
	);

	if (revolutionDelta <= 0 || eventTimeDelta <= 0) {
		return undefined;
	}

	const metersPerSecond =
		(revolutionDelta *
			wheelCircumferenceMeters *
			WHEEL_EVENT_TIME_UNITS_PER_SECOND) /
		eventTimeDelta;

	return Math.round(metersPerSecond * 3.6 * 10) / 10;
}

export function estimateDistanceKm(
	initialWheelData?: CyclingPowerWheelData,
	currentWheelData?: CyclingPowerWheelData,
	wheelCircumferenceMeters = DEFAULT_WHEEL_CIRCUMFERENCE_METERS,
): number | undefined {
	if (!initialWheelData || !currentWheelData) {
		return undefined;
	}

	const revolutionDelta = getRolledUint32Delta(
		currentWheelData.cumulativeWheelRevolutions,
		initialWheelData.cumulativeWheelRevolutions,
	);

	return Math.round((revolutionDelta * wheelCircumferenceMeters) / 10) / 100;
}

export function decodeCyclingPowerPacket(
	dataView: DataView,
	timestamp = Date.now(),
): DecodeResult | null {
	if (dataView.byteLength < MIN_PACKET_LENGTH) {
		return null;
	}

	try {
		const flags = dataView.getUint16(FLAGS_OFFSET, true);
		const watts = dataView.getInt16(INSTANTANEOUS_POWER_OFFSET, true);
		const wheelRevolutionData = readWheelRevolutionData(dataView, flags);
		const crankRevolutionData = readCrankRevolutionData(dataView, flags);

		return {
			flags,
			crankRevolutionData,
			measurement: {
				timestamp,
				watts,
				source: "cps",
			},
			wheelRevolutionData,
		};
	} catch {
		return null;
	}
}

export function decodeCyclingPowerMeasurement(
	dataView: DataView,
	timestamp = Date.now(),
): PowerMeasurement | null {
	return decodeCyclingPowerPacket(dataView, timestamp)?.measurement ?? null;
}
