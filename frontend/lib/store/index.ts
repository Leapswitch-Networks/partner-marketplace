import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";

import { api } from "./api";
import authReducer from "./authSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [api.reducerPath]: api.reducer,
  },
  // RTK Query's middleware is what runs the cache: without it queries never
  // resolve, subscriptions never clean up, and `invalidatesTags` does nothing.
  // Concatenated rather than replacing the defaults — dropping
  // `serializableCheck` and friends to add one middleware is how a store loses
  // its dev-time guardrails.
  middleware: (getDefault) => getDefault().concat(api.middleware),
});

/**
 * Enables `refetchOnFocus` / `refetchOnReconnect` for any endpoint that opts in.
 *
 * Registered once, here, rather than per-component. Nothing opts in yet — this
 * is the switch, not the policy. Turning it on globally would refetch every
 * cached list every time the user alt-tabs back, which on an admin dashboard is
 * a lot of traffic for data that changes hourly.
 */
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
