import { Container, Stack, Text, Title } from '@mantine/core';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { useAppSelector } from './hooks';
import { RouteStateSynchronizer } from './RouteStateSynchronizer';
import { FlowStepper } from '../components/FlowStepper';
import { ConnectScreen } from '../screens/ConnectScreen';
import { RideScreen } from '../screens/RideScreen';
import { WorkoutSelectionScreen } from '../screens/WorkoutSelectionScreen';
import {
  selectCanAccessRide,
  selectCanAccessWorkouts,
  selectFlowStepperModel,
} from '../state/appSelectors';

function getRouterBasename() {
  const baseUrl = import.meta.env.BASE_URL ?? '/';
  return baseUrl === '/' ? '/' : baseUrl.replace(/\/$/, '');
}

function AppLayout() {
  const flowStepper = useAppSelector(selectFlowStepperModel);

  return (
    <Container className="app-shell" py="xl" size="lg">
      <Stack gap="lg">
        <header className="app-header">
          <Title className="app-title" order={1}>
            Realtime Watts
          </Title>
          <Text className="app-subtitle">
            Guided smart trainer workflow for setup, workout selection, and ride telemetry.
          </Text>
        </header>
        <FlowStepper
          connectComplete={flowStepper.connectComplete}
          currentScreen={flowStepper.currentScreen}
          workoutComplete={flowStepper.workoutComplete}
        />
        <Outlet />
      </Stack>
    </Container>
  );
}

function RequireWorkoutsAccess() {
  const canAccessWorkouts = useAppSelector(selectCanAccessWorkouts);

  return canAccessWorkouts ? <Outlet /> : <Navigate replace to="/connect" />;
}

function RequireRideAccess() {
  const canAccessRide = useAppSelector(selectCanAccessRide);
  const canAccessWorkouts = useAppSelector(selectCanAccessWorkouts);

  if (canAccessRide) {
    return <Outlet />;
  }

  return <Navigate replace to={canAccessWorkouts ? '/workouts' : '/connect'} />;
}

export function AppRoutes() {
  return (
    <>
      <RouteStateSynchronizer />
      <Routes>
        <Route element={<AppLayout />} path="/">
          <Route element={<Navigate replace to="/connect" />} index />
          <Route element={<ConnectScreen />} path="connect" />
          <Route element={<RequireWorkoutsAccess />}>
            <Route element={<WorkoutSelectionScreen />} path="workouts" />
          </Route>
          <Route element={<RequireRideAccess />}>
            <Route element={<RideScreen />} path="ride" />
          </Route>
          <Route element={<Navigate replace to="/connect" />} path="*" />
        </Route>
      </Routes>
    </>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter basename={getRouterBasename()}>
      <AppRoutes />
    </BrowserRouter>
  );
}
