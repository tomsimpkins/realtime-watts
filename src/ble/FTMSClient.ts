import type {
	ConnectedTrainer,
	DiscoveredBleTopology,
	TrainerDeviceInfo,
	TrainerMode,
} from "../domain/trainer";
import type { WorkoutDefinition, WorkoutStatus } from "../domain/workout";
import {
	type WorkoutControlIntent,
	type WorkoutSessionSnapshot,
	WorkoutEngine,
} from "../domain/workoutEngine";
import type { MetricsState } from "../state/metricsSlice";
import { logDebug } from "../utils/errors";
import {
	FITNESS_MACHINE_CONTROL_POINT_CHARACTERISTIC,
	FITNESS_MACHINE_INDOOR_BIKE_DATA_CHARACTERISTIC,
	FITNESS_MACHINE_SERVICE,
} from "./uuids";

const FTMSServiceId = 0x1826;
const indoorBikeDataCharacteristicId = 0x2ad2;
const fitnessMachineStatusCharacteristicId = 0x2acc;

type DisconnectCallback = () => void;
type MetricsSnapshotCallback = (snapshot: MetricsState) => void;
type WorkoutSnapshotCallback = (snapshot: WorkoutSessionSnapshot) => void;
type Unsubscribe = () => void;

const FTMS_CONTROL_OP_REQUEST_CONTROL = 0x00;
const FTMS_CONTROL_OP_RESET = 0x01;
const FTMS_CONTROL_OP_SET_TARGET_POWER = 0x05;

export interface TrainerConnection {
	requestDevice(): Promise<TrainerDeviceInfo>;
	connect(): Promise<ConnectedTrainer>;
	reconnect(): Promise<ConnectedTrainer>;
	disconnect(): Promise<void>;
	getMetricsSnapshot(): MetricsState;
	getWorkoutSnapshot(): WorkoutSessionSnapshot;
	onDisconnected(callback: DisconnectCallback): Unsubscribe;
	subscribeToMetricsSnapshot(callback: MetricsSnapshotCallback): Unsubscribe;
	subscribeToWorkoutSnapshot(callback: WorkoutSnapshotCallback): Unsubscribe;
	selectWorkout(workout?: WorkoutDefinition): void;
	startWorkout(clockMs: number): void;
	pauseWorkout(clockMs: number): void;
	resumeWorkout(clockMs: number): void;
	endWorkout(): void;
}

function toDeviceInfo(
	device: Pick<BluetoothDevice, "id" | "name">,
): TrainerDeviceInfo {
	return {
		id: device.id || undefined,
		name: device.name || "Unnamed trainer",
	};
}

function normalizeUuid(uuid: string): string {
	return uuid.toLowerCase();
}

class FTMSManager implements TrainerConnection {
	private bluetoothDevice: BluetoothDevice | undefined;
	private connectedDevice: FTMSDevice | undefined;
	private controlPointCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;
	private controlRequested = false;
	private readonly disconnectCallbacks = new Set<DisconnectCallback>();
	private readonly metricsSnapshotCallbacks = new Set<MetricsSnapshotCallback>();
	private readonly workoutSnapshotCallbacks = new Set<WorkoutSnapshotCallback>();
	private readonly workoutEngine = new WorkoutEngine();
	private bikeDataSource: BikeDataSource | undefined;
	private isDisconnecting = false;
	private pendingControlTask: Promise<void> = Promise.resolve();
	private workoutTickerId:
		| ReturnType<typeof globalThis.setInterval>
		| undefined;

	constructor() {
		this.workoutEngine.subscribeToControlIntents((intent) => {
			this.pendingControlTask = this.pendingControlTask
				.then(() => this.handleControlIntent(intent))
				.catch((error) => {
					logDebug("Failed to handle control intent", error);
				});
		});
		this.workoutEngine.subscribeToWorkoutSnapshots((snapshot) => {
			this.workoutSnapshotCallbacks.forEach((callback) => callback(snapshot));
		});
	}

	get device(): FTMSDevice | undefined {
		return this.connectedDevice;
	}

	async requestDevice(): Promise<TrainerDeviceInfo> {
		if (!("bluetooth" in navigator)) {
			throw new DOMException(
				"Web Bluetooth is not supported.",
				"NotSupportedError",
			);
		}

		const bluetoothDevice = await navigator.bluetooth.requestDevice({
			filters: [{ services: [FITNESS_MACHINE_SERVICE] }],
		});

		this.setBluetoothDevice(bluetoothDevice);
		logDebug("Trainer selected", toDeviceInfo(bluetoothDevice));
		return toDeviceInfo(bluetoothDevice);
	}

