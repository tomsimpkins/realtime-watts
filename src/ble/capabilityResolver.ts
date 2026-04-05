import type {
	DiscoveredBleTopology,
	TrainerCapabilities,
	TrainerCapabilityStatuses,
	TrainerMode,
} from "../domain/trainer";
import {
	createCapabilityStatuses,
	createEmptyCapabilities,
} from "../domain/trainer";
import {
	FITNESS_MACHINE_CONTROL_CHARACTERISTIC_UUIDS,
	FITNESS_MACHINE_FEATURE_CHARACTERISTIC_UUIDS,
	FITNESS_MACHINE_SERVICE_UUIDS,
} from "./uuids";

export interface ResolveCapabilitiesInput {
	mode: TrainerMode;
	topology?: DiscoveredBleTopology;
}

export interface CapabilityResolutionResult {
	capabilities: TrainerCapabilities;
	statuses: TrainerCapabilityStatuses;
}

function normalizeUuid(uuid: string): string {
	return uuid.toLowerCase();
}

function includesAny(candidates: string[], values: string[]): boolean {
	const normalizedValues = new Set(values.map(normalizeUuid));

	return candidates.some((candidate) =>
		normalizedValues.has(normalizeUuid(candidate)),
	);
}

export function resolveCapabilities({
	mode,
	topology,
}: ResolveCapabilitiesInput): CapabilityResolutionResult {
	if (mode === "simulate") {
		return {
			capabilities: {
				...createEmptyCapabilities(),
				cadence: true,
				power: true,
				speed: true,
			},
			statuses: {
				...createCapabilityStatuses("unavailable"),
				cadence: "available",
				power: "available",
				speed: "available",
			},
		};
	}

	if (!topology) {
		return {
			capabilities: createEmptyCapabilities(),
			statuses: createCapabilityStatuses("unavailable"),
		};
	}

	const serviceUuids = topology.serviceUuids.map(normalizeUuid);
	const allCharacteristicUuids = Object.values(
		topology.characteristicUuidsByService,
	)
		.flat()
		.map(normalizeUuid);

	const hasFtmsService = includesAny(
		FITNESS_MACHINE_SERVICE_UUIDS,
		serviceUuids,
	);
	const hasFtmsFeature = includesAny(
		FITNESS_MACHINE_FEATURE_CHARACTERISTIC_UUIDS,
		allCharacteristicUuids,
	);
	const hasFtmsControl = includesAny(
		FITNESS_MACHINE_CONTROL_CHARACTERISTIC_UUIDS,
		allCharacteristicUuids,
	);

	const telemetryAvailable = hasFtmsService && hasFtmsFeature;
	const controlAvailable = hasFtmsService && hasFtmsControl;

	return {
		capabilities: {
			power: telemetryAvailable,
			cadence: telemetryAvailable,
			speed: telemetryAvailable,
			resistanceControl: controlAvailable,
			ergMode: controlAvailable,
			simulationMode: controlAvailable,
		},
		statuses: {
			power: telemetryAvailable ? "available" : "unavailable",
			cadence: telemetryAvailable ? "available" : "unavailable",
			speed: telemetryAvailable ? "available" : "unavailable",
			resistanceControl: controlAvailable ? "available" : "unavailable",
			ergMode: controlAvailable ? "available" : "unavailable",
			simulationMode: controlAvailable ? "available" : "unavailable",
		},
	};
}

export function createCheckingCapabilityResolution(): CapabilityResolutionResult {
	return {
		capabilities: createEmptyCapabilities(),
		statuses: createCapabilityStatuses("checking"),
	};
}
