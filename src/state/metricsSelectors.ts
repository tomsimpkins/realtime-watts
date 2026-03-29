import { createSelector } from "@reduxjs/toolkit";

import type { RootState } from "../app/store";

export const selectMetricsState = (state: RootState) => state.metrics;

export const selectLatestPower = createSelector(
	[selectMetricsState],
	(metrics) => metrics.latestPower,
);

export const selectPowerDisplay = createSelector(
	[selectLatestPower],
	(latestPower) => (latestPower ? String(latestPower.watts) : "--"),
);

export const selectCadenceDisplay = createSelector(
	[selectLatestPower],
	(latestPower) =>
		typeof latestPower?.cadenceRpm === "number"
			? `${latestPower.cadenceRpm} rpm`
			: "Unavailable",
);

export const selectSpeedDisplay = createSelector(
	[selectLatestPower],
	(latestPower) =>
		typeof latestPower?.speedKph === "number"
			? `${latestPower.speedKph.toFixed(1)} km/h`
			: "Unavailable",
);

export const selectDistanceDisplay = createSelector(
	[selectLatestPower],
	(latestPower) =>
		typeof latestPower?.distanceKm === "number"
			? `${latestPower.distanceKm.toFixed(2)} km`
			: "Unavailable",
);

export const selectRecentPower = createSelector(
	[selectMetricsState],
	(metrics) => metrics.recentPower,
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
			(sample) => sample.timestamp >= cutoff,
		);

		if (!windowedSamples.length) {
			return undefined;
		}

		const totalWatts = windowedSamples.reduce(
			(sum, sample) => sum + sample.watts,
			0,
		);

		return Math.round(totalWatts / windowedSamples.length);
	},
);

export const selectDiagnostics = createSelector(
	[selectMetricsState, selectAverageWatts10s],
	(metrics, averageWatts10s) => ({
		averageWatts10s,
		lastPacketTimestamp: metrics.diagnostics.lastPacketTimestamp,
		sampleCount: metrics.diagnostics.sampleCount,
	}),
);
