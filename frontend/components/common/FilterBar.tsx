"use client";

import type { ReactNode } from "react";

import Input from "@/components/common/Input";
import Select from "@/components/common/Select";
import { FilterRow } from "@/components/common/Card";
import type { FilterValues, ResourceQuery } from "@/lib/hooks/useResourceQuery";

/**
 * Declarative filter bar for an index page.
 *
 * A module describes its filters as data and gets the markup, the widths, the
 * reset button and the disabled states for free. Previously each module hand-wrote
 * this block — `UsersModule` had 50 lines of it, and the same 50 lines would have
 * been pasted into the seven modules still to be built.
 *
 * The reference implementation has **no equivalent**: its `components/` directory
 * ships only a `filter-reset-button`, and every index page writes its own bar
 * inline. That is a large part of why its Users index is 936 lines. This is one of
 * the few places we deliberately build something it does not have — see
 * `CORE_COMPLETION_PLAN.md` § 1.1, which keeps behaviour at parity while allowing
 * the implementation to be better.
 *
 * Rendering rules kept from the hand-written version, because they were right:
 *
 *  - **Reset is always visible, and disabled when nothing is active.** A control
 *    that appears and disappears makes the row jump; a disabled one does not, and
 *    it tells the user the feature exists before they need it.
 *  - **Text filters flex, controls stay narrow.** `min-w` per field stops a long
 *    placeholder collapsing a neighbour on a narrow viewport.
 *  - **Every field carries an accessible name.** These have no visible `<label>`,
 *    so without `aria-label` a screen reader announces four unnamed comboboxes.
 */

export interface TextFilter<F extends FilterValues> {
  type: "text";
  key: keyof F;
  placeholder: string;
  /** Accessible name. Falls back to the placeholder. */
  label?: string;
  minWidth?: number;
}

export interface DateFilter<F extends FilterValues> {
  type: "date";
  key: keyof F;
  /** Accessible name — "From", "To". These have no visible label. */
  label: string;
  minWidth?: number;
}

export interface SelectFilter<F extends FilterValues> {
  type: "select";
  key: keyof F;
  /** Empty-valued first option — "All statuses". */
  placeholder: string;
  label?: string;
  options: { value: string; label: string }[];
  minWidth?: number;
  /**
   * Hide the control entirely. For a filter whose options are permission-gated
   * or still loading — an empty dropdown is worse than no dropdown.
   */
  hidden?: boolean;
}

/**
 * A boolean filter, as a checkbox. Stored as `"1"` / `""` rather than a real
 * boolean so the whole filter record stays `Record<string, string>` — which is
 * what makes the query-string round-trip lossless.
 */
export interface CheckFilter<F extends FilterValues> {
  type: "check";
  key: keyof F;
  label: string;
}

export type FilterDef<F extends FilterValues> =
  | TextFilter<F>
  | SelectFilter<F>
  | DateFilter<F>
  | CheckFilter<F>;

export default function FilterBar<F extends FilterValues>({
  query,
  filters,
  children,
}: {
  query: ResourceQuery<F>;
  filters: FilterDef<F>[];
  /** Extra controls placed before Reset — an export button, a view toggle. */
  children?: ReactNode;
}) {
  return (
    <FilterRow>
      {filters.map((filter) => {
        if (filter.type === "select" && filter.hidden) return null;
        const key = String(filter.key);

        // A checkbox sizes to its label rather than sharing the flex row, or a
        // two-word control gets the same width as a search box.
        if (filter.type === "check") {
          return (
            <label
              key={key}
              className="flex shrink-0 items-center gap-1.5 text-xs text-ink dark:text-gray-300"
            >
              <input
                type="checkbox"
                checked={query.filters[filter.key] === "1"}
                onChange={(e) => query.setFilter(filter.key, e.target.checked ? "1" : "")}
                className="h-3.5 w-3.5 accent-brand"
              />
              {filter.label}
            </label>
          );
        }

        const width =
          filter.minWidth ?? (filter.type === "text" ? 180 : filter.type === "date" ? 150 : 140);

        return (
          <div
            key={key}
            className="flex-1"
            style={{ minWidth: `${width}px` }}
          >
            {filter.type === "date" ? (
              <Input
                label=""
                type="date"
                id={`filter-${key}`}
                aria-label={filter.label}
                value={query.filters[filter.key]}
                onChange={(e) => query.setFilter(filter.key, e.target.value)}
                className="!h-9 !py-0 !text-xs"
              />
            ) : filter.type === "text" ? (
              <Input
                label=""
                id={`filter-${key}`}
                aria-label={filter.label ?? filter.placeholder}
                placeholder={filter.placeholder}
                value={query.filters[filter.key]}
                onChange={(e) => query.setFilter(filter.key, e.target.value)}
                className="!h-9 !py-0 !text-xs"
              />
            ) : (
              <Select
                aria-label={filter.label ?? filter.placeholder}
                placeholder={filter.placeholder}
                options={filter.options}
                value={query.filters[filter.key]}
                onChange={(e) => query.setFilter(filter.key, e.target.value)}
              />
            )}
          </div>
        );
      })}

      {children}

      <button
        type="button"
        onClick={query.resetFilters}
        disabled={!query.filtersActive}
        className="h-9 shrink-0 rounded-[5px] border border-brand/20 px-3 text-xs font-medium text-ink-label transition-colors hover:bg-brand/10 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 dark:border-night-border dark:text-gray-400 dark:hover:bg-brand/20 dark:hover:text-brand-on-dark"
      >
        Reset
      </button>
    </FilterRow>
  );
}
