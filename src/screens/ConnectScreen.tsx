import { Button, Group, Stack } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { CapabilitiesPanel } from '../components/CapabilitiesPanel';
import { ConnectionPanel } from '../components/ConnectionPanel';
import { DiagnosticsPanel } from '../components/DiagnosticsPanel';
import { StatusBanner } from '../components/StatusBanner';
import { selectCanContinueFromConnect, selectCanRetrySetup, selectCanStartSetup, selectConnectStatusBannerModel, selectDeviceName, selectTrainerCapabilityStatuses, selectTrainerEnvironment } from '../state/trainerSelectors';
import { connectTrainer, refreshTrainerEnvironment, retryTrainerSetup } from '../state/trainerThunks';
import { selectDiagnostics } from '../state/metricsSelectors';

export function ConnectScreen() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const canContinue = useAppSelector(selectCanContinueFromConnect);
  const canRetrySetup = useAppSelector(selectCanRetrySetup);
  const canStartSetup = useAppSelector(selectCanStartSetup);
  const deviceName = useAppSelector(selectDeviceName);
  const diagnostics = useAppSelector(selectDiagnostics);
  const environment = useAppSelector(selectTrainerEnvironment);
  const statuses = useAppSelector(selectTrainerCapabilityStatuses);
  const statusBanner = useAppSelector(selectConnectStatusBannerModel);

  return (
    <Stack gap="lg">
      <StatusBanner
        color={statusBanner.color}
        description={statusBanner.description}
        label={statusBanner.label}
      />

      <ConnectionPanel deviceName={deviceName} mode={environment.mode} />
      <CapabilitiesPanel statuses={statuses} />

      <Group>
        <Button
          disabled={!canStartSetup}
          onClick={() => {
            void dispatch(refreshTrainerEnvironment());
            void dispatch(connectTrainer());
          }}
          radius="xl"
        >
          Connect Trainer
        </Button>
        <Button
          disabled={!canRetrySetup}
          onClick={() => {
            void dispatch(retryTrainerSetup());
          }}
          radius="xl"
          variant="default"
        >
          Retry Setup
        </Button>
        <Button
          disabled={!canContinue}
          onClick={() => {
            navigate('/workouts');
          }}
          radius="xl"
          variant="light"
        >
          Continue
        </Button>
      </Group>

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
  );
}