	async connect(): Promise<ConnectedTrainer> {
		const device = this.mustGetDevice();
		await device.connect();
		const server = device.mustGetServer();
		const topology = await this.discoverTopology(server);
		this.bikeDataSource = await device.getBikeDatasource();
		try {
			this.controlPointCharacteristic = await device.getControlPointCharacteristic();
			await this.startControlPointIndications();
		} catch (error) {
			this.controlPointCharacteristic = undefined;
			logDebug("FTMS control point is unavailable", error);
		}
		this.controlRequested = false;
		this.bikeDataSource.subscribe(this.handleBikeData);
		await this.bikeDataSource.start();

		if (import.meta.env.DEV) {
			logDebug("Discovered trainer topology", topology);
		}

		return {
			device: toDeviceInfo(device.bluetoothDevice),
			topology,
		};
	}

	async reconnect(): Promise<ConnectedTrainer> {
		return this.connect();
	}

	async disconnect(): Promise<void> {
		const device = this.connectedDevice;

		if (!device) {
			return;
		}

		this.isDisconnecting = true;

		try {
			await this.stopBikeData();
			await device.disconnect();
		} finally {
			this.cleanupConnection();
			this.isDisconnecting = false;
		}
	}

	onDisconnected(callback: DisconnectCallback): Unsubscribe {
		this.disconnectCallbacks.add(callback);

		return () => {
			this.disconnectCallbacks.delete(callback);
		};
	}

	getMetricsSnapshot(): MetricsState {
		return this.workoutEngine.getSnapshot();
	}

	getWorkoutSnapshot(): WorkoutSessionSnapshot {
		return this.workoutEngine.getWorkoutSnapshot();
	}

	subscribeToMetricsSnapshot(
		callback: MetricsSnapshotCallback,
	): Unsubscribe {
		this.metricsSnapshotCallbacks.add(callback);

		return () => {
			this.metricsSnapshotCallbacks.delete(callback);
		};
	}

	subscribeToWorkoutSnapshot(
		callback: WorkoutSnapshotCallback,
	): Unsubscribe {
		this.workoutSnapshotCallbacks.add(callback);

		return () => {
			this.workoutSnapshotCallbacks.delete(callback);
		};
	}

	selectWorkout(workout?: WorkoutDefinition): void {
		this.workoutEngine.dispatch({
			type: "workout.selected",
			payload: { workout },
		});
		this.emitWorkoutSnapshot();
	}

	startWorkout(clockMs: number): void {
		this.stopWorkoutTicker();
		this.workoutEngine.dispatch({
			type: "workout.started",
			payload: { clockMs },
		});
		this.emitWorkoutSnapshot();
		this.ensureWorkoutTicker();
	}

	pauseWorkout(clockMs: number): void {
		this.workoutEngine.dispatch({
			type: "workout.paused",
			payload: { clockMs },
		});
		this.emitWorkoutSnapshot();
		this.stopWorkoutTicker();
	}

	resumeWorkout(clockMs: number): void {
		this.workoutEngine.dispatch({
			type: "workout.resumed",
			payload: { clockMs },
		});
		this.emitWorkoutSnapshot();
		this.ensureWorkoutTicker();
	}

	endWorkout(): void {
		this.workoutEngine.dispatch({ type: "workout.ended" });
		this.emitWorkoutSnapshot();
		this.stopWorkoutTicker();
	}

	private mustGetDevice(): FTMSDevice {
		if (!this.connectedDevice) {
			throw new Error("No FTMS device has been selected yet.");
		}

		return this.connectedDevice;
	}

	private setBluetoothDevice(device: BluetoothDevice): void {
		if (this.bluetoothDevice && this.bluetoothDevice !== device) {
			this.bluetoothDevice.removeEventListener(
				"gattserverdisconnected",
				this.handleGattDisconnected,
			);
		}

		this.bluetoothDevice = device;
		this.bluetoothDevice.addEventListener(
			"gattserverdisconnected",
			this.handleGattDisconnected,
		);
		this.connectedDevice = new FTMSDevice(device);
	}

	private async discoverTopology(
		server: BluetoothRemoteGATTServer,
	): Promise<DiscoveredBleTopology> {
		const services = await server.getPrimaryServices();
		const characteristicUuidsByService: Record<string, string[]> = {};
		const serviceUuids: string[] = [];

		await Promise.all(
			services.map(async (service) => {
				const normalizedServiceUuid = normalizeUuid(service.uuid);
				serviceUuids.push(normalizedServiceUuid);
				const characteristics = await service.getCharacteristics();
				characteristicUuidsByService[normalizedServiceUuid] =
					characteristics.map((characteristic) =>
						normalizeUuid(characteristic.uuid),
					);
			}),
		);

		return {
			serviceUuids,
			characteristicUuidsByService,
		};
	}

