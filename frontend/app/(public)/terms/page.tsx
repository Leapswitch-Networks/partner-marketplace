import type { Metadata } from "next";

import LegalPage from "@/components/public/LegalPage";
import { TERMS_SECTIONS } from "@/lib/public/siteContent";

/**
 * `/terms`.
 *
 * The section structure is modelled on what a comparable Indian service
 * publishes — the platform's own terms run to 25 sections covering KYC, GPU
 * services and CERT-In compliance — but **most of those do not apply to us and
 * were dropped rather than copied.** We do not sell compute; we publish pages
 * about companies that do, and we forward enquiries.
 *
 * So the sections that matter here are the ones that hosting terms have no
 * reason to carry: what verification does and does not promise, what happens to
 * an enquiry, and that Leapswitch is not a party to whatever a buyer agrees
 * with a partner. Those three are the legal shape of this product.
 *
 * ⚠️ **Not reviewed, not binding.** § 20.4 — not drafted by an engineer or an
 * AI. The banner stays until `LEGAL_REVIEWED` flips.
 */
export const metadata: Metadata = {
  title: "Terms",
  description: "The terms governing this directory, what verification means, and how enquiries are handled.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use."
      lede="What this directory is, what verification promises, and what happens to an enquiry once you send it."
      updated="18 August 2026"
      sections={TERMS_SECTIONS}
    />
  );
}
