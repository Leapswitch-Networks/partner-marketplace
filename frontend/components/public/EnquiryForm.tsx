"use client";

import { useState } from "react";

import PublicButton from "./PublicButton";

/**
 * The enquiry form — a component, never a route.
 *
 * § 6.4 of the directory plan: making it its own page loses the context the
 * buyer was reading, which is the thing that makes an enquiry worth receiving.
 * So it lives on the profile (and later the listing detail) and never navigates
 * away on success — § 20.4 is explicit that a redirect destroys the context and
 * the back button.
 *
 * ## Fields, and why two optional ones are here
 *
 * Name, email and message are required; phone and company are optional.
 * **Budget and timeline are optional and they are the point** — § 6.4 records
 * that those two raise lead quality sharply, and a partner deciding whether to
 * reply within the hour is really deciding on those two lines.
 *
 * ## It posts to the public API, and the failure states are real
 *
 * `POST /public/enquiries` — the only unauthenticated write in the application.
 * Three defences sit behind it, in order of how much they are worth: the backend
 * rate limit (6/min per address, the real control because it survives somebody
 * posting directly), the honeypot field below, and schema validation.
 *
 * **No captcha** until there is a spam problem to solve (§ 20.4) — it costs
 * every honest buyer something to prevent a problem we have not had.
 *
 * **A failure renders a message the buyer can act on.** § 20.4 forbids silent
 * failure specifically: a form that swallows an error has taken somebody's
 * enquiry and told them it arrived.
 *
 * ## The success state names what happens next
 *
 * It shows the reference and links to it, because that URL is the buyer's only
 * way back to their own thread — they have no account.
 */
export default function EnquiryForm({
  partnerName,
  partnerSlug,
}: {
  partnerName: string;
  /** Resolved to an id by the profile page's own fetch — the form posts the id. */
  partnerSlug?: string;
  partnerId?: string;
}) {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (sent) {
    return (
      <div className="pub-border-thick rounded-[1.25rem] p-6 sm:rounded-[1.5rem] sm:p-8">
        <h3 className="pub-display text-2xl leading-tight tracking-[-0.02em]">
          Sent to {partnerName}.
        </h3>
        <p className="pub-muted mt-3 text-sm leading-relaxed">
          Your reference is{" "}
          <strong className="pub-ink">{sent}</strong>. Keep it — it is how you check back, and you
          do not need an account.
        </p>
        <a
          href={`/enquiries/${encodeURIComponent(sent)}`}
          className="pub-focus pub-deep mt-5 inline-block text-sm font-semibold underline underline-offset-4"
        >
          Track this enquiry
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        const form = new FormData(e.currentTarget);
        try {
          const res = await fetch("/api/public/enquiries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              partner_slug: partnerSlug,
              buyer_name: form.get("name"),
              buyer_email: form.get("email"),
              buyer_phone: form.get("phone") || null,
              company: form.get("company") || null,
              message: form.get("message"),
              budget_range: form.get("budget") || null,
              timeline: form.get("timeline") || null,
              website: form.get("website") || null,
            }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.detail ?? "That did not send.");
          }
          const body = await res.json();
          setSent(body.reference);
        } catch (err) {
          // § 20.4 forbids silent failure — a swallowed error means we took
          // somebody's enquiry and told them it arrived.
          setError(err instanceof Error ? err.message : "That did not send. Try again.");
        } finally {
          setBusy(false);
        }
      }}
      className="pub-border-thick rounded-[1.25rem] p-6 sm:rounded-[1.5rem] sm:p-8"
    >
      <h3 className="pub-display text-2xl leading-tight tracking-[-0.02em]">
        Send {partnerName} an enquiry
      </h3>
      <p className="pub-muted mt-2 text-sm leading-relaxed">
        It goes to them and to nobody else. No account needed.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field name="name" label="Your name" required />
        <Field name="email" label="Email" type="email" required />
        <Field name="phone" label="Phone" type="tel" />
        <Field name="company" label="Company" />
        <Field name="budget" label="Budget range" placeholder="₹1–5 lakh" />
        <Field name="timeline" label="Timeline" placeholder="Within a month" />
      </div>

      <div className="mt-4">
        <label htmlFor="message" className="pub-ink block text-sm font-medium">
          What do you need? <span className="pub-deep">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={4}
          className="pub-focus pub-bg pub-ink mt-1.5 w-full rounded-xl border-2 border-[color:var(--public-ink-30)] px-3 py-2.5 text-base outline-none focus:border-[color:var(--public-ink)]"
        />
      </div>

      {/* Honeypot. A real browser leaves it empty; a bot fills every field it
          finds. Hidden from sight and from assistive technology, and named
          innocuously — "honeypot" would be a hint. */}
      <div aria-hidden className="hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {error && (
        <p role="alert" className="pub-ink mt-4 rounded-xl border-2 border-[color:var(--public-wine)] px-4 py-3 text-sm">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <PublicButton type="submit" variant="primary" size="md" disabled={busy}>
          {busy ? "Sending…" : "Send enquiry"}
        </PublicButton>
        <p className="pub-muted text-xs leading-relaxed">
          By sending this you agree to our{" "}
          <a href="/privacy" className="pub-deep underline underline-offset-2">
            privacy policy
          </a>
          . Your details are shared with {partnerName}.
        </p>
      </div>
    </form>
  );
}

/** Local, because nothing else on the surface takes text input yet. When a
 *  second form appears, this moves to its own file rather than being copied. */
function Field({
  name,
  label,
  type = "text",
  required,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={name} className="pub-ink block text-sm font-medium">
        {label} {required && <span className="pub-deep">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="pub-focus pub-bg pub-ink mt-1.5 min-h-11 w-full rounded-xl border-2 border-[color:var(--public-ink-30)] px-3 py-2.5 text-base outline-none placeholder:text-[color:var(--public-ink-50)] focus:border-[color:var(--public-ink)]"
      />
    </div>
  );
}
