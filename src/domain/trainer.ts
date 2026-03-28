export type ConnectionState =
  | 'idle'
  | 'requesting'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export type MeasurementSource = 'cps' | 'simulation';

export type TrainerMode = 'ble' | 'simulate';

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

export interface TrainerDiagnostics {
  lastPacketTimestamp?: number;
  sampleCount: number;
}

export interface TrainerState {
  connectionState: ConnectionState;
  device?: TrainerDeviceInfo;
  latestPower?: PowerMeasurement;
  recentPower: PowerMeasurement[];
  error?: string;
  environment: TrainerEnvironment;
  diagnostics: TrainerDiagnostics;
}

export interface ConnectedTrainer {
  device: TrainerDeviceInfo;
}
