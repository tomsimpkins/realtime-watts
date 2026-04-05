import { createSelector } from "@reduxjs/toolkit";

import type { RootState } from "../../../app/store";

export interface ConnectSetupModel {
	canConnect: boolean;
	canContinue: boolean;
	canReconnect: boolean;
	deviceName?: string;
	readinessLabel: string;
	readinessMessage: string;
	readinessTone: "ready" | "checking" | "attention" | "idle";
	showPrimaryAction: "connect" | "continue" | "connecting" | "retry";
	showSecondaryAction?: "reconnect" | "retry";
}

export const selectTrainerState = (state: RootState) => state.trainer;

export const selectConnectionState = createSelector(
	[selectTrainerState],
	(trainer) => trainer.connectionState,
);

export const selectDevice = createSelector(
	[selectTrainerState],
	(trainer) => trainer.device,
);

export const selectDeviceName = createSelector(
	[selectDevice],
	(device) => device?.name,
);

export const selectTrainerEnvironment = createSelector(
	[selectTrainerState],
	(trainer) => trainer.environment,
);

export const selectTrainerError = createSelector(
	[selectTrainerState],
	(trainer) => trainer.error,
);

export const selectTrainerCapabilities = createSelector(
	[selectTrainerState],
	(trainer) => trainer.capabilities,
);

export const selectTrainerCapabilityStatuses = createSelector(
	[selectTrainerState],
	(trainer) => trainer.capabilityStatuses,
);

export const selectTrainerTopology = createSelector(
	[selectTrainerState],
	(trainer) => trainer.topology,
);

export const selectDegradedDuringRide = createSelector(
	[selectTrainerState],
	(trainer) => trainer.degradedDuringRide,
);

export const selectIsTrainerReady = createSelector(
	[selectConnectionState, selectTrainerCapabilities],
	(connectionState, capabilities) =>
		connectionState === "connected" && capabilities.power,
);

export const selectCanStartSetup = createSelector(
	[selectTrainerState],
	(trainer) => {
		const isBusy =
			trainer.connectionState === "requesting" ||
			trainer.connectionState === "connecting" ||
			trainer.connectionState === "disconnecting";

		if (isBusy) {
			return false;
		}

		if (trainer.environment.mode === "simulate") {
			return true;
		}

		return (
			trainer.environment.isSecureContext &&
			trainer.environment.isWebBluetoothSupported
		);
	},
);

export const selectCanRetrySetup = createSelector(
	[selectTrainerState],
	(trainer) => {
		const isBusy =
			trainer.connectionState === "requesting" ||
			trainer.connectionState === "connecting" ||
			trainer.connectionState === "disconnecting";

		return (
			!isBusy &&
			(trainer.environment.mode === "simulate" || Boolean(trainer.device))
		);
	},
);

export const selectCanContinueFromConnect = selectIsTrainerReady;

export const selectConnectSetupModel = createSelector(
	[
		selectConnectionState,
		selectDeviceName,
		selectTrainerEnvironment,
		selectTrainerError,
		selectIsTrainerReady,
		selectCanStartSetup,
		selectCanRetrySetup,
		selectTrainerCapabilities,
	],
	(
		connectionState,
		deviceName,
		environment,
		error,
		isTrainerReady,
		canStartSetup,
		canRetrySetup,
		capabilities,
	): ConnectSetupModel => {
		const isBusy =
			connectionState === "requesting" ||
			connectionState === "connecting" ||
			connectionState === "disconnecting";

		if (isTrainerReady) {
			return {
				canConnect: canStartSetup,
				canContinue: true,
				canReconnect: canRetrySetup,
				deviceName,
				readinessLabel: "Ready",
				readinessMessage: deviceName
					? `${deviceName} is ready for workout selection.`
					: "Trainer is ready for workout selection.",
				readinessTone: "ready",
				showPrimaryAction: "continue",
				showSecondaryAction: canRetrySetup ? "reconnect" : undefined,
			};
		}

		if (isBusy) {
			return {
				canConnect: false,
				canContinue: false,
				canReconnect: false,
				deviceName,
				readinessLabel: "Checking trainer",
				readinessMessage:
					connectionState === "requesting"
						? environment.mode === "simulate"
							? "Starting the demo trainer."
							: "Choose your trainer to continue."
						: "Checking device readiness and supported features.",
				readinessTone: "checking",
				showPrimaryAction: "connecting",
			};
		}

		if (error) {
			return {
				canConnect: canStartSetup,
				canContinue: false,
				canReconnect: canRetrySetup,
				deviceName,
				readinessLabel: "Needs attention",
				readinessMessage: error,
				readinessTone: "attention",
				showPrimaryAction: canRetrySetup ? "retry" : "connect",
			};
		}

		if (connectionState === "connected" && !capabilities.power) {
			return {
				canConnect: canStartSetup,
				canContinue: false,
				canReconnect: canRetrySetup,
				deviceName,
				readinessLabel: "Needs attention",
				readinessMessage:
					"Trainer connected, but power support is unavailable.",
				readinessTone: "attention",
				showPrimaryAction: canRetrySetup ? "retry" : "connect",
			};
		}

		return {
			canConnect: canStartSetup,
			canContinue: false,
			canReconnect: false,
			deviceName,
			readinessLabel: "Not connected",
			readinessMessage:
				environment.supportMessage ??
				(deviceName
					? `Reconnect to ${deviceName} or connect a trainer to continue.`
					: "Connect a trainer to continue."),
			readinessTone: canStartSetup ? "idle" : "attention",
			showPrimaryAction: "connect",
		};
	},
);

export const selectRideBannerModel = createSelector(
	[selectDegradedDuringRide, selectTrainerError],
	(degradedDuringRide, error) => {
		if (degradedDuringRide) {
			return {
				color: "red",
				description: "Trainer disconnected. Live telemetry is unavailable.",
				label: "Degraded Ride",
			};
		}

		if (error) {
			return {
				color: "red",
				description: error,
				label: "Error",
			};
		}

		return undefined;
	},
);
