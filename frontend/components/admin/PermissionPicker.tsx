"use client";

import Badge from "@/components/common/Badge";
import type { PermissionGroup } from "@/types";

/**
 * Grouped permission checkboxes with per-group select-all.
 *
 * Extracted from `RoleFormModal` so the form page and the Show page render the
 * same grid — the Show page passes `readOnly`, which is exactly what the modal
 * already did for a protected role. Two copies would drift the moment a group
 * gained a new permission.
 *
 * The group legend is a button that toggles the whole group, and carries a badge
 * saying `all` or `partial`. That tri-state matters: without it a group with
 * three of five permissions ticked looks identical to one with none, because the
 * legend itself has no checkbox.
 */
export default function PermissionPicker({
  groups,
  checked,
  onToggle,
  onToggleGroup,
  readOnly = false,
}: {
  groups: PermissionGroup[];
  checked: Set<number>;
  onToggle: (id: number) => void;
  onToggleGroup: (group: PermissionGroup) => void;
  readOnly?: boolean;
}) {
  if (groups.length === 0) {
    return (
      <p className="rounded-[5px] border border-brand/20 px-3 py-4 text-center text-xs text-ink-label dark:border-night-border dark:text-night-muted">
        You do not have permission to view the permission catalog.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const ids = group.permissions.map((p) => p.id);
        const allOn = ids.length > 0 && ids.every((id) => checked.has(id));
        const someOn = !allOn && ids.some((id) => checked.has(id));

        return (
          <fieldset
            key={group.id}
            className="rounded-[5px] border border-brand/20 px-3 py-2.5 dark:border-night-border"
          >
            <legend className="flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={() => !readOnly && onToggleGroup(group)}
                disabled={readOnly}
                className="text-xs font-semibold text-ink hover:text-brand disabled:cursor-not-allowed dark:text-gray-200"
              >
                {group.display_name}
              </button>
              {someOn && <Badge tone="warning">partial</Badge>}
              {allOn && <Badge tone="success">all</Badge>}
            </legend>

            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {group.permissions.map((permission) => (
                <label
                  key={permission.id}
                  className={`flex items-start gap-2 rounded-[5px] px-1.5 py-1 text-xs ${
                    readOnly ? "" : "cursor-pointer hover:bg-brand/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked.has(permission.id)}
                    onChange={() => onToggle(permission.id)}
                    disabled={readOnly}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-ink dark:text-gray-300">
                      {permission.display_name}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-ink-label dark:text-night-muted">
                      {permission.name}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
