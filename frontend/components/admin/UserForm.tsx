"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import Input from "@/components/common/Input";
import ResourceForm from "@/components/common/ResourceForm";
import Select from "@/components/common/Select";
import Skeleton from "@/components/common/Skeleton";
import { adminApi, type CreateUserPayload, type UpdateUserPayload } from "@/lib/api/adminApi";
import { roleApi } from "@/lib/api/rbacApi";
import useAppSelector from "@/lib/hooks/useAppSelector";
import type { ManagedUserDetail, Role } from "@/types";

/**
 * Create and edit a user — **one component, both modes**.
 *
 * `userId` absent means create; present means edit, and the record is fetched
 * here rather than passed in so the edit URL is directly linkable. That is the
 * Index / Form / Show contract in `CORE_COMPLETION_PLAN.md` § 2.1, and the
 * reference implementation's pattern (`const isEditMode = !!user`).
 *
 * ## Why this replaces `UserFormModal`
 *
 * Beyond being linkable and surviving a reload, the modal carried a real bug it
 * could not avoid. It received a `ManagedUser`, which has `full_name` but not
 * `first_name`/`last_name`, so it **guessed** the split:
 *
 *     const parts = user.full_name.trim().split(" ");
 *     first_name = parts[0];  last_name = parts.slice(1).join(" ");
 *
 * For "Mary Jane Watson" that yields first "Mary", last "Jane Watson" — and
 * saving the form persisted the guess, silently rewriting the user's name. This
 * form loads `ManagedUserDetail`, which carries both fields, so nothing is
 * inferred.
 */

const schema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().max(100),
  email: z.email({ message: "Enter a valid email address" }),
  // Optional in both modes, for different reasons: on create, blank means a
  // Google-only staff account with no password; on edit, blank means unchanged.
  password: z.string().max(128),
  account_type: z.enum(["staff", "partner"]),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
  designation: z.string().max(120),
  company_name: z.string().max(160),
  role_id: z.string(),
});

type FormValues = z.infer<typeof schema>;

const ACCOUNT_TYPE_OPTIONS = [
  { value: "partner", label: "Partner" },
  { value: "staff", label: "Staff" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Pending approval" },
  { value: "SUSPENDED", label: "Suspended" },
];

function apiMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { detail?: unknown }; status?: number } })?.response;
  const detail = response?.data?.detail;
  if (Array.isArray(detail)) {
    const msg = (detail[0] as { msg?: string })?.msg ?? fallback;
    return msg.replace(/^Value error,\s*/i, "");
  }
  if (typeof detail === "string" && detail) return detail;
  if (!response) return "Network error — check your connection and try again.";
  return `${fallback} (${response.status ?? "unknown"})`;
}

export default function UserForm({ userId }: { userId?: string }) {
  const router = useRouter();
  const me = useAppSelector((s) => s.auth.user);

  const [record, setRecord] = useState<ManagedUserDetail | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      account_type: "partner",
      status: "INACTIVE",
      designation: "",
      company_name: "",
      role_id: "",
    },
  });

  const { reset, register, formState } = form;

  useEffect(() => {
    roleApi
      .list()
      .then((res) => setRoles(res.data))
      .catch(() => setRoles([]));
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    adminApi
      .getUser(userId)
      .then((res) => {
        if (cancelled) return;
        const user = res.data;
        setRecord(user);
        // `reset` rather than per-field `setValue`: it re-baselines the form so
        // `isDirty` means "changed since load", which is what the unsaved-changes
        // guard needs. Seeding with setValue leaves the form dirty on arrival.
        reset({
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          password: "",
          account_type: user.account_type,
          status: user.status,
          designation: user.designation ?? "",
          company_name: user.company_name ?? "",
          role_id: user.roles[0]?.id ? String(user.roles[0].id) : "",
        });
      })
      .catch((err) => !cancelled && setServerError(apiMessage(err, "Could not load this user.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId, reset]);

  /**
   * Editing your own account. The API refuses `status` and `role_ids` from you
   * on yourself — you cannot lock yourself out or self-promote — so the fields
   * are hidden and omitted rather than sent and rejected.
   */
  const isSelf = Boolean(record && me && record.id === me.id);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      if (record) {
        const payload: UpdateUserPayload = {
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          email: values.email.trim(),
          account_type: values.account_type,
          designation: values.designation.trim() || null,
          company_name: values.company_name.trim() || null,
        };
        if (values.password) payload.password = values.password;
        if (!isSelf) {
          payload.status = values.status;
          payload.role_ids = values.role_id ? [Number(values.role_id)] : [];
        }
        await adminApi.updateUser(record.id, payload);
      } else {
        const payload: CreateUserPayload = {
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          email: values.email.trim(),
          account_type: values.account_type,
          status: values.status,
          role_ids: values.role_id ? [Number(values.role_id)] : [],
          designation: values.designation.trim() || null,
          company_name: values.company_name.trim() || null,
        };
        if (values.password) payload.password = values.password;
        await adminApi.createUser(payload);
      }
      // Set before navigating so the dirty guard does not prompt on the way out.
      setSaved(true);
      router.push("/dashboard/users");
    } catch (err) {
      setServerError(apiMessage(err, record ? "Could not update user." : "Could not create user."));
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

  const roleOptions = roles.map((r) => ({ value: String(r.id), label: r.display_name }));

  return (
    <ResourceForm
      form={form}
      record={record}
      resourceName="User"
      backHref="/dashboard/users"
      serverError={serverError}
      onSubmit={onSubmit}
      skipDirtyGuard={saved}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="First name" error={formState.errors.first_name?.message} {...register("first_name")} />
        <Input label="Last name" error={formState.errors.last_name?.message} {...register("last_name")} />
      </div>

      <Input
        label="Email address"
        type="email"
        error={formState.errors.email?.message}
        {...register("email")}
      />

      <Input
        label={record ? "New password (leave blank to keep)" : "Password"}
        type="password"
        placeholder={record ? "Unchanged" : "Min 8 chars, one uppercase, one number"}
        hint={
          record
            ? undefined
            : "Leave blank for a Google-only staff account — it will have no password and must sign in with Google."
        }
        error={formState.errors.password?.message}
        {...register("password")}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Account type"
          options={ACCOUNT_TYPE_OPTIONS}
          {...register("account_type")}
        />
        {!isSelf && (
          <Select label="Status" options={STATUS_OPTIONS} {...register("status")} />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Designation" error={formState.errors.designation?.message} {...register("designation")} />
        <Input label="Company" error={formState.errors.company_name?.message} {...register("company_name")} />
      </div>

      {!isSelf && (
        <Select
          label="Role"
          placeholder="No role"
          options={roleOptions}
          {...register("role_id")}
        />
      )}

      {isSelf && (
        <p className="text-[11px] text-ink-label dark:text-night-muted">
          Status and role are hidden because this is your own account. The API refuses both from you
          on yourself, so you cannot lock yourself out or change your own permissions.
        </p>
      )}
    </ResourceForm>
  );
}
