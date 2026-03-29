import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { PowerMeasurement } from "../domain/trainer";
import { appendAndTrimByTime } from "../utils/ringBuffer";

export interface MetricsState {
	latestPower?: PowerMeasurement;
	recentPower: PowerMeasurement[];
	diagnostics: {
		lastPacketTimestamp?: number;
		sampleCount: number;
	};
}

const MAX_RECENT_POWER_SAMPLES = 240;
const RECENT_POWER_WINDOW_MS = 120_000;

const initialState: MetricsState = {
	recentPower: [],
	diagnostics: {
		sampleCount: 0,
	},
};

const metricsSlice = createSlice({
	name: "metrics",
	initialState,
	reducers: {
		pushPowerSample(state, action: PayloadAction<PowerMeasurement>) {
			state.latestPower = action.payload;
			state.recentPower = appendAndTrimByTime(
				state.recentPower,
				action.payload,
				MAX_RECENT_POWER_SAMPLES,
				RECENT_POWER_WINDOW_MS,
			);
			state.diagnostics.lastPacketTimestamp = action.payload.timestamp;
			state.diagnostics.sampleCount += 1;
		},
		resetMetrics() {
			return initialState;
		},
		resetLiveMetricValuesPreserveHistory(state) {
			state.latestPower = undefined;
		},
		markStreamIdle(state) {
			state.latestPower = undefined;
		},
	},
});

export const {
	markStreamIdle,
	pushPowerSample,
	resetLiveMetricValuesPreserveHistory,
	resetMetrics,
} = metricsSlice.actions;

export default metricsSlice.reducer;
