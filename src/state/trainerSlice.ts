import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type {
  ConnectionState,
  PowerMeasurement,
  TrainerDeviceInfo,
  TrainerEnvironment,
  TrainerState,
} from '../domain/trainer';
import { getTrainerEnvironment } from '../utils/environment';
import { appendAndTrimByTime } from '../utils/ringBuffer';

const MAX_RECENT_POWER_SAMPLES = 240;
const RECENT_POWER_WINDOW_MS = 120_000;

const initialState: TrainerState = {
  connectionState: 'idle',
  recentPower: [],
  environment: getTrainerEnvironment(),
  diagnostics: {
    sampleCount: 0,
  },
};

function resetLiveState(state: TrainerState): void {
  state.latestPower = undefined;
  state.recentPower = [];
  state.diagnostics = {
    sampleCount: 0,
  };
}

const trainerSlice = createSlice({
  name: 'trainer',
  initialState,
  reducers: {
    setConnectionState(state, action: PayloadAction<ConnectionState>) {
      state.connectionState = action.payload;

      if (action.payload !== 'error') {
        state.error = undefined;
      }
    },
    setDevice(state, action: PayloadAction<TrainerDeviceInfo | undefined>) {
      state.device = action.payload;
    },
    pushPowerSample(state, action: PayloadAction<PowerMeasurement>) {
      state.latestPower = action.payload;
      state.recentPower = appendAndTrimByTime(
        state.recentPower,
        action.payload,
        MAX_RECENT_POWER_SAMPLES,
        RECENT_POWER_WINDOW_MS
      );
      state.connectionState = 'connected';
      state.error = undefined;
      state.diagnostics.lastPacketTimestamp = action.payload.timestamp;
      state.diagnostics.sampleCount += 1;
    },
    setError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload;

      if (action.payload) {
        state.connectionState = 'error';
      }
    },
    setEnvironment(state, action: PayloadAction<TrainerEnvironment>) {
      state.environment = action.payload;
    },
    resetConnection(state) {
      state.connectionState = 'idle';
      state.error = undefined;
      resetLiveState(state);
    },
    handleUnexpectedDisconnect(state, action: PayloadAction<string | undefined>) {
      state.connectionState = 'idle';
      state.error = action.payload;
      resetLiveState(state);
    },
  },
});

export const {
  handleUnexpectedDisconnect,
  pushPowerSample,
  resetConnection,
  setConnectionState,
  setDevice,
  setEnvironment,
  setError,
} = trainerSlice.actions;

export default trainerSlice.reducer;