	private async stopBikeData(): Promise<void> {
		if (!this.bikeDataSource) {
			return;
		}

		try {
			await this.bikeDataSource.stop();
		} catch (error) {
			logDebug("Stopping bike data notifications was not clean", error);
		}
	}

	private async startControlPointIndications(): Promise<void> {
		if (!this.controlPointCharacteristic) {
			return;
		}

		try {
			await this.controlPointCharacteristic.startNotifications();
		} catch (error) {
			logDebug("Starting control point indications was not clean", error);
		}
	}

	private cleanupConnection(): void {
		this.stopWorkoutTicker();
		this.bikeDataSource = undefined;
		this.controlPointCharacteristic = undefined;
		this.controlRequested = false;
		this.connectedDevice?.resetConnection();
	}

	private readonly handleGattDisconnected = (): void => {
		this.cleanupConnection();
		this.workoutEngine.dispatch({ type: "workout.stream-idle" });
		this.emitMetricsSnapshot();

		if (this.isDisconnecting) {
			return;
		}

		this.disconnectCallbacks.forEach((callback) => callback());
	};

	private readonly handleBikeData = (data: IndoorBikeData): void => {
		this.workoutEngine.dispatch({
			type: "workout.telemetry",
			payload: {
				cadenceRpm:
					data.instantaneousCadenceRpm >= 0
						? data.instantaneousCadenceRpm
						: undefined,
				distanceKm:
					data.totalDistanceKm >= 0 ? data.totalDistanceKm : undefined,
				source: "ftms",
				speedKph:
					data.instantaneousSpeedKph >= 0
						? data.instantaneousSpeedKph
						: undefined,
				timestampMs: Date.now(),
				watts:
					data.instantaneousPowerW >= 0 ? data.instantaneousPowerW : 0,
			},
		});
		this.emitMetricsSnapshot();
	};

	private emitMetricsSnapshot(): void {
		const snapshot = this.workoutEngine.getSnapshot();
		this.metricsSnapshotCallbacks.forEach((callback) => callback(snapshot));
	}

	private emitWorkoutSnapshot(): void {
		const snapshot = this.workoutEngine.getWorkoutSnapshot();
		this.workoutSnapshotCallbacks.forEach((callback) => callback(snapshot));
	}

	private async handleControlIntent(intent: WorkoutControlIntent): Promise<void> {
		if (!this.controlPointCharacteristic) {
			return;
		}

		await this.ensureControlRequested();

		switch (intent.type) {
			case "trainer.control.disable-erg":
				await this.writeControlPoint(
					new Uint8Array([FTMS_CONTROL_OP_RESET]).buffer,
				);
				return;
			case "trainer.control.set-erg-power": {
				const payload = new ArrayBuffer(3);
				const view = new DataView(payload);
				view.setUint8(0, FTMS_CONTROL_OP_SET_TARGET_POWER);
				view.setInt16(1, intent.payload.watts, true);
				await this.writeControlPoint(payload);
			}
		}
	}

	private async ensureControlRequested(): Promise<void> {
		if (this.controlRequested || !this.controlPointCharacteristic) {
			return;
		}

		await this.writeControlPoint(
			new Uint8Array([FTMS_CONTROL_OP_REQUEST_CONTROL]).buffer,
		);
		this.controlRequested = true;
	}

	private async writeControlPoint(value: ArrayBuffer): Promise<void> {
		if (!this.controlPointCharacteristic) {
			return;
		}

		await (
			this.controlPointCharacteristic as BluetoothRemoteGATTCharacteristic & {
				writeValue: (value: BufferSource) => Promise<void>;
			}
		).writeValue(value);
	}

	private ensureWorkoutTicker(): void {
		this.stopWorkoutTicker();
		this.workoutTickerId = globalThis.setInterval(() => {
			this.workoutEngine.dispatch({
				type: "clock.ticked",
				payload: { clockMs: Date.now() },
			});
			this.emitWorkoutSnapshot();
		}, 1000);
	}

	private stopWorkoutTicker(): void {
		if (typeof this.workoutTickerId === "undefined") {
			return;
		}

		globalThis.clearInterval(this.workoutTickerId);
		this.workoutTickerId = undefined;
	}
}

