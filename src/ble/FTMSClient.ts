const FTMSServiceId = 0x1826;
const indoorBikeDataCharacteristicId = 0x2ad2;
const fitnessMachineStatusCharacteristicId = 0x2acc;

class FTMSManager {
	device: FTMSDevice | undefined;
	async requestDevice() {
		this.device = new FTMSDevice(
			await navigator.bluetooth.requestDevice({
				filters: [{ services: [FTMSServiceId] }],
			}),
		);
	}
}

export const ftmsManager = new FTMSManager();

interface FTMSFeatures {
	machine: {
		averageSpeedSupported: boolean;
		cadenceSupported: boolean;
		totalDistanceSupported: boolean;
		resistanceLevelSupported: boolean;
		powerMeasurementSupported: boolean;
		expendedEnergySupported: boolean;
		heartRateMeasurementSupported: boolean;
		elapsedTimeSupported: boolean;
		remainingTimeSupported: boolean;
	};
	target: {
		speedTargetSettingSupported: boolean;
		inclinationTargetSettingSupported: boolean;
		resistanceTargetSettingSupported: boolean;
		powerTargetSettingSupported: boolean;
		heartRateTargetSettingSupported: boolean;
		indoorBikeSimulationParametersSupported: boolean;
		wheelCircumferenceConfigurationSupported: boolean;
		spinDownControlSupported: boolean;
	};
}

const decodeFeaturesData = (view: DataView) => {
	const machine = view.getUint32(0, true);
	const target = view.getUint32(4, true);

	return {
		machine: {
			averageSpeedSupported: !!(machine & (1 << 0)),
			cadenceSupported: !!(machine & (1 << 1)),
			totalDistanceSupported: !!(machine & (1 << 2)),
			resistanceLevelSupported: !!(machine & (1 << 7)),
			powerMeasurementSupported: !!(machine & (1 << 14)),
			expendedEnergySupported: !!(machine & (1 << 9)),
			heartRateMeasurementSupported: !!(machine & (1 << 10)),
			elapsedTimeSupported: !!(machine & (1 << 12)),
			remainingTimeSupported: !!(machine & (1 << 13)),
		},
		target: {
			speedTargetSettingSupported: !!(target & (1 << 0)),
			inclinationTargetSettingSupported: !!(target & (1 << 1)),
			resistanceTargetSettingSupported: !!(target & (1 << 2)),
			powerTargetSettingSupported: !!(target & (1 << 3)),
			heartRateTargetSettingSupported: !!(target & (1 << 4)),
			indoorBikeSimulationParametersSupported: !!(target & (1 << 13)),
			wheelCircumferenceConfigurationSupported: !!(target & (1 << 14)),
			spinDownControlSupported: !!(target & (1 << 15)),
		},
	};
};

class FTMSDevice {
	private device: BluetoothDevice;
	private server: BluetoothRemoteGATTServer | undefined;
	private service: BluetoothRemoteGATTService | undefined;
	constructor(device: BluetoothDevice) {
		this.device = device;
	}

	get name() {
		return this.device.name ?? this.device.id;
	}

	get id() {
		return this.device.id;
	}

	async connect() {
		if (!this.device.gatt) {
			throw new Error("Does not support GATT connection");
		}

		this.server = await this.device.gatt!.connect();
		this.service = await this.server.getPrimaryService(FTMSServiceId);
	}

	private mustGetService(): BluetoothRemoteGATTService {
		if (!this.service) {
			throw new Error("Must connect to FTMSDevice before trying to read data");
		}

		return this.service;
	}

	async getBikeDatasource() {
		const service = this.mustGetService();
		return new BikeDataSource(
			await service.getCharacteristic(indoorBikeDataCharacteristicId),
		);
	}

	async readCapabilities(): Promise<FTMSFeatures> {
		const service = this.mustGetService();

		const featureCharacteristic = await service.getCharacteristic(
			fitnessMachineStatusCharacteristicId,
		);
		const featureValue = await featureCharacteristic.readValue();

		return decodeFeaturesData(featureValue);
	}
}

interface IndoorBikeData {
	instantaneousCadenceRpm: number;
	instantaneousSpeedKph: number;
	instantaneousPowerW: number;
}
type IndoorBikeDataListener = (bikeData: IndoorBikeData) => void;
type Unsubscribe = () => void;

