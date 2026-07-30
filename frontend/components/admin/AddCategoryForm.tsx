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
    <tr className="bg-orange-50 dark:bg-orange-950/20">
      <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-gray-400">
        {category.id}
      </td>
      <td className="px-4 py-3">
        <input
          {...register("name")}
          className={`w-full rounded border px-2 py-1 text-sm outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]/20 dark:bg-gray-800 dark:text-gray-100 ${
            errors.name ? "border-red-400" : "border-gray-300 dark:border-gray-600"
          }`}
        />
        {errors.name && (
          <p className="mt-0.5 text-xs text-red-500">{errors.name.message}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <textarea
          {...register("description")}
          rows={2}
          className={`w-full resize-none rounded border px-2 py-1 text-sm outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]/20 dark:bg-gray-800 dark:text-gray-100 ${
            errors.description ? "border-red-400" : "border-gray-300 dark:border-gray-600"
          }`}
        />
        {errors.description && (
          <p className="mt-0.5 text-xs text-red-500">{errors.description.message}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <select
          {...register("status")}
          className="rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-[#F97316] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
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
            className="rounded bg-[#F97316] px-3 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
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
            className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400"
          >
            Category created successfully.
          </div>
        )}

        {apiError && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
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
              className={`w-full resize-none rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 dark:text-gray-100 dark:placeholder-gray-500 ${
                errors.description
                  ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/30"
                  : "border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800"
              }`}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description.message}</p>
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
              className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 dark:bg-gray-800 dark:text-gray-100 ${
                errors.status
                  ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950/30"
                  : "border-gray-300 bg-white dark:border-gray-700"
              }`}
              {...register("status")}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {errors.status && (
              <p className="text-xs text-red-500">{errors.status.message}</p>
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
            className="text-xs text-[#F97316] hover:underline"
          >
            Refresh
          </button>
        </div>

        {actionError && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
          >
            {actionError}
          </div>
        )}

        {listLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : listError ? (
          <p className="text-sm text-red-500">{listError}</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No categories yet. Create one above.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
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
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-700 dark:bg-gray-900">
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
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
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
                              className="text-xs font-medium text-[#F97316] hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(cat.id)}
                              disabled={deletingId === cat.id}
                              className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50"
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
