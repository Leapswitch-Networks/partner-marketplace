import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import testReducer from "./testSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    test: testReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
