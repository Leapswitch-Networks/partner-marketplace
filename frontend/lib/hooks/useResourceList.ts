"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { extractApiError } from "@/lib/utils/apiError";

/** The envelope every list endpoint returns. Matches `Page[T]` on the API side. */
export interface PageEnvelope<T> {
  items: T[];
  total: number;
  pages: number;
}

/**
 * Fetch state for a paged list: rows, total, pages, loading, error, refetch.
 *
 * Every index module was writing the same twenty lines — five `useState`s, a
 * `useCallback` wrapping try/catch/finally, and a `useEffect` gated on
 * `query.ready`. Users, Invitations and Activity had three copies that differed
 * only in which API they called and what the error message said.
 *
 * ## The two rules it encodes
 *
 * **1. It does not fetch until `ready`.** `useResourceQuery` reads the initial
 * filters out of the query string on mount, so a fetch before that fires with
 * default filters and is immediately repeated with the real ones — a wasted round
 * trip, and a visible flash of the wrong rows on a deep link.
 *
 * **2. A failed fetch does not blank the table.** `rows` is left alone on error,
 * so a refresh that 500s shows the last good data with an error beside it rather
 * than an empty state that looks like "you have no users".
 *
 * ## Usage
 *
 *     const q = useResourceQuery({ … });
 *     const list = useResourceList<ManagedUser>({
 *       ready: q.ready,
 *       deps: [q.applied, q.sortBy, q.sortOrder, q.page, q.perPage],
 *       errorMessage: "Could not load users.",
 *       fetch: () => adminApi.listUsers({ …, page: q.page, per_page: q.perPage }).then((r) => r.data),
 *     });
 *
 * Then hand `list.rows`, `list.loading`, `list.error`, `list.total`, `list.pages`
 * and `list.refetch` to `ResourceIndex`.
 *
 * `patchRow` is what a row action uses after a write returns the updated record:
 * it replaces that row in place, so the table reflects the change without a round
 * trip that would only re-fetch what you are already holding.
 */
/**
 * `string | number`, matching the table's own `RowId`. Users and Invitations are
 * UUID strings; Roles and Activity are bigint primary keys. A `string`-only
 * constraint here would exclude half the modules from the hook for no reason —
 * nothing in it does anything to an id but compare it.
 */
export function useResourceList<T extends { id: string | number }>({
  ready = true,
  deps,
  fetch,
  errorMessage,
}: {
  /** Gate. Pass `query.ready` — see rule 1. */
  ready?: boolean;
  /**
   * Everything the fetch reads — refetch when any of it changes.
   *
   * Compared by value, not by identity, so `q.applied` being a fresh object each
   * render does not cause a loop. That means the contents must be
   * **JSON-serializable**: query parameters, which is all this is ever given.
   * Passing a function or a class instance here would compare equal forever and
   * the list would stop refetching.
   */
  deps: unknown[];
  fetch: () => Promise<PageEnvelope<T>>;
  /** Shown when the request fails and the server sent nothing more specific. */
  errorMessage: string;
}) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*
    `fetch` is a fresh closure on every render — it captures the current filters —
    so `refetch` cannot depend on it without refetching in a loop. It is held in a
    ref instead, refreshed on each commit, and `refetch` stays **stable for the
    life of the component**.

    That stability is not incidental. `refetch` is handed out as `onRetry` and as
    a bulk action's `onChanged`, and an unstable one would change the identity of
    every callback built from it.

    The ref is updated in an effect declared *before* the fetching effect below,
    so on any commit where both run, the pointer is current before the fetch
    fires. Assigning during render would be the other way to do it, and is a
    mutation during render.
  */
  const fetchRef = useRef(fetch);
  useEffect(() => {
    fetchRef.current = fetch;
  });

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchRef.current();
      setRows(page.items);
      setTotal(page.total);
      setPages(page.pages);
    } catch (err) {
      // Rule 2: `rows` is deliberately not cleared.
      setError(extractApiError(err, errorMessage));
    } finally {
      setLoading(false);
    }
    // `errorMessage` is a string literal at every call site, so this stays stable
    // in practice — unlike `fetch`, which is a new closure each render and is why
    // that one needs the ref above.
  }, [errorMessage]);

  /*
    Compared by value. `deps` cannot be spread into a dependency array — the
    React Compiler's lint requires a literal — and `q.applied` is a new object
    every render, so identity comparison would loop regardless. Serialising is
    what makes "the filters actually changed" the trigger rather than "something
    re-rendered".
  */
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    if (!ready) return;
    // Deferred by a microtask. `refetch` sets `loading` before it awaits, so
    // calling it here put that update inside the effect's synchronous phase —
    // and this hook is used by every index in the app, so it was one error
    // reported once and a second render pass on twelve screens.
    void Promise.resolve().then(refetch);
  }, [depsKey, ready, refetch]);

  /** Replace one row in place, from the record a write returned. */
  const patchRow = useCallback((next: T) => {
    setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
  }, []);

  return { rows, total, pages, loading, error, refetch, patchRow, setRows };
}

export default useResourceList;
