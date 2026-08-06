"use client";

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
  renderItem,
}: {
  section: NavigationSection;
  pathname: string;
  collapsed: boolean;
  renderItem: (item: NavigationItem, active: boolean) => React.ReactNode;
}) {
  // No heading in the icon-only rail: there is no room for a label.
  if (collapsed || !section.label) {
    return <>{section.items.map((item) => renderItem(item, isActive(item, pathname)))}</>;
  }

  /*
   * **Sections are plain headings, and their items are always visible.**
   *
   * They used to be collapsible, defaulting to closed unless the section held the
   * current page. Two problems, both visible in a render: on `/dashboard` the
   * whole of User Management was hidden behind a chevron, and — because Viho's
   * section headings are large teal text — a collapsible heading was visually
   * indistinguishable from a static one.
   *
   * Viho does not do this. In `dashboard-default-light-top.png` "General" and
   * "Applications" are inert labels with a rule beneath and every item listed;
   * the chevrons belong to nav *items* that own children ("Dashboard", "Widgets",
   * "Project"). `section.collapsible` still arrives from the API and is
   * deliberately ignored here — the server is describing structure, and this is
   * the presentation decision.
   */
  return (
    <div className="mt-3 first:mt-0">
      <p className="mb-2 mt-6 border-b border-surface-border px-4 pb-2 text-[15px] font-semibold text-brand first:mt-2 dark:border-night-border dark:text-brand-on-dark">
        {section.label}
      </p>

      <div className="mt-0.5 space-y-1">
        {section.items.map((item) => renderItem(item, isActive(item, pathname)))}
      </div>
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
