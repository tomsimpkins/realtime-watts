import type { PowerMeasurement } from '../domain/trainer';

const FLAGS_OFFSET = 0;
const INSTANTANEOUS_POWER_OFFSET = 2;
const MIN_PACKET_LENGTH = 4;
const CRANK_REVOLUTION_DATA_PRESENT_FLAG = 1 << 5;
const CRANK_REVOLUTION_DATA_OFFSET = 4;
const CRANK_REVOLUTION_DATA_LENGTH = 4;
const UINT16_ROLLOVER = 0x1_0000;
const CRANK_EVENT_TIME_UNITS_PER_SECOND = 1024;

export interface CyclingPowerCrankData {
  cumulativeCrankRevolutions: number;
  lastCrankEventTime: number;
}

export interface DecodeResult {
  flags: number;
  crankRevolutionData?: CyclingPowerCrankData;
  measurement: PowerMeasurement;
}

function hasFlag(flags: number, mask: number): boolean {
  return (flags & mask) === mask;
}

function readCrankRevolutionData(
  dataView: DataView,
  flags: number
): CyclingPowerCrankData | undefined {
  if (!hasFlag(flags, CRANK_REVOLUTION_DATA_PRESENT_FLAG)) {
    return undefined;
  }

  if (dataView.byteLength < CRANK_REVOLUTION_DATA_OFFSET + CRANK_REVOLUTION_DATA_LENGTH) {
    return undefined;
  }

  return {
    cumulativeCrankRevolutions: dataView.getUint16(
      CRANK_REVOLUTION_DATA_OFFSET,
      true
    ),
    lastCrankEventTime: dataView.getUint16(
      CRANK_REVOLUTION_DATA_OFFSET + 2,
      true
    ),
  };
}

function getRolledUint16Delta(next: number, previous: number): number {
  return next >= previous ? next - previous : UINT16_ROLLOVER - previous + next;
}

export function estimateCadenceRpm(
  previousCrankData?: CyclingPowerCrankData,
  currentCrankData?: CyclingPowerCrankData
): number | undefined {
  if (!previousCrankData || !currentCrankData) {
    return undefined;
  }

  const revolutionDelta = getRolledUint16Delta(
    currentCrankData.cumulativeCrankRevolutions,
    previousCrankData.cumulativeCrankRevolutions
  );
  const eventTimeDelta = getRolledUint16Delta(
    currentCrankData.lastCrankEventTime,
    previousCrankData.lastCrankEventTime
  );

  if (revolutionDelta <= 0 || eventTimeDelta <= 0) {
    return undefined;
  }

  return Math.round(
    (revolutionDelta * 60 * CRANK_EVENT_TIME_UNITS_PER_SECOND) / eventTimeDelta
  );
}

export function decodeCyclingPowerPacket(
  dataView: DataView,
  timestamp = Date.now()
): DecodeResult | null {
  if (dataView.byteLength < MIN_PACKET_LENGTH) {
    return null;
  }

  try {
    const flags = dataView.getUint16(FLAGS_OFFSET, true);
    const watts = dataView.getInt16(INSTANTANEOUS_POWER_OFFSET, true);
    const crankRevolutionData = readCrankRevolutionData(dataView, flags);

    return {
      flags,
      crankRevolutionData,
      measurement: {
        timestamp,
        watts,
        source: 'cps',
      },
    };
  } catch {
    return null;
  }
}

export function decodeCyclingPowerMeasurement(
  dataView: DataView,
  timestamp = Date.now()
): PowerMeasurement | null {
  return decodeCyclingPowerPacket(dataView, timestamp)?.measurement ?? null;
}
