import { FITNESS_MACHINE_CONTROL_POINT_CHARACTERISTIC } from "./uuids";
import {
	decodeBikeData,
	type IndoorBikeData,
} from "./FTMSTelemetryDecoder";

const FTMS_SERVICE_ID = 0x1826;
const INDOOR_BIKE_DATA_CHARACTERISTIC_ID = 0x2ad2;
const FITNESS_MACHINE_FEATURE_CHARACTERISTIC_ID = 0x2acc;

export interface FTMSFeatures {
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

export type IndoorBikeDataListener = (bikeData: IndoorBikeData) => void;

function decodeFeaturesData(view: DataView): FTMSFeatures {
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
}

export class BikeDataSource {
	private readonly listeners = new Set<IndoorBikeDataListener>();
	private notificationsActive = false;

	constructor(
		private readonly bikeDataCharacteristic: BluetoothRemoteGATTCharacteristic,
	) {}

	async start(): Promise<void> {
		if (this.notificationsActive) {
			return;
		}

		this.bikeDataCharacteristic.addEventListener(
			"characteristicvaluechanged",
			this.onBikeData,
		);
		await this.bikeDataCharacteristic.startNotifications();
		this.notificationsActive = true;
	}

	async stop(): Promise<void> {
		this.bikeDataCharacteristic.removeEventListener(
			"characteristicvaluechanged",
			this.onBikeData,
		);

		if (!this.notificationsActive) {
			return;
		}

		await this.bikeDataCharacteristic.stopNotifications();
		this.notificationsActive = false;
	}

	subscribe(listener: IndoorBikeDataListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private readonly onBikeData = (event: Event): void => {
		const value = (event.target as BluetoothRemoteGATTCharacteristic).value;

		if (!value) {
			return;
		}

		const decoded = decodeBikeData(value);
		this.listeners.forEach((listener) => listener(decoded));
	};
}

export class FTMSDevice {
	private server: BluetoothRemoteGATTServer | undefined;
	private service: BluetoothRemoteGATTService | undefined;

	constructor(private readonly device: BluetoothDevice) {}

	get bluetoothDevice(): BluetoothDevice {
		return this.device;
	}

	get name(): string {
		return this.device.name ?? this.device.id;
	}

	get id(): string {
		return this.device.id;
	}

	async connect(): Promise<void> {
		if (!this.device.gatt) {
			throw new Error("Does not support GATT connection");
		}

		this.server = this.device.gatt.connected
			? this.device.gatt
			: await this.device.gatt.connect();
		this.service = await this.server.getPrimaryService(FTMS_SERVICE_ID);
	}

	async disconnect(): Promise<void> {
		if (this.device.gatt?.connected) {
			this.device.gatt.disconnect();
		}

		this.resetConnection();
	}

	resetConnection(): void {
		this.server = undefined;
		this.service = undefined;
	}

	mustGetServer(): BluetoothRemoteGATTServer {
		if (!this.server) {
			throw new Error("Must connect to FTMSDevice before using the GATT server");
		}

		return this.server;
	}

	async getBikeDatasource(): Promise<BikeDataSource> {
		const service = this.mustGetService();
		const indoorBikeCharacteristic = await service.getCharacteristic(
			INDOOR_BIKE_DATA_CHARACTERISTIC_ID,
		);

		return new BikeDataSource(indoorBikeCharacteristic);
	}

	async getControlPointCharacteristic(): Promise<BluetoothRemoteGATTCharacteristic> {
		return this.mustGetService().getCharacteristic(
			FITNESS_MACHINE_CONTROL_POINT_CHARACTERISTIC,
		);
	}

	async readCapabilities(): Promise<FTMSFeatures> {
		const featureCharacteristic = await this.mustGetService().getCharacteristic(
			FITNESS_MACHINE_FEATURE_CHARACTERISTIC_ID,
		);
		const featureValue = await featureCharacteristic.readValue();

		return decodeFeaturesData(featureValue);
	}

	private mustGetService(): BluetoothRemoteGATTService {
		if (!this.service) {
			throw new Error("Must connect to FTMSDevice before trying to read data");
		}

		return this.service;
	}
}
