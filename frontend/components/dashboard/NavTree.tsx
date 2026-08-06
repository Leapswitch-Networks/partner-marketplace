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

function anyActive(items: NavigationItem[], pathname: string): boolean {
  return items.some(
    (i) => isActive(i, pathname) || (i.items ? anyActive(i.items, pathname) : false)
  );
}

function Section({
  section,
  pathname,
  collapsed,
  renderItem,
}: {
  section: NavigationSection;
  pathname: string;
  collapsed: boolean;
  renderItem: (item: NavigationItem, active: boolean) => React.ReactNode;
}) {
  const holdsCurrentPage = anyActive(section.items, pathname);

  // A collapsible section starts closed unless it contains the current page —
  // otherwise navigating to Roles would collapse the group you just used.
  const [open, setOpen] = useState(!section.collapsible || holdsCurrentPage);

  // No heading and no collapse affordance in the icon-only rail: there is no room
  // for a label, and a collapse toggle with nothing to label it is a mystery box.
  if (collapsed || !section.label) {
    return <>{section.items.map((item) => renderItem(item, isActive(item, pathname)))}</>;
  }

  const expanded = section.collapsible ? open || holdsCurrentPage : true;

  return (
    <div className="mt-3 first:mt-0">
      {section.collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={expanded}
          className="mb-1 flex w-full items-center justify-between border-b border-surface-border px-3 pb-2 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand transition-colors hover:text-brand-dark dark:border-night-border dark:text-night-muted dark:hover:text-brand-on-dark"
        >
          <span>{section.label}</span>
          <svg
            className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ) : (
        <p className="mb-1 border-b border-surface-border px-3 pb-2 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand dark:border-night-border dark:text-night-muted">
          {section.label}
        </p>
      )}

      {expanded && (
        <div className="mt-0.5 space-y-1">
          {section.items.map((item) => renderItem(item, isActive(item, pathname)))}
        </div>
      )}
    </div>
  );
}

export default function NavTree({
  sections,
  collapsed,
  onNavigate,
  renderButton,
}: {
  sections: NavigationSection[];
  collapsed: boolean;
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
        <div className="ml-4 mt-1 space-y-1 border-l border-surface-border pl-2 dark:border-night-border">
          {item.items.map((child) => renderItem(child, isActive(child, pathname)))}
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {sections.map((section, index) => (
        <Section
          key={section.key ?? `section-${index}`}
          section={section}
          pathname={pathname}
          collapsed={collapsed}
          renderItem={renderItem}
        />
      ))}
    </>
  );
}
