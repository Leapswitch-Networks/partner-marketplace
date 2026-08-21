"use client";

import { useState } from "react";

import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Textarea from "@/components/common/Textarea";
import Toggle from "@/components/common/Toggle";
import type { Setting } from "@/lib/api/configurationApi";
import { extractApiError } from "@/lib/utils/apiError";

/**
 * One editable setting — the row Configuration and Security both render.
 *
 * Extracted 2026-08-11 when Security landed. The two screens edit **the same
 * table through two endpoints**, so the editor is the same editor; a second copy
 * would be two places to keep the five type-editors in step, and this session has
 * already found seven bugs that were exactly that.
 *
 * `save` is injected rather than the endpoint being derived from the setting,
 * because which endpoint may write a row is an authorisation decision the screen
 * makes, not a property of the row. Security's endpoint refuses anything outside
 * `security.*`; Configuration's takes everything. A row does not know which
 * screen is showing it, and should not.
 */
export default function SettingRowEditor({
  setting,
  save,
  onSaved,
  onError,
}: {
  setting: Setting;
  /** Writes the value and resolves with the updated record. */
  save: (id: number, value: unknown) => Promise<Setting>;
  /**
   * Called with the record the server stored, for a parent that keeps its own
   * copy of the row.
   *
   * **Optional since 2026-08-21.** Both parents used to splice the response back
   * into a local array; now they read through the shared cache and the mutation
   * invalidates it, so the refetched row replaces this one and there is nothing
   * for the parent to do. A parent that still holds its own list can pass this.
   */
  onSaved?: (next: Setting) => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState<unknown>(setting.value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /*
    The record is the source of truth: when its value changes — a save landing, a
    refetch after an error — the draft follows it.

    **Adjusted during render, not in an effect.** React documents this shape for
    "reset state when a prop changes" (react.dev/learn/you-might-not-need-an-
    effect); it re-renders before anything is painted rather than painting the
    stale draft and correcting it. The `useEffect` version flashes, and the
    compiler's `set-state-in-effect` rule flags it.

    Keying the component on the value was the other option and is worse: a
    remount resets `saved` too, so the "Saved" badge would never be seen.
  */
  const [syncedFrom, setSyncedFrom] = useState<unknown>(setting.value);
  if (!Object.is(syncedFrom, setting.value)) {
    setSyncedFrom(setting.value);
    setDraft(setting.value);
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(setting.value);

  const commit = async (value: unknown = draft) => {
    setSaving(true);
    try {
      const stored = await save(setting.id, value);
      onSaved?.(stored);
      setSaved(true);
      // A confirmation that never leaves becomes wallpaper. Two seconds is long
      // enough to be seen and short enough not to accumulate down the page.
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      // Named, because these screens have many save buttons and "Could not save"
      // would not say which. The API already answers with the label in the
      // message; this is the fallback for when it cannot be reached at all.
      onError(extractApiError(err, `Could not save “${setting.label}”.`));
      setDraft(setting.value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-[5px] border border-brand/20 bg-white p-3 dark:border-night-border dark:bg-night-card md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink dark:text-gray-100">
            {setting.label}
          </span>
          <Badge tone="neutral">{setting.type_label}</Badge>
          {saved && <Badge tone="success">Saved</Badge>}
        </div>
        {setting.description && (
          <p className="mt-0.5 text-xs text-ink-label dark:text-night-muted">
            {setting.description}
          </p>
        )}
        {/* The key is shown because it is the API contract — it is what appears
            in the activity log, in a support question, and in the code that
            reads this setting. */}
        <code className="mt-1 block font-mono text-[10px] text-ink-label dark:text-night-muted">
          {setting.key}
        </code>
      </div>

      <div className="flex shrink-0 items-center gap-2 md:w-80">
        {setting.type === "bool" ? (
          <Toggle
            checked={Boolean(draft)}
            disabled={saving}
            label={setting.label}
            onChange={(next) => {
              setDraft(next);
              // Booleans save immediately. A toggle that needs a second click on
              // a Save button reads as not having worked — the switch has
              // already moved, so the change looks applied whether or not it is.
              void commit(next);
            }}
          />
        ) : setting.type === "text" || setting.type === "json" ? (
          <Textarea
            label=""
            mono
            rows={3}
            value={
              setting.type === "json"
                ? JSON.stringify(draft ?? {}, null, 2)
                : ((draft as string) ?? "")
            }
            onChange={(e) =>
              setDraft(setting.type === "json" ? safeParse(e.target.value) : e.target.value)
            }
          />
        ) : (
          <Input
            label=""
            type={setting.type === "int" ? "number" : "text"}
            className="font-mono tabular-nums"
            value={(draft as string | number) ?? ""}
            onChange={(e) =>
              setDraft(setting.type === "int" ? Number(e.target.value) : e.target.value)
            }
          />
        )}

        {setting.type !== "bool" && (
          <Button
            size="sm"
            variant="outline"
            disabled={!dirty || saving}
            loading={saving}
            onClick={() => void commit()}
          >
            Save
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Parse JSON, keeping the raw string on failure.
 *
 * Mid-typing, `{"a":` is not valid JSON — and clearing the field every time the
 * text is briefly unparseable would make a JSON setting impossible to edit. The
 * raw string is held instead and rejected by the API's own type validation if it
 * is still not JSON when Save is pressed, which is the right place for that
 * verdict.
 */
function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
