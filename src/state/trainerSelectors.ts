import { createSelector } from '@reduxjs/toolkit';

import type { RootState } from '../app/store';

export const selectTrainerState = (state: RootState) => state.trainer;

export const selectConnectionState = createSelector(
  [selectTrainerState],
  (trainer) => trainer.connectionState
);

export const selectDevice = createSelector(
  [selectTrainerState],
  (trainer) => trainer.device
);

export const selectDeviceName = createSelector(
  [selectDevice],
  (device) => device?.name
);

export const selectTrainerEnvironment = createSelector(
  [selectTrainerState],
  (trainer) => trainer.environment
);

export const selectTrainerError = createSelector(
  [selectTrainerState],
  (trainer) => trainer.error
);

export const selectTrainerCapabilities = createSelector(
  [selectTrainerState],
  (trainer) => trainer.capabilities
);

export const selectTrainerCapabilityStatuses = createSelector(
  [selectTrainerState],
  (trainer) => trainer.capabilityStatuses
);

export const selectTrainerTopology = createSelector(
  [selectTrainerState],
  (trainer) => trainer.topology
);

export const selectDegradedDuringRide = createSelector(
  [selectTrainerState],
  (trainer) => trainer.degradedDuringRide
);

export const selectIsTrainerReady = createSelector(
  [selectConnectionState, selectTrainerCapabilities],
  (connectionState, capabilities) =>
    connectionState === 'connected' && capabilities.power
);

export const selectCanStartSetup = createSelector(
  [selectTrainerState],
  (trainer) => {
    const isBusy =
      trainer.connectionState === 'requesting' ||
      trainer.connectionState === 'connecting' ||
      trainer.connectionState === 'disconnecting';

    if (isBusy) {
      return false;
    }

    if (trainer.environment.mode === 'simulate') {
      return true;
    }

    return (
      trainer.environment.isSecureContext &&
      trainer.environment.isWebBluetoothSupported
    );
  }
);

export const selectCanRetrySetup = createSelector(
  [selectTrainerState],
  (trainer) => {
    const isBusy =
      trainer.connectionState === 'requesting' ||
      trainer.connectionState === 'connecting' ||
      trainer.connectionState === 'disconnecting';

    return !isBusy && (trainer.environment.mode === 'simulate' || Boolean(trainer.device));
  }
);

export const selectCanContinueFromConnect = selectIsTrainerReady;

export const selectConnectStatusBannerModel = createSelector(
  [
    selectConnectionState,
    selectDeviceName,
    selectTrainerEnvironment,
    selectTrainerError,
  ],
  (connectionState, deviceName, environment, error) => {
    if (error) {
      return {
        color: 'red',
        description: error,
        label: 'Error',
      };
    }

    switch (connectionState) {
      case 'requesting':
        return {
          color: 'yellow',
          description:
            environment.mode === 'simulate'
              ? 'Preparing the simulated trainer stream.'
              : 'Choose your trainer from the Bluetooth picker.',
          label: environment.mode === 'simulate' ? 'Starting Demo' : 'Choose Trainer',
        };
      case 'connecting':
        return {
          color: 'yellow',
          description: deviceName
            ? `Checking services and capabilities for ${deviceName}.`
            : 'Connecting to the selected trainer.',
          label: 'Checking Trainer',
        };
      case 'connected':
        return {
          color: 'green',
          description: deviceName
            ? `${deviceName} is ready for workout selection.`
            : 'Trainer is connected and ready.',
          label: 'Setup Complete',
        };
      case 'disconnecting':
        return {
          color: 'yellow',
          description: 'Disconnecting from the current trainer.',
          label: 'Disconnecting',
        };
      default:
        return {
          color: environment.mode === 'simulate' ? 'violet' : 'gray',
          description:
            environment.supportMessage ??
            'Connect a trainer to inspect capabilities and continue.',
          label: environment.mode === 'simulate' ? 'Simulation Ready' : 'Ready',
        };
    }
  }
);

export const selectRideBannerModel = createSelector(
  [selectDegradedDuringRide, selectTrainerError],
  (degradedDuringRide, error) => {
    if (degradedDuringRide) {
      return {
        color: 'red',
        description: 'Trainer disconnected. Live telemetry is unavailable.',
        label: 'Degraded Ride',
      };
    }

    if (error) {
      return {
        color: 'red',
        description: error,
        label: 'Error',
      };
    }

    return undefined;
  }
);
