"use client";

import { useEffect, useMemo, useState } from "react";

import Badge from "@/components/common/Badge";
import { Card, CardContent } from "@/components/common/Card";
import StatTiles from "@/components/common/StatTiles";
import Input from "@/components/common/Input";
import { navIcon } from "@/components/dashboard/navIcons";
import { apiDocsApi, type ApiOperation, type CatalogueSummary } from "@/lib/api/apiDocsApi";
import { extractApiError } from "@/lib/utils/apiError";

/**
 * The API catalogue — every route, and the permission that gates it.
 *
 * **Not a Swagger clone.** FastAPI already serves `/docs`, and `openapi.json` is
 * committed and CI-checked; rebuilding a request explorer would be a third copy
 * of the same information. What none of those show is **which permission a route
 * requires**, because our authorization is a dependency rather than an OpenAPI
 * security scheme — and that is the fact anyone reviewing access actually needs.
 *
 * The number to read is **Public**. It should be a handful of routes that are
 * unauthenticated by necessity — signing in, accepting an invitation — and the
 * page says so rather than leaving a reader to judge. Anything unexpected is
 * shown in red at the top, and a test fails on it too.
 */

const METHOD_TONE = {
  GET: "info",
  POST: "success",
  PUT: "warning",
  PATCH: "warning",
  DELETE: "danger",
} as const;

export default function ApiDocsModule() {
  const [operations, setOperations] = useState<ApiOperation[]>([]);
  const [summary, setSummary] = useState<CatalogueSummary | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await apiDocsApi.catalogue();
        if (live) {
          setOperations(res.data.operations);
          setSummary(res.data.summary);
        }
      } catch (err) {
        if (live) setError(extractApiError(err, "Could not load the API catalogue."));
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matching = term
      ? operations.filter(
          (op) =>
            op.path.toLowerCase().includes(term) ||
            op.tag.toLowerCase().includes(term) ||
            op.permissions.some((p) => p.toLowerCase().includes(term))
        )
      : operations;

    const groups = new Map<string, ApiOperation[]>();
    for (const op of matching) {
      const existing = groups.get(op.tag);
      if (existing) existing.push(op);
      else groups.set(op.tag, [op]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [operations, search]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 text-brand dark:text-brand-on-dark">{navIcon("apiDocs")}</span>
        <div>
          <h1 className="text-lg font-semibold text-ink dark:text-gray-100">API Documentation</h1>
          <p className="text-xs text-ink-label dark:text-night-muted">
            Every route this application serves, and the permission that gates it
          </p>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-xs text-tone-danger"
        >
          {error}
        </div>
      )}

      {summary && (
        <>
          {/* `Public` carries a tone because it is the one number here that is a
              finding rather than a fact — an unexpected public route is the thing
              this page exists to catch, and the banner below reports on the same
              set. The other four are neutral counts. */}
          <StatTiles
            items={[
              { label: "Operations", value: summary.operations, hint: `${summary.paths} paths` },
              { label: "Permission-gated", value: summary.permission_gated, tone: "success", hint: "require a named permission" },
              { label: "Signed in only", value: summary.auth_only, hint: "authenticated, no specific permission" },
              {
                label: "Public",
                value: summary.public,
                tone: summary.unexpected_public.length > 0 ? "danger" : "warning",
                hint: "reachable by anyone",
              },
              { label: "Sections", value: summary.tags, hint: "grouped by module" },
            ]}
          />

          {summary.unexpected_public.length > 0 ? (
            <div
              role="alert"
              className="rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-xs text-tone-danger"
            >
              <p className="font-semibold">
                {summary.unexpected_public.length} route(s) are reachable without signing in and
                were not expected to be:
              </p>
              <ul className="mt-1 font-mono">
                {summary.unexpected_public.map((route) => (
                  <li key={route}>{route}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[11px] text-ink-label dark:text-night-muted">
              Every public route is one that has to be — signing in, accepting an invitation, the
              branding the sign-in page renders. Nothing unexpected is reachable unauthenticated.
            </p>
          )}
        </>
      )}

      <Input
        label="Filter"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Filter by path, section or permission…"
      />

      {loading ? (
        <p className="py-6 text-center text-xs text-ink-label dark:text-night-muted">Loading…</p>
      ) : (
        grouped.map(([tag, ops]) => (
          <Card key={tag}>
            <CardContent>
              <h2 className="pt-1 text-sm font-semibold text-ink dark:text-gray-100">
                {tag}{" "}
                <span className="font-normal text-ink-label dark:text-night-muted">
                  ({ops.length})
                </span>
              </h2>
              <ul className="flex flex-col gap-1 py-2">
                {ops.map((op) => (
                  <li
                    key={`${op.method}-${op.path}`}
                    className="flex flex-wrap items-baseline gap-2 rounded-[5px] px-1.5 py-1 hover:bg-brand/10"
                  >
                    <Badge tone={METHOD_TONE[op.method as keyof typeof METHOD_TONE] ?? "neutral"}>
                      {op.method}
                    </Badge>
                    <span className="font-mono text-xs text-ink dark:text-gray-200">{op.path}</span>
                    {op.permissions.length > 0 ? (
                      <span className="font-mono text-[11px] text-brand dark:text-brand-on-dark">
                        {op.permissions.join(" or ")}
                      </span>
                    ) : op.requires_auth ? (
                      <span className="text-[11px] text-ink-label dark:text-night-muted">
                        signed in
                      </span>
                    ) : (
                      <Badge tone="warning">public</Badge>
                    )}
                    {op.summary && (
                      <span className="w-full text-[11px] text-ink-label dark:text-night-muted">
                        {op.summary}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
