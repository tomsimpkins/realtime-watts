import { Badge, Button, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { PowerDisplay } from '../components/PowerDisplay';
import { StatusBanner } from '../components/StatusBanner';
import { selectCadenceDisplay, selectPowerDisplay, selectRecentPower } from '../state/metricsSelectors';
import { retryTrainerConnection } from '../state/trainerThunks';
import { selectRideBannerModel } from '../state/trainerSelectors';
import { endWorkout, pauseWorkout, resumeWorkout } from '../state/workoutSlice';
import {
  selectCanEndWorkout,
  selectCanPauseWorkout,
  selectCanResumeWorkout,
  selectCurrentBlockRemainingSeconds,
  selectWorkoutSummary,
} from '../state/workoutSelectors';

const PowerChart = lazy(() =>
  import('../components/PowerChart').then((module) => ({
    default: module.PowerChart,
  }))
);

export function RideScreen() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const cadenceDisplay = useAppSelector(selectCadenceDisplay);
  const canEnd = useAppSelector(selectCanEndWorkout);
  const canPause = useAppSelector(selectCanPauseWorkout);
  const canResume = useAppSelector(selectCanResumeWorkout);
  const currentBlockRemainingSeconds = useAppSelector(
    selectCurrentBlockRemainingSeconds
  );
  const powerDisplay = useAppSelector(selectPowerDisplay);
  const recentPower = useAppSelector(selectRecentPower);
  const rideBanner = useAppSelector(selectRideBannerModel);
  const workoutSummary = useAppSelector(selectWorkoutSummary);

  const handleEndRide = () => {
    dispatch(endWorkout());
    navigate('/workouts');
  };

  const showCompletionCta = workoutSummary.status === 'completed';

  return (
    <Stack gap="lg">
      {rideBanner ? (
        <StatusBanner
          color={rideBanner.color}
          description={rideBanner.description}
          label={rideBanner.label}
        />
      ) : null}

      {showCompletionCta ? (
        <StatusBanner
          color="green"
          description="This workout is complete. You can choose another one without reconnecting the trainer."
          label="Workout Complete"
        />
      ) : null}

      <Paper p="lg" radius="xl" withBorder>
        <Stack gap="md">
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text fw={700} size="lg">
                {workoutSummary.workoutName}
              </Text>
              <Text c="dimmed" size="sm">
                {workoutSummary.currentBlockLabel}
              </Text>
            </div>
            <Badge color={workoutSummary.status === 'completed' ? 'green' : 'lime'}>
              {workoutSummary.status}
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <div>
              <Text c="dimmed" size="xs" tt="uppercase">
                Elapsed Time
              </Text>
              <Text fw={700} size="lg">
                {workoutSummary.elapsedTimeLabel}
              </Text>
            </div>
            <div>
              <Text c="dimmed" size="xs" tt="uppercase">
                Current Target
              </Text>
              <Text fw={700} size="lg">
                {workoutSummary.currentTargetLabel}
              </Text>
            </div>
            <div>
              <Text c="dimmed" size="xs" tt="uppercase">
                Block Remaining
              </Text>
              <Text fw={700} size="lg">
                {typeof currentBlockRemainingSeconds === 'number'
                  ? `${currentBlockRemainingSeconds}s`
                  : '—'}
              </Text>
            </div>
          </SimpleGrid>
        </Stack>
      </Paper>

      <PowerDisplay
        subtitle={`Cadence: ${cadenceDisplay}`}
        wattsDisplay={powerDisplay}
      />

      <Suspense
        fallback={
          <Paper p="lg" radius="xl" withBorder>
            <Text c="dimmed" size="sm">
              Loading chart…
            </Text>
          </Paper>
        }
      >
        <PowerChart samples={recentPower} />
      </Suspense>

      <Group>
        {canPause ? (
          <Button onClick={() => dispatch(pauseWorkout(Date.now()))} radius="xl" variant="default">
            Pause
          </Button>
        ) : null}
        {canResume ? (
          <Button onClick={() => dispatch(resumeWorkout(Date.now()))} radius="xl" variant="default">
            Resume
          </Button>
        ) : null}
        {rideBanner ? (
          <Button
            onClick={() => {
              void dispatch(retryTrainerConnection());
            }}
            radius="xl"
          >
            Retry Trainer
          </Button>
        ) : null}
        {canEnd && !showCompletionCta ? (
          <Button color="red" onClick={handleEndRide} radius="xl" variant="light">
            End Ride
          </Button>
        ) : null}
        {showCompletionCta ? (
          <Button onClick={handleEndRide} radius="xl">
            Choose Another Workout
          </Button>
        ) : null}
      </Group>
    </Stack>
  );
}
