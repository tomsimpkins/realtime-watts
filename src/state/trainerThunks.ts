import type { AppDispatch, AppThunk, RootState } from "../app/store";
import { createTrainerClient, type TrainerClient } from "../ble/trainerClient";
import {
	createCheckingCapabilityResolution,
	resolveCapabilities,
} from "../ble/capabilityResolver";
import type { TrainerEnvironment } from "../domain/trainer";
import {
	decodeCyclingPowerPacket,
	estimateCadenceRpm,
	estimateDistanceKm,
	estimateSpeedKph,
	type CyclingPowerCrankData,
	type CyclingPowerWheelData,
} from "../protocol/cyclingPower";
import { getTrainerEnvironment } from "../utils/environment";
import { getUserFacingError, logDebug, logError } from "../utils/errors";
import { markStreamIdle, pushPowerSample, resetMetrics } from "./metricsSlice";
import {
	resetTrainerSession,
	setCapabilities,
	setCapabilityStatuses,
	setConnectionState,
	setDegradedDuringRide,
	setDevice,
	setEnvironment,
	setError,
	setTrainerTopology,
} from "./trainerSlice";

let activeClient: TrainerClient | null = null;
let unsubscribePower: (() => void) | undefined;
let unsubscribeDisconnect: (() => void) | undefined;

function releaseClientSubscriptions(): void {
	unsubscribePower?.();
	unsubscribeDisconnect?.();
	unsubscribePower = undefined;
	unsubscribeDisconnect = undefined;
}

async function disposeActiveClient(): Promise<void> {
	if (!activeClient) {
		return;
	}

	try {
		await activeClient.disconnect();
	} catch (error) {
		logDebug("Unable to disconnect previous trainer client cleanly", error);
	} finally {
		releaseClientSubscriptions();
		activeClient = null;
	}
}

function bindClientListeners(
	client: TrainerClient,
	dispatch: AppDispatch,
	getState: () => RootState,
): void {
	releaseClientSubscriptions();
	let initialWheelData: CyclingPowerWheelData | undefined;
	let previousCadenceRpm: number | undefined;
	let previousCrankData: CyclingPowerCrankData | undefined;
	let previousSpeedKph: number | undefined;
	let previousWheelData: CyclingPowerWheelData | undefined;

	unsubscribePower = client.subscribeToPower((packet) => {
		const decoded = decodeCyclingPowerPacket(packet);

		if (!decoded) {
			logDebug("Ignoring malformed or unsupported cycling power packet");
			return;
		}

		if (decoded.wheelRevolutionData && !initialWheelData) {
			initialWheelData = decoded.wheelRevolutionData;
		}

		const cadenceRpm =
			estimateCadenceRpm(previousCrankData, decoded.crankRevolutionData) ??
			previousCadenceRpm;
		const speedKph =
			estimateSpeedKph(previousWheelData, decoded.wheelRevolutionData) ??
			previousSpeedKph;
		const distanceKm = estimateDistanceKm(
			initialWheelData,
			decoded.wheelRevolutionData,
		);

		if (decoded.crankRevolutionData) {
			const crankDataChanged =
				!previousCrankData ||
				decoded.crankRevolutionData.cumulativeCrankRevolutions !==
					previousCrankData.cumulativeCrankRevolutions ||
				decoded.crankRevolutionData.lastCrankEventTime !==
					previousCrankData.lastCrankEventTime;

			if (crankDataChanged) {
				previousCrankData = decoded.crankRevolutionData;
			}
		}

		if (decoded.wheelRevolutionData) {
			const wheelDataChanged =
				!previousWheelData ||
				decoded.wheelRevolutionData.cumulativeWheelRevolutions !==
					previousWheelData.cumulativeWheelRevolutions ||
				decoded.wheelRevolutionData.lastWheelEventTime !==
					previousWheelData.lastWheelEventTime;

			if (wheelDataChanged) {
				previousWheelData = decoded.wheelRevolutionData;
			}
		}

		if (typeof cadenceRpm === "number") {
			previousCadenceRpm = cadenceRpm;
		}

		if (typeof speedKph === "number") {
			previousSpeedKph = speedKph;
		}

		dispatch(
			pushPowerSample({
				...decoded.measurement,
				cadenceRpm,
				distanceKm,
				speedKph,
			}),
		);
	});

	unsubscribeDisconnect = client.onDisconnected(() => {
		releaseClientSubscriptions();
		const isRideScreen = getState().app.currentScreen === "ride";

		dispatch(setConnectionState("idle"));
		dispatch(
			setError(
				"Trainer disconnected. You can reconnect without reloading the page.",
			),
		);
		dispatch(markStreamIdle());
		dispatch(setDegradedDuringRide(isRideScreen));
	});
}

