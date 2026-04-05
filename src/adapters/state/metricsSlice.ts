import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { PowerMeasurement } from "../../domain/trainer";
import type {
	WorkoutMetricsSnapshot,
} from "../../domain/workoutEngine";

export type MetricsState = WorkoutMetricsSnapshot;

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
		setMetricsSnapshot(_state, action: PayloadAction<MetricsState>) {
			return action.payload;
		},
		pushPowerSample(state, action: PayloadAction<PowerMeasurement>) {
			state.latestPower = action.payload;
			state.recentPower = [...state.recentPower, action.payload];
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
	setMetricsSnapshot,
} = metricsSlice.actions;

export default metricsSlice.reducer;
