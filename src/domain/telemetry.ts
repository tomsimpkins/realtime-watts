const UINT16_ROLLOVER = 0x1_0000;
const UINT32_ROLLOVER = 0x1_0000_0000;
const CRANK_EVENT_TIME_UNITS_PER_SECOND = 1024;
const WHEEL_EVENT_TIME_UNITS_PER_SECOND = 2048;
const DEFAULT_WHEEL_CIRCUMFERENCE_METERS = 2.105;

export interface WheelRevolutionData {
	cumulativeWheelRevolutions: number;
	lastWheelEventTime: number;
}

export interface CrankRevolutionData {
	cumulativeCrankRevolutions: number;
	lastCrankEventTime: number;
}

function getRolledUint16Delta(next: number, previous: number): number {
	return next >= previous ? next - previous : UINT16_ROLLOVER - previous + next;
}

function getRolledUint32Delta(next: number, previous: number): number {
	return next >= previous ? next - previous : UINT32_ROLLOVER - previous + next;
}

export function estimateCadenceRpm(
	previousCrankData?: CrankRevolutionData,
	currentCrankData?: CrankRevolutionData,
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
	previousWheelData?: WheelRevolutionData,
	currentWheelData?: WheelRevolutionData,
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
	initialWheelData?: WheelRevolutionData,
	currentWheelData?: WheelRevolutionData,
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
