"use client";

import { useEffect, useState } from "react";

import PageHeading, { headingClasses } from "@/components/common/PageHeading";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Textarea from "@/components/common/Textarea";
import Toast, { useToast } from "@/components/common/Toast";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  type Category,
} from "@/lib/api/directoryApi";
import { extractApiError } from "@/lib/utils/apiError";
import { usePermissions } from "@/lib/hooks/usePermissions";

/**
 * The taxonomy admin — staff only.
 *
 * ## Leapswitch owns this table and partners never write to it
 *
 * § 6.2, and it is the reason the public filter works at all: every selection a
 * partner makes is a foreign key into these rows, so a vocabulary its listers
 * could extend would stop being joinable the day two of them spelled the same
 * thing differently.
 *
 * ## Two levels, and the third is refused rather than flattened
 *
 * The API returns a 409 (§ 19.12). The parent picker below only offers
 * top-level categories, so the ordinary path never produces one — but the server
 * is the authority, because a hidden option is not a constraint.
 *
 * ## Deleting is guarded twice, and both guards say why
 *
 * A category with children, or with listings pointing at it, cannot be deleted.
 * The foreign keys are `RESTRICT` so the database would refuse anyway; the
 * service turns that into a sentence rather than a constraint name, and this
 * page shows the sentence.
 *
 * ## The live count is the § 8 threshold, made visible
 *
 * A category's number is what decides whether it earns a public page. Showing it
 * here is how a staff member can tell why something is not appearing without
 * reading the plan.
 */
export default function CategoriesModule() {
  const { toasts, show, dismiss } = useToast();
  const { can } = usePermissions();
  const canManage = can("category-manage");

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<number | "">("");
  const [description, setDescription] = useState("");

  const load = () =>
    listCategories(true)
      .then(setCategories)
      .catch((e) => show(extractApiError(e, "Could not load categories."), "error"))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCreate = async () => {
    if (name.trim().length < 2) return;
    setSaving(true);
    try {
      await createCategory({
        name: name.trim(),
        parent_id: parentId === "" ? null : Number(parentId),
        description: description.trim() || null,
      });
      setName("");
      setDescription("");
      setParentId("");
      show("Category created.");
      await load();
    } catch (e) {
      show(extractApiError(e, "Could not create the category."), "error");
    } finally {
      setSaving(false);
    }
  };

  const onToggleActive = async (category: Category) => {
    try {
      await updateCategory(category.id, { is_active: !category.is_active });
      show(category.is_active ? `${category.name} hidden.` : `${category.name} is live.`);
      await load();
    } catch (e) {
      show(extractApiError(e, "Could not change the category."), "error");
    }
  };

  const onDelete = async (category: Category) => {
    try {
      await deleteCategory(category.id);
      show(`${category.name} deleted.`);
      await load();
    } catch (e) {
      // The API's refusal is a sentence explaining what still points at it —
      // showing it verbatim is more useful than anything this page could invent.
      show(extractApiError(e, "Could not delete the category."), "error");
    }
  };

  const parents = categories.filter((c) => c.parent_id === null);
  const childrenOf = (id: number) => categories.filter((c) => c.parent_id === id);

  if (loading) {
    return <p className="p-6 text-sm text-ink-muted dark:text-night-muted">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <PageHeading title="Service categories" />
      <p className="mt-1 text-sm text-ink-muted dark:text-night-muted">
        The vocabulary partners pick from and buyers filter by. Only ours to change — a category with
        no listings does not get a public page.
      </p>

      {canManage && (
        <div className="mt-6 rounded-[5px] border border-surface-border p-5 dark:border-night-border">
          <h2 className="text-sm font-semibold text-ink dark:text-gray-100">Add a category</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <div>
              <label
                htmlFor="parent"
                className="mb-1 block text-sm font-medium text-ink-label dark:text-night-muted"
              >
                Parent (optional)
              </label>
              <select
                id="parent"
                value={parentId}
                onChange={(e) => setParentId(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full rounded-[5px] border border-surface-border bg-white px-3 py-2 text-sm text-ink dark:border-night-border dark:bg-night-card dark:text-gray-100"
              >
                <option value="">None — this is a top-level category</option>
                {/* Only top-level parents are offered: the taxonomy is two deep
                    and a third level is a 409 from the API. */}
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <Textarea
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="mt-4">
            <Button onClick={onCreate} loading={saving} disabled={name.trim().length < 2}>
              Add category
            </Button>
          </div>
        </div>
      )}

      <ul className="mt-8 space-y-4">
        {parents.map((parent) => (
          <li
            key={parent.id}
            className="rounded-[5px] border border-surface-border p-5 dark:border-night-border"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className={`${headingClasses("section")} text-ink dark:text-gray-100`}>
                  {parent.name}
                  {!parent.is_active && (
                    <span className="ml-2 text-xs font-normal text-ink-muted dark:text-night-muted">
                      (hidden)
                    </span>
                  )}
                </h2>
                <p className="text-xs text-ink-muted dark:text-night-muted">
                  /{parent.slug} · {parent.listing_count} listing
                  {parent.listing_count === 1 ? "" : "s"} of its own
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onToggleActive(parent)}>
                    {parent.is_active ? "Hide" : "Show"}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => onDelete(parent)}>
                    Delete
                  </Button>
                </div>
              )}
            </div>

            {childrenOf(parent.id).length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-surface-border pt-3 dark:border-night-border">
                {childrenOf(parent.id).map((child) => (
                  <li key={child.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-ink dark:text-gray-100">
                      {child.name}
                      <span className="ml-2 text-xs text-ink-muted dark:text-night-muted">
                        /{child.slug} · {child.listing_count} listing
                        {child.listing_count === 1 ? "" : "s"}
                        {child.listing_count === 0 && " — no public page"}
                      </span>
                    </span>
                    {canManage && (
                      <span className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => onToggleActive(child)}>
                          {child.is_active ? "Hide" : "Show"}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => onDelete(child)}>
                          Delete
                        </Button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
