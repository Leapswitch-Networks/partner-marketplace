import { API_BASE_URL } from "@/lib/utils/constants";

/**
 * A partner's logo, or their initials.
 *
 * ## The fallback is the design, not a placeholder
 *
 * Most partners will not upload a logo, and a directory of grey boxes looks
 * broken. Initials on the brand ground are a deliberate treatment that reads as
 * finished — which is why `has_logo` gates the image rather than an `onError`
 * handler: a fallback that only appears after a failed request shows a broken
 * image first, and shows nothing at all while the request is in flight.
 *
 * ## A plain `<img>`, on purpose
 *
 * The source is a runtime byte stream from our own API, not a build-time asset,
 * so `next/image` has nothing to optimise and would need the route allowlisted
 * in the config for no gain. It also cannot know the intrinsic dimensions, and
 * `next/image` requires them.
 *
 * Width and height are still set explicitly, because the performance budget caps
 * CLS at 0.1 and an unsized image blows that on its own.
 *
 * ⚠️ Browser-facing URL, not the internal one — this renders in the browser, and
 * the container's own address means nothing there.
 */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export default function PartnerLogo({
  name,
  slug,
  hasLogo,
  size = 56,
}: {
  name: string;
  slug: string;
  hasLogo: boolean;
  /** Rendered px. The logo floor is 32 — see `LOGO_BRIEF.md`. */
  size?: number;
}) {
  if (!hasLogo) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className="pub-deep-bg pub-cream flex shrink-0 items-center justify-center rounded-xl font-semibold"
      >
        {initials(name)}
      </span>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`${API_BASE_URL}/api/v1/public/partners/${encodeURIComponent(slug)}/brand/logo`}
      alt={`${name} logo`}
      width={size}
      height={size}
      className="pub-bg shrink-0 rounded-xl object-contain p-1"
      style={{ width: size, height: size }}
    />
  );
}
