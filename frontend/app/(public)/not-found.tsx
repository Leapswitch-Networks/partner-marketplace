import EmptyState from "@/components/public/EmptyState";
import HeadingReveal from "@/components/public/HeadingReveal";
import SearchBar from "@/components/public/SearchBar";
import SectionSlab from "@/components/public/SectionSlab";
import PublicButton from "@/components/public/PublicButton";

/**
 * 404 for the public surface.
 *
 * § 20.4: **a crawled 404 is judged.** A stranger who arrives here from a stale
 * search result forms an opinion of the whole company from this screen, so it
 * gets a real search box, a route back, and the same chrome as every other page
 * rather than a bare apology.
 *
 * ## Why this file exists alongside `app/not-found.tsx`
 *
 * The root 404 wears the signed-in green chrome and offers *"Go to dashboard"* —
 * correct for a signed-in user who mistyped, wrong for a stranger who has never
 * heard of us. This one catches `notFound()` raised inside `(public)`, which is
 * every unknown partner slug and every unknown audience.
 *
 * ⚠️ **A genuinely unmatched URL still falls through to the root 404**, because
 * that is where Next looks when no segment matches at all. So a crawler hitting
 * `/nonsense` gets the app's 404, not this one. Fixing that means deciding which
 * chrome an unmatched URL should wear — a real question, since the root file is
 * shared with the signed-in app — and it is left open rather than guessed at.
 */
export default function PublicNotFound() {
  return (
    <SectionSlab className="pt-16 sm:pt-24">
      <div className="max-w-3xl">
        <p className="pub-deep text-xs font-semibold uppercase tracking-[0.16em] sm:text-sm">404</p>
        <h1 className="pub-display mt-4 text-[2.5rem] leading-[0.95] tracking-[-0.035em] sm:text-6xl">
          <HeadingReveal text="That page is not here." />
        </h1>
        <p className="pub-muted mt-6 text-base leading-relaxed sm:text-lg">
          The address may be out of date, or the partner may no longer be listed. Search the
          directory instead.
        </p>

        <div className="mt-8 max-w-2xl">
          <SearchBar />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <PublicButton href="/partners" variant="secondary" size="md">
            Browse every partner
          </PublicButton>
          <PublicButton href="/" variant="text" size="md">
            Back to the home page
          </PublicButton>
        </div>
      </div>

      <div className="mt-14">
        <EmptyState
          title="Looking for a partner that used to be here?"
          body="Listings come down when they go stale or when a partner stops meeting the verification criteria. Tell us what you were after and we will point you at somebody current."
          action={{ href: "/contact", label: "Ask us" }}
        />
      </div>
    </SectionSlab>
  );
}
