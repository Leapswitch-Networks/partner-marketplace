"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * The primary action on the home page.
 *
 * ## It navigates. It does not fetch.
 *
 * § 20.5 states this and it is the difference between a search box and a search
 * *feature*: submitting pushes `/partners?q=…`, and that page does the work
 * server-side. Keeping the fetch out of here is what lets the home page stay a
 * server component with one small client leaf, which is how the route stays
 * inside the 150 kB first-load budget (§ 11).
 *
 * ## Why there is no autocomplete
 *
 * § 13.3: suggestions are a Band 2 feature. Autocompleting from an inventory of
 * fifteen partners exposes the inventory, and "we have fifteen" is not the first
 * thing a stranger should learn about us.
 *
 * ## Why it is a real `<form>`
 *
 * § 20.2 rule 5 — the public surface must work for reading with JavaScript
 * disabled. A form with a `method` and an `action` submits without React; the
 * router push is the enhancement, not the mechanism.
 */
export default function SearchBar({
  className,
  autoFocus = false,
}: {
  className?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      action="/partners"
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        router.push(query ? `/partners?q=${encodeURIComponent(query)}` : "/partners");
      }}
      className={cn(
        // The 2px border and the cream fill are the reference's input treatment.
        // Stacks to full width below `sm` — a side-by-side input and button at
        // 360px leaves the field about ten characters wide.
        "pub-bg pub-border flex w-full flex-col gap-2 rounded-2xl p-2 sm:flex-row sm:items-center sm:gap-2",
        className,
      )}
      role="search"
    >
      <label htmlFor="partner-search" className="sr-only">
        What do you need help with?
      </label>
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
        <Search aria-hidden className="pub-muted h-5 w-5 shrink-0" />
        <input
          id="partner-search"
          name="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus={autoFocus}
          placeholder="Kubernetes, ISO 27001, colocation…"
          className="pub-ink min-h-11 w-full min-w-0 bg-transparent py-2 text-base outline-none placeholder:text-[color:var(--public-ink-50)]"
        />
      </div>
      <button
        type="submit"
        className="pub-focus pub-lilac-bg pub-ink min-h-11 shrink-0 rounded-xl border-2 border-[color:var(--public-ink)] px-6 py-3 text-[0.9375rem] font-semibold leading-none transition-transform duration-200 hover:scale-[.98]"
      >
        Search
      </button>
    </form>
  );
}
