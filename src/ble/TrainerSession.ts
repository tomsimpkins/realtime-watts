import type {
	ConnectedTrainer,
	DiscoveredBleTopology,
	TrainerDeviceInfo,
	TrainerMode,
} from "../domain/trainer";
import type { WorkoutDefinition } from "../domain/workout";
import {
	type WorkoutControlIntent,
	type WorkoutSessionSnapshot,
	WorkoutEngine,
} from "../domain/workoutEngine";
import type { MetricsState } from "../state/metricsSlice";
import { logDebug } from "../utils/errors";
import { resolveCapabilities } from "./capabilityResolver";
import {
	type FTMSDevice,
	type BikeDataSource,
} from "./FTMSDevice";
import { FTMSDevice as ConnectedFTMSDevice } from "./FTMSDevice";
import { FTMSControlAdapter } from "./FTMSControlAdapter";
import type { IndoorBikeData } from "./FTMSTelemetryDecoder";
import {
	FITNESS_MACHINE_INDOOR_BIKE_DATA_CHARACTERISTIC,
	FITNESS_MACHINE_SERVICE,
} from "./uuids";

type DisconnectCallback = () => void;
type MetricsSnapshotCallback = (snapshot: MetricsState) => void;
type WorkoutSnapshotCallback = (snapshot: WorkoutSessionSnapshot) => void;
type Unsubscribe = () => void;

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

abstract class EngineBackedTrainerConnection implements TrainerConnection {
	protected readonly disconnectCallbacks = new Set<DisconnectCallback>();
	protected readonly metricsSnapshotCallbacks = new Set<MetricsSnapshotCallback>();
	protected readonly workoutSnapshotCallbacks = new Set<WorkoutSnapshotCallback>();
	protected readonly workoutEngine = new WorkoutEngine();
	private workoutTickerId:
		| ReturnType<typeof globalThis.setInterval>
		| undefined;

	constructor() {
		this.workoutEngine.subscribeToWorkoutSnapshots((snapshot) => {
			this.workoutSnapshotCallbacks.forEach((callback) => callback(snapshot));
		});
	}

	abstract requestDevice(): Promise<TrainerDeviceInfo>;
	abstract connect(): Promise<ConnectedTrainer>;
	abstract reconnect(): Promise<ConnectedTrainer>;
	abstract disconnect(): Promise<void>;

	getMetricsSnapshot(): MetricsState {
		return this.workoutEngine.getSnapshot();
	}

	getWorkoutSnapshot(): WorkoutSessionSnapshot {
		return this.workoutEngine.getWorkoutSnapshot();
	}

	onDisconnected(callback: DisconnectCallback): Unsubscribe {
		this.disconnectCallbacks.add(callback);

		return () => {
			this.disconnectCallbacks.delete(callback);
		};
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

	protected emitMetricsSnapshot(): void {
		const snapshot = this.workoutEngine.getSnapshot();
		this.metricsSnapshotCallbacks.forEach((callback) => callback(snapshot));
	}

	protected emitWorkoutSnapshot(): void {
		const snapshot = this.workoutEngine.getWorkoutSnapshot();
		this.workoutSnapshotCallbacks.forEach((callback) => callback(snapshot));
	}

	protected emitDisconnected(): void {
		this.disconnectCallbacks.forEach((callback) => callback());
	}

	protected ensureWorkoutTicker(): void {
		this.stopWorkoutTicker();
		this.workoutTickerId = globalThis.setInterval(() => {
			this.workoutEngine.dispatch({
				type: "clock.ticked",
				payload: { clockMs: Date.now() },
			});
			this.emitWorkoutSnapshot();
		}, 1000);
	}

	protected stopWorkoutTicker(): void {
		if (typeof this.workoutTickerId === "undefined") {
			return;
		}

		globalThis.clearInterval(this.workoutTickerId);
		this.workoutTickerId = undefined;
	}
}

export class TrainerSession extends EngineBackedTrainerConnection {
	private bluetoothDevice: BluetoothDevice | undefined;
	private connectedDevice: ConnectedFTMSDevice | undefined;
	private controlAdapter: FTMSControlAdapter | undefined;
	private bikeDataSource: BikeDataSource | undefined;
	private isDisconnecting = false;
	private pendingControlTask: Promise<void> = Promise.resolve();

	constructor() {
		super();
		this.workoutEngine.subscribeToControlIntents((intent) => {
			this.pendingControlTask = this.pendingControlTask
				.then(() => this.handleControlIntent(intent))
				.catch((error) => {
					logDebug("Failed to handle control intent", error);
				});
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
			const controlPointCharacteristic =
				await device.getControlPointCharacteristic();
			this.controlAdapter = new FTMSControlAdapter(controlPointCharacteristic);
			await this.controlAdapter.start();
			this.controlAdapter.resetState();
		} catch (error) {
			this.controlAdapter = undefined;
			logDebug("FTMS control point is unavailable", error);
		}

		this.bikeDataSource.subscribe(this.handleBikeData);
		await this.bikeDataSource.start();

		if (import.meta.env.DEV) {
			logDebug("Discovered trainer topology", topology);
		}

		const capabilityResolution = resolveCapabilities({
			mode: "ble",
			topology,
		});

		return {
			capabilities: capabilityResolution.capabilities,
			capabilityStatuses: capabilityResolution.statuses,
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

	private mustGetDevice(): ConnectedFTMSDevice {
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
		this.connectedDevice = new ConnectedFTMSDevice(device);
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

	private cleanupConnection(): void {
		this.stopWorkoutTicker();
		this.bikeDataSource = undefined;
		this.controlAdapter?.resetState();
		this.controlAdapter = undefined;
		this.connectedDevice?.resetConnection();
	}

	private readonly handleGattDisconnected = (): void => {
		this.cleanupConnection();
		this.workoutEngine.dispatch({ type: "workout.stream-idle" });
		this.emitMetricsSnapshot();

		if (this.isDisconnecting) {
			return;
		}

		this.emitDisconnected();
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

	private async handleControlIntent(intent: WorkoutControlIntent): Promise<void> {
		if (!this.controlAdapter) {
			return;
		}

		switch (intent.type) {
			case "trainer.control.disable-erg":
				await this.controlAdapter.reset();
				return;
			case "trainer.control.set-erg-power":
				await this.controlAdapter.setTargetPower(intent.payload.watts);
		}
	}
}

class MockTrainerConnection extends EngineBackedTrainerConnection {
	private intervalId?: number;
	private startedAt = Date.now();
	private lastEmitAt = Date.now();
	private simulatedDistanceKm = 0;
	private readonly device: TrainerDeviceInfo = {
		id: "simulated-trainer",
		name: "Simulated Trainer",
	};

	async requestDevice(): Promise<TrainerDeviceInfo> {
		return this.device;
	}

	async connect(): Promise<ConnectedTrainer> {
		this.startedAt = Date.now();
		this.lastEmitAt = this.startedAt;
		this.simulatedDistanceKm = 0;
		this.startEmitter();
		const capabilityResolution = resolveCapabilities({ mode: "simulate" });

		return {
			capabilities: capabilityResolution.capabilities,
			capabilityStatuses: capabilityResolution.statuses,
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
}

export const ftmsManager = new TrainerSession();

export function createTrainerConnection(mode: TrainerMode): TrainerConnection {
	return mode === "simulate" ? new MockTrainerConnection() : ftmsManager;
}
