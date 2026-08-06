// 8002, not 8000. The framework defaults (:3000 / :8000) are too often already
// taken, so this project runs the API on 8002 and the frontend on 3001 — see
// README § Quick Start. The fallback said 8000, which meant a developer with no
// NEXT_PUBLIC_API_URL set got connection-refused against a port nothing serves,
// and the symptom ("the app is broken") points nowhere near the cause.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002";