export const ftmsManager = new FTMSManager();

export function createTrainerConnection(mode: TrainerMode): TrainerConnection {
	return mode === "simulate" ? new MockTrainerConnection() : ftmsManager;
}

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
	private readonly device: BluetoothDevice;
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

	get bluetoothDevice(): BluetoothDevice {
		return this.device;
	}

	async connect() {
		if (!this.device.gatt) {
			throw new Error("Does not support GATT connection");
		}

		this.server = this.device.gatt.connected
			? this.device.gatt
			: await this.device.gatt.connect();
		this.service = await this.server.getPrimaryService(FTMSServiceId);
	}

	async disconnect() {
		if (this.device.gatt?.connected) {
			this.device.gatt.disconnect();
		}

		this.resetConnection();
	}

	resetConnection() {
		this.server = undefined;
		this.service = undefined;
	}

	mustGetServer(): BluetoothRemoteGATTServer {
		if (!this.server) {
			throw new Error("Must connect to FTMSDevice before using the GATT server");
		}

		return this.server;
	}

	private mustGetService(): BluetoothRemoteGATTService {
		if (!this.service) {
			throw new Error("Must connect to FTMSDevice before trying to read data");
		}

		return this.service;
	}

	async getBikeDatasource() {
		const service = this.mustGetService();
		const indoorBikeCharacteristic = await service.getCharacteristic(
			indoorBikeDataCharacteristicId,
		);

		return new BikeDataSource(indoorBikeCharacteristic);
	}

	async getControlPointCharacteristic() {
		const service = this.mustGetService();

		return service.getCharacteristic(FITNESS_MACHINE_CONTROL_POINT_CHARACTERISTIC);
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
	totalDistanceKm: number;
	instantaneousSpeedKph: number;
	instantaneousPowerW: number;
}
type IndoorBikeDataListener = (bikeData: IndoorBikeData) => void;

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
		totalDistanceKm: -1,
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
		result.totalDistanceKm =
			(view.getUint8(offset) |
				(view.getUint8(offset + 1) << 8) |
				(view.getUint8(offset + 2) << 16)) /
			1000;
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

class MockTrainerConnection implements TrainerConnection {
	private readonly disconnectCallbacks = new Set<DisconnectCallback>();
	private readonly metricsSnapshotCallbacks = new Set<MetricsSnapshotCallback>();
	private readonly workoutSnapshotCallbacks = new Set<WorkoutSnapshotCallback>();
	private readonly workoutEngine = new WorkoutEngine();
	private intervalId?: number;
	private startedAt = Date.now();
	private lastEmitAt = Date.now();
	private simulatedDistanceKm = 0;
	private workoutTickerId:
		| ReturnType<typeof globalThis.setInterval>
		| undefined;
	private readonly device: TrainerDeviceInfo = {
		id: "simulated-trainer",
		name: "Simulated Trainer",
	};

	constructor() {
		this.workoutEngine.subscribeToWorkoutSnapshots((snapshot) => {
			this.workoutSnapshotCallbacks.forEach((callback) => callback(snapshot));
		});
	}

	async requestDevice(): Promise<TrainerDeviceInfo> {
		return this.device;
	}

	async connect(): Promise<ConnectedTrainer> {
		this.startedAt = Date.now();
		this.lastEmitAt = this.startedAt;
		this.simulatedDistanceKm = 0;
		this.startEmitter();

			return {
				device: this.device,
				topology: {
					serviceUuids: [FITNESS_MACHINE_SERVICE],
					characteristicUuidsByService: {
						[FITNESS_MACHINE_SERVICE]: [
							FITNESS_MACHINE_INDOOR_BIKE_DATA_CHARACTERISTIC,
						],
					},
				},
			};
	}

	async reconnect(): Promise<ConnectedTrainer> {
		return this.connect();
	}

	async disconnect(): Promise<void> {
		this.stopEmitter();
		this.stopWorkoutTicker();
	}

	onDisconnected(callback: DisconnectCallback): Unsubscribe {
		this.disconnectCallbacks.add(callback);

		return () => {
			this.disconnectCallbacks.delete(callback);
		};
	}

	getMetricsSnapshot(): MetricsState {
		return this.workoutEngine.getSnapshot();
	}

	getWorkoutSnapshot(): WorkoutSessionSnapshot {
		return this.workoutEngine.getWorkoutSnapshot();
	}

	subscribeToMetricsSnapshot(
		callback: MetricsSnapshotCallback,
	): Unsubscribe {
		this.metricsSnapshotCallbacks.add(callback);

		return () => {
			this.metricsSnapshotCallbacks.delete(callback);
		};
	}

