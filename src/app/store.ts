import {
  combineReducers,
  configureStore,
  type UnknownAction,
} from '@reduxjs/toolkit';
import type { ThunkAction } from 'redux-thunk';

import appReducer from '../state/appSlice';
import metricsReducer from '../state/metricsSlice';
import trainerReducer from '../state/trainerSlice';
import workoutReducer from '../state/workoutSlice';
import { listenerMiddleware } from './listenerMiddleware';
import { registerWorkoutListeners } from '../state/workoutListeners';

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

let listenersRegistered = false;

export function createAppStore(preloadedState?: DeepPartial<RootState>) {
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(listenerMiddleware.middleware),
    preloadedState: preloadedState as RootState | undefined,
  });

  if (!listenersRegistered) {
    registerWorkoutListeners(listenerMiddleware.startListening);
    listenersRegistered = true;
  }

  return store;
}

export const store = createAppStore();

export type AppStore = typeof store;
export type AppDispatch = AppStore['dispatch'];
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  undefined,
  UnknownAction
>;