function ensureEnvironmentReady(
	environment: TrainerEnvironment,
	dispatch: AppDispatch,
): boolean {
	dispatch(setEnvironment(environment));

	if (environment.mode === "simulate") {
		return true;
	}

	if (!environment.isWebBluetoothSupported || !environment.isSecureContext) {
		dispatch(
			setError(
				environment.supportMessage ??
					"This app currently requires Chrome or Edge with Web Bluetooth support.",
			),
		);
		return false;
	}

	return true;
}

async function completeTrainerConnection(
	client: TrainerClient,
	dispatch: AppDispatch,
	getState: () => RootState,
	mode: TrainerEnvironment["mode"],
	resetMetricsOnSuccess: boolean,
	connectMethod: "connect" | "reconnect",
) {
	const connectedTrainer = await client[connectMethod]();
	const capabilityResolution = resolveCapabilities({
		mode,
		topology: connectedTrainer.topology,
	});

	bindClientListeners(client, dispatch, getState);

	if (resetMetricsOnSuccess) {
		dispatch(resetMetrics());
	}

	dispatch(setDevice(connectedTrainer.device));
	dispatch(setTrainerTopology(connectedTrainer.topology));
	dispatch(setCapabilities(capabilityResolution.capabilities));
	dispatch(setCapabilityStatuses(capabilityResolution.statuses));
	dispatch(setConnectionState("connected"));
	dispatch(setError(undefined));
	dispatch(setDegradedDuringRide(false));
}

export const refreshTrainerEnvironment = (): AppThunk => (dispatch) => {
	dispatch(setEnvironment(getTrainerEnvironment()));
};

export const connectTrainer =
	(): AppThunk<Promise<void>> => async (dispatch, getState) => {
		const environment = getTrainerEnvironment();

		if (!ensureEnvironmentReady(environment, dispatch)) {
			return;
		}

		dispatch(
			setCapabilityStatuses(createCheckingCapabilityResolution().statuses),
		);
		dispatch(
			setCapabilities(createCheckingCapabilityResolution().capabilities),
		);
		dispatch(setTrainerTopology(undefined));
		dispatch(setDegradedDuringRide(false));
		dispatch(setConnectionState("requesting"));

		await disposeActiveClient();
		const client = createTrainerClient(environment.mode);
		activeClient = client;

		try {
			const device = await client.requestDevice();
			dispatch(setDevice(device));
			dispatch(setConnectionState("connecting"));
			await completeTrainerConnection(
				client,
				dispatch,
				getState,
				environment.mode,
				true,
				"connect",
			);
		} catch (error) {
			logError("Failed to connect to trainer", error);
			dispatch(setError(getUserFacingError(error)));
		}
	};

export const retryTrainerSetup =
	(): AppThunk<Promise<void>> => async (dispatch, getState) => {
		const environment = getTrainerEnvironment();

		if (!ensureEnvironmentReady(environment, dispatch)) {
			return;
		}

		if (!activeClient) {
			dispatch(
				setError(
					"No previous trainer is available to retry. Use Connect Trainer instead.",
				),
			);
			return;
		}

		dispatch(
			setCapabilityStatuses(createCheckingCapabilityResolution().statuses),
		);
		dispatch(
			setCapabilities(createCheckingCapabilityResolution().capabilities),
		);
		dispatch(setTrainerTopology(undefined));
		dispatch(setDegradedDuringRide(false));
		dispatch(setConnectionState("connecting"));

		try {
			await completeTrainerConnection(
				activeClient,
				dispatch,
				getState,
				environment.mode,
				false,
				"reconnect",
			);
		} catch (error) {
			logError("Failed to retry trainer setup", error);
			dispatch(setError(getUserFacingError(error)));
		}
	};

export const retryTrainerConnection =
	(): AppThunk<Promise<void>> => async (dispatch, getState) => {
		const environment = getTrainerEnvironment();

		if (!ensureEnvironmentReady(environment, dispatch)) {
			return;
		}

		if (!activeClient) {
			dispatch(
				setError(
					"Cannot reconnect without a remembered trainer. Return to setup to connect again.",
				),
			);
			return;
		}

		dispatch(setConnectionState("connecting"));

		try {
			await completeTrainerConnection(
				activeClient,
				dispatch,
				getState,
				environment.mode,
				false,
				"reconnect",
			);
		} catch (error) {
			logError("Failed to reconnect trainer", error);
			dispatch(setError(getUserFacingError(error)));
		}
	};

export const disconnectTrainer =
	(): AppThunk<Promise<void>> => async (dispatch) => {
		if (!activeClient) {
			dispatch(resetTrainerSession());
			dispatch(resetMetrics());
			return;
		}

		dispatch(setConnectionState("disconnecting"));

		try {
			await activeClient.disconnect();
		} catch (error) {
			logError("Failed to disconnect trainer", error);
		} finally {
			releaseClientSubscriptions();
			activeClient = null;
			dispatch(resetTrainerSession());
			dispatch(resetMetrics());
		}
	};
