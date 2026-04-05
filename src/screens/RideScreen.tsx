import { Badge, Button, Group, Paper, Stack, Text } from "@mantine/core";
import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";

import { useAppDispatch, useAppSelector } from "../app/hooks";
import { PowerDisplay } from "../components/PowerDisplay";
import { RideStatsDisplay } from "../components/RideStatsDisplay";
import { StatusBanner } from "../components/StatusBanner";
import {
	selectCadenceDisplay,
	selectDistanceDisplay,
	selectPowerDisplay,
	selectRecentPowerHistogram,
	selectSpeedDisplay,
} from "../state/metricsSelectors";
import { retryTrainerConnection } from "../state/trainerThunks";
import { selectRideBannerModel } from "../state/trainerSelectors";
import { endWorkout, pauseWorkout, resumeWorkout } from "../state/workoutSlice";
import {
	selectCanEndWorkout,
	selectCanPauseWorkout,
	selectCanResumeWorkout,
	selectCurrentBlockRemainingLabel,
	selectWorkoutSummary,
} from "../state/workoutSelectors";

const PowerChart = lazy(() =>
	import("../components/PowerChart").then((module) => ({
		default: module.PowerChart,
	})),
);

export function RideScreen() {
	const dispatch = useAppDispatch();
	const navigate = useNavigate();
	const cadenceDisplay = useAppSelector(selectCadenceDisplay);
	const distanceDisplay = useAppSelector(selectDistanceDisplay);
	const canEnd = useAppSelector(selectCanEndWorkout);
	const canPause = useAppSelector(selectCanPauseWorkout);
	const canResume = useAppSelector(selectCanResumeWorkout);
	const currentBlockRemainingLabel = useAppSelector(
		selectCurrentBlockRemainingLabel,
	);
	const powerDisplay = useAppSelector(selectPowerDisplay);
	const recentPowerHistogram = useAppSelector(selectRecentPowerHistogram);
	const speedDisplay = useAppSelector(selectSpeedDisplay);
	const rideBanner = useAppSelector(selectRideBannerModel);
	const workoutSummary = useAppSelector(selectWorkoutSummary);

	const handleEndRide = () => {
		dispatch(endWorkout());
		navigate("/workouts");
	};

	const showCompletionCta = workoutSummary.status === "completed";

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

			<Paper className="panel" p="xl" radius="32px">
				<Stack gap="lg">
					<Group justify="space-between" align="flex-start">
						<div>
							<Text className="section-title">
								{workoutSummary.workoutName}
							</Text>
							<Text className="section-copy">
								{workoutSummary.currentBlockLabel}
							</Text>
						</div>
						<Badge
							color={workoutSummary.status === "completed" ? "ember" : "accent"}
						>
							{workoutSummary.status}
						</Badge>
					</Group>

					<div className="summary-grid">
						<div className="summary-card">
							<Text className="summary-card__label">Elapsed Time</Text>
							<Text className="summary-card__value">
								{workoutSummary.elapsedTimeLabel}
							</Text>
						</div>
						<div className="summary-card">
							<Text className="summary-card__label">Current Target</Text>
							<Text className="summary-card__value">
								{workoutSummary.currentTargetLabel}
							</Text>
						</div>
						<div className="summary-card">
							<Text className="summary-card__label">Block Remaining</Text>
							<Text className="summary-card__value">
								{currentBlockRemainingLabel}
							</Text>
						</div>
					</div>
				</Stack>
			</Paper>

			<PowerDisplay
				cadenceDisplay={cadenceDisplay}
				powerDisplay={powerDisplay}
			/>

			<RideStatsDisplay
				distanceDisplay={distanceDisplay}
				speedDisplay={speedDisplay}
			/>

			<Suspense
				fallback={
					<Paper className="chart-shell" p="xl" radius="32px">
						<Text c="dimmed" size="sm">
							Loading chart…
						</Text>
					</Paper>
				}
			>
				<PowerChart bins={recentPowerHistogram} />
			</Suspense>

			<Group className="action-row">
				{canPause ? (
					<Button
						className="button-quiet"
						onClick={() => dispatch(pauseWorkout(Date.now()))}
					>
						Pause
					</Button>
				) : null}
				{canResume ? (
					<Button
						className="button-quiet"
						onClick={() => dispatch(resumeWorkout(Date.now()))}
					>
						Resume
					</Button>
				) : null}
				{rideBanner ? (
					<Button
						className="button-primary"
						onClick={() => {
							void dispatch(retryTrainerConnection());
						}}
					>
						Retry Trainer
					</Button>
				) : null}
				{canEnd && !showCompletionCta ? (
					<Button className="button-secondary" onClick={handleEndRide}>
						End Ride
					</Button>
				) : null}
				{showCompletionCta ? (
					<Button className="button-primary" onClick={handleEndRide}>
						Choose Another Workout
					</Button>
				) : null}
			</Group>
		</Stack>
	);
}
