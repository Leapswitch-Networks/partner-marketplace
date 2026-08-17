"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { navIcon } from "@/components/dashboard/navIcons";
import type { NavigationItem, NavigationSection } from "@/types";

/**
 * Renders the server-provided navigation tree.
 *
 * Everything about *what* appears here was decided by
 * `services/navigation_service.py`. This file decides only how it looks and which
 * entry is highlighted — there is no `can(...)` call anywhere in it, deliberately:
 * a permission check here would reintroduce the second source of truth the
 * server-driven nav was built to remove.
 */

/**
 * Is this item the one the current URL belongs to?
 *
 * `exact` exists for `/dashboard`, which is a prefix of every dashboard route and
 * would otherwise stay lit on all of them. Everything else matches on prefix so
 * that one conceptual item can own several routes.
 */
function isActive(item: NavigationItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  const prefixes = item.active_prefixes.length ? item.active_prefixes : [item.href];
  return prefixes.some((p) => p !== "#" && (pathname === p || pathname.startsWith(`${p}/`)));
}

function Section({
  section,
  pathname,
  collapsed,
  filtering,
  renderItem,
}: {
  section: NavigationSection;
  pathname: string;
  collapsed: boolean;
  /** A nav-filter query is live: hold every visible section open while it types. */
  filtering: boolean;
  renderItem: (item: NavigationItem, active: boolean) => React.ReactNode;
}) {
  /*
   * **Sections collapse, and start collapsed — owner's instructions, 2026-08-13.**
   *
   * This screen has now been through all three states. Plain headings (the
   * decision a long comment here used to defend), then collapsible-but-open,
   * and now collapsible-and-closed by default, which is what the first
   * collapsible version did — and the reason it was removed was that it hid
   * the current page behind a chevron. What makes closed-by-default safe this
   * time is one rule, enforced in two places:
   *
   *  - **The section holding the current page is born open** (the `useState`
   *    initialiser), and **reopens on navigation into it** (the render-time
   *    adjustment below). The active row can never sit inside a closed group.
   *  - A live **filter query overrides everything open** while it types, so a
   *    match is never invisible; clearing it restores each section's own state.
   *
   * `section.collapsible` is the server's word on which sections may collapse
   * (per-role, editable from the Roles screen); a `false` renders an inert,
   * always-open heading. The animation is the grid-rows trick — `0fr ⇄ 1fr`
   * transitions smoothly at any content height, where `max-height` needs a
   * magic number that is either too small (clips) or too large (the delay
   * before anything visibly moves).
   */
  const holdsCurrent = section.items.some((item) => isActive(item, pathname));
  const [open, setOpen] = useState(holdsCurrent);

  // Accordion on navigation — owner's instruction, 2026-08-13 (second round):
  // moving from one heading's page to another's closes the group you left as
  // the one you entered opens. Each section only watches its own
  // `holdsCurrent` transition, in both directions, so no cross-section
  // coordination is needed: the section gaining the page opens, the section
  // losing it closes, and sections the reader toggled by hand in between are
  // left exactly as they set them. Written as the render-time "adjust state
  // when a prop changes" pattern rather than an effect, which is what
  // react-hooks/set-state-in-effect exists to steer away from.
  const [prevHolds, setPrevHolds] = useState(holdsCurrent);
  if (holdsCurrent !== prevHolds) {
    setPrevHolds(holdsCurrent);
    setOpen(holdsCurrent);
  }

  const effectiveOpen = open || filtering;

  // No heading in the icon-only rail: there is no room for a label.
  if (collapsed || !section.label) {
    return <>{section.items.map((item) => renderItem(item, isActive(item, pathname)))}</>;
  }

  if (!section.collapsible) {
    return (
      <div className="mt-3 first:mt-0">
        <p className="mb-2 mt-6 border-b border-brand/20 px-4 pb-2 text-[12px] font-semibold text-brand first:mt-2 dark:border-night-border dark:text-brand-on-dark">
          {section.label}
        </p>
        <div className="mt-0.5 space-y-1">
          {section.items.map((item) => renderItem(item, isActive(item, pathname)))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 first:mt-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={effectiveOpen}
        className="group mb-2 mt-6 flex w-full items-center justify-between border-b border-brand/20 px-4 pb-2 text-[12px] font-semibold text-brand transition-colors first:mt-2 hover:text-brand-dark dark:border-night-border dark:text-brand-on-dark dark:hover:text-white"
      >
        <span>{section.label}</span>
        <svg
          className={`h-4 w-4 shrink-0 transition-transform duration-300 ease-in-out ${
            effectiveOpen ? "" : "-rotate-90"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          effectiveOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-0.5 space-y-1 pb-1">
            {section.items.map((item) => renderItem(item, isActive(item, pathname)))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Keep items whose title matches, and keep a matching item's children intact —
 * finding "Users" should still show its sub-entries. A section whose *label*
 * matches keeps everything: typing "settings" means "show me that group".
 */
function filterItems(items: NavigationItem[], q: string): NavigationItem[] {
  return items
    .map((item) => {
      if (item.title.toLowerCase().includes(q)) return item;
      const children = item.items?.length ? filterItems(item.items, q) : [];
      return children.length ? { ...item, items: children } : null;
    })
    .filter((item): item is NavigationItem => item !== null);
}

export default function NavTree({
  sections,
  collapsed,
  query = "",
  onNavigate,
  renderButton,
}: {
  sections: NavigationSection[];
  collapsed: boolean;
  /** Live nav-filter text from the sidebar's search box. Empty = no filter. */
  query?: string;
  onNavigate: (href: string) => void;
  /** Supplied by the Sidebar so the existing button styling is reused verbatim. */
  renderButton: (args: {
    active: boolean;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  }) => React.ReactNode;
}) {
  const pathname = usePathname();

  const q = query.trim().toLowerCase();
  const visible = !q
    ? sections
    : sections
        .map((section) =>
          section.label?.toLowerCase().includes(q)
            ? section
            : { ...section, items: filterItems(section.items, q) }
        )
        .filter((section) => section.items.length > 0);

  const renderItem = (item: NavigationItem, active: boolean): React.ReactNode => (
    <div key={`${item.href}:${item.title}`}>
      {renderButton({
        active,
        label: item.title,
        icon: navIcon(item.icon),
        onClick: () => onNavigate(item.href),
      })}
      {/* Children are rendered flat and indented rather than as a nested
          collapsible: nothing in the current tree uses them, and a speculative
          second collapse mechanism would be untested code. */}
      {item.items?.length ? (
        <div className="ml-4 mt-1 space-y-1 border-l border-brand/20 pl-2 dark:border-night-border">
          {item.items.map((child) => renderItem(child, isActive(child, pathname)))}
        </div>
      ) : null}
    </div>
  );

  if (q && visible.length === 0) {
    return (
      <p className="px-4 py-3 text-xs text-ink-muted dark:text-night-muted">
        Nothing in the menu matches &ldquo;{query.trim()}&rdquo;.
      </p>
    );
  }

  return (
    <>
      {visible.map((section, index) => (
        <Section
          key={section.key ?? `section-${index}`}
          section={section}
          pathname={pathname}
          collapsed={collapsed}
          filtering={Boolean(q)}
          renderItem={renderItem}
        />
      ))}
    </>
  );
}
