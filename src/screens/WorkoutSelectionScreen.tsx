import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { selectDeviceName } from '../state/trainerSelectors';
import { selectWorkout, startWorkout } from '../state/workoutSlice';
import { WORKOUT_CATALOG } from '../workouts/catalog';

function formatDuration(seconds: number) {
  if (seconds === 0) {
    return 'No fixed duration';
  }

  const minutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds % 60;

  if (!remainderSeconds) {
    return `${minutes} min`;
  }

  return `${minutes}m ${remainderSeconds}s`;
}

export function WorkoutSelectionScreen() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const deviceName = useAppSelector(selectDeviceName);

  return (
    <Stack gap="lg">
      <Card className="panel" padding="xl" radius="32px">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text className="section-title">Choose a Workout</Text>
            <Text className="section-copy">
              Trainer ready: {deviceName ?? 'Connected trainer'}
            </Text>
          </div>
          <Button className="button-quiet" onClick={() => navigate('/connect')}>
            Back to Setup
          </Button>
        </Group>
      </Card>

      <div className="workout-grid">
        {WORKOUT_CATALOG.map((workout) => (
          <Card className="workout-card" key={workout.id} padding="xl" radius="28px">
            <Stack gap="md" h="100%" justify="space-between">
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text className="section-title">{workout.name}</Text>
                    <Text className="section-copy">{workout.description}</Text>
                  </div>
                  <Badge color={workout.type === 'freeRide' ? 'ember' : 'accent'}>
                    {workout.type === 'freeRide' ? 'Free Ride' : 'Structured'}
                  </Badge>
                </Group>

                <div className="workout-meta">
                  <span className="workout-meta-item">
                    Duration: {formatDuration(workout.durationSeconds)}
                  </span>
                  <span className="workout-meta-item">
                    Blocks: {workout.blocks.length || 'Open-ended'}
                  </span>
                </div>
              </Stack>

              <Button
                className={workout.type === 'freeRide' ? 'button-secondary' : 'button-primary'}
                onClick={() => {
                  dispatch(selectWorkout(workout.id));
                  dispatch(startWorkout(Date.now()));
                  navigate('/ride');
                }}
              >
                Start Workout
              </Button>
            </Stack>
          </Card>
        ))}
      </div>
    </Stack>
  );
}
