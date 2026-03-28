import { Divider, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { Fragment } from 'react';
import { IconCheck, IconCircleDot } from '@tabler/icons-react';

import type { AppScreen } from '../state/appSlice';

interface FlowStepperProps {
  connectComplete: boolean;
  currentScreen: AppScreen;
  workoutComplete: boolean;
}

interface StepConfig {
  description: string;
  key: AppScreen;
  label: string;
}

const STEPS: StepConfig[] = [
  {
    key: 'connect',
    label: 'Connect',
    description: 'Trainer setup and capability detection',
  },
  {
    key: 'workouts',
    label: 'Workout',
    description: 'Choose a workout',
  },
  {
    key: 'ride',
    label: 'Ride',
    description: 'Live telemetry and workout timing',
  },
];

function getStepState(
  step: StepConfig,
  props: FlowStepperProps
): 'complete' | 'active' | 'upcoming' {
  if (step.key === 'connect' && props.connectComplete) {
    return 'complete';
  }

  if (step.key === 'workouts' && props.workoutComplete) {
    return 'complete';
  }

  if (step.key === props.currentScreen) {
    return 'active';
  }

  return 'upcoming';
}

export function FlowStepper(props: FlowStepperProps) {
  return (
    <Group align="stretch" gap="sm" wrap="nowrap">
      {STEPS.map((step, index) => {
        const state = getStepState(step, props);
        const isComplete = state === 'complete';
        const isActive = state === 'active';

        return (
          <Fragment key={step.key}>
            <Paper
              p="md"
              radius="lg"
              style={{
                border: '1px solid rgba(255,255,255,0.08)',
                flex: 1,
                opacity: state === 'upcoming' ? 0.72 : 1,
              }}
            >
              <Group align="flex-start" gap="sm" wrap="nowrap">
                <ThemeIcon
                  color={isComplete ? 'green' : isActive ? 'lime' : 'gray'}
                  radius="xl"
                  size="lg"
                  variant={isActive ? 'filled' : 'light'}
                >
                  {isComplete ? <IconCheck size={18} /> : <IconCircleDot size={18} />}
                </ThemeIcon>
                <Stack gap={2}>
                  <Text fw={700} size="sm">
                    {step.label}
                  </Text>
                  <Text c="dimmed" size="xs">
                    {step.description}
                  </Text>
                </Stack>
              </Group>
            </Paper>
            {index < STEPS.length - 1 ? <Divider orientation="vertical" /> : null}
          </Fragment>
        );
      })}
    </Group>
  );
}
