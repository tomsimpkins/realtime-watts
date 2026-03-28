import { Text, ThemeIcon } from '@mantine/core';
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
    description: 'Live telemetry and timing',
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
    <div className="stepper">
      {STEPS.map((step) => {
        const state = getStepState(step, props);
        const iconColor =
          state === 'complete' ? 'ember' : state === 'active' ? 'accent' : 'dark';

        return (
          <div className={`stepper-item stepper-item--${state}`} key={step.key}>
            <ThemeIcon color={iconColor} radius="xl" size="lg" variant="light">
              {state === 'complete' ? <IconCheck size={18} /> : <IconCircleDot size={18} />}
            </ThemeIcon>
            <div className="stepper-copy">
              <Text className="stepper-title">{step.label}</Text>
              <Text className="stepper-description">{step.description}</Text>
            </div>
          </div>
        );
      })}
    </div>
  );
}
