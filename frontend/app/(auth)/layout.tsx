import AuthArt from "@/components/auth/AuthArt";
import { getBranding } from "@/lib/branding";

/**
 * Auth shell — Viho's split-screen auth layout.
 *
 * Measured from `documentation/design/assets/screenshots/login.png` and
 * `register.png` (1917×933):
 *
 * | Thing | Measured |
 * |---|---|
 * | Left panel | `#ffffff`, carries the artwork |
 * | Right panel | `#eaf0ef` — brand at 10%, so `bg-brand/10` |
 * | Card | exactly **450px**, **centred in the right panel**, **no border**, no shadow |
 *
 * The two screenshots disagree on the split (the login shot gives the form 41.6%
 * of the width, the register shot 58.3%). We standardise on the login
 * proportions — it is the screen the owner originally shared — so the form panel
 * is `42%` on both. That needs a ~1215px viewport to seat a 450px card with
 * breathing room, so below `lg` the artwork panel is dropped and the form panel
 * goes full width rather than crushing the card.
 *
 * ⚠️ **The artwork is original, not Viho's.** Its illustrations are licensed
 * theme assets and `documentation/design/assets/screenshots/README.md` forbids
 * committing the theme's own images — screenshots of rendered pages only. So
 * `AuthArt` is hand-authored in the same style and palette rather than traced
 * from the screenshots. It swaps per route, and a commissioned illustration can
 * replace it without touching this file.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const branding = await getBranding();

  return (
    <div className="flex min-h-screen">
      {/* Artwork panel — hidden until there is room for it.
          Measured against login.png: this panel is pure #ffffff, with only very
          faint decoration in the far corners. Earlier attempts put a dot texture
          across the whole panel and tinted it to #f3f7f6, which read as grey
          rather than white — so the decoration is corner-only and the centre is
          left clean. */}
      <aside className="relative hidden flex-1 items-center justify-center overflow-hidden bg-white lg:flex dark:bg-night-card">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-brand/[.05] blur-3xl"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -right-40 h-[30rem] w-[30rem] rounded-full bg-brand/[.04] blur-3xl"
        />

        <div className="relative flex w-full flex-col items-center px-10">
          <AuthArt />
          <div className="mt-2 flex flex-col items-center text-center">
            <h2 className="text-[22px] font-semibold text-ink dark:text-white">
              {branding.app_name}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-ink-muted dark:text-night-muted">
              {branding.tagline}
            </p>
          </div>
        </div>
      </aside>

      {/* Form panel — the brand wash, with the 450px card centred in it.
          Uses the opaque `surface-wash` token, not `bg-brand/10`. Both are
          "brand at 10%", but alpha compositing over white rounds to #e9f0ee
          while the theme's own rendered value is #eaf0ef — one value out. The
          flattened token is exact and does not depend on what sits behind it. */}
      <main className="flex w-full items-center justify-center bg-surface-wash px-3 py-[30px] lg:w-[42%] lg:shrink-0 dark:bg-night-body">
        {children}
      </main>
    </div>
  );
}
