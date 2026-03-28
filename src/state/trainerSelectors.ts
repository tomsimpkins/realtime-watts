import { createSelector } from '@reduxjs/toolkit';

import type { RootState } from '../app/store';

const selectTrainerState = (state: RootState) => state.trainer;

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

export const selectLatestPower = createSelector(
  [selectTrainerState],
  (trainer) => trainer.latestPower
);

export const selectPowerDisplay = createSelector(
  [selectLatestPower],
  (latestPower) => (latestPower ? String(latestPower.watts) : '--')
);

export const selectRecentPower = createSelector(
  [selectTrainerState],
  (trainer) => trainer.recentPower
);

export const selectEnvironment = createSelector(
  [selectTrainerState],
  (trainer) => trainer.environment
);

export const selectError = createSelector(
  [selectTrainerState],
  (trainer) => trainer.error
);

export const selectAverageWatts10s = createSelector(
  [selectRecentPower],
  (recentPower) => {
    if (!recentPower.length) {
      return undefined;
    }

    const anchorTimestamp = recentPower[recentPower.length - 1].timestamp;
    const cutoff = anchorTimestamp - 10_000;
    const windowedSamples = recentPower.filter(
      (sample) => sample.timestamp >= cutoff
    );

    if (!windowedSamples.length) {
      return undefined;
    }

    const totalWatts = windowedSamples.reduce(
      (sum, sample) => sum + sample.watts,
      0
    );

    return Math.round(totalWatts / windowedSamples.length);
  }
);

export const selectDiagnostics = createSelector(
  [selectTrainerState, selectAverageWatts10s],
  (trainer, averageWatts10s) => ({
    averageWatts10s,
    lastPacketTimestamp: trainer.diagnostics.lastPacketTimestamp,
    sampleCount: trainer.diagnostics.sampleCount,
  })
);

export const selectCanConnect = createSelector(
  [selectTrainerState],
  (trainer) => {
    const isBusy =
      trainer.connectionState === 'requesting' ||
      trainer.connectionState === 'connecting' ||
      trainer.connectionState === 'disconnecting';

    if (isBusy || trainer.connectionState === 'connected') {
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

export const selectCanDisconnect = createSelector(
  [selectConnectionState],
  (connectionState) => connectionState === 'connected'
);

export const selectCanReconnect = createSelector(
  [selectTrainerState],
  (trainer) => {
    const isBusy =
      trainer.connectionState === 'requesting' ||
      trainer.connectionState === 'connecting' ||
      trainer.connectionState === 'disconnecting';

    return Boolean(trainer.device) && !isBusy && trainer.connectionState !== 'connected';
  }
);

export const selectStatusBannerModel = createSelector(
  [selectTrainerState],
  (trainer) => {
    if (trainer.error) {
      return {
        color: 'red',
        description: trainer.error,
        label: 'Error',
      };
    }

    switch (trainer.connectionState) {
      case 'requesting':
        return {
          color: 'blue',
          description:
            trainer.environment.mode === 'simulate'
              ? 'Preparing the simulated trainer stream.'
              : 'Choose your trainer from the Bluetooth device picker.',
          label: trainer.environment.mode === 'simulate' ? 'Starting Demo' : 'Choose Trainer',
        };
      case 'connecting':
        return {
          color: 'blue',
          description: trainer.device
            ? `Connecting to ${trainer.device.name}.`
            : 'Connecting to the selected trainer.',
          label: 'Connecting',
        };
      case 'connected':
        return {
          color: 'teal',
          description: trainer.device
            ? `Live power is streaming from ${trainer.device.name}.`
            : 'Live power is streaming from the trainer.',
          label: 'Connected',
        };
      case 'disconnecting':
        return {
          color: 'yellow',
          description: 'Disconnecting from the current trainer.',
          label: 'Disconnecting',
        };
      default:
        if (trainer.device) {
          return {
            color: 'gray',
            description: `Ready to reconnect to ${trainer.device.name}.`,
            label: 'Disconnected',
          };
        }

        return {
          color: trainer.environment.mode === 'simulate' ? 'violet' : 'gray',
          description:
            trainer.environment.supportMessage ??
            'Press Connect Trainer to start streaming wattage.',
          label: trainer.environment.mode === 'simulate' ? 'Simulation Ready' : 'Ready',
        };
    }
  }
);
