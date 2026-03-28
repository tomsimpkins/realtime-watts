import { Stepper } from '@mantine/core';
import { IconCheck, IconCircleDot } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import type { AppScreen } from '../state/appSlice';

interface FlowStepperProps {
  activeStep: number;
  currentScreen: AppScreen;
  rideUnlocked: boolean;
  workoutsUnlocked: boolean;
}

interface StepConfig {
  description: string;
  key: AppScreen;
  label: string;
  path: string;
}

const STEPS: StepConfig[] = [
  {
    key: 'connect',
    label: 'Connect',
    description: 'Trainer setup',
    path: '/connect',
  },
  {
    key: 'workouts',
    label: 'Workout',
    description: 'Choose a workout',
    path: '/workouts',
  },
  {
    key: 'ride',
    label: 'Ride',
    description: 'Live metrics',
    path: '/ride',
  },
];

export function FlowStepper({
  activeStep,
  currentScreen,
  rideUnlocked,
  workoutsUnlocked,
}: FlowStepperProps) {
  const navigate = useNavigate();

  const selectableSteps: Record<AppScreen, boolean> = {
    connect: true,
    workouts: workoutsUnlocked,
    ride: rideUnlocked,
  };

  const handleStepClick = (stepIndex: number) => {
    const step = STEPS[stepIndex];

    if (!step || !selectableSteps[step.key]) {
      return;
    }

    if (step.key !== currentScreen) {
      navigate(step.path);
    }
  };

  return (
    <Stepper
      active={activeStep}
      classNames={{
        root: 'workflow-stepper',
        separator: 'workflow-stepper__separator',
        step: 'workflow-stepper__step',
        stepBody: 'workflow-stepper__body',
        stepDescription: 'workflow-stepper__description',
        stepIcon: 'workflow-stepper__icon',
        stepLabel: 'workflow-stepper__label',
        steps: 'workflow-stepper__steps',
      }}
      color="accent"
      completedIcon={<IconCheck size={16} stroke={2.6} />}
      iconSize={34}
      onStepClick={handleStepClick}
      size="sm"
    >
      {STEPS.map((step) => {
        const canSelect = selectableSteps[step.key];

        return (
          <Stepper.Step
            allowStepClick={canSelect}
            allowStepSelect={canSelect}
            data-testid={`workflow-step-${step.key}`}
            description={step.description}
            icon={<IconCircleDot size={14} stroke={2.4} />}
            key={step.key}
            label={step.label}
          />
        );
      })}
    </Stepper>
  );
}
