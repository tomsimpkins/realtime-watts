import { Alert } from '@mantine/core';
import {
  IconAlertCircle,
  IconBluetooth,
  IconBolt,
  IconPlugConnected,
} from '@tabler/icons-react';

interface StatusBannerProps {
  color: string;
  description: string;
  label: string;
}

function getStatusIcon(label: string) {
  switch (label) {
    case 'Connected':
      return <IconPlugConnected size={18} />;
    case 'Error':
      return <IconAlertCircle size={18} />;
    case 'Connecting':
    case 'Choose Trainer':
    case 'Starting Demo':
      return <IconBluetooth size={18} />;
    default:
      return <IconBolt size={18} />;
  }
}

export function StatusBanner({ color, description, label }: StatusBannerProps) {
  return (
    <Alert color={color} icon={getStatusIcon(label)} radius="lg" title={label}>
      {description}
    </Alert>
  );
}
