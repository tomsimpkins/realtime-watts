import {
	combineReducers,
	configureStore,
	type UnknownAction,
} from "@reduxjs/toolkit";
import type { ThunkAction } from "redux-thunk";

import appReducer from "../adapters/state/appSlice";
import metricsReducer from "../adapters/state/metricsSlice";
import trainerReducer from "../adapters/state/trainerSlice";
import workoutReducer from "../adapters/state/workoutSlice";
import { listenerMiddleware } from "./listenerMiddleware";

const rootReducer = combineReducers({
	app: appReducer,
	metrics: metricsReducer,
	trainer: trainerReducer,
	workout: workoutReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export type DeepPartial<T> = {
	[K in keyof T]?: T[K] extends Array<infer _Value>
		? T[K]
		: T[K] extends object
			? DeepPartial<T[K]>
			: T[K];
};

export function createAppStore(preloadedState?: DeepPartial<RootState>) {
	const store = configureStore({
		reducer: rootReducer,
		middleware: (getDefaultMiddleware) =>
			getDefaultMiddleware().prepend(listenerMiddleware.middleware),
		preloadedState: preloadedState as RootState | undefined,
	});

	return store;
}

export const store = createAppStore();

export type AppStore = typeof store;
export type AppDispatch = AppStore["dispatch"];
export type AppThunk<ReturnType = void> = ThunkAction<
	ReturnType,
	RootState,
	undefined,
	UnknownAction
>;
