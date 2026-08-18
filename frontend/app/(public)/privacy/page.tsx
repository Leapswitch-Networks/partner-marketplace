import type { Metadata } from "next";

import LegalPage from "@/components/public/LegalPage";
import { PRIVACY_SECTIONS } from "@/lib/public/siteContent";

/**
 * `/privacy`.
 *
 * Structured around the **Digital Personal Data Protection Act, 2023** — the
 * framework the platform's own policy is written to, including the Data
 * Fiduciary role, Data Principal rights, the Grievance Officer, and escalation
 * to the Data Protection Board of India.
 *
 * ## The one section a hosting privacy policy does not need
 *
 * *"Who we share it with."* An enquiry is personal data that we deliberately
 * hand to a third party — the partner — and that is the entire point of the
 * product. § 20.4 requires this page to state plainly that the data is shared
 * with the partner contacted, which is why it is section 4 rather than buried,
 * and why section 5 says in as many words what we do not do with it.
 *
 * **This page is non-optional the moment a public form collects a name, an
 * email and a phone number** — which is why it is being built now, alongside
 * `/become-a-partner`, rather than at the end.
 *
 * ⚠️ Not reviewed, not binding. See `LegalNotice`.
 */
export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What we collect when you send an enquiry, who it goes to, and your rights under the DPDPA, 2023.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy."
      lede="An enquiry is personal data, and we hand it to the partner you chose. That is the point of it. Here is exactly what happens, and what never does."
      updated="18 August 2026"
      sections={PRIVACY_SECTIONS}
    />
  );
}
