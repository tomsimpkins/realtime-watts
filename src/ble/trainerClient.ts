import type {
  ConnectedTrainer,
  DiscoveredBleTopology,
  TrainerDeviceInfo,
  TrainerMode,
} from '../domain/trainer';
import { logDebug } from '../utils/errors';
import {
  CYCLING_POWER_MEASUREMENT_CHARACTERISTIC,
  CYCLING_POWER_SERVICE,
  FITNESS_MACHINE_SERVICE,
} from './uuids';

type PowerPacketCallback = (dataView: DataView) => void;
type DisconnectCallback = () => void;

export interface TrainerClient {
  requestDevice(): Promise<TrainerDeviceInfo>;
  connect(): Promise<ConnectedTrainer>;
  reconnect(): Promise<ConnectedTrainer>;
  disconnect(): Promise<void>;
  onDisconnected(callback: DisconnectCallback): () => void;
  subscribeToPower(callback: PowerPacketCallback): () => void;
}

export function createTrainerClient(mode: TrainerMode): TrainerClient {
  return mode === 'simulate'
    ? new MockTrainerClient()
    : new WebBluetoothTrainerClient();
}

function cloneDataView(view: DataView): DataView {
  return new DataView(
    view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)
  );
}

function toDeviceInfo(device: Pick<BluetoothDevice, 'id' | 'name'>): TrainerDeviceInfo {
  return {
    id: device.id || undefined,
    name: device.name || 'Unnamed trainer',
  };
}

function normalizeUuid(uuid: string): string {
  return uuid.toLowerCase();
}

class WebBluetoothTrainerClient implements TrainerClient {
  private device?: BluetoothDevice;
  private server?: BluetoothRemoteGATTServer;
  private powerCharacteristic?: BluetoothRemoteGATTCharacteristic;
  private readonly powerCallbacks = new Set<PowerPacketCallback>();
  private readonly disconnectCallbacks = new Set<DisconnectCallback>();
  private isDisconnecting = false;
  private notificationsActive = false;

  async requestDevice(): Promise<TrainerDeviceInfo> {
    if (!('bluetooth' in navigator)) {
      throw new DOMException('Web Bluetooth is not supported.', 'NotSupportedError');
    }

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [CYCLING_POWER_SERVICE] }],
      optionalServices: [FITNESS_MACHINE_SERVICE],
    });

    this.setDevice(device);
    logDebug('Trainer selected', toDeviceInfo(device));
    return toDeviceInfo(device);
  }

  async connect(): Promise<ConnectedTrainer> {
    return this.connectWithKnownDevice();
  }

  async reconnect(): Promise<ConnectedTrainer> {
    return this.connectWithKnownDevice();
  }

  async disconnect(): Promise<void> {
    this.isDisconnecting = true;

    await this.stopNotifications();

    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }

    this.cleanupConnection();
    this.isDisconnecting = false;
  }

  onDisconnected(callback: DisconnectCallback): () => void {
    this.disconnectCallbacks.add(callback);

    return () => {
      this.disconnectCallbacks.delete(callback);
    };
  }

  subscribeToPower(callback: PowerPacketCallback): () => void {
    this.powerCallbacks.add(callback);

    return () => {
      this.powerCallbacks.delete(callback);
    };
  }

  private setDevice(device: BluetoothDevice): void {
    if (this.device && this.device !== device) {
      this.device.removeEventListener(
        'gattserverdisconnected',
        this.handleGattDisconnected
      );
    }

    this.device = device;
    this.device.addEventListener(
      'gattserverdisconnected',
      this.handleGattDisconnected
    );
  }

  private async connectWithKnownDevice(): Promise<ConnectedTrainer> {
    if (!this.device) {
      throw new Error('No trainer has been selected yet.');
    }

    const gatt = this.device.gatt;

    if (!gatt) {
      throw new Error(
        'The selected trainer does not expose a Bluetooth GATT server.'
      );
    }

    const server = gatt.connected ? gatt : await gatt.connect();
    this.server = server;

    const topology = await this.discoverTopology(server);
    const service = await server.getPrimaryService(CYCLING_POWER_SERVICE);
    const characteristic = await service.getCharacteristic(
      CYCLING_POWER_MEASUREMENT_CHARACTERISTIC
    );

    this.powerCharacteristic = characteristic;
    await this.startPowerNotifications();

    if (import.meta.env.DEV) {
      logDebug('Discovered trainer topology', topology);
    }

    return {
      device: toDeviceInfo(this.device),
      topology,
    };
  }

  private async discoverTopology(
    server: BluetoothRemoteGATTServer
  ): Promise<DiscoveredBleTopology> {
    const services = await server.getPrimaryServices();
    const characteristicUuidsByService: Record<string, string[]> = {};
    const serviceUuids: string[] = [];

    await Promise.all(
      services.map(async (service) => {
        const normalizedServiceUuid = normalizeUuid(service.uuid);
        serviceUuids.push(normalizedServiceUuid);
        const characteristics = await service.getCharacteristics();
        characteristicUuidsByService[normalizedServiceUuid] = characteristics.map(
          (characteristic) => normalizeUuid(characteristic.uuid)
        );
      })
    );

    return {
      serviceUuids,
      characteristicUuidsByService,
    };
  }

  private async startPowerNotifications(): Promise<void> {
    if (!this.powerCharacteristic) {
      throw new Error('Cycling power measurement characteristic is unavailable.');
    }

    if (this.notificationsActive) {
      return;
    }

    await this.powerCharacteristic.startNotifications();
    this.powerCharacteristic.addEventListener(
      'characteristicvaluechanged',
      this.handleCharacteristicValueChanged
    );
    this.notificationsActive = true;
  }

  private async stopNotifications(): Promise<void> {
    if (!this.powerCharacteristic) {
      this.notificationsActive = false;
      return;
    }

    this.powerCharacteristic.removeEventListener(
      'characteristicvaluechanged',
      this.handleCharacteristicValueChanged
    );

    if (this.notificationsActive) {
      try {
        await this.powerCharacteristic.stopNotifications();
      } catch (error) {
        logDebug('Stopping power notifications was not clean', error);
      }
    }

    this.notificationsActive = false;
  }

  private cleanupConnection(): void {
    if (this.powerCharacteristic) {
      this.powerCharacteristic.removeEventListener(
        'characteristicvaluechanged',
        this.handleCharacteristicValueChanged
      );
    }

    this.server = undefined;
    this.powerCharacteristic = undefined;
    this.notificationsActive = false;
  }

  private readonly handleCharacteristicValueChanged = (event: Event): void => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic | null;
    const value = characteristic?.value;

    if (!value) {
      return;
    }

    const packet = cloneDataView(value);
    this.powerCallbacks.forEach((callback) => callback(packet));
  };

  private readonly handleGattDisconnected = (): void => {
    this.cleanupConnection();
    logDebug('Trainer disconnected');

    if (this.isDisconnecting) {
      return;
    }

    this.disconnectCallbacks.forEach((callback) => callback());
  };
}

