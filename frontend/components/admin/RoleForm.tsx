"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import Badge from "@/components/common/Badge";
import Input from "@/components/common/Input";
import ResourceForm from "@/components/common/ResourceForm";
import Skeleton from "@/components/common/Skeleton";
import PermissionPicker from "@/components/admin/PermissionPicker";
import { permissionApi, roleApi, type NavSectionOption } from "@/lib/api/rbacApi";
import type { PermissionGroup, Role } from "@/types";

/**
 * Create and edit a role. Same `record?` contract as `UserForm`.
 *
 * The permission grid is not part of the RHF form. Its state is a `Set<number>`
 * held alongside, because a checkbox grid over a variable, server-supplied group
 * tree does not map onto a fixed schema — registering N dynamic fields would buy
 * validation that has nothing to validate. The set is merged into the payload on
 * submit.
 */

const schema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(64)
    .regex(/^[A-Za-z][A-Za-z0-9]*$/, "Letters and numbers only, starting with a letter"),
  display_name: z.string().max(120),
  description: z.string().max(255),
});

type FormValues = z.infer<typeof schema>;

function apiMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { detail?: unknown }; status?: number } })?.response;
  const detail = response?.data?.detail;
  if (Array.isArray(detail)) return (detail[0] as { msg?: string })?.msg ?? fallback;
  if (typeof detail === "string" && detail) return detail;
  if (!response) return "Network error — check your connection and try again.";
  return `${fallback} (${response.status ?? "unknown"})`;
}

export default function RoleForm({ roleId }: { roleId?: number }) {
  const router = useRouter();

  const [record, setRecord] = useState<Role | null>(null);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  //: Per-role sidebar preferences. Edit-mode only — the endpoint is keyed on a
  //  role id, which a role being created does not have yet.
  const [navSections, setNavSections] = useState<NavSectionOption[] | null>(null);
  const [loading, setLoading] = useState(Boolean(roleId));
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", display_name: "", description: "" },
  });
  const { reset, register, formState } = form;

  useEffect(() => {
    permissionApi
      .list()
      .then((res) => setGroups(res.data))
      .catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    if (!roleId) return;
    let cancelled = false;
    roleApi
      .list()
      .then((res) => {
        if (cancelled) return;
        const role = res.data.find((r) => r.id === roleId) ?? null;
        setRecord(role);
        if (role) {
          reset({
            name: role.name,
            display_name: role.display_name,
            description: role.description ?? "",
          });
          setChecked(new Set(role.permissions.map((p) => p.id)));
        }
      })
      .then(() => roleApi.navPreferences(roleId))
      .then((res) => !cancelled && setNavSections(res.data.sections))
      .catch((err) => !cancelled && setServerError(apiMessage(err, "Could not load this role.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [roleId, reset]);

  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleGroup = (group: PermissionGroup) =>
    setChecked((prev) => {
      const ids = group.permissions.map((p) => p.id);
      const allOn = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });

  /**
   * A system role's name is fixed — renaming `Admin` would break the guards that
   * read it by name. Everything else about it stays editable.
   */
  const nameLocked = Boolean(record?.is_system);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const permission_ids = Array.from(checked);
    try {
      if (record) {
        await roleApi.update(record.id, {
          display_name: values.display_name.trim() || values.name.trim(),
          description: values.description.trim() || null,
          permission_ids,
        });
      } else {
        await roleApi.create({
          name: values.name.trim(),
          display_name: values.display_name.trim() || values.name.trim(),
          description: values.description.trim() || null,
          permission_ids,
        });
      }
      // Sidebar preferences are a second endpoint, so a second request. Sent
      // after the role save rather than before: if the role update is rejected
      // there is nothing to attach preferences to, and a preferences-only write
      // would leave the two out of step.
      if (record && navSections) {
        await roleApi.setNavPreferences(
          record.id,
          Object.fromEntries(
            navSections.map((section) => [section.key, { collapsible: section.collapsible }])
          )
        );
      }
      setSaved(true);
      router.push("/dashboard/roles");
    } catch (err) {
      setServerError(apiMessage(err, record ? "Could not update role." : "Could not create role."));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <ResourceForm
      form={form}
      record={record}
      resourceName="Role"
      backHref="/dashboard/roles"
      serverError={serverError}
      onSubmit={onSubmit}
      skipDirtyGuard={saved}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          hint={nameLocked ? "System roles cannot be renamed." : "Letters and numbers, no spaces."}
          disabled={nameLocked}
          error={formState.errors.name?.message}
          {...register("name")}
        />
        <Input
          label="Display name"
          hint="Shown in the UI. Defaults to the name."
          error={formState.errors.display_name?.message}
          {...register("display_name")}
        />
      </div>

      <Input
        label="Description"
        placeholder="What is this role for?"
        error={formState.errors.description?.message}
        {...register("description")}
      />

      {navSections && navSections.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink dark:text-gray-300">Sidebar</p>
          <p className="mb-2 text-[11px] text-ink-label dark:text-night-muted">
            Which sections start collapsed for someone holding this role. Affects the sidebar only —
            it hides nothing they have permission to reach.
          </p>
          <div className="flex flex-col gap-1.5 rounded-[5px] border border-brand/20 px-3 py-2.5 dark:border-night-border">
            {navSections.map((section) => (
              <label
                key={section.key}
                className="flex cursor-pointer items-center gap-2 rounded-[5px] px-1.5 py-1 text-xs hover:bg-brand/10"
              >
                <input
                  type="checkbox"
                  checked={section.collapsible}
                  onChange={(e) =>
                    setNavSections((prev) =>
                      (prev ?? []).map((s2) =>
                        s2.key === section.key ? { ...s2, collapsible: e.target.checked } : s2
                      )
                    )
                  }
                  className="h-3.5 w-3.5 accent-brand"
                />
                <span className="text-ink dark:text-gray-300">{section.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-ink dark:text-gray-300">Permissions</p>
          <Badge tone="brand">{checked.size} selected</Badge>
        </div>
        <PermissionPicker
          groups={groups}
          checked={checked}
          onToggle={toggle}
          onToggleGroup={toggleGroup}
        />
      </div>
    </ResourceForm>
  );
}
