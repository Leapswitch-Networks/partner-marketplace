import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { authApi } from "@/lib/api/authApi";
import { clearPersonalTheme } from "@/lib/hooks/usePersonalTheme";
import { extractApiError } from "@/lib/utils/apiError";
import type { CurrentUser } from "@/types";

interface AuthState {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  /** True until the first identity fetch settles — distinguishes "unknown" from "logged out". */
  initialising: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  initialising: true,
  loading: false,
  error: null,
};

export const updateUserProfile = createAsyncThunk(
  "auth/updateUserProfile",
  async (
    data: {
      first_name?: string;
      last_name?: string;
      designation?: string | null;
      employee_id?: string | null;
      personal_mobile_number?: string | null;
      personal_email?: string | null;
      company_name?: string | null;
      timezone_preference?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const res = await authApi.updateProfile(data);
      return res.data;
    } catch (err) {
      // Surface the server's own message rather than a generic one. The API
      // returns real reasons here — a malformed personal email, a field over its
      // length — and replacing them with "Failed to update profile" left the user
      // with no idea which field to fix.
      return rejectWithValue(extractApiError(err, "Failed to update profile"));
    }
  }
);

/**
 * Hydrate identity from the httpOnly cookie on mount.
 *
 * One endpoint now — there is a single account table, so there is nothing to
 * disambiguate. The response already carries resolved roles and permissions.
 */
export const fetchCurrentUser = createAsyncThunk(
  "auth/fetchCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      const res = await authApi.me();
      return res.data;
    } catch {
      return rejectWithValue("Unauthenticated");
    }
  }
);

export const logoutUser = createAsyncThunk("auth/logout", async () => {
  await authApi.logout();
  // 🔴 `localStorage` is per-origin, not per-user. Without this, the next person to
  // sign in on this browser sees the previous person's colours until hydration
  // finishes — which looks exactly like the bug where a page shows the wrong
  // account's data, and would be reported as one.
  clearPersonalTheme();
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<CurrentUser>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.initialising = false;
      state.error = null;
    },
    clearAuth(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.initialising = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.initialising = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.loading = false;
        state.initialising = false;
        state.isAuthenticated = false;
        state.user = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { setUser, clearAuth } = authSlice.actions;
export default authSlice.reducer;
