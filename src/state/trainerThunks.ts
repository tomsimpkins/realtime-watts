import type { AppDispatch, AppThunk, RootState } from "../app/store";
import {
	createTrainerConnection,
	type TrainerConnection,
} from "../bluetooth/FTMSClient";
import { createCheckingCapabilityResolution } from "../bluetooth/capabilityResolver";
import type { TrainerEnvironment } from "../domain/trainer";
import { getTrainerEnvironment } from "../utils/environment";
import { getUserFacingError, logDebug, logError } from "../utils/errors";
import { resetMetrics, setMetricsSnapshot } from "./metricsSlice";
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
import { clearWorkout, setWorkoutSnapshot } from "./workoutSlice";
import { WORKOUTS_BY_ID } from "../workouts/catalog";

let activeClient: TrainerConnection | null = null;
let unsubscribeMetricsSnapshot: (() => void) | undefined;
let unsubscribeDisconnect: (() => void) | undefined;
let unsubscribeWorkoutSnapshot: (() => void) | undefined;

function releaseClientSubscriptions(): void {
	unsubscribeMetricsSnapshot?.();
	unsubscribeWorkoutSnapshot?.();
	unsubscribeDisconnect?.();
	unsubscribeMetricsSnapshot = undefined;
	unsubscribeWorkoutSnapshot = undefined;
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
	client: TrainerConnection,
	dispatch: AppDispatch,
	getState: () => RootState,
): void {
	releaseClientSubscriptions();

	unsubscribeMetricsSnapshot = client.subscribeToMetricsSnapshot((snapshot) => {
		dispatch(setMetricsSnapshot(snapshot));
	});
	unsubscribeWorkoutSnapshot = client.subscribeToWorkoutSnapshot((snapshot) => {
		dispatch(setWorkoutSnapshot(snapshot));
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
		dispatch(setMetricsSnapshot(client.getMetricsSnapshot()));
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
	client: TrainerConnection,
	dispatch: AppDispatch,
	getState: () => RootState,
	mode: TrainerEnvironment["mode"],
	resetMetricsOnSuccess: boolean,
	connectMethod: "connect" | "reconnect",
) {
	const connectedTrainer = await client[connectMethod]();

	bindClientListeners(client, dispatch, getState);

	if (resetMetricsOnSuccess) {
		dispatch(resetMetrics());
	}

	dispatch(setMetricsSnapshot(client.getMetricsSnapshot()));
	dispatch(setWorkoutSnapshot(client.getWorkoutSnapshot()));

	dispatch(setDevice(connectedTrainer.device));
	dispatch(setTrainerTopology(connectedTrainer.topology));
	dispatch(setCapabilities(connectedTrainer.capabilities));
	dispatch(setCapabilityStatuses(connectedTrainer.capabilityStatuses));
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
		const client = createTrainerConnection(environment.mode);
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
			dispatch(clearWorkout());
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
			dispatch(clearWorkout());
		}
	};

export const beginWorkoutSession =
	(workoutId: string): AppThunk =>
	(dispatch) => {
		const workout = WORKOUTS_BY_ID[workoutId];

		if (!workout) {
			return;
		}

		if (!activeClient) {
			dispatch(
				setWorkoutSnapshot({
					selectedWorkoutId: workout.id,
					status: "active",
					accumulatedElapsedMs: 0,
					runningSinceMs: Date.now(),
					completedAtMs: undefined,
				}),
			);
			return;
		}

		activeClient.selectWorkout(workout);
		activeClient.startWorkout(Date.now());
		dispatch(setWorkoutSnapshot(activeClient.getWorkoutSnapshot()));
	};

export const pauseWorkoutSession =
	(): AppThunk =>
	(dispatch) => {
		if (!activeClient) {
			return;
		}

		activeClient.pauseWorkout(Date.now());
		dispatch(setWorkoutSnapshot(activeClient.getWorkoutSnapshot()));
	};

export const resumeWorkoutSession =
	(): AppThunk =>
	(dispatch) => {
		if (!activeClient) {
			return;
		}

		activeClient.resumeWorkout(Date.now());
		dispatch(setWorkoutSnapshot(activeClient.getWorkoutSnapshot()));
	};

export const endWorkoutSession =
	(): AppThunk =>
	(dispatch) => {
		if (activeClient) {
			activeClient.endWorkout();
			dispatch(setWorkoutSnapshot(activeClient.getWorkoutSnapshot()));
			return;
		}

		dispatch(clearWorkout());
	};
