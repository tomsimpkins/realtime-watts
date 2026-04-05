import {
	Badge,
	Button,
	Group,
	Paper,
	Stack,
	Text,
	ThemeIcon,
} from "@mantine/core";
import {
	IconAlertCircle,
	IconBluetooth,
	IconBolt,
	IconPlugConnected,
} from "@tabler/icons-react";

import { CapabilitiesPanel } from "./CapabilitiesPanel";
import type { TrainerCapabilityStatuses } from "../../../domain/trainer";
import type { ConnectSetupModel } from "../../state/selectors/trainerSelectors";

interface ConnectionPanelProps {
	onConnect: () => void;
	onContinue: () => void;
	onRetry: () => void;
	setup: ConnectSetupModel;
	statuses: TrainerCapabilityStatuses;
}

function getStatusIcon(tone: ConnectSetupModel["readinessTone"]) {
	switch (tone) {
		case "ready":
			return IconPlugConnected;
		case "checking":
			return IconBluetooth;
		case "attention":
			return IconAlertCircle;
		default:
			return IconBolt;
	}
}

function getStatusIconColor(tone: ConnectSetupModel["readinessTone"]) {
	switch (tone) {
		case "ready":
			return "accent";
		case "checking":
		case "attention":
			return "ember";
		default:
			return "dark";
	}
}

function getPrimaryActionLabel(setup: ConnectSetupModel) {
	switch (setup.showPrimaryAction) {
		case "continue":
			return "Continue";
		case "connecting":
			return "Connecting…";
		case "retry":
			return "Retry Setup";
		default:
			return "Connect Trainer";
	}
}

function getPrimaryActionHandler(
	setup: ConnectSetupModel,
	onConnect: () => void,
	onContinue: () => void,
	onRetry: () => void,
) {
	switch (setup.showPrimaryAction) {
		case "continue":
			return onContinue;
		case "retry":
			return onRetry;
		default:
			return onConnect;
	}
}

function getPrimaryActionDisabled(setup: ConnectSetupModel) {
	switch (setup.showPrimaryAction) {
		case "continue":
			return !setup.canContinue;
		case "connecting":
			return true;
		case "retry":
			return !setup.canReconnect;
		default:
			return !setup.canConnect;
	}
}

function getSecondaryActionLabel(setup: ConnectSetupModel) {
	switch (setup.showSecondaryAction) {
		case "reconnect":
			return "Reconnect";
		case "retry":
			return "Retry Setup";
		default:
			return null;
	}
}

export function ConnectionPanel({
	onConnect,
	onContinue,
	onRetry,
	setup,
	statuses,
}: ConnectionPanelProps) {
	const StatusIcon = getStatusIcon(setup.readinessTone);
	const secondaryActionLabel = getSecondaryActionLabel(setup);

	return (
		<Paper className="panel" p="xl" radius="32px">
			<Stack gap="lg">
				<Group align="flex-start" justify="space-between">
					<Text className="section-title">Trainer Setup</Text>
				</Group>

				<div
					className={`connection-status connection-status--${setup.readinessTone}`}
				>
					<ThemeIcon
						className="connection-status__icon"
						color={getStatusIconColor(setup.readinessTone)}
						radius="xl"
						size={44}
						variant="light"
					>
						<StatusIcon size={20} stroke={2.2} />
					</ThemeIcon>
					<div className="connection-status__copy">
						<Text className="connection-status__label">
							{setup.readinessLabel}
						</Text>
						<Text className="section-copy">{setup.readinessMessage}</Text>
					</div>
				</div>

				<Stack gap="sm">
					<Text className="setup-section-label">Device</Text>
					<div className="data-grid data-grid--single">
						<div className="data-chip data-chip--accent">
							<Text className="data-chip__value">
								{setup.deviceName ?? "No trainer selected yet"}
							</Text>
						</div>
					</div>
				</Stack>

				<Stack gap="sm">
					<Text className="setup-section-label">Capabilities</Text>
					<CapabilitiesPanel statuses={statuses} />
				</Stack>

				<Group className="action-row connection-actions">
					<Button
						className="button-primary"
						disabled={getPrimaryActionDisabled(setup)}
						onClick={getPrimaryActionHandler(
							setup,
							onConnect,
							onContinue,
							onRetry,
						)}
					>
						{getPrimaryActionLabel(setup)}
					</Button>
					{secondaryActionLabel ? (
						<Button
							className="button-quiet"
							disabled={!setup.canReconnect}
							onClick={onRetry}
						>
							{secondaryActionLabel}
						</Button>
					) : null}
				</Group>
			</Stack>
		</Paper>
	);
}
