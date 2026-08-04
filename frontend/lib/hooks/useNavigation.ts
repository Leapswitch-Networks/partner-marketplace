"use client";

import { useEffect, useState } from "react";
import { navigationApi } from "@/lib/api/navigationApi";
import useAppSelector from "@/lib/hooks/useAppSelector";
import type { NavigationSection } from "@/types";

interface NavState {
  sections: NavigationSection[];
  loading: boolean;
  failed: boolean;
}

/**
 * The signed-in user's sidebar, fetched from the server.
 *
 * Keyed on the user id rather than fetched once on mount: the tree depends on the
 * user's roles, so signing in as someone else must refetch. Without that, a second
 * sign-in in the same tab would render the previous user's navigation.
 *
 * Returns no sections while loading and on failure. The Sidebar renders nothing for
 * an empty tree, which is the right failure mode — a nav built from a stale or
 * guessed tree would show items the API refuses, which is exactly the
 * two-sources-of-truth problem the server-driven nav exists to remove.
 */
export default function useNavigation() {
  const userId = useAppSelector((s) => s.auth.user?.id ?? null);

  const [state, setState] = useState<NavState>({
    sections: [],
    // Seeded from whether there is anyone to fetch for, so the effect does not
    // have to flip it synchronously on mount.
    loading: Boolean(userId),
    failed: false,
  });

  useEffect(() => {
    if (!userId) return;

    // A cancellation flag rather than an AbortController: this guards against
    // writing state after unmount, which matters because the sidebar unmounts on
    // sign-out while a request may still be in flight.
    let cancelled = false;

    // Every setState below happens after an await, deliberately. Setting state
    // synchronously in an effect body triggers a cascading render, which is what
    // `react-hooks/set-state-in-effect` is pointing at — and here it was also
    // redundant, since the initial state can carry the loading flag itself.
    void (async () => {
      try {
        const res = await navigationApi.get();
        if (!cancelled) {
          setState({ sections: res.data.sections, loading: false, failed: false });
        }
      } catch {
        if (!cancelled) {
          setState({ sections: [], loading: false, failed: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    // Derived rather than cleared in an effect: signing out should empty the nav
    // immediately, not one render later.
    sections: userId ? state.sections : [],
    loading: state.loading,
    failed: state.failed,
  };
}
