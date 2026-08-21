"use client";

import { useState } from "react";

import PageHeading from "@/components/common/PageHeading";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Toast, { useToast } from "@/components/common/Toast";
import { useCreateInvitationMutation } from "@/lib/api/endpoints/invitationsEndpoints";
import { useMyOrganisationQuery } from "@/lib/api/endpoints/directoryEndpoints";
import { useListUsersQuery } from "@/lib/api/endpoints/usersEndpoints";
import { extractApiError } from "@/lib/utils/apiError";
import { usePermissions } from "@/lib/hooks/usePermissions";

/** Rows per page. Small enough that a partner reads a page rather than scrolling
 *  one, and well under the server's cap of 100. */
const PER_PAGE = 25;

/**
 * `/dashboard/team` — a partner's own logins.
 *
 * ## There is no second users module, and that is the point
 *
 * § 20.6.3: it is the same table. This page calls the same endpoint the staff
 * Users index does, and **row scoping returns only this organisation's
 * accounts** — a partner cannot widen it by asking differently, because the
 * server takes the organisation from the session rather than the request.
 *
 * The one thing this page adds over the staff index is the framing: a partner is
 * managing colleagues, not administering a platform, so it shows names and
 * status and nothing about roles or permissions.
 *
 * ## Inviting takes the organisation from the actor, never the form
 *
 * § 20.6.1, and it is the same rule as creating a listing: an organisation id in
 * a payload is an invitation to add somebody to a company that is not yours.
 * The field does not exist on this form.
 */
export default function TeamModule() {
  const { toasts, show, dismiss } = useToast();
  const { can } = usePermissions();
  const canInvite = can("invitation-create");

  const [email, setEmail] = useState("");
  const [page, setPage] = useState(1);

  // Both reads share caches with other screens: the member list with the users
  // table (tenancy-scoped server-side, so a partner sees only their own people),
  // and the organisation with the profile and branding screens.
  //
  // ## This list is paged, and it was not
  //
  // It asked for `per_page: 100` and rendered whatever came back with no control
  // and no count — so an organisation with more than a hundred people saw exactly
  // a hundred and had no way to know. That is the failure mode this codebase keeps
  // finding: not a crash, a number that is wrong and looks right. The server caps
  // `per_page` at 100, so asking for more is not a fix either.
  //
  // 25 a page, with the total always on screen. A partner with eight colleagues
  // sees no controls at all; one with two hundred can reach all of them.
  const { data: memberPage, isFetching: usersFetching } = useListUsersQuery({
    page,
    per_page: PER_PAGE,
  });
  const { data: org, isLoading: orgLoading } = useMyOrganisationQuery();

  const members = memberPage?.items ?? [];
  const total = memberPage?.total ?? 0;
  const totalPages = memberPage?.pages ?? 1;
  const organisation = org?.name ?? "";

  // `isFetching` **and** empty: turning a page must not blank the list while the
  // next one arrives, which is the rule `lib/store/api.ts` records for every list
  // screen here.
  const loading = (usersFetching && members.length === 0) || orgLoading;

  const firstOnPage = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const lastOnPage = Math.min(page * PER_PAGE, total);

  const [createInvitation, { isLoading: sending }] = useCreateInvitationMutation();

  const onInvite = async () => {
    if (!email.trim()) return;
    try {
      // No organisation field — the API resolves it from the actor's session.
      // `CreateInvitationPayload` has no place to put one, which is the
      // enforcement rather than a convention.
      await createInvitation({ email: email.trim() }).unwrap();
      setEmail("");
      show("Invitation sent.");
    } catch (e) {
      show(extractApiError(e, "Could not send the invitation."), "error");
    }
  };

  if (loading) {
    return <p className="p-6 text-sm text-ink-muted dark:text-night-muted">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <PageHeading
        title="Your team"
        description={`Everyone at ${organisation || "your organisation"} who can sign in here. Enquiries are visible to all of them.`}
      />

      {canInvite && (
        <div className="mt-6 rounded-[5px] border border-surface-border p-5 dark:border-night-border">
          <h2 className="text-sm font-semibold text-ink dark:text-gray-100">Invite a colleague</h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@yourcompany.com"
              />
            </div>
            <Button onClick={onInvite} loading={sending} disabled={!email.trim()}>
              Send invitation
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-muted dark:text-night-muted">
            They join {organisation || "your organisation"} — you cannot invite somebody into another
            company, and the form has no field for it.
          </p>
        </div>
      )}

      <ul className="mt-8 divide-y divide-surface-border dark:divide-night-border">
        {members.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink dark:text-gray-100">
                {member.full_name}
              </span>
              <span className="block truncate text-xs text-ink-muted dark:text-night-muted">
                {member.email}
              </span>
            </span>
            <span className="text-xs text-ink-muted dark:text-night-muted">{member.status}</span>
          </li>
        ))}
        {members.length === 0 && (
          <li className="py-4 text-sm text-ink-muted dark:text-night-muted">
            Just you so far.
          </li>
        )}
      </ul>

      {/*
        Shown only when there is more than one page. A count and a pair of buttons
        on a team of six would be furniture; on a team of two hundred their absence
        was a lie.
      */}
      {totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-muted dark:text-night-muted">
            Showing {firstOnPage}–{lastOnPage} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || usersFetching}
            >
              Previous
            </Button>
            <span className="text-xs text-ink-muted dark:text-night-muted">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || usersFetching}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
