import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type AppScreen = 'connect' | 'workouts' | 'ride';

export interface AppState {
  currentScreen: AppScreen;
}

const initialState: AppState = {
  currentScreen: 'connect',
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setCurrentScreen(state, action: PayloadAction<AppScreen>) {
      state.currentScreen = action.payload;
    },
  },
});

export const { setCurrentScreen } = appSlice.actions;

export default appSlice.reducer;
