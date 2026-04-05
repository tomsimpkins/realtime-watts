import type { TrainerEnvironment, TrainerMode } from "../domain/trainer";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
const TRUTHY_QUERY_VALUES = new Set(["1", "true", "yes", "on"]);

export const SIMULATION_QUERY_PARAM = "simulate";

export function isSimulationModeEnabled(
	search = typeof window !== "undefined" ? window.location.search : "",
): boolean {
	const params = new URLSearchParams(search);
	const value = params.get(SIMULATION_QUERY_PARAM);

	if (value === null) {
		return false;
	}

	return value === "" || TRUTHY_QUERY_VALUES.has(value.toLowerCase());
}

export function isSecureBluetoothContext(): boolean {
	if (typeof window === "undefined") {
		return false;
	}

	if (window.isSecureContext) {
		return true;
	}

	return LOCAL_HOSTNAMES.has(window.location.hostname);
}

function getTrainerMode(): TrainerMode {
	return isSimulationModeEnabled() ? "simulate" : "bluetooth";
}

export function getTrainerEnvironment(): TrainerEnvironment {
	const mode = getTrainerMode();
	const isWebBluetoothSupported =
		typeof navigator !== "undefined" && "bluetooth" in navigator;
	const secureContext = isSecureBluetoothContext();

	let supportMessage: string | undefined;

	if (mode === "simulate") {
		supportMessage =
			"Simulation mode is enabled. Open the app without ?simulate=1 on localhost in Chrome or Edge to use real trainer hardware.";
	} else if (!isWebBluetoothSupported) {
		supportMessage =
			"This app currently requires Chrome or Edge with Web Bluetooth support.";
	} else if (!secureContext) {
		supportMessage =
			"Web Bluetooth requires HTTPS or localhost. Use the Bun dev server on localhost for trainer access.";
	}

	return {
		isWebBluetoothSupported,
		isSecureContext: secureContext,
		mode,
		supportMessage,
	};
}
