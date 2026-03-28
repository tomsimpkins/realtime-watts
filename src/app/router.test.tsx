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
  it('shows connect as the primary action until power capability is available', () => {
    const notReady = renderWithProviders(
      <MemoryRouter>
        <ConnectScreen />
      </MemoryRouter>
    );

    expect(screen.getByText('Trainer Setup')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Trainer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    expect(screen.queryByText('Detected Capabilities')).not.toBeInTheDocument();
    notReady.unmount();

    renderWithProviders(
      <MemoryRouter>
        <ConnectScreen />
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

    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reconnect' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect Trainer' })).not.toBeInTheDocument();
  });

  it('hides diagnostics by default and shows them when enabled by query param', () => {
    const hidden = renderWithProviders(
      <MemoryRouter initialEntries={['/connect']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.queryByText('Diagnostics')).not.toBeInTheDocument();
    hidden.unmount();

    renderWithProviders(
      <MemoryRouter initialEntries={['/connect?diagnostics=1']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByText('Diagnostics')).toBeInTheDocument();
  });

  it('redirects /workouts back to /connect when trainer setup is invalid', () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/workouts']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByText('Trainer Setup')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Trainer' })).toBeInTheDocument();
  });

  it('locks future workflow steps until prerequisites are met', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter initialEntries={['/connect']}>
        <AppRoutes />
      </MemoryRouter>
    );

    await user.click(screen.getByTestId('workflow-step-workouts'));

    expect(screen.getByText('Trainer Setup')).toBeInTheDocument();
    expect(screen.queryByText('Choose a Workout')).not.toBeInTheDocument();
  });

  it('allows navigating with unlocked workflow steps', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter initialEntries={['/connect']}>
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

    await user.click(screen.getByTestId('workflow-step-workouts'));
    expect(await screen.findByText('Choose a Workout')).toBeInTheDocument();

    await user.click(screen.getByTestId('workflow-step-connect'));
    expect(await screen.findByText('Trainer Setup')).toBeInTheDocument();
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

    expect(screen.queryByText('Trainer Setup')).not.toBeInTheDocument();
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

    expect(screen.getByText('Power')).toBeInTheDocument();
    expect(screen.getByText('Cadence')).toBeInTheDocument();
  });
});
