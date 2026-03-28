import { Stack } from '@mantine/core';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { ConnectionPanel } from '../components/ConnectionPanel';
import { DiagnosticsPanel } from '../components/DiagnosticsPanel';
import {
  selectConnectSetupModel,
  selectTrainerCapabilityStatuses,
  selectTrainerEnvironment,
} from '../state/trainerSelectors';
import {
  connectTrainer,
  refreshTrainerEnvironment,
  retryTrainerSetup,
} from '../state/trainerThunks';
import { selectDiagnostics } from '../state/metricsSelectors';

export function ConnectScreen() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const diagnostics = useAppSelector(selectDiagnostics);
  const environment = useAppSelector(selectTrainerEnvironment);
  const setup = useAppSelector(selectConnectSetupModel);
  const statuses = useAppSelector(selectTrainerCapabilityStatuses);
  const showDiagnostics = searchParams.get('diagnostics') === '1';

  return (
    <Stack gap="lg">
      <ConnectionPanel
        onConnect={() => {
          void dispatch(refreshTrainerEnvironment());
          void dispatch(connectTrainer());
        }}
        onContinue={() => {
          navigate('/workouts');
        }}
        onRetry={() => {
          void dispatch(retryTrainerSetup());
        }}
        setup={setup}
        statuses={statuses}
      />

      {showDiagnostics ? (
        <DiagnosticsPanel
          averageWatts10s={diagnostics.averageWatts10s}
          deviceName={setup.deviceName}
          isSecureContext={environment.isSecureContext}
          isWebBluetoothSupported={environment.isWebBluetoothSupported}
          lastPacketTimestamp={diagnostics.lastPacketTimestamp}
          mode={environment.mode}
          sampleCount={diagnostics.sampleCount}
        />
      ) : null}
    </Stack>
  );
}
