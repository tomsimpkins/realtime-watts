import { configureStore, type UnknownAction } from '@reduxjs/toolkit';
import type { ThunkAction } from 'redux-thunk';

import trainerReducer from '../state/trainerSlice';

export const store = configureStore({
  reducer: {
    trainer: trainerReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  undefined,
  UnknownAction
>;