class MockTrainerClient implements TrainerClient {
  private readonly powerCallbacks = new Set<PowerPacketCallback>();
  private readonly disconnectCallbacks = new Set<DisconnectCallback>();
  private intervalId?: number;
  private startedAt = Date.now();
  private lastEmitAt = Date.now();
  private cumulativeCrankRevolutions = 0;
  private crankEventTime = 0;
  private crankRemainder = 0;
  private readonly device: TrainerDeviceInfo = {
    id: 'simulated-trainer',
    name: 'Simulated Trainer',
  };

  async requestDevice(): Promise<TrainerDeviceInfo> {
    return this.device;
  }

  async connect(): Promise<ConnectedTrainer> {
    this.startedAt = Date.now();
    this.lastEmitAt = this.startedAt;
    this.cumulativeCrankRevolutions = 0;
    this.crankEventTime = 0;
    this.crankRemainder = 0;
    this.startEmitter();

    return {
      device: this.device,
      topology: {
        serviceUuids: [CYCLING_POWER_SERVICE],
        characteristicUuidsByService: {
          [CYCLING_POWER_SERVICE]: [CYCLING_POWER_MEASUREMENT_CHARACTERISTIC],
        },
      },
    };
  }

  async reconnect(): Promise<ConnectedTrainer> {
    return this.connect();
  }

  async disconnect(): Promise<void> {
    this.stopEmitter();
  }

  onDisconnected(callback: DisconnectCallback): () => void {
    this.disconnectCallbacks.add(callback);

    return () => {
      this.disconnectCallbacks.delete(callback);
    };
  }

  subscribeToPower(callback: PowerPacketCallback): () => void {
    this.powerCallbacks.add(callback);

    return () => {
      this.powerCallbacks.delete(callback);
    };
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
            25 * Math.sin(elapsedSeconds * 1.7)
        )
      );
      const cadenceRpm = Math.max(
        65,
        Math.round(
          88 +
            8 * Math.sin(elapsedSeconds * 0.5) +
            4 * Math.sin(elapsedSeconds * 1.3)
        )
      );

      this.advanceCrankState(cadenceRpm, intervalSeconds);

      this.powerCallbacks.forEach((callback) =>
        callback(
          createSimulationPacket(
            watts,
            this.cumulativeCrankRevolutions,
            this.crankEventTime
          )
        )
      );
    }, 500);
  }

  private advanceCrankState(cadenceRpm: number, intervalSeconds: number): void {
    this.crankRemainder += (cadenceRpm * intervalSeconds) / 60;
    const completedRevolutions = Math.floor(this.crankRemainder);

    if (completedRevolutions <= 0) {
      return;
    }

    this.crankRemainder -= completedRevolutions;
    this.cumulativeCrankRevolutions =
      (this.cumulativeCrankRevolutions + completedRevolutions) % 0x1_0000;

    const ticksPerRevolution = Math.max(
      1,
      Math.round((60 * 1024) / cadenceRpm)
    );
    this.crankEventTime =
      (this.crankEventTime + completedRevolutions * ticksPerRevolution) %
      0x1_0000;
  }

  private stopEmitter(): void {
    if (typeof this.intervalId === 'number') {
      window.clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
}

function createSimulationPacket(
  watts: number,
  cumulativeCrankRevolutions: number,
  lastCrankEventTime: number
): DataView {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);

  view.setUint16(0, 1 << 5, true);
  view.setInt16(2, watts, true);
  view.setUint16(4, cumulativeCrankRevolutions, true);
  view.setUint16(6, lastCrankEventTime, true);

  return view;
}
