import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { authApi } from "@/lib/api/authApi";
import type { AdminUser, User } from "@/types";

interface AuthState {
  user: User | AdminUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

export const updateUserProfile = createAsyncThunk(
  "auth/updateUserProfile",
  async (data: { name: string; email: string }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      const isAdmin = state.auth.user && "full_name" in state.auth.user;
      if (isAdmin) {
        const res = await authApi.adminUpdateProfile({ full_name: data.name, email: data.email });
        return res.data as AdminUser | User;
      }
      const res = await authApi.updateProfile(data);
      return res.data as AdminUser | User;
    } catch {
      return rejectWithValue("Failed to update profile");
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  "auth/fetchCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      const res = await authApi.whoami();
      return res.data.user as AdminUser | User;
    } catch {
      return rejectWithValue("Unauthenticated");
    }
  }
);

export const logoutUser = createAsyncThunk("auth/logout", async () => {
  await authApi.logout();
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User | AdminUser>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.error = null;
    },
    clearAuth(state) {
      state.user = null;
      state.isAuthenticated = false;
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
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.loading = false;
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
