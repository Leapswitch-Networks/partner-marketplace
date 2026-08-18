import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PageHero from "@/components/public/PageHero";
import PublicButton from "@/components/public/PublicButton";
import SectionSlab from "@/components/public/SectionSlab";
import { fetchEnquiry } from "@/lib/api/public";

/**
 * `/enquiries/[reference]` — the buyer's own thread.
 *
 * ## The reference is the credential
 *
 * The buyer has no account, by design (decision 9 stays open and anonymous is
 * the default). So possession of an unguessable string is the whole of the
 * authorisation — it is generated with `secrets` on the backend, and that makes
 * three things mandatory rather than advisable:
 *
 * 1. **`noindex, nofollow`.** A crawled capability URL is a leaked one.
 * 2. **Excluded from the sitemap** — `app/sitemap.ts` never lists these.
 * 3. **Disallowed in `robots.ts`**, which it is.
 *
 * ## What it shows, and what it must not
 *
 * The thread, the partner's name, and whether anyone has replied. **Nothing
 * about other enquiries, other partners, or the buyer beyond what they typed** —
 * § 20.4. The response model on the backend carries exactly that and no more,
 * so there is nothing here to over-render.
 */
export const metadata: Metadata = {
  title: "Your enquiry",
  // The one page on the surface that must never be indexed.
  robots: { index: false, follow: false },
};

export default async function EnquiryStatusPage({
  params,
}: {
  params: { reference: string };
}) {
  const enquiry = await fetchEnquiry(params.reference).catch(() => null);
  if (!enquiry) notFound();

  const answered = Boolean(enquiry.first_responded_at);

  return (
    <>
      <PageHero
        eyebrow={`Reference ${enquiry.reference}`}
        title={answered ? `${enquiry.partner_name} replied.` : `Waiting for ${enquiry.partner_name}.`}
        lede={
          answered
            ? "Their answer is below. Reply to them directly using the contact details they gave you."
            : "They have your message and have not answered yet. We measure whether they do — it is part of what verification means here."
        }
      />

      <SectionSlab className="pt-12 sm:pt-16">
        <ol className="max-w-3xl space-y-4">
          {enquiry.messages.map((message) => (
            <li
              key={message.id}
              className={
                message.direction === "FROM_BUYER"
                  ? "pub-border-thick rounded-[1.25rem] p-5 sm:p-6"
                  : "pub-deep-bg pub-cream rounded-[1.25rem] p-5 sm:p-6"
              }
            >
              <p
                className={
                  message.direction === "FROM_BUYER"
                    ? "pub-muted text-xs font-semibold uppercase tracking-[0.1em]"
                    : "text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--public-cream-70)]"
                }
              >
                {message.direction === "FROM_BUYER" ? "You" : enquiry.partner_name} ·{" "}
                {new Date(message.created_at).toLocaleString()}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-[0.9375rem] leading-relaxed">
                {message.body}
              </p>
            </li>
          ))}
        </ol>

        <p className="pub-muted mt-8 max-w-3xl text-sm leading-relaxed">
          Keep this page&rsquo;s address — it is how you check back, and it is the only way in. We
          did not create an account for you and we will not email you anything you did not ask for.
        </p>

        <div className="mt-8">
          <PublicButton href="/partners" variant="secondary" size="md">
            Back to the directory
          </PublicButton>
        </div>
      </SectionSlab>
    </>
  );
}
