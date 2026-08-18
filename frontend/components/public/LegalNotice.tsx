import { TriangleAlert } from "lucide-react";

/**
 * The banner that sits at the top of `/terms` and `/privacy` until somebody who
 * owns compliance has signed them off.
 *
 * `PARTNER_DIRECTORY_PLAN.md` § 20.4 is unambiguous that these two pages are
 * **not drafted by an engineer or an AI**. The pages exist so the design can be
 * reviewed and so the structure is agreed early — publishing unreviewed legal
 * text as though it were binding is a different thing entirely, and this banner
 * is what keeps the two apart.
 *
 * It disappears when `LEGAL_REVIEWED` flips in `siteContent.ts`. Deleting the
 * banner without that review is the failure mode; it is one import either way,
 * so there is no reason to.
 */
export default function LegalNotice() {
  return (
    <p
      role="status"
      className="pub-bg-alt pub-ink flex items-start gap-2.5 rounded-2xl border-2 border-[color:var(--public-ink-30)] px-4 py-3 text-sm font-medium"
    >
      <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <strong>Draft — not yet reviewed.</strong> This page sets out the structure and the plain
        intent of the document. It has not been through legal review and is not binding on anyone
        until it has.
      </span>
    </p>
  );
}
