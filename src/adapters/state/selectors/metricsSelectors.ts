import { createSelector } from "@reduxjs/toolkit";

import type { RootState } from "../../../app/store";

export const selectMetricsState = (state: RootState) => state.metrics;

export const RECENT_POWER_HISTOGRAM_GRAIN_MS = 5_000;

export interface PowerHistogramBin {
	timestamp: number;
	watts: number;
}

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

export const selectRecentPowerHistogram = createSelector(
	[selectRecentPower],
	(recentPower): PowerHistogramBin[] => {
		const buckets = new Map<
			number,
			{
				sampleCount: number;
				totalWatts: number;
			}
		>();

		for (const sample of recentPower) {
			const bucketStart =
				Math.floor(sample.timestamp / RECENT_POWER_HISTOGRAM_GRAIN_MS) *
				RECENT_POWER_HISTOGRAM_GRAIN_MS;
			const bucket = buckets.get(bucketStart);

			if (bucket) {
				bucket.sampleCount += 1;
				bucket.totalWatts += sample.watts;
				continue;
			}

			buckets.set(bucketStart, {
				sampleCount: 1,
				totalWatts: sample.watts,
			});
		}

		return Array.from(buckets.entries())
			.sort(([leftTimestamp], [rightTimestamp]) =>
				leftTimestamp - rightTimestamp,
			)
			.map(([timestamp, bucket]) => ({
				timestamp,
				watts: Math.round(bucket.totalWatts / bucket.sampleCount),
			}));
	},
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
