import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { testApi } from "@/lib/api/testApi";
import type { Question, Test } from "@/types";

interface TestState {
  tests: Test[];
  testsLoading: boolean;
  testsError: string | null;
  testInfo: Test | null;
  questions: Question[];
  currentIndex: number;
  answers: Record<string, string>;
  flagged: string[];
  timeRemaining: number;
  status: "idle" | "in_progress" | "submitted";
}

const initialState: TestState = {
  tests: [],
  testsLoading: false,
  testsError: null,
  testInfo: null,
  questions: [],
  currentIndex: 0,
  answers: {},
  flagged: [],
  timeRemaining: 0,
  status: "idle",
};

export const fetchTests = createAsyncThunk(
  "test/fetchTests",
  async (_, { rejectWithValue }) => {
    try {
      const res = await testApi.listTests();
      return res.data;
    } catch {
      return rejectWithValue("Failed to load tests");
    }
  }
);

const testSlice = createSlice({
  name: "test",
  initialState,
  reducers: {
    setAnswer(state, action: PayloadAction<{ questionId: string; answer: string }>) {
      state.answers[action.payload.questionId] = action.payload.answer;
    },
    toggleFlag(state, action: PayloadAction<string>) {
      const idx = state.flagged.indexOf(action.payload);
      if (idx === -1) state.flagged.push(action.payload);
      else state.flagged.splice(idx, 1);
    },
    setCurrentIndex(state, action: PayloadAction<number>) {
      state.currentIndex = action.payload;
    },
    tickTimer(state) {
      if (state.timeRemaining > 0) state.timeRemaining -= 1;
    },
    setStatus(state, action: PayloadAction<TestState["status"]>) {
      state.status = action.payload;
    },
    resetTest(state) {
      state.testInfo = null;
      state.questions = [];
      state.currentIndex = 0;
      state.answers = {};
      state.flagged = [];
      state.timeRemaining = 0;
      state.status = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTests.pending, (state) => {
        state.testsLoading = true;
        state.testsError = null;
      })
      .addCase(fetchTests.fulfilled, (state, action) => {
        state.testsLoading = false;
        state.tests = action.payload;
      })
      .addCase(fetchTests.rejected, (state, action) => {
        state.testsLoading = false;
        state.testsError = action.payload as string;
      });
  },
});

export const { setAnswer, toggleFlag, setCurrentIndex, tickTimer, setStatus, resetTest } =
  testSlice.actions;
export default testSlice.reducer;
