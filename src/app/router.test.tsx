import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AppRoutes } from './router';
import { ConnectScreen } from '../screens/ConnectScreen';
import { RideScreen } from '../screens/RideScreen';
import { renderWithProviders } from '../test/testUtils';

vi.mock('../components/PowerChart', () => ({
  PowerChart: () => <div>Mock Power Chart</div>,
}));

describe('app routing and screens', () => {
  it('keeps Continue disabled until power capability is available', () => {
    const notReady = renderWithProviders(
      <MemoryRouter>
        <ConnectScreen />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    notReady.unmount();

    renderWithProviders(
      <MemoryRouter>
        <ConnectScreen />
      </MemoryRouter>,
      {
        preloadedState: {
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
        },
      }
    );

    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('redirects /workouts back to /connect when trainer setup is invalid', () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/workouts']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByText('Trainer Connection')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('navigates from workout selection to the ride screen', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter initialEntries={['/workouts']}>
        <AppRoutes />
      </MemoryRouter>,
      {
        preloadedState: {
          trainer: {
            connectionState: 'connected',
            device: { id: 'trainer-1', name: 'Kickr' },
            capabilities: {
              power: true,
              cadence: false,
              speed: false,
              resistanceControl: false,
              ergMode: false,
              simulationMode: false,
            },
          },
        },
      }
    );

    await user.click(screen.getAllByRole('button', { name: 'Start Workout' })[0]);

    expect(await screen.findByText('Current Target')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'End Ride' }));
  });

  it('keeps the ride screen free of the full connection panel and shows degraded state', () => {
    renderWithProviders(
      <MemoryRouter>
        <RideScreen />
      </MemoryRouter>,
      {
        preloadedState: {
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
          app: {
            currentScreen: 'ride',
          },
        },
      }
    );

    expect(screen.queryByText('Trainer Connection')).not.toBeInTheDocument();
    expect(
      screen.getByText('Trainer disconnected. Live telemetry is unavailable.')
    ).toBeInTheDocument();
  });

  it('returns to workout selection when ending a ride', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter initialEntries={['/ride']}>
        <AppRoutes />
      </MemoryRouter>,
      {
        preloadedState: {
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
          workout: {
            selectedWorkoutId: 'twoByTwenty',
            status: 'active',
            runningSinceMs: 0,
            accumulatedElapsedMs: 0,
          },
          app: {
            currentScreen: 'ride',
          },
        },
      }
    );

    await user.click(screen.getByRole('button', { name: 'End Ride' }));

    await waitFor(() => {
      expect(screen.getByText('Choose a Workout')).toBeInTheDocument();
    });
  });

  it('allows access to /ride during a degraded active ride', () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/ride']}>
        <AppRoutes />
      </MemoryRouter>,
      {
        preloadedState: {
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
          app: {
            currentScreen: 'ride',
          },
        },
      }
    );

    expect(screen.getByText('Live Power')).toBeInTheDocument();
  });
});
