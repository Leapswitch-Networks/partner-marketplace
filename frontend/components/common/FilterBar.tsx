"use client";

import type { ReactNode } from "react";

import FilterCombobox from "@/components/common/FilterCombobox";
import Input from "@/components/common/Input";
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
  /**
   * Leading icon inside the field, sized `h-4 w-4`.
   *
   * Omit it for the magnifier, which is what a text filter almost always wants.
   * Pass `null` explicitly for a bare field.
   */
  icon?: ReactNode;
}

/**
 * The reference's magnifier — in the field, on its own background, not in a
 * bordered tile. A tile was tried first and read as a second control sitting in
 * a row of single controls.
 */
export const SEARCH_ICON = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
    />
  </svg>
);

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
  /** Shown when nothing is chosen, and as the first "clear" row — "All Status". */
  placeholder: string;
  label?: string;
  options: { value: string; label: string }[];
  minWidth?: number;
  /** Placeholder inside the combobox's own search box — "Search status...". */
  searchPlaceholder?: string;
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
            // Three sizes of screen, three behaviours (2026-08-13, the
            // responsive pass):
            //  - phone (<sm): `w-full` stacks each filter on its own row —
            //    before this they wrapped wherever min-width happened to land,
            //    leaving Reset and Cols orphaned mid-row;
            //  - laptop: `flex-1` shares the row, `minWidth` stops a long
            //    placeholder collapsing a neighbour;
            //  - big desktops: dropdowns CAP at 320px. Uncapped `flex-1` gave a
            //    ten-character "All Status" a 400px control at 2560px. The text
            //    search stays uncapped — a wide search box is actually useful.
            className={`w-full sm:w-auto sm:flex-1 ${
              filter.type === "text" ? "" : "sm:max-w-[320px]"
            }`}
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
                // Defaults to the magnifier. Every index page's first filter is a
                // search box, and every module was declaring the same 4-line SVG
                // to get one — a decoration that has no reason to be a decision.
                // Pass `icon` for anything else; pass `null` for none.
                leadingIcon={filter.icon === undefined ? SEARCH_ICON : filter.icon}
                value={query.filters[filter.key]}
                onChange={(e) => query.setFilter(filter.key, e.target.value)}
                className="!h-9 !py-0 !text-xs"
              />
            ) : (
              // A searchable combobox, not a native `<select>` — see
              // `FilterCombobox`'s docblock. The Role filter is the case that
              // forces it: forty roles in an unsearchable list is not a filter.
              <FilterCombobox
                options={filter.options}
                value={query.filters[filter.key]}
                onChange={(next) => query.setFilter(filter.key, next)}
                placeholder={filter.placeholder}
                searchPlaceholder={filter.searchPlaceholder ?? "Search..."}
                label={filter.label ?? filter.placeholder}
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
