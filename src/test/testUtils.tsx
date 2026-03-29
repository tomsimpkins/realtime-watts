import { createTheme, MantineProvider } from "@mantine/core";
import { render, type RenderOptions } from "@testing-library/react";
import type { PropsWithChildren, ReactElement } from "react";
import { Provider } from "react-redux";

import {
	createAppStore,
	type AppStore,
	type DeepPartial,
	type RootState,
} from "../app/store";
import {
	createCapabilityStatuses,
	createEmptyCapabilities,
} from "../domain/trainer";

const theme = createTheme({
	fontFamily: "Inter, system-ui, sans-serif",
	primaryColor: "lime",
});

export function createTestState(
	overrides: DeepPartial<RootState> = {},
): RootState {
	const baseState: RootState = {
		app: {
			currentScreen: "connect",
		},
		metrics: {
			latestPower: undefined,
			recentPower: [],
			diagnostics: {
				lastPacketTimestamp: undefined,
				sampleCount: 0,
			},
		},
		trainer: {
			connectionState: "idle",
			device: undefined,
			error: undefined,
			environment: {
				isWebBluetoothSupported: true,
				isSecureContext: true,
				mode: "simulate",
			},
			topology: undefined,
			capabilities: createEmptyCapabilities(),
			capabilityStatuses: createCapabilityStatuses("unknown"),
			degradedDuringRide: false,
		},
		workout: {
			selectedWorkoutId: undefined,
			status: "idle",
			runningSinceMs: undefined,
			accumulatedElapsedMs: 0,
			completedAtMs: undefined,
		},
	};

	return {
		...baseState,
		...overrides,
		app: {
			...baseState.app,
			...overrides.app,
		},
		metrics: {
			...baseState.metrics,
			...overrides.metrics,
			diagnostics: {
				...baseState.metrics.diagnostics,
				...overrides.metrics?.diagnostics,
			},
		},
		trainer: {
			...baseState.trainer,
			...overrides.trainer,
			environment: {
				...baseState.trainer.environment,
				...overrides.trainer?.environment,
			},
			capabilities: {
				...baseState.trainer.capabilities,
				...overrides.trainer?.capabilities,
			},
			capabilityStatuses: {
				...baseState.trainer.capabilityStatuses,
				...overrides.trainer?.capabilityStatuses,
			},
		},
		workout: {
			...baseState.workout,
			...overrides.workout,
		},
	};
}

export function createTestStore(
	overrides: DeepPartial<RootState> = {},
): AppStore {
	return createAppStore(createTestState(overrides));
}

interface ExtendedRenderOptions extends Omit<RenderOptions, "wrapper"> {
	preloadedState?: DeepPartial<RootState>;
	store?: AppStore;
}

export function renderWithProviders(
	ui: ReactElement,
	{
		preloadedState,
		store = createTestStore(preloadedState),
		...renderOptions
	}: ExtendedRenderOptions = {},
) {
	function Wrapper({ children }: PropsWithChildren) {
		return (
			<Provider store={store}>
				<MantineProvider defaultColorScheme="dark" theme={theme}>
					{children}
				</MantineProvider>
			</Provider>
		);
	}

	return {
		store,
		...render(ui, { wrapper: Wrapper, ...renderOptions }),
	};
}