const decodeBikeData = (view: DataView) => {
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

	const requireBytes = (n: number, field: string) => {
		if (offset + n > view.byteLength) {
			throw new Error(`Indoor Bike Data truncated while reading ${field}`);
		}
	};

	const result: IndoorBikeData = {
		instantaneousCadenceRpm: -1,
		instantaneousPowerW: -1,
		instantaneousSpeedKph: -1,
	};

	// FTMS quirk:
	// instantaneous speed is present when More Data == 0
	if (!moreData) {
		requireBytes(2, "instantaneousSpeed");
		result.instantaneousSpeedKph = view.getUint16(offset, true) / 100;
		offset += 2;
	}

	if (hasAverageSpeed) {
		requireBytes(2, "averageSpeed");
		// result.averageSpeedKph = view.getUint16(offset, true) / 100
		offset += 2;
	}

	if (hasInstantaneousCadence) {
		requireBytes(2, "instantaneousCadence");
		result.instantaneousCadenceRpm = view.getUint16(offset, true) / 2;
		offset += 2;
	}

	if (hasAverageCadence) {
		requireBytes(2, "averageCadence");
		// result.averageCadenceRpm = view.getUint16(offset, true) / 2
		offset += 2;
	}

	if (hasTotalDistance) {
		requireBytes(3, "totalDistance");
		// result.totalDistanceM = readUint24LE(view, offset)
		offset += 3;
	}

	if (hasResistanceLevel) {
		requireBytes(2, "resistanceLevel");
		// result.resistanceLevel = view.getInt16(offset, true) / 10
		offset += 2;
	}

	if (hasInstantaneousPower) {
		requireBytes(2, "instantaneousPower");
		result.instantaneousPowerW = view.getInt16(offset, true);
		offset += 2;
	}

	if (hasAveragePower) {
		requireBytes(2, "averagePower");
		// result.averagePowerW = view.getInt16(offset, true)
		offset += 2;
	}

	if (hasExpendedEnergy) {
		requireBytes(5, "expendedEnergy");

		const totalKcalRaw = view.getUint16(offset, true);
		offset += 2;

		const perHourKcalRaw = view.getUint16(offset, true);
		offset += 2;

		const perMinuteKcalRaw = view.getUint8(offset);
		offset += 1;

		// result.expendedEnergy = {
		//   totalKcal: totalKcalRaw === 0xffff ? undefined : totalKcalRaw,
		//   perHourKcal: perHourKcalRaw === 0xffff ? undefined : perHourKcalRaw,
		//   perMinuteKcal: perMinuteKcalRaw === 0xff ? undefined : perMinuteKcalRaw,
		// }
	}

	if (hasHeartRate) {
		requireBytes(1, "heartRate");
		// result.heartRateBpm = view.getUint8(offset)
		offset += 1;
	}

	if (hasMetabolicEquivalent) {
		requireBytes(1, "metabolicEquivalent");
		// result.metabolicEquivalent = view.getUint8(offset) / 10
		offset += 1;
	}

	if (hasElapsedTime) {
		requireBytes(2, "elapsedTime");
		// result.elapsedTimeS = view.getUint16(offset, true)
		offset += 2;
	}

	if (hasRemainingTime) {
		requireBytes(2, "remainingTime");
		// result.remainingTimeS = view.getUint16(offset, true)
		offset += 2;
	}

	if (offset !== view.byteLength) {
		throw new Error(
			`Indoor Bike Data has ${view.byteLength - offset} unexpected trailing byte(s)`,
		);
	}

	return result;
};

class BikeDataSource {
	private bikeDataCharacteristic: BluetoothRemoteGATTCharacteristic;
	private listeners = new Set<IndoorBikeDataListener>();
	constructor(bikeDataCharacteristic: BluetoothRemoteGATTCharacteristic) {
		this.bikeDataCharacteristic = bikeDataCharacteristic;
	}

	async start() {
		this.bikeDataCharacteristic.addEventListener(
			"characteristicvaluechanged",
			this.onBikeData,
		);
		await this.bikeDataCharacteristic.startNotifications();
	}

	private onBikeData = (e: Event) => {
		const value = (e.target as BluetoothRemoteGATTCharacteristic).value!;
		const decoded = decodeBikeData(value);

		this.listeners.forEach((listener) => listener(decoded));
	};

	subscribe(listener: IndoorBikeDataListener): Unsubscribe {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}
