import { Badge, Button, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
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
      <Card padding="lg" radius="xl" withBorder>
        <Group justify="space-between">
          <div>
            <Text fw={700} size="lg">
              Connected Trainer
            </Text>
            <Text c="dimmed" size="sm">
              {deviceName ?? 'Trainer ready'}
            </Text>
          </div>
          <Button onClick={() => navigate('/connect')} radius="xl" variant="default">
            Back to Setup
          </Button>
        </Group>
      </Card>

      <div>
        <Text fw={700} size="lg">
          Choose a Workout
        </Text>
        <Text c="dimmed" size="sm">
          Pick a workout and jump straight into the ride dashboard.
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
        {WORKOUT_CATALOG.map((workout) => (
          <Card key={workout.id} padding="lg" radius="xl" withBorder>
            <Stack gap="md" h="100%" justify="space-between">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={700} size="lg">
                    {workout.name}
                  </Text>
                  <Badge color={workout.type === 'freeRide' ? 'blue' : 'lime'}>
                    {workout.type === 'freeRide' ? 'Free Ride' : 'Structured'}
                  </Badge>
                </Group>
                <Text c="dimmed" size="sm">
                  {workout.description}
                </Text>
                <Text size="sm">Duration: {formatDuration(workout.durationSeconds)}</Text>
                <Text size="sm">Blocks: {workout.blocks.length || 'Open-ended'}</Text>
              </Stack>

              <Button
                onClick={() => {
                  dispatch(selectWorkout(workout.id));
                  dispatch(startWorkout(Date.now()));
                  navigate('/ride');
                }}
                radius="xl"
              >
                Start Workout
              </Button>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
