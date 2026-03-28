import { createTrainerClient, type TrainerClient } from '../ble/trainerClient';
import type { TrainerEnvironment } from '../domain/trainer';
import type { AppDispatch, AppThunk } from '../app/store';
import { decodeCyclingPowerMeasurement } from '../protocol/cyclingPower';
import { getTrainerEnvironment } from '../utils/environment';
import { getUserFacingError, logDebug, logError } from '../utils/errors';
import {
  handleUnexpectedDisconnect,
  pushPowerSample,
  resetConnection,
  setConnectionState,
  setDevice,
  setEnvironment,
  setError,
} from './trainerSlice';

let activeClient: TrainerClient | null = null;
let unsubscribePower: (() => void) | undefined;
let unsubscribeDisconnect: (() => void) | undefined;

function releaseClientSubscriptions(): void {
  unsubscribePower?.();
  unsubscribeDisconnect?.();
  unsubscribePower = undefined;
  unsubscribeDisconnect = undefined;
}

function getOrCreateClient(environment: TrainerEnvironment, recreate = false): TrainerClient {
  if (recreate || !activeClient) {
    releaseClientSubscriptions();
    activeClient = createTrainerClient(environment.mode);
  }

  return activeClient;
}

function bindClientListeners(client: TrainerClient, dispatch: AppDispatch): void {
  releaseClientSubscriptions();

  unsubscribePower = client.subscribeToPower((packet) => {
    const sample = decodeCyclingPowerMeasurement(packet);

    if (!sample) {
      logDebug('Ignoring malformed or unsupported cycling power packet');
      return;
    }

    dispatch(pushPowerSample(sample));
  });

  unsubscribeDisconnect = client.onDisconnected(() => {
    releaseClientSubscriptions();
    dispatch(
      handleUnexpectedDisconnect(
        'Trainer disconnected. You can reconnect without reloading the page.'
      )
    );
  });
}

function ensureEnvironmentReady(
  environment: TrainerEnvironment,
  dispatch: AppDispatch
): boolean {
  dispatch(setEnvironment(environment));

  if (environment.mode === 'simulate') {
    return true;
  }

  if (!environment.isWebBluetoothSupported || !environment.isSecureContext) {
    dispatch(
      setError(
        environment.supportMessage ??
          'This app currently requires Chrome or Edge with Web Bluetooth support.'
      )
    );
    return false;
  }

  return true;
}

export const refreshTrainerEnvironment = (): AppThunk => (dispatch) => {
  dispatch(setEnvironment(getTrainerEnvironment()));
};

export const connectTrainer = (): AppThunk<Promise<void>> => async (dispatch) => {
  const environment = getTrainerEnvironment();

  if (!ensureEnvironmentReady(environment, dispatch)) {
    return;
  }

  const client = getOrCreateClient(environment, true);
  bindClientListeners(client, dispatch);
  dispatch(setConnectionState('requesting'));

  try {
    const device = await client.requestDevice();
    dispatch(setDevice(device));
    dispatch(setConnectionState('connecting'));

    const connectedTrainer = await client.connect();
    dispatch(setDevice(connectedTrainer.device));
    dispatch(setConnectionState('connected'));
  } catch (error) {
    logError('Failed to connect to trainer', error);
    dispatch(setError(getUserFacingError(error)));
  }
};

export const reconnectTrainer = (): AppThunk<Promise<void>> => async (
  dispatch,
  getState
) => {
  const environment = getTrainerEnvironment();

  if (!ensureEnvironmentReady(environment, dispatch)) {
    return;
  }

  if (!activeClient || !getState().trainer.device) {
    await dispatch(connectTrainer());
    return;
  }

  bindClientListeners(activeClient, dispatch);
  dispatch(setConnectionState('connecting'));

  try {
    const connectedTrainer = await activeClient.reconnect();
    dispatch(setDevice(connectedTrainer.device));
    dispatch(setConnectionState('connected'));
  } catch (error) {
    logError('Failed to reconnect to trainer', error);
    dispatch(setError(getUserFacingError(error)));
  }
};

export const disconnectTrainer = (): AppThunk<Promise<void>> => async (
  dispatch
) => {
  if (!activeClient) {
    dispatch(resetConnection());
    return;
  }

  dispatch(setConnectionState('disconnecting'));

  try {
    await activeClient.disconnect();
    dispatch(resetConnection());
  } catch (error) {
    logError('Failed to disconnect cleanly', error);
    dispatch(setError(getUserFacingError(error)));
  } finally {
    releaseClientSubscriptions();
  }
};
