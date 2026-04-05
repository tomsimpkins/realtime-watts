import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

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
		resetMetrics() {
			return initialState;
		},
	},
});

export const { resetMetrics, setMetricsSnapshot } = metricsSlice.actions;

export default metricsSlice.reducer;
