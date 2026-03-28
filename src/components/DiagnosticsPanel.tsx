import { Paper, Text } from '@mantine/core';

import type { TrainerMode } from '../domain/trainer';

interface DiagnosticsPanelProps {
  averageWatts10s?: number;
  deviceName?: string;
  isSecureContext: boolean;
  isWebBluetoothSupported: boolean;
  lastPacketTimestamp?: number;
  mode: TrainerMode;
  sampleCount: number;
}

export function DiagnosticsPanel({
  averageWatts10s,
  deviceName,
  isSecureContext,
  isWebBluetoothSupported,
  lastPacketTimestamp,
  mode,
  sampleCount,
}: DiagnosticsPanelProps) {
  const lastPacketText = lastPacketTimestamp
    ? new Date(lastPacketTimestamp).toLocaleTimeString()
    : 'No packets yet';

  return (
    <Paper className="panel panel-muted" p="lg" radius="28px">
      <div>
        <Text className="section-title">Diagnostics</Text>
      </div>
      <div className="diagnostics-grid" style={{ marginTop: '1rem' }}>
        <div className="diagnostics-item">
          <Text className="diagnostics-label">Mode</Text>
          <Text className="diagnostics-value">
            {mode === 'simulate' ? 'Simulation' : 'Web Bluetooth'}
          </Text>
        </div>
        <div className="diagnostics-item">
          <Text className="diagnostics-label">Browser Support</Text>
          <Text className="diagnostics-value">
            {isWebBluetoothSupported ? 'Supported' : 'Missing'}
          </Text>
        </div>
        <div className="diagnostics-item">
          <Text className="diagnostics-label">Secure Context</Text>
          <Text className="diagnostics-value">{isSecureContext ? 'Yes' : 'No'}</Text>
        </div>
        <div className="diagnostics-item">
          <Text className="diagnostics-label">Device</Text>
          <Text className="diagnostics-value">{deviceName ?? 'None selected'}</Text>
        </div>
        <div className="diagnostics-item">
          <Text className="diagnostics-label">Last Packet</Text>
          <Text className="diagnostics-value">{lastPacketText}</Text>
        </div>
        <div className="diagnostics-item">
          <Text className="diagnostics-label">Sample Count</Text>
          <Text className="diagnostics-value">{sampleCount}</Text>
        </div>
        <div className="diagnostics-item">
          <Text className="diagnostics-label">Avg Power (10s)</Text>
          <Text className="diagnostics-value">
            {typeof averageWatts10s === 'number' ? `${averageWatts10s} W` : 'Waiting'}
          </Text>
        </div>
      </div>
    </Paper>
  );
}
