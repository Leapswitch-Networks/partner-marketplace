"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { categoryApi } from "@/lib/api/categoryApi";
import type { AdminSection } from "@/components/dashboard/Sidebar";
import type { Category } from "@/types";
import useAppSelector from "@/lib/hooks/useAppSelector";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  id: z
    .string()
    .min(1, "Category ID is required")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "ID may only contain letters, numbers, hyphens, and underscores"
    ),
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  status: z.enum(["active", "inactive"]),
});

const editSchema = schema.omit({ id: true });

type FormValues = z.infer<typeof schema>;
type EditFormValues = z.infer<typeof editSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface AddCategoryFormProps {
  onNavigate: (section: AdminSection) => void;
  onCategoryCreated?: (categoryId: string, categoryName: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg).join(", ");
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

// ─── Edit Row Component ───────────────────────────────────────────────────────

interface EditRowProps {
  category: Category;
  onSave: (id: string, data: EditFormValues) => Promise<void>;
  onCancel: () => void;
}

function EditRow({ category, onSave, onCancel }: EditRowProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: category.name,
      description: category.description,
      status: category.status,
    },
  });

  return (
    <tr className="bg-brand/10 dark:bg-brand/20">
      <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">
        {category.id}
      </td>
      <td className="px-4 py-3">
        <input
          {...register("name")}
          className={`w-full rounded border px-2 py-1 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 dark:bg-night-card dark:text-gray-100 ${
            errors.name ? "border-tone-danger/40" : "border-surface-border dark:border-night-border"
          }`}
        />
        {errors.name && (
          <p className="mt-0.5 text-xs text-tone-danger">{errors.name.message}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <textarea
          {...register("description")}
          rows={2}
          className={`w-full resize-none rounded border px-2 py-1 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 dark:bg-night-card dark:text-gray-100 ${
            errors.description ? "border-tone-danger/40" : "border-surface-border dark:border-night-border"
          }`}
        />
        {errors.description && (
          <p className="mt-0.5 text-xs text-tone-danger">{errors.description.message}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <select
          {...register("status")}
          className="rounded border border-surface-border px-2 py-1 text-sm outline-none focus:border-brand dark:border-night-border dark:bg-night-card dark:text-gray-100"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit((data) => onSave(category.id, data))}
            disabled={isSubmitting}
            className="rounded bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-surface-border px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:border-night-border dark:text-gray-400 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AddCategoryForm({
  onNavigate,
  onCategoryCreated,
}: AddCategoryFormProps) {
  const [apiError, setApiError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const user = useAppSelector((state) => state.auth.user);
  const isSuperAdmin =
    user && "role" in user && (user as { role: string }).role === "super_admin";

  // ── Create form ──────────────────────────────────────────────────────────────

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: "active" },
  });

  // ── Fetch list ───────────────────────────────────────────────────────────────

  const fetchCategories = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await categoryApi.list();
      setCategories(data);
    } catch (err) {
      setListError(extractApiError(err, "Failed to load categories."));
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // ── Create handler ───────────────────────────────────────────────────────────

  const onSubmit = useCallback(
    async (data: FormValues) => {
      setApiError(null);
      setSaved(false);
      try {
        const created = await categoryApi.create(data);
        setSaved(true);
        setCategories((prev) => [created, ...prev]);
        if (onCategoryCreated) onCategoryCreated(data.id, data.name);
        reset();
      } catch (err) {
        setApiError(extractApiError(err, "Failed to save category. Please try again."));
      }
    },
    [reset, onCategoryCreated]
  );

  // ── Edit handler ─────────────────────────────────────────────────────────────

  const handleSaveEdit = useCallback(
    async (id: string, data: EditFormValues) => {
      setActionError(null);
      try {
        const updated = await categoryApi.update(id, data);
        setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
        setEditingId(null);
      } catch (err) {
        setActionError(extractApiError(err, "Failed to update category."));
      }
    },
    []
  );

  // ── Delete handler ───────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (id: string) => {
    setActionError(null);
    setDeletingId(id);
    try {
      await categoryApi.delete(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setActionError(extractApiError(err, "Failed to delete category."));
    } finally {
      setDeletingId(null);
    }
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ── Create Form ── */}
      <div className="max-w-xl">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Add Category
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create a category to group job roles and tests.
          </p>
        </div>

        {saved && (
          <div
            role="status"
            className="mb-5 rounded-[5px] border border-tone-success/40 bg-tone-success/10 px-4 py-3 text-sm font-medium text-tone-success dark:border-tone-success/50 dark:bg-tone-success/20 dark:text-brand-on-dark"
          >
            Category created successfully.
          </div>
        )}

        {apiError && (
          <div
            role="alert"
            className="mb-5 rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-4 py-3 text-sm font-medium text-tone-danger dark:border-tone-danger/50 dark:bg-tone-danger/15 dark:text-tone-danger"
          >
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <Input
            label="Category ID"
            type="text"
            placeholder="e.g. engineering or tech-roles"
            error={errors.id?.message}
            {...register("id")}
          />

          <Input
            label="Category Name"
            type="text"
            placeholder="e.g. Engineering"
            error={errors.name?.message}
            {...register("name")}
          />

          <div className="flex flex-col gap-1">
            <label
              htmlFor="category-description"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Description
            </label>
            <textarea
              id="category-description"
              rows={4}
              placeholder="Briefly describe this category..."
              className={`w-full resize-none rounded-[5px] border px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:text-gray-100 dark:placeholder-gray-500 ${
                errors.description
                  ? "border-tone-danger/40 bg-tone-danger/10 dark:border-tone-danger/50 dark:bg-tone-danger/15"
                  : "border-surface-border bg-white dark:border-night-border dark:bg-night-card"
              }`}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-tone-danger">{errors.description.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="category-status"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Status
            </label>
            <select
              id="category-status"
              className={`w-full rounded-[5px] border px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:bg-night-card dark:text-gray-100 ${
                errors.status
                  ? "border-tone-danger/40 bg-tone-danger/10 dark:border-tone-danger/50 dark:bg-tone-danger/15"
                  : "border-surface-border bg-white dark:border-night-border"
              }`}
              {...register("status")}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {errors.status && (
              <p className="text-xs text-tone-danger">{errors.status.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
            <Button type="submit" loading={isSubmitting}>
              Save Category
            </Button>
            {saved && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onNavigate("add-job-role")}
              >
                Continue to Add Job Role →
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* ── Category List ── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Existing Categories
          </h3>
          <button
            type="button"
            onClick={fetchCategories}
            className="text-xs text-brand dark:text-brand-on-dark hover:underline"
          >
            Refresh
          </button>
        </div>

        {actionError && (
          <div
            role="alert"
            className="mb-4 rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-4 py-3 text-sm font-medium text-tone-danger dark:border-tone-danger/50 dark:bg-tone-danger/15 dark:text-tone-danger"
          >
            {actionError}
          </div>
        )}

        {listLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : listError ? (
          <p className="text-sm text-tone-danger">{listError}</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No categories yet. Create one above.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[5px] border border-surface-border dark:border-night-border">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-night-card/60">
                <tr>
                  {["ID", "Name", "Description", "Status", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-700 dark:bg-night-card">
                {categories.map((cat) =>
                  editingId === cat.id ? (
                    <EditRow
                      key={cat.id}
                      category={cat}
                      onSave={handleSaveEdit}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <tr
                      key={cat.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/40"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                        {cat.id}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {cat.name}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-gray-600 dark:text-gray-300">
                        <span className="line-clamp-2">{cat.description}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            cat.status === "active"
                              ? "bg-tone-success/10 text-tone-success dark:bg-tone-success/15 dark:text-brand-on-dark"
                              : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                          }`}
                        >
                          {cat.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isSuperAdmin ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActionError(null);
                                setEditingId(cat.id);
                              }}
                              className="text-xs font-medium text-brand dark:text-brand-on-dark hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(cat.id)}
                              disabled={deletingId === cat.id}
                              className="text-xs font-medium text-tone-danger hover:underline disabled:opacity-50"
                            >
                              {deletingId === cat.id ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}

        {!isSuperAdmin && categories.length > 0 && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Edit and delete actions are available to super admins only.
          </p>
        )}
      </div>
    </div>
  );
}
