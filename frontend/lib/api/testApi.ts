import axiosInstance from "./axiosInstance";
import type { Question, Test, TestSession } from "@/types";

export const testApi = {
  listTests: () => axiosInstance.get<Test[]>("/api/tests"),

  getTest: (id: string) => axiosInstance.get<Test>(`/api/tests/${id}`),

  getQuestions: (testId: string) =>
    axiosInstance.get<Question[]>(`/api/tests/${testId}/questions`),

  startSession: (testId: string) =>
    axiosInstance.post<TestSession>("/api/sessions", { test_id: testId }),
};
