import type { PowerMeasurement } from '../domain/trainer';

const FLAGS_OFFSET = 0;
const INSTANTANEOUS_POWER_OFFSET = 2;
const MIN_PACKET_LENGTH = 4;

export interface DecodeResult {
  flags: number;
  measurement: PowerMeasurement;
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

    return {
      flags,
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
