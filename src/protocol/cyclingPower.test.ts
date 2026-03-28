import { describe, expect, it } from 'vitest';

import {
  decodeCyclingPowerMeasurement,
  decodeCyclingPowerPacket,
  estimateCadenceRpm,
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

  it('extracts crank revolution data when present', () => {
    const decoded = decodeCyclingPowerPacket(
      createDataView([0x20, 0x00, 0x90, 0x01, 0x0a, 0x00, 0x00, 0x04]),
      5678
    );

    expect(decoded).toEqual({
      flags: 0x0020,
      crankRevolutionData: {
        cumulativeCrankRevolutions: 10,
        lastCrankEventTime: 1024,
      },
      measurement: {
        timestamp: 5678,
        watts: 400,
        source: 'cps',
      },
    });
  });

  it('estimates cadence from crank revolution deltas', () => {
    expect(
      estimateCadenceRpm(
        {
          cumulativeCrankRevolutions: 10,
          lastCrankEventTime: 1024,
        },
        {
          cumulativeCrankRevolutions: 11,
          lastCrankEventTime: 2048,
        }
      )
    ).toBe(60);
  });
});
