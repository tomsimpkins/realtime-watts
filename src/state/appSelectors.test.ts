import { describe, expect, it } from 'vitest';

import { createTestState } from '../test/testUtils';
import {
  getScreenFromPath,
  selectCanAccessRide,
  selectCanAccessWorkouts,
} from './appSelectors';

describe('appSelectors', () => {
  it('blocks workout access until the trainer is ready', () => {
    const blockedState = createTestState();
    const readyState = createTestState({
      trainer: {
        connectionState: 'connected',
        capabilities: {
          power: true,
          cadence: false,
          speed: false,
          resistanceControl: false,
          ergMode: false,
          simulationMode: false,
        },
      },
    });

    expect(selectCanAccessWorkouts(blockedState)).toBe(false);
    expect(selectCanAccessWorkouts(readyState)).toBe(true);
  });

  it('requires an active workout before ride access is allowed', () => {
    const noWorkoutState = createTestState({
      trainer: {
        connectionState: 'connected',
        capabilities: {
          power: true,
          cadence: false,
          speed: false,
          resistanceControl: false,
          ergMode: false,
          simulationMode: false,
        },
      },
    });

    expect(selectCanAccessRide(noWorkoutState)).toBe(false);
  });

  it('allows ride access during a degraded ride when a workout is already active', () => {
    const degradedRideState = createTestState({
      trainer: {
        connectionState: 'idle',
        degradedDuringRide: true,
      },
      workout: {
        selectedWorkoutId: 'freeRide',
        status: 'active',
        runningSinceMs: 0,
        accumulatedElapsedMs: 0,
      },
    });

    expect(selectCanAccessRide(degradedRideState)).toBe(true);
  });

  it('maps browser paths to app screens', () => {
    expect(getScreenFromPath('/connect')).toBe('connect');
    expect(getScreenFromPath('/workouts')).toBe('workouts');
    expect(getScreenFromPath('/ride')).toBe('ride');
    expect(getScreenFromPath('/anything-else')).toBe('connect');
  });
});
