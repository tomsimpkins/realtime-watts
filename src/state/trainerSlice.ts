import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type {
	ConnectionState,
	DiscoveredBluetoothTopology,
	TrainerCapabilities,
	TrainerCapabilityStatuses,
	TrainerDeviceInfo,
	TrainerEnvironment,
	TrainerState,
} from "../domain/trainer";
import {
	createCapabilityStatuses,
	createEmptyCapabilities,
} from "../domain/trainer";
import { getTrainerEnvironment } from "../utils/environment";

const initialState: TrainerState = {
	connectionState: "idle",
	environment: getTrainerEnvironment(),
	capabilities: createEmptyCapabilities(),
	capabilityStatuses: createCapabilityStatuses("unknown"),
	degradedDuringRide: false,
};

const trainerSlice = createSlice({
	name: "trainer",
	initialState,
	reducers: {
		setConnectionState(state, action: PayloadAction<ConnectionState>) {
			state.connectionState = action.payload;

			if (action.payload !== "error") {
				state.error = undefined;
			}
		},
		setDevice(state, action: PayloadAction<TrainerDeviceInfo | undefined>) {
			state.device = action.payload;
		},
		setEnvironment(state, action: PayloadAction<TrainerEnvironment>) {
			state.environment = action.payload;
		},
		setTrainerTopology(
			state,
			action: PayloadAction<DiscoveredBluetoothTopology | undefined>,
		) {
			state.topology = action.payload;
		},
		setCapabilities(state, action: PayloadAction<TrainerCapabilities>) {
			state.capabilities = action.payload;
		},
		setCapabilityStatuses(
			state,
			action: PayloadAction<TrainerCapabilityStatuses>,
		) {
			state.capabilityStatuses = action.payload;
		},
		setError(state, action: PayloadAction<string | undefined>) {
			state.error = action.payload;

			if (action.payload) {
				state.connectionState = "error";
			}
		},
		setDegradedDuringRide(state, action: PayloadAction<boolean>) {
			state.degradedDuringRide = action.payload;
		},
		resetTrainerSession(state) {
			return {
				...initialState,
				environment: state.environment,
			};
		},
	},
});

export const {
	resetTrainerSession,
	setCapabilities,
	setCapabilityStatuses,
	setConnectionState,
	setDegradedDuringRide,
	setDevice,
	setEnvironment,
	setError,
	setTrainerTopology,
} = trainerSlice.actions;

export default trainerSlice.reducer;
