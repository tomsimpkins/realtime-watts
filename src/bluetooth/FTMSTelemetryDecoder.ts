export interface IndoorBikeData {
	instantaneousCadenceRpm: number;
	totalDistanceKm: number;
	instantaneousSpeedKph: number;
	instantaneousPowerW: number;
}

function readUint24LE(view: DataView, offset: number): number {
	return (
		view.getUint8(offset) |
		(view.getUint8(offset + 1) << 8) |
		(view.getUint8(offset + 2) << 16)
	);
}

export function decodeBikeData(view: DataView): IndoorBikeData {
	let offset = 0;
	if (view.byteLength < 2) {
		throw new Error("Indoor Bike Data packet too short");
	}

	const flags = view.getUint16(offset, true);
	offset += 2;

	const moreData = (flags & (1 << 0)) !== 0;

	const hasAverageSpeed = (flags & (1 << 1)) !== 0;
	const hasInstantaneousCadence = (flags & (1 << 2)) !== 0;
	const hasAverageCadence = (flags & (1 << 3)) !== 0;
	const hasTotalDistance = (flags & (1 << 4)) !== 0;
	const hasResistanceLevel = (flags & (1 << 5)) !== 0;
	const hasInstantaneousPower = (flags & (1 << 6)) !== 0;
	const hasAveragePower = (flags & (1 << 7)) !== 0;
	const hasExpendedEnergy = (flags & (1 << 8)) !== 0;
	const hasHeartRate = (flags & (1 << 9)) !== 0;
	const hasMetabolicEquivalent = (flags & (1 << 10)) !== 0;
	const hasElapsedTime = (flags & (1 << 11)) !== 0;
	const hasRemainingTime = (flags & (1 << 12)) !== 0;

	const requireBytes = (count: number, field: string) => {
		if (offset + count > view.byteLength) {
			throw new Error(`Indoor Bike Data truncated while reading ${field}`);
		}
	};

	const result: IndoorBikeData = {
		instantaneousCadenceRpm: -1,
		instantaneousPowerW: -1,
		instantaneousSpeedKph: -1,
		totalDistanceKm: -1,
	};

	// FTMS quirk: instantaneous speed is present when More Data == 0.
	if (!moreData) {
		requireBytes(2, "instantaneousSpeed");
		result.instantaneousSpeedKph = view.getUint16(offset, true) / 100;
		offset += 2;
	}

	if (hasAverageSpeed) {
		requireBytes(2, "averageSpeed");
		offset += 2;
	}

	if (hasInstantaneousCadence) {
		requireBytes(2, "instantaneousCadence");
		result.instantaneousCadenceRpm = view.getUint16(offset, true) / 2;
		offset += 2;
	}

	if (hasAverageCadence) {
		requireBytes(2, "averageCadence");
		offset += 2;
	}

	if (hasTotalDistance) {
		requireBytes(3, "totalDistance");
		result.totalDistanceKm = readUint24LE(view, offset) / 1000;
		offset += 3;
	}

	if (hasResistanceLevel) {
		requireBytes(2, "resistanceLevel");
		offset += 2;
	}

	if (hasInstantaneousPower) {
		requireBytes(2, "instantaneousPower");
		result.instantaneousPowerW = view.getInt16(offset, true);
		offset += 2;
	}

	if (hasAveragePower) {
		requireBytes(2, "averagePower");
		offset += 2;
	}

	if (hasExpendedEnergy) {
		requireBytes(5, "expendedEnergy");
		offset += 5;
	}

	if (hasHeartRate) {
		requireBytes(1, "heartRate");
		offset += 1;
	}

	if (hasMetabolicEquivalent) {
		requireBytes(1, "metabolicEquivalent");
		offset += 1;
	}

	if (hasElapsedTime) {
		requireBytes(2, "elapsedTime");
		offset += 2;
	}

	if (hasRemainingTime) {
		requireBytes(2, "remainingTime");
		offset += 2;
	}

	if (offset !== view.byteLength) {
		throw new Error(
			`Indoor Bike Data has ${view.byteLength - offset} unexpected trailing byte(s)`,
		);
	}

	return result;
}
