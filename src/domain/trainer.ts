export type ConnectionState =
  | 'idle'
  | 'requesting'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export type MeasurementSource = 'cps' | 'simulation';

export type TrainerMode = 'ble' | 'simulate';

export type Capability =
  | 'power'
  | 'cadence'
  | 'speed'
  | 'resistanceControl'
  | 'ergMode'
  | 'simulationMode';

export type CapabilityStatus =
  | 'unknown'
  | 'checking'
  | 'available'
  | 'unavailable';

export interface TrainerDeviceInfo {
  id?: string;
  name: string;
}

export interface PowerMeasurement {
  timestamp: number;
  watts: number;
  cadenceRpm?: number;
  source: MeasurementSource;
}

export interface TrainerEnvironment {
  isWebBluetoothSupported: boolean;
  isSecureContext: boolean;
  mode: TrainerMode;
  supportMessage?: string;
}

export interface TrainerCapabilities {
  power: boolean;
  cadence: boolean;
  speed: boolean;
  resistanceControl: boolean;
  ergMode: boolean;
  simulationMode: boolean;
}

export interface TrainerCapabilityStatuses {
  power: CapabilityStatus;
  cadence: CapabilityStatus;
  speed: CapabilityStatus;
  resistanceControl: CapabilityStatus;
  ergMode: CapabilityStatus;
  simulationMode: CapabilityStatus;
}

export interface DiscoveredBleTopology {
  serviceUuids: string[];
  characteristicUuidsByService: Record<string, string[]>;
}

export interface TrainerState {
  connectionState: ConnectionState;
  device?: TrainerDeviceInfo;
  error?: string;
  environment: TrainerEnvironment;
  topology?: DiscoveredBleTopology;
  capabilities: TrainerCapabilities;
  capabilityStatuses: TrainerCapabilityStatuses;
  degradedDuringRide: boolean;
}

export interface ConnectedTrainer {
  device: TrainerDeviceInfo;
  topology: DiscoveredBleTopology;
}

export function createEmptyCapabilities(): TrainerCapabilities {
  return {
    power: false,
    cadence: false,
    speed: false,
    resistanceControl: false,
    ergMode: false,
    simulationMode: false,
  };
}

export function createCapabilityStatuses(
  status: CapabilityStatus
): TrainerCapabilityStatuses {
  return {
    power: status,
    cadence: status,
    speed: status,
    resistanceControl: status,
    ergMode: status,
    simulationMode: status,
  };
}
