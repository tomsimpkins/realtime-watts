import { Container, Paper, Stack, Text, Title } from '@mantine/core';
import { lazy, Suspense, useEffect } from 'react';

import { useAppDispatch, useAppSelector } from './app/hooks';
import { ConnectionPanel } from './components/ConnectionPanel';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { PowerDisplay } from './components/PowerDisplay';
import { StatusBanner } from './components/StatusBanner';
import {
  selectCanConnect,
  selectCanDisconnect,
  selectCanReconnect,
  selectConnectionState,
  selectDeviceName,
  selectDiagnostics,
  selectEnvironment,
  selectPowerDisplay,
  selectRecentPower,
  selectStatusBannerModel,
} from './state/trainerSelectors';
import {
  connectTrainer,
  disconnectTrainer,
  reconnectTrainer,
  refreshTrainerEnvironment,
} from './state/trainerThunks';

const PowerChart = lazy(() =>
  import('./components/PowerChart').then((module) => ({
    default: module.PowerChart,
  }))
);

export default function App() {
  const dispatch = useAppDispatch();
  const canConnect = useAppSelector(selectCanConnect);
  const canDisconnect = useAppSelector(selectCanDisconnect);
  const canReconnect = useAppSelector(selectCanReconnect);
  const connectionState = useAppSelector(selectConnectionState);
  const deviceName = useAppSelector(selectDeviceName);
  const diagnostics = useAppSelector(selectDiagnostics);
  const environment = useAppSelector(selectEnvironment);
  const powerDisplay = useAppSelector(selectPowerDisplay);
  const recentPower = useAppSelector(selectRecentPower);
  const status = useAppSelector(selectStatusBannerModel);

  useEffect(() => {
    dispatch(refreshTrainerEnvironment());
  }, [dispatch]);

  return (
    <Container py="xl" size="lg">
      <Stack gap="lg">
        <div>
          <Title order={1}>Realtime Watts</Title>
          <Text c="dimmed" mt={6}>
            Low-latency wattage readout for a Bluetooth smart trainer, built for
            desktop Chrome or Edge.
          </Text>
        </div>

        <StatusBanner
          color={status.color}
          description={status.description}
          label={status.label}
        />

        <ConnectionPanel
          canConnect={canConnect}
          canDisconnect={canDisconnect}
          canReconnect={canReconnect}
          connectionState={connectionState}
          deviceName={deviceName}
          mode={environment.mode}
          onConnect={() => {
            void dispatch(connectTrainer());
          }}
          onDisconnect={() => {
            void dispatch(disconnectTrainer());
          }}
          onReconnect={() => {
            void dispatch(reconnectTrainer());
          }}
        />

        <PowerDisplay deviceName={deviceName} wattsDisplay={powerDisplay} />
        <Suspense
          fallback={
            <Paper p="lg" radius="xl" withBorder>
              <Text c="dimmed" size="sm">
                Loading chart…
              </Text>
            </Paper>
          }
        >
          <PowerChart samples={recentPower} />
        </Suspense>
        <DiagnosticsPanel
          averageWatts10s={diagnostics.averageWatts10s}
          deviceName={deviceName}
          isSecureContext={environment.isSecureContext}
          isWebBluetoothSupported={environment.isWebBluetoothSupported}
          lastPacketTimestamp={diagnostics.lastPacketTimestamp}
          mode={environment.mode}
          sampleCount={diagnostics.sampleCount}
        />
      </Stack>
    </Container>
  );
}
