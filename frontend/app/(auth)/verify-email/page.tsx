import { Metadata } from "next";
import VerifyEmailClient from "@/components/auth/VerifyEmailClient";

export const metadata: Metadata = {
  title: "Confirm your email — Partner Marketplace",
  // Emailed links should never be indexed: the URL contains a token.
  robots: { index: false, follow: false },
};

/**
 * `/verify-email?token=…` — the destination of the link in a verification email.
 *
 * The token is read from `searchParams` on the server and handed to the client
 * component as a prop, rather than read from `window.location` in the browser.
 * That way the page renders with the token already available and there is no
 * flash of "nothing to confirm" before the query string is parsed.
 */
export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  return <VerifyEmailClient token={searchParams.token ?? null} />;
}
