import { useEffect } from "react";

import { useAppDispatch } from "./app/hooks";
import { AppRouter } from "./app/router";
import { refreshTrainerEnvironment } from "./adapters/state/trainerThunks";

export default function App() {
	const dispatch = useAppDispatch();

	useEffect(() => {
		dispatch(refreshTrainerEnvironment());
	}, [dispatch]);

	return <AppRouter />;
}
