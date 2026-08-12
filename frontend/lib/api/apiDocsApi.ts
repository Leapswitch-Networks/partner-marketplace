import axiosInstance from "./axiosInstance";

/**
 * The API catalogue (LeapDesk parity Module 15).
 *
 * A reader over the running application, not a second registry — FastAPI's
 * `/docs` and the committed `openapi.json` already describe the shapes. What
 * this adds is the permission gating each route, which OpenAPI cannot express
 * for us because our authorization is a dependency rather than a security scheme.
 */

export interface ApiOperation {
  method: string;
  path: string;
  name: string;
  summary: string;
  tag: string;
  /** More than one means the route accepts any of them. */
  permissions: string[];
  requires_auth: boolean;
  /** Neither authenticated nor permission-gated — reachable by anyone. */
  is_public: boolean;
}

export interface CatalogueSummary {
  operations: number;
  paths: number;
  tags: number;
  permission_gated: number;
  auth_only: number;
  public: number;
  /** Should always be empty. Anything here is a review item, not a statistic. */
  unexpected_public: string[];
}

export const apiDocsApi = {
  catalogue: () =>
    axiosInstance.get<{ summary: CatalogueSummary; operations: ApiOperation[] }>("/api-docs"),

  /** Permission → the routes it opens. "What does granting this let someone do?" */
  permissions: () =>
    axiosInstance.get<Record<string, string[]>>("/api-docs/permissions"),
};