	subscribeToWorkoutSnapshot(
		callback: WorkoutSnapshotCallback,
	): Unsubscribe {
		this.workoutSnapshotCallbacks.add(callback);

		return () => {
			this.workoutSnapshotCallbacks.delete(callback);
		};
	}

	selectWorkout(workout?: WorkoutDefinition): void {
		this.workoutEngine.dispatch({
			type: "workout.selected",
			payload: { workout },
		});
		this.emitWorkoutSnapshot();
	}

	startWorkout(clockMs: number): void {
		this.stopWorkoutTicker();
		this.workoutEngine.dispatch({
			type: "workout.started",
			payload: { clockMs },
		});
		this.emitWorkoutSnapshot();
		this.ensureWorkoutTicker();
	}

	pauseWorkout(clockMs: number): void {
		this.workoutEngine.dispatch({
			type: "workout.paused",
			payload: { clockMs },
		});
		this.emitWorkoutSnapshot();
		this.stopWorkoutTicker();
	}

	resumeWorkout(clockMs: number): void {
		this.workoutEngine.dispatch({
			type: "workout.resumed",
			payload: { clockMs },
		});
		this.emitWorkoutSnapshot();
		this.ensureWorkoutTicker();
	}

	endWorkout(): void {
		this.workoutEngine.dispatch({ type: "workout.ended" });
		this.emitWorkoutSnapshot();
		this.stopWorkoutTicker();
	}

	private startEmitter(): void {
		this.stopEmitter();

		this.intervalId = window.setInterval(() => {
			const now = Date.now();
			const elapsedSeconds = (now - this.startedAt) / 1000;
			const intervalSeconds = Math.max(0, (now - this.lastEmitAt) / 1000);
			this.lastEmitAt = now;
			const watts = Math.max(
				0,
				Math.round(
					200 +
						70 * Math.sin(elapsedSeconds * 0.9) +
						25 * Math.sin(elapsedSeconds * 1.7),
				),
			);
			const cadenceRpm = Math.max(
				65,
				Math.round(
					88 +
						8 * Math.sin(elapsedSeconds * 0.5) +
						4 * Math.sin(elapsedSeconds * 1.3),
				),
			);
			const speedKph = Math.max(
				24,
				Math.round(
					(31 +
						4 * Math.sin(elapsedSeconds * 0.35) +
						1.5 * Math.sin(elapsedSeconds * 0.9)) *
						10,
				) / 10,
			);
			this.simulatedDistanceKm += (speedKph * intervalSeconds) / 3600;
			this.workoutEngine.dispatch({
				type: "workout.telemetry",
				payload: {
					cadenceRpm,
					distanceKm: Math.round(this.simulatedDistanceKm * 100) / 100,
					source: "simulation",
					speedKph,
					timestampMs: now,
					watts,
				},
			});
			this.emitMetricsSnapshot();
		}, 500);
	}

	private stopEmitter(): void {
		if (typeof this.intervalId === "number") {
			window.clearInterval(this.intervalId);
			this.intervalId = undefined;
		}
	}

	private emitMetricsSnapshot(): void {
		const snapshot = this.workoutEngine.getSnapshot();
		this.metricsSnapshotCallbacks.forEach((callback) => callback(snapshot));
	}

	private emitWorkoutSnapshot(): void {
		const snapshot = this.workoutEngine.getWorkoutSnapshot();
		this.workoutSnapshotCallbacks.forEach((callback) => callback(snapshot));
	}

	private ensureWorkoutTicker(): void {
		this.stopWorkoutTicker();
		this.workoutTickerId = globalThis.setInterval(() => {
			this.workoutEngine.dispatch({
				type: "clock.ticked",
				payload: { clockMs: Date.now() },
			});
			this.emitWorkoutSnapshot();
		}, 1000);
	}

	private stopWorkoutTicker(): void {
		if (typeof this.workoutTickerId === "undefined") {
			return;
		}

		globalThis.clearInterval(this.workoutTickerId);
		this.workoutTickerId = undefined;
	}
}

class BikeDataSource {
	private bikeDataCharacteristic: BluetoothRemoteGATTCharacteristic;
	private listeners = new Set<IndoorBikeDataListener>();
	private notificationsActive = false;
	constructor(bikeDataCharacteristic: BluetoothRemoteGATTCharacteristic) {
		this.bikeDataCharacteristic = bikeDataCharacteristic;
	}

	async start() {
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

	async stop() {
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
