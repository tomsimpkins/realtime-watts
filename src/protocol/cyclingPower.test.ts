import { describe, expect, it } from 'vitest';

import {
  decodeCyclingPowerMeasurement,
  decodeCyclingPowerPacket,
} from './cyclingPower';

function createDataView(bytes: number[]): DataView {
  return new DataView(Uint8Array.from(bytes).buffer);
}

describe('decodeCyclingPowerMeasurement', () => {
  it('returns watts from a valid packet', () => {
    const measurement = decodeCyclingPowerMeasurement(
      createDataView([0x00, 0x00, 0x2c, 0x01]),
      1234
    );

    expect(measurement).toEqual({
      timestamp: 1234,
      watts: 300,
      source: 'cps',
    });
  });

  it('returns null when the packet is too short', () => {
    expect(
      decodeCyclingPowerMeasurement(createDataView([0x00, 0x00, 0x2c]))
    ).toBeNull();
  });

  it('returns null for an empty payload', () => {
    expect(decodeCyclingPowerMeasurement(new DataView(new ArrayBuffer(0)))).toBe(
      null
    );
  });

  it('ignores unsupported flags safely while still decoding watts', () => {
    const decoded = decodeCyclingPowerPacket(
      createDataView([0x30, 0x00, 0x64, 0x00, 0x00, 0x00]),
      5678
    );

    expect(decoded).toEqual({
      flags: 0x0030,
      measurement: {
        timestamp: 5678,
        watts: 100,
        source: 'cps',
      },
    });
  });
});
