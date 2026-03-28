import { createListenerMiddleware } from '@reduxjs/toolkit';

export const listenerMiddleware = createListenerMiddleware();

export type AppStartListening = typeof listenerMiddleware.startListening;
