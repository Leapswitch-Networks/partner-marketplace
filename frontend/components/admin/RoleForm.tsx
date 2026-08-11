"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import Badge from "@/components/common/Badge";
import Button from "@/components/common/Button";
import FormModal from "@/components/common/FormModal";
import Input from "@/components/common/Input";
import ResourceForm, { FormGrid, FormSection } from "@/components/common/ResourceForm";
import Skeleton from "@/components/common/Skeleton";
import PermissionPicker from "@/components/admin/PermissionPicker";
import { navIcon } from "@/components/dashboard/navIcons";
import { permissionApi, roleApi, type NavSectionOption } from "@/lib/api/rbacApi";
import type { PermissionGroup, Role } from "@/types";
import { extractApiError } from "@/lib/utils/apiError";

/**
 * Create and edit a role. Same `record?` contract as `UserForm`, and since
 * 2026-08-11 the same `asModal` contract too.
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

/** Links the modal footer's submit button to the form it sits outside of. */
const FORM_ID = "role-form";

export default function RoleForm({
  roleId,
  /**
   * Renders into `FormModal` instead of the full-page `ResourceForm`, and calls
   * `onDone` instead of navigating. Everything else — schema, fetch, the
   * permission set, the payload — is shared, which is the whole reason this is a
   * prop rather than a second component. Same shape as `UserForm`.
   */
  asModal = false,
  onDone,
}: {
  roleId?: number;
  asModal?: boolean;
  onDone?: (action: "saved" | "cancelled") => void;
}) {
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
      .catch((err) => !cancelled && setServerError(extractApiError(err, "Could not load this role.")))
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
      // Set before navigating so the dirty guard does not prompt on the way out.
      setSaved(true);
      if (asModal) onDone?.("saved");
      else router.push("/dashboard/roles");
    } catch (err) {
      setServerError(extractApiError(err, record ? "Could not update role." : "Could not create role."));
    }
  };

  const isEditMode = Boolean(record);

  if (loading) {
    const skeleton = (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
    // In modal mode the skeleton has to be *in the modal*. Returned bare, it
    // renders wherever the module happens to mount its children — at the bottom
    // of the index page, under the table — which is what `UserForm` still does
    // and is worth not copying.
    return asModal ? (
      <FormModal open onClose={() => onDone?.("cancelled")} title="Edit Role" icon={navIcon("roles")}>
        {skeleton}
      </FormModal>
    ) : (
      skeleton
    );
  }

  /**
   * The fields, declared once and rendered by whichever shell is active.
   *
   * Grouped into sections as of 2026-08-11 — this was the flat column
   * `DAILY_CHANGES.md` promised to split on 2026-08-10 and did not. Three cards,
   * matching how the form is actually read: what the role *is*, what it *sees*,
   * what it *may do*.
   */
  const fields = (
    <>
      <FormSection title="Role Identity">
        <FormGrid>
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
        </FormGrid>

        <Input
          label="Description"
          placeholder="What is this role for?"
          error={formState.errors.description?.message}
          {...register("description")}
        />
      </FormSection>

      {navSections && navSections.length > 0 && (
        <FormSection
          title="Sidebar"
          description="Which sections start collapsed for someone holding this role. Affects the sidebar only — it hides nothing they have permission to reach."
        >
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
        </FormSection>
      )}

      <FormSection
        title="Permissions"
        description="What someone holding this role may do. Everything is denied unless it is ticked here."
      >
        <div className="flex items-center justify-end">
          <Badge tone="brand">{checked.size} selected</Badge>
        </div>
        <PermissionPicker
          groups={groups}
          checked={checked}
          onToggle={toggle}
          onToggleGroup={toggleGroup}
        />
      </FormSection>
    </>
  );

  if (asModal) {
    return (
      <FormModal
        open
        onClose={() => onDone?.("cancelled")}
        icon={navIcon("roles")}
        title={isEditMode ? `Edit Role: ${record?.display_name ?? ""}` : "Create New Role"}
        subtitle={
          isEditMode
            ? "Update the role and what it grants"
            : "Define a role and the permissions it carries"
        }
        // `xl`, not the default `lg`: the permission picker is a multi-column
        // checkbox grid, and at 672px it wraps to one column and becomes a very
        // long scroll inside a 60vh box.
        size="xl"
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => onDone?.("cancelled")}>
              Cancel
            </Button>
            <Button type="submit" form={FORM_ID} loading={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? isEditMode
                  ? "Updating…"
                  : "Creating…"
                : isEditMode
                  ? "Update Role"
                  : "Create Role"}
            </Button>
          </>
        }
      >
        {/* Submit lives in the footer, outside this element, so it is wired by
            `form=` rather than by nesting. */}
        <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {serverError && (
            <div
              role="alert"
              className="mb-4 rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-xs text-tone-danger"
            >
              {serverError}
            </div>
          )}
          <div className="flex flex-col gap-5">{fields}</div>
        </form>
      </FormModal>
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
      {fields}
    </ResourceForm>
  );
}
