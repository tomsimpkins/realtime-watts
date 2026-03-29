import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { useAppDispatch } from "./hooks";
import { getScreenFromPath } from "../state/appSelectors";
import { setCurrentScreen } from "../state/appSlice";

export function RouteStateSynchronizer() {
	const dispatch = useAppDispatch();
	const location = useLocation();

	useEffect(() => {
		dispatch(setCurrentScreen(getScreenFromPath(location.pathname)));
	}, [dispatch, location.pathname]);

	return null;
}
