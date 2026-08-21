/**
 * The one place a build-time API failure is allowed to be survivable.
 *
 * ## The problem this solves
 *
 * `/partners/[slug]` and `/services/[category]` both enumerate their pages in
 * `generateStaticParams`, which runs **at build time** and reads the live API. So
 * `npm run build` requires a reachable backend — and CI has none, which is why
 * the build job had been failing with `TypeError: fetch failed` while every other
 * check passed. A permanently-red build check is one nobody reads, so it was
 * catching nothing.
 *
 * ## Why the escape hatch is here and not in `lib/api/public.ts`
 *
 * That module's docstring makes a promise and `DIRECTORY_BUILD_PUNCHLIST` 6.2
 * turns it into a test: **stop the backend and the page must fail visibly.** A
 * fetcher that returns placeholder data on failure is how a page ships looking
 * healthy while reading nothing. Nothing here weakens that — page *rendering*
 * still throws.
 *
 * What this touches is only the build-time question "which pages exist", which is
 * a different question from "what does this page show".
 *
 * ## Why it is opt-in, and loud
 *
 * These routes set `dynamicParams = false`, so a build that enumerates **no**
 * slugs produces a site where every partner page is a hard 404. Returning `[]`
 * silently on any failure would turn a missing backend into a directory that
 * builds cleanly and serves nothing — strictly worse than a failed build.
 *
 * So without `BUILD_WITHOUT_API=1` the error is rethrown and the build fails,
 * which is the correct outcome for anything you intend to deploy. With the flag,
 * the failure is announced on stderr and the build continues.
 *
 * ⚠️ **A build produced with `BUILD_WITHOUT_API=1` is not deployable.** Its only
 * use is proving the project compiles. CI sets it and discards the output.
 */
export async function staticParamsOrEmpty<T>(
  label: string,
  enumerate: () => Promise<T[]>
): Promise<T[]> {
  try {
    return await enumerate();
  } catch (error) {
    if (process.env.BUILD_WITHOUT_API !== "1") {
      // Rethrow with the reason attached: the bare `TypeError: fetch failed`
      // Next surfaces names neither the route nor the cause, and that is what
      // made this failure take a while to place.
      throw new Error(
        `generateStaticParams for ${label} could not reach the API. A deployable ` +
          `build needs INTERNAL_API_URL to resolve, because these routes set ` +
          `dynamicParams = false and a build with no params serves 404 for every ` +
          `one of them. Set BUILD_WITHOUT_API=1 only to prove the project ` +
          `compiles — that build must not be deployed. Cause: ${String(error)}`,
        { cause: error }
      );
    }
    console.warn(
      `[build] BUILD_WITHOUT_API=1 — ${label} enumerated no pages because the API ` +
        `was unreachable. THIS BUILD IS NOT DEPLOYABLE; every one of these routes ` +
        `will 404. Cause: ${String(error)}`
    );
    return [];
  }
}
