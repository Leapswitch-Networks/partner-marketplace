"use client";

import { useState } from "react";

import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Modal from "@/components/common/Modal";
import { useCloneRoleMutation } from "@/lib/api/endpoints/rolesEndpoints";
import type { Role } from "@/types";

/**
 * Copy a role's permissions onto a new one.
 *
 * A modal, not a page: it asks for exactly one field. The reference has a
 * dedicated `Clone.tsx` screen, which is a divergence registered in
 * `CORE_COMPLETION_PLAN.md` § 1.1 — a whole route for one text input is worse
 * for the user, and the resulting role opens in the edit page anyway.
 *
 * The name is pre-filled with "<original> Copy" rather than generated
 * server-side. A silently invented role name is one nobody chose, and role names
 * are read by guards.
 */
export default function CloneRoleModal({
  role,
  onClose,
  onCloned,
}: {
  role: Role;
  onClose: () => void;
  onCloned: (role: Role) => void;
}) {
  const [name, setName] = useState(`${role.name}Copy`);
  const [displayName, setDisplayName] = useState(`${role.display_name} Copy`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cloneRole] = useCloneRoleMutation();

  const submit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Converted 2026-08-21. The mutation invalidates the roles list, so the new
      // role appears wherever roles are shown — this modal used to depend on its
      // caller reloading, which the roles screen did and any other opener would
      // not have.
      const created = await cloneRole({
        id: role.id,
        data: { name: name.trim(), display_name: displayName.trim() || null },
      }).unwrap();
      onCloned(created);
    } catch (err) {
      // `error.data` is already a human-readable message from `axiosBaseQuery` —
      // the axios `response.data.detail` shape this used to dig into is not what
      // the cache layer hands back.
      setError((err as { data?: string })?.data ?? "Could not clone this role.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={`Clone ${role.display_name}`}
      subtitle={`Copies all ${role.permissions.length} permissions onto a new role`}
      footer={
        <>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="clone-role-form" loading={saving} disabled={!name.trim()}>
            Create clone
          </Button>
        </>
      }
    >
      <form id="clone-role-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="rounded-[5px] border border-tone-danger/40 bg-tone-danger/10 px-3 py-2 text-xs text-tone-danger"
          >
            {error}
          </div>
        )}

        <Input
          label="Name"
          id="clone-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="Letters and numbers, no spaces. Must be unique."
          required
        />

        <Input
          label="Display name"
          id="clone-display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          hint="Shown in the UI. Defaults to the name."
        />

        <p className="text-[11px] text-ink-label dark:text-night-muted">
          The clone will not be a system role, and you cannot grant it a permission you do not hold
          yourself — so it may end up narrower than {role.display_name}.
        </p>
      </form>
    </Modal>
  );
}
