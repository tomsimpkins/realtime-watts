import type {
  ConnectedTrainer,
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
  requestAndConnect(): Promise<ConnectedTrainer>;
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

  async requestAndConnect(): Promise<ConnectedTrainer> {
    await this.requestDevice();
    return this.connect();
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

    const service = await server.getPrimaryService(CYCLING_POWER_SERVICE);
    const characteristic = await service.getCharacteristic(
      CYCLING_POWER_MEASUREMENT_CHARACTERISTIC
    );

    this.powerCharacteristic = characteristic;
    await this.startPowerNotifications();

    if (import.meta.env.DEV) {
      await this.logDiscovery(server, service);
    }

    logDebug('Connected to cycling power characteristic', {
      characteristic: CYCLING_POWER_MEASUREMENT_CHARACTERISTIC,
      service: CYCLING_POWER_SERVICE,
    });

    return {
      device: toDeviceInfo(this.device),
    };
  }

  private async logDiscovery(
    server: BluetoothRemoteGATTServer,
    service: BluetoothRemoteGATTService
  ): Promise<void> {
    try {
      const services = await server.getPrimaryServices();
      const characteristics = await service.getCharacteristics();

      logDebug(
        'Discovered services',
        services.map((discoveredService) => discoveredService.uuid)
      );
      logDebug(
        'Discovered cycling power characteristics',
        characteristics.map((discoveredCharacteristic) =>
          discoveredCharacteristic.uuid
        )
      );
    } catch (error) {
      logDebug('Unable to inspect discovered services', error);
    }
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
  private readonly device: TrainerDeviceInfo = {
    id: 'simulated-trainer',
    name: 'Simulated Trainer',
  };

  async requestDevice(): Promise<TrainerDeviceInfo> {
    return this.device;
  }

  async connect(): Promise<ConnectedTrainer> {
    this.startedAt = Date.now();
    this.startEmitter();

    return {
      device: this.device,
    };
  }

  async requestAndConnect(): Promise<ConnectedTrainer> {
    await this.requestDevice();
    return this.connect();
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
      const elapsedSeconds = (Date.now() - this.startedAt) / 1000;
      const watts = Math.max(
        0,
        Math.round(
          200 +
            70 * Math.sin(elapsedSeconds * 0.9) +
            25 * Math.sin(elapsedSeconds * 1.7)
        )
      );

      this.powerCallbacks.forEach((callback) =>
        callback(createSimulationPacket(watts))
      );
    }, 500);
  }

  private stopEmitter(): void {
    if (typeof this.intervalId === 'number') {
      window.clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }
}

function createSimulationPacket(watts: number): DataView {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);

  view.setUint16(0, 0, true);
  view.setInt16(2, watts, true);

  return view;
}
