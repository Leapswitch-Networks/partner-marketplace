"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import Badge from "@/components/common/Badge";
import ErrorState from "@/components/common/ErrorState";
import Skeleton from "@/components/common/Skeleton";
import {
  Field,
  InfoCard,
  MetaCard,
  ShowPageGrid,
  ShowPageHeader,
  ShowPageMain,
  ShowPageSidebar,
} from "@/components/common/ShowPage";
import PermissionPicker from "@/components/admin/PermissionPicker";
import { permissionApi, roleApi, type RoleUserItem } from "@/lib/api/rbacApi";
import usePermissions from "@/lib/hooks/usePermissions";
import type { PermissionGroup, Role } from "@/types";

/**
 * Role detail. Renders the same permission grid as the form, `readOnly`.
 *
 * Showing the full catalog with the role's grants ticked — rather than listing
 * only what it holds — is deliberate: "what can this role NOT do" is the
 * question people actually open this page with, and a list of grants cannot
 * answer it.
 */
export default function RoleShow({ roleId }: { roleId: number }) {
  const { can } = usePermissions();
  const [role, setRole] = useState<Role | null>(null);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [holders, setHolders] = useState<RoleUserItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await roleApi.list();
      const found = res.data.find((r) => r.id === roleId) ?? null;
      if (!found) setError("That role no longer exists.");
      setRole(found);
    } catch {
      setError("Could not load this role.");
    } finally {
      setLoading(false);
    }
  }, [roleId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Fetched separately from the role: it is a second query server-side too,
    // and a role with no `user-view` reader should still render its permissions.
    if (!can("user-view")) return;
    roleApi
      .users(roleId)
      .then((res) => setHolders(res.data))
      .catch(() => setHolders([]));
  }, [roleId, can]);

  useEffect(() => {
    if (!can("permission-view")) return;
    permissionApi
      .list()
      .then((res) => setGroups(res.data))
      .catch(() => setGroups([]));
  }, [can]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !role) {
    return (
      <ErrorState
        error={new Error(error ?? "The role could not be found.")}
        reset={load}
        title="Could not load this role"
        description="It may have been deleted, or you may not have permission to view it."
        compact
      />
    );
  }

  const granted = new Set(role.permissions.map((p) => p.id));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ShowPageHeader
        eyebrow="Role"
        title={role.display_name}
        id={role.id}
        description={role.description ?? undefined}
        badges={[
          ...(role.is_system ? [{ label: "System", tone: "brand" as const }] : []),
          { label: `${role.user_count} user${role.user_count === 1 ? "" : "s"}`, tone: "neutral" as const },
          { label: `${role.permissions.length} permissions`, tone: "neutral" as const },
        ]}
        backHref="/dashboard/roles"
        backLabel="Back to Roles"
        actions={
          can("role-update") ? (
            <Link
              href={`/dashboard/roles/${role.id}/edit`}
              className="inline-flex h-9 items-center rounded-[5px] bg-brand px-7 text-xs font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              Edit
            </Link>
          ) : undefined
        }
      />

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
        <ShowPageGrid>
          <ShowPageMain>
            <InfoCard title="Permissions">
              <div className="py-2.5">
                <PermissionPicker
                  groups={groups}
                  checked={granted}
                  onToggle={() => {}}
                  onToggleGroup={() => {}}
                  readOnly
                />
              </div>
            </InfoCard>
          </ShowPageMain>

          <ShowPageSidebar>
            {holders !== null && (
              <InfoCard title={`Users (${holders.length})`}>
                {holders.length === 0 ? (
                  <Field label="Holders" value={null} />
                ) : (
                  <div className="flex flex-col gap-1.5 py-2.5">
                    {holders.map((u) => (
                      <Link
                        key={u.id}
                        href={`/dashboard/users/${u.id}`}
                        className="flex items-baseline justify-between gap-2 rounded-[5px] px-1.5 py-1 text-xs transition-colors hover:bg-brand/10"
                      >
                        <span className="truncate text-ink dark:text-gray-200">{u.full_name}</span>
                        <span className="shrink-0 truncate text-[10px] text-ink-label dark:text-night-muted">
                          {u.email}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </InfoCard>
            )}

            <MetaCard>
              <Field label="Name" value={<span className="font-mono">{role.name}</span>} />
              <Field label="Display name" value={role.display_name} />
              <Field
                label="Type"
                value={role.is_system ? <Badge tone="brand">System</Badge> : "Custom"}
              />
              <Field label="Users holding it" value={String(role.user_count)} />
              <Field label="Permissions granted" value={String(role.permissions.length)} />
            </MetaCard>

            {role.is_system && (
              <p className="rounded-[5px] border border-brand/20 px-3 py-2 text-[11px] text-ink-label dark:border-night-border dark:text-night-muted">
                A system role cannot be renamed or deleted — guards read it by name. Its permissions
                can still be changed.
              </p>
            )}
          </ShowPageSidebar>
        </ShowPageGrid>
      </div>
    </div>
  );
}
