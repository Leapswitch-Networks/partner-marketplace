/**
 * Compile-time proof that the hand-written types in `./index.ts` still match the API.
 *
 * **Types only — this file emits no JavaScript** and costs nothing at runtime. It
 * exists so `tsc --noEmit` fails when the backend and the frontend disagree.
 *
 * ## Why not just use the generated types directly?
 *
 * `./api.d.ts` is generated from `backend/openapi.json` and is the source of truth for
 * *shape*. But it is generated from Pydantic, which types several fields more loosely
 * than the UI wants: `account_type` is `string` there and `"staff" | "partner"` here,
 * because the backend column is a SQLAlchemy `Enum` that Pydantic serialises as `str`.
 * Replacing the hand-written types wholesale would throw away those narrowings, and
 * with them every exhaustive `switch` and every meaningful autocomplete.
 *
 * So the hand-written types stay, and this file asserts they cannot silently drift.
 *
 * ## What is actually asserted, and what it catches
 *
 * **Key sets must match exactly**, in both directions:
 *
 *   - a field the backend **removed or renamed** → `ExtraInUi` is non-empty → build fails
 *   - a field the backend **added** → `MissingInUi` is non-empty → build fails
 *
 * That second direction matters more than it looks. Without it a new response field is
 * invisible to the frontend forever, which is how a feature ships half-wired.
 *
 * **Assignability is asserted separately** for the fields the UI deliberately narrows,
 * so `"staff" | "partner"` still has to be a subset of whatever the backend sends. If
 * the backend ever made `account_type` a number, that assertion breaks.
 *
 * ## The failure mode this replaces
 *
 * Before this, the two were connected by nothing. A renamed backend field produced a
 * **`tsc`-clean frontend that read `undefined` at runtime** — types that agree by
 * convention give the appearance of an enforced contract, which is worse than no types
 * because it stops anyone checking.
 *
 * ## Keeping it honest
 *
 * `api.d.ts` and `openapi.json` are both committed, and CI runs
 * `python -m app.tools.export_openapi --check` plus a regenerate-and-diff on the types.
 * A stale generated file would make these assertions pass against yesterday's API,
 * which is the one way this guard can lie.
 */

import type { components } from "./api";
import type {
  CurrentUser,
  Invitation,
  InvitationCreated,
  ManagedUser,
  ManagedUserDetail,
  NavigationItem,
  NavigationSection,
  Permission,
  PermissionGroup,
  Role,
  RoleSummary,
} from "./index";
import type {
  ActivityEntry,
  MatrixGroupCell,
  MatrixRow,
  NavSectionOption,
  RoleUserItem,
} from "@/lib/api/rbacApi";
import type { Branding } from "@/lib/branding";

type Schemas = components["schemas"];

// --- Assertion machinery ----------------------------------------------------

/** Fails to compile unless `T` is exactly `true`. */
type Assert<T extends true> = T;

/**
 * True when `A` and `B` are identical.
 *
 * The doubled conditional is the standard trick for *invariant* comparison — a plain
 * `A extends B ? B extends A ? true : false : false` reports `true` for pairs that are
 * merely mutually assignable, which would let `any` and optionality differences slip
 * through.
 */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Keys the UI declares that the API does not send — a removed or renamed field. */
type ExtraInUi<Ui, Api> = Exclude<keyof Ui, keyof Api>;

/** Keys the API sends that the UI has not modelled — a new field, silently ignored. */
type MissingInUi<Ui, Api> = Exclude<keyof Api, keyof Ui>;

/**
 * `true` when the key sets match, otherwise a tuple **naming the offending keys**.
 *
 * Returning a tuple rather than `false` is the whole point: `Type 'false' does not
 * satisfy the constraint 'true'` tells you nothing, whereas
 * `Type '["API sends fields the UI has not modelled:", "new_field"]' …` tells you
 * exactly which field and which direction.
 *
 * Note `Assert` is applied at each **use site** below, not inside this alias.
 * Constraining a generic alias's body checks it against unresolved type parameters,
 * where the result is `boolean` rather than `true` and every assertion fails.
 */
