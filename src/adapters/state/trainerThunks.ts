import type { AppDispatch, AppThunk, RootState } from "../../app/store";
import {
	createTrainerSession,
	type TrainerSessionApi,
} from "../../application/TrainerSession";
import { createCheckingCapabilityResolution } from "../bluetooth/capabilityResolver";
import type { TrainerEnvironment } from "../../domain/trainer";
import { getTrainerEnvironment } from "../../utils/environment";
import { getUserFacingError, logDebug, logError } from "../../utils/errors";
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
import { WORKOUTS_BY_ID } from "../../workouts/catalog";

let activeTrainerSession: TrainerSessionApi | null = null;
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

async function disposeActiveTrainerSession(): Promise<void> {
	if (!activeTrainerSession) {
		return;
	}

	try {
		await activeTrainerSession.disconnect();
	} catch (error) {
		logDebug("Unable to disconnect previous trainer session cleanly", error);
	} finally {
		releaseClientSubscriptions();
		activeTrainerSession = null;
	}
}

function bindTrainerSessionListeners(
	trainerSession: TrainerSessionApi,
	dispatch: AppDispatch,
	getState: () => RootState,
): void {
	releaseClientSubscriptions();

	unsubscribeMetricsSnapshot = trainerSession.subscribeToMetricsSnapshot((snapshot) => {
		dispatch(setMetricsSnapshot(snapshot));
	});
	unsubscribeWorkoutSnapshot = trainerSession.subscribeToWorkoutSnapshot((snapshot) => {
		dispatch(setWorkoutSnapshot(snapshot));
	});

	unsubscribeDisconnect = trainerSession.onDisconnected(() => {
		releaseClientSubscriptions();
		const isRideScreen = getState().app.currentScreen === "ride";

		dispatch(setConnectionState("idle"));
		dispatch(
			setError(
				"Trainer disconnected. You can reconnect without reloading the page.",
			),
		);
		dispatch(setMetricsSnapshot(trainerSession.getMetricsSnapshot()));
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

async function completeTrainerSessionSetup(
	trainerSession: TrainerSessionApi,
	dispatch: AppDispatch,
	getState: () => RootState,
	mode: TrainerEnvironment["mode"],
	resetMetricsOnSuccess: boolean,
	connectMethod: "connect" | "reconnect",
) {
	const connectedTrainer = await trainerSession[connectMethod]();

	bindTrainerSessionListeners(trainerSession, dispatch, getState);

	if (resetMetricsOnSuccess) {
		dispatch(resetMetrics());
	}

	dispatch(setMetricsSnapshot(trainerSession.getMetricsSnapshot()));
	dispatch(setWorkoutSnapshot(trainerSession.getWorkoutSnapshot()));

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

		await disposeActiveTrainerSession();
		const trainerSession = createTrainerSession(environment.mode);
		activeTrainerSession = trainerSession;

		try {
			const device = await trainerSession.requestDevice();
			dispatch(setDevice(device));
			dispatch(setConnectionState("connecting"));
			await completeTrainerSessionSetup(
				trainerSession,
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

		if (!activeTrainerSession) {
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
			await completeTrainerSessionSetup(
				activeTrainerSession,
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

export const retryTrainerSession =
	(): AppThunk<Promise<void>> => async (dispatch, getState) => {
		const environment = getTrainerEnvironment();

		if (!ensureEnvironmentReady(environment, dispatch)) {
			return;
		}

		if (!activeTrainerSession) {
			dispatch(
				setError(
					"Cannot reconnect without a remembered trainer. Return to setup to connect again.",
				),
			);
			return;
		}

		dispatch(setConnectionState("connecting"));

		try {
			await completeTrainerSessionSetup(
				activeTrainerSession,
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
		if (!activeTrainerSession) {
			dispatch(resetTrainerSession());
			dispatch(resetMetrics());
			dispatch(clearWorkout());
			return;
		}

		dispatch(setConnectionState("disconnecting"));

		try {
			await activeTrainerSession.disconnect();
		} catch (error) {
			logError("Failed to disconnect trainer", error);
		} finally {
			releaseClientSubscriptions();
			activeTrainerSession = null;
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

		if (!activeTrainerSession) {
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

		activeTrainerSession.selectWorkout(workout);
		activeTrainerSession.startWorkout(Date.now());
		dispatch(setWorkoutSnapshot(activeTrainerSession.getWorkoutSnapshot()));
	};

export const pauseWorkoutSession =
	(): AppThunk =>
	(dispatch) => {
		if (!activeTrainerSession) {
			return;
		}

		activeTrainerSession.pauseWorkout(Date.now());
		dispatch(setWorkoutSnapshot(activeTrainerSession.getWorkoutSnapshot()));
	};

export const resumeWorkoutSession =
	(): AppThunk =>
	(dispatch) => {
		if (!activeTrainerSession) {
			return;
		}

		activeTrainerSession.resumeWorkout(Date.now());
		dispatch(setWorkoutSnapshot(activeTrainerSession.getWorkoutSnapshot()));
	};

export const endWorkoutSession =
	(): AppThunk =>
	(dispatch) => {
		if (activeTrainerSession) {
			activeTrainerSession.endWorkout();
			dispatch(setWorkoutSnapshot(activeTrainerSession.getWorkoutSnapshot()));
			return;
		}

		dispatch(clearWorkout());
	};
