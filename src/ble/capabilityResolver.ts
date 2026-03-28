import type {
  DiscoveredBleTopology,
  TrainerCapabilities,
  TrainerCapabilityStatuses,
  TrainerMode,
} from '../domain/trainer';
import {
  createCapabilityStatuses,
  createEmptyCapabilities,
} from '../domain/trainer';
import {
  CYCLING_POWER_MEASUREMENT_CHARACTERISTIC_UUIDS,
  CYCLING_POWER_SERVICE_UUIDS,
  FITNESS_MACHINE_CONTROL_CHARACTERISTIC_UUIDS,
  FITNESS_MACHINE_SERVICE_UUIDS,
} from './uuids';

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
    normalizedValues.has(normalizeUuid(candidate))
  );
}

export function resolveCapabilities({
  mode,
  topology,
}: ResolveCapabilitiesInput): CapabilityResolutionResult {
  if (mode === 'simulate') {
    return {
      capabilities: {
        ...createEmptyCapabilities(),
        power: true,
      },
      statuses: {
        ...createCapabilityStatuses('unavailable'),
        power: 'available',
      },
    };
  }

  if (!topology) {
    return {
      capabilities: createEmptyCapabilities(),
      statuses: createCapabilityStatuses('unavailable'),
    };
  }

  const serviceUuids = topology.serviceUuids.map(normalizeUuid);
  const allCharacteristicUuids = Object.values(
    topology.characteristicUuidsByService
  )
    .flat()
    .map(normalizeUuid);

  const hasCyclingPowerService = includesAny(
    CYCLING_POWER_SERVICE_UUIDS,
    serviceUuids
  );
  const hasPowerMeasurementCharacteristic = includesAny(
    CYCLING_POWER_MEASUREMENT_CHARACTERISTIC_UUIDS,
    allCharacteristicUuids
  );
  const hasFtmsService = includesAny(FITNESS_MACHINE_SERVICE_UUIDS, serviceUuids);
  const hasFtmsControl = includesAny(
    FITNESS_MACHINE_CONTROL_CHARACTERISTIC_UUIDS,
    allCharacteristicUuids
  );

  const powerAvailable = hasCyclingPowerService && hasPowerMeasurementCharacteristic;
  const controlAvailable = hasFtmsService && hasFtmsControl;

  return {
    capabilities: {
      power: powerAvailable,
      cadence: false,
      speed: false,
      resistanceControl: controlAvailable,
      ergMode: controlAvailable,
      simulationMode: controlAvailable,
    },
    statuses: {
      power: powerAvailable ? 'available' : 'unavailable',
      cadence: 'unavailable',
      speed: 'unavailable',
      resistanceControl: controlAvailable ? 'available' : 'unavailable',
      ergMode: controlAvailable ? 'available' : 'unavailable',
      simulationMode: controlAvailable ? 'available' : 'unavailable',
    },
  };
}

export function createCheckingCapabilityResolution(): CapabilityResolutionResult {
  return {
    capabilities: createEmptyCapabilities(),
    statuses: createCapabilityStatuses('checking'),
  };
}