type KeysMatch<Ui, Api> = Equals<ExtraInUi<Ui, Api>, never> extends true
  ? Equals<MissingInUi<Ui, Api>, never> extends true
    ? true
    : ["API sends fields the UI has not modelled:", MissingInUi<Ui, Api>]
  : ["UI declares fields the API does not send:", ExtraInUi<Ui, Api>];

// --- The contracts ----------------------------------------------------------
//
// One per type that crosses the wire. Add a line here when you add a response type;
// a schema with no assertion is a schema that can drift.

export type CurrentUserContract = Assert<KeysMatch<CurrentUser, Schemas["CurrentUserResponse"]>>;
export type ManagedUserContract = Assert<KeysMatch<ManagedUser, Schemas["UserListItem"]>>;
export type ManagedUserDetailContract = Assert<
  KeysMatch<ManagedUserDetail, Schemas["UserDetailResponse"]>
>;
export type RoleSummaryContract = Assert<KeysMatch<RoleSummary, Schemas["RoleSummary"]>>;
export type BrandingContract = Assert<KeysMatch<Branding, Schemas["BrandingResponse"]>>;

// --- Added 2026-08-07 ------------------------------------------------------
//
// Five schemas were asserted out of the 67 the API publishes, and the gap cost
// us three times in one day: `getUser` was typed as the list item and hid eleven
// fields; `InvitationCreated` did not exist at all, so `email_sent` was
// unreachable and the create flow could not tell "we emailed them" from "copy
// this link"; and `Preview` on the accept page omitted `expires_at`, so the page
// asserted a hardcoded expiry instead of showing the real one.
//
// Each was invisible until someone tried to render the missing field. The file
// already warned that "a schema with no assertion is a schema that can drift" —
// these are the ones that were drifting.

export type RoleContract = Assert<KeysMatch<Role, Schemas["RoleResponse"]>>;
export type PermissionContract = Assert<KeysMatch<Permission, Schemas["PermissionResponse"]>>;
export type PermissionGroupContract = Assert<
  KeysMatch<PermissionGroup, Schemas["PermissionGroupResponse"]>
>;
export type InvitationContract = Assert<KeysMatch<Invitation, Schemas["InvitationResponse"]>>;
export type InvitationCreatedContract = Assert<
  KeysMatch<InvitationCreated, Schemas["InvitationCreatedResponse"]>
>;
export type ActivityEntryContract = Assert<KeysMatch<ActivityEntry, Schemas["ActivityEntry"]>>;
export type NavigationItemContract = Assert<KeysMatch<NavigationItem, Schemas["NavigationItem"]>>;
export type NavigationSectionContract = Assert<
  KeysMatch<NavigationSection, Schemas["NavigationSection"]>
>;
export type NavSectionOptionContract = Assert<
  KeysMatch<NavSectionOption, Schemas["NavSectionOption"]>
>;
export type RoleUserItemContract = Assert<KeysMatch<RoleUserItem, Schemas["RoleUserItem"]>>;
export type MatrixRowContract = Assert<KeysMatch<MatrixRow, Schemas["MatrixRow"]>>;
export type MatrixGroupCellContract = Assert<
  KeysMatch<MatrixGroupCell, Schemas["MatrixGroupCell"]>
>;

// --- The deliberate narrowings ---------------------------------------------
//
// Each of these is a field the UI types more tightly than Pydantic does. The assertion
// is one-way on purpose: the UI's union must remain a SUBSET of what the API sends.
// If the backend widens the field these still pass; if it changes the field's *kind*,
// they fail.

export type NarrowedFields = Assert<
  CurrentUser["account_type"] extends Schemas["CurrentUserResponse"]["account_type"]
    ? CurrentUser["status"] extends Schemas["CurrentUserResponse"]["status"]
      ? CurrentUser["auth_provider"] extends Schemas["CurrentUserResponse"]["auth_provider"]
        ? true
        : false
      : false
    : false
>;
