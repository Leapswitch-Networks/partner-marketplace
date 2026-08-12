"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { buttonClasses } from "@/components/common/Button";
import { Card, CardContent, CardHeader } from "@/components/common/Card";
import ErrorState from "@/components/common/ErrorState";
import FilterCombobox from "@/components/common/FilterCombobox";
import Skeleton from "@/components/common/Skeleton";
import Toast, { useToast } from "@/components/common/Toast";
import SettingRowEditor from "@/components/admin/SettingRowEditor";
import { navIcon } from "@/components/dashboard/navIcons";
import configurationApi, { type Setting } from "@/lib/api/configurationApi";
import usePermissions from "@/lib/hooks/usePermissions";
import { extractApiError } from "@/lib/utils/apiError";

/**
 * Configuration — the settings registry (LeapDesk parity, Module 11).
 *
 * ## Why this is not `ResourceIndex`
 *
 * `UI_PATTERNS.md` § The module CRUD contract makes the Users index the shape for
 * every module, and **this is one of the deviations that section explicitly
 * allows** — *"parity means the same vocabulary, not the same feature list"*.
 *
 * The reference does not render a table here either, and its reasons are the same
 * ones: there is no create, no delete and no row to open. Every setting is edited
 * **in place**, and the five types need five different editors — a toggle, a
 * number, a line of text, a textarea, a JSON box. A data table's job is to let you
 * compare rows and pick one; nobody compares settings, they find the one they came
 * for and change it. Grouped headings do that better than a sortable grid.
 *
 * What it **does** keep from the contract: the Card shell, `FilterCombobox`, the
 * house `Button` and `Badge`, the toast, and the ink tokens. Those are the
 * vocabulary, and they are not optional.
 *
 * `MODULE_PARITY_PLAN.md` § The CRUD shape does not fit all eight lists this
 * module as *Index ✅* — that entry is wrong and is corrected there.
 */

/** Options for the module filter. `""` clears back to everything. */
const ALL_MODULES = "";

export default function ConfigurationModule() {
  const { can } = usePermissions();
  const { toasts, show, dismiss } = useToast();

  const [rows, setRows] = useState<Setting[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [moduleFilter, setModuleFilter] = useState(ALL_MODULES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*
    Not `useResourceList`. That hook owns paging and a `Page[T]` envelope, and
    this endpoint returns the whole registry unpaged with two extra fields the
    filters need. Wrapping it would mean making `total` and `pages` optional on a
    hook four modules depend on, to serve the one caller that has neither.

    The filter is applied **client-side** even though the API accepts `?module=`:
    ten rows are already in memory, so re-fetching to hide six of them is a round
    trip that buys nothing. The query parameter stays on the API because a
    future integration reading one module's settings should not have to fetch
    everyone's.
  */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await configurationApi.list();
      setRows(res.data.items);
      setModules(res.data.modules);
    } catch (err) {
      setError(extractApiError(err, "Could not load configuration."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Handed to a callback rather than called in the body. `load` sets state,
    // and calling it here would run those updates inside the effect's own
    // synchronous phase — one microtask's remove is what makes them ordinary
    // updates instead of a cascading second pass.
    void Promise.resolve().then(load);
  }, [load]);

  /** Replace one row in place after a save — the response is the updated record. */
  const patch = useCallback((next: Setting) => {
    setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
  }, []);

  /**
   * `module · group`, preserving the server's ordering.
   *
   * The API already sorts `module → group → label`, so inserting into a Map in
   * arrival order gives the right section order for free. Re-sorting here would
   * be a second opinion about an ordering the server already holds.
   */
  const sections = useMemo(() => {
    const out = new Map<string, Setting[]>();
    for (const row of rows) {
      if (moduleFilter && row.module !== moduleFilter) continue;
      const heading = `${row.module} · ${row.group}`;
      const bucket = out.get(heading);
      if (bucket) bucket.push(row);
      else out.set(heading, [row]);
    }
    return Array.from(out.entries());
  }, [rows, moduleFilter]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Card bordered={false}>
        <CardHeader
          icon={navIcon("configuration")}
          title="Configuration"
          description="One settings store for the whole platform. Every change is recorded in the activity log."
          actions={
            /*
              **This button is the only route to Feature Flags**, and that is
              deliberate rather than an oversight.

              LeapDesk has no sidebar entry for feature flags either — it lists
              `/settings/feature-flags` among Configuration's `activePrefixes` and
              reaches it from exactly this button, so Configuration stays
              highlighted while you are there. Two sibling nav entries for one
              settings surface is a longer sidebar that says less.

              Which means: if this button is ever removed, the page becomes
              unreachable. It is not decoration.
            */
            can("feature-flag-view") ? (
              <Link href="/dashboard/feature-flags" className={buttonClasses("outline")}>
                {navIcon("featureFlags")}
                Feature flags
              </Link>
            ) : undefined
          }
        />

        <CardContent>
          <div className="flex shrink-0 flex-wrap items-center gap-2 pb-3">
            <div className="w-[220px]">
              <FilterCombobox
                options={modules.map((m) => ({ value: m, label: m }))}
                value={moduleFilter}
                onChange={setModuleFilter}
                placeholder="All modules"
                searchPlaceholder="Search modules..."
                label="Filter by module"
              />
            </div>
          </div>

          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            {loading && (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}

            {!loading && error && (
              <ErrorState
                error={new Error(error)}
                reset={load}
                title="Could not load configuration"
                compact
              />
            )}

            {!loading && !error && sections.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-ink dark:text-gray-200">
                  No settings registered
                </p>
                <p className="mt-2 text-xs text-ink-label dark:text-night-muted">
                  {/* Two different empty states, because they are two different
                      situations and only one of them is a problem. */}
                  {moduleFilter
                    ? "No settings in this module yet."
                    : "Modules declare their settings here as they adopt the registry."}
                </p>
              </div>
            )}

            {!loading &&
              !error &&
              sections.map(([heading, settings]) => (
                <section key={heading} className="mb-6">
                  <div className="mb-3 border-b border-brand/20 pb-2 dark:border-night-border">
                    <h3 className="text-sm font-bold text-ink dark:text-white">{heading}</h3>
                  </div>
                  <div className="flex flex-col gap-3">
                    {settings.map((setting) => (
                      <SettingRowEditor
                        key={setting.id}
                        setting={setting}
                        save={async (id, value) =>
                          (await configurationApi.update(id, value)).data
                        }
                        onSaved={patch}
                        onError={(message) => show(message, "error")}
                      />
                    ))}
                  </div>
                </section>
              ))}
          </div>
        </CardContent>
      </Card>

      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
