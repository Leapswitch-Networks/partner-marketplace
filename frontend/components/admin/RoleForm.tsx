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
import { permissionApi, roleApi } from "@/lib/api/rbacApi";
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
