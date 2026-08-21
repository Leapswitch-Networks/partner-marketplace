"use client";

import { useRef, useState } from "react";

import PageHeading from "@/components/common/PageHeading";
import Button from "@/components/common/Button";
import Toast, { useToast } from "@/components/common/Toast";
// `uploadBrandAsset` stays a direct call — see the note on `onUpload` below.
import { uploadBrandAsset } from "@/lib/api/directoryApi";
import {
  useClearBrandAssetMutation,
  useMyOrganisationQuery,
} from "@/lib/api/endpoints/directoryEndpoints";
import { extractApiError } from "@/lib/utils/apiError";

const ASSETS = [
  {
    key: "logo" as const,
    label: "Logo",
    hint: "PNG, JPEG, WebP or SVG. Rendered as small as 32 pixels tall, so a wordmark with fine detail will not read — a mark or initials works better.",
    accept: "image/png,image/jpeg,image/webp,image/svg+xml",
  },
  {
    key: "banner" as const,
    label: "Profile banner",
    hint: "PNG, JPEG or WebP. Wide and photographic. No SVG — a banner is always rendered large, so vector buys nothing.",
    accept: "image/png,image/jpeg,image/webp",
  },
];

/**
 * `/dashboard/organisation/branding` — a partner's logo and banner.
 *
 * ## The 32-pixel floor is stated, not implied
 *
 * `LOGO_BRIEF.md` records that the logo renders as small as 32px tall, and that
 * a single-colour mark is what survives it. A partner who uploads a detailed
 * wordmark and sees it turn to mush will blame the site, so the constraint is on
 * the page next to the upload rather than in a document nobody reads.
 *
 * ## No client-side validation, deliberately
 *
 * The server checks size, magic bytes rather than the declared type or the
 * filename, dimensions, and scans SVG for script, embedded HTML, external
 * references and DOCTYPEs. Duplicating any of that here would be a second thing
 * to keep in agreement with the first — and the first is the one that has been
 * thought about. `accept` on the input is a file-picker convenience, not a
 * control; it is trivially bypassed and is not relied on.
 *
 * The server's refusals are shown verbatim, because they are more specific than
 * anything this page could invent — "that image is 4000×3000, the limit is
 * 2048×2048" beats "upload failed".
 *
 * ## Previews come from the public serving route
 *
 * Not from a local object URL. That means what a partner sees here is exactly the
 * bytes a visitor gets, including the cache behaviour — and a timestamp on the
 * query busts it after a replacement, which is the one case where a stale image
 * would be actively confusing.
 */
export default function BrandingModule() {
  const { toasts, show, dismiss } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [version, setVersion] = useState(() => 0);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  // Converted 2026-08-21. The organisation is shared with the profile and team
  // screens, so this no longer fetches its own copy.
  const { data: org, isLoading: loading, refetch } = useMyOrganisationQuery();
  const [clearAsset] = useClearBrandAssetMutation();

  /**
   * ⚠️ **The upload is deliberately NOT a cache mutation.**
   *
   * It sends a `File` inside `FormData`, and a mutation's argument ends up in a
   * dispatched Redux action — so a File would trip the store's
   * `serializableCheck`, which `lib/store/index.ts` keeps on purpose ("dropping
   * serializableCheck to add one middleware is how a store loses its dev-time
   * guardrails"). Weakening that for one upload is a bad trade.
   *
   * So this one call goes direct and then refetches by hand. It is the only place
   * in the app that does, and this comment is why — without it the next reader
   * would reasonably "tidy" it into the slice and reintroduce the warning.
   */
  const onUpload = async (asset: "logo" | "banner", file: File) => {
    setBusy(asset);
    try {
      await uploadBrandAsset(asset, file);
      await refetch();
      // Bust the preview: the URL is unchanged, so without this the browser
      // shows the image it already has.
      setVersion((v) => v + 1);
      show(`${asset === "logo" ? "Logo" : "Banner"} updated.`);
    } catch (e) {
      show(extractApiError(e, "That file was refused."), "error");
    } finally {
      setBusy(null);
      const input = inputs.current[asset];
      // Clear the input, or picking the same file again fires no change event.
      if (input) input.value = "";
    }
  };

  const onClear = async (asset: "logo" | "banner") => {
    setBusy(asset);
    try {
      // Clearing carries no body, so it is an ordinary mutation — and it
      // invalidates the record, so no manual refetch here.
      await clearAsset(asset).unwrap();
      setVersion((v) => v + 1);
      show("Removed.");
    } catch (e) {
      show(extractApiError(e, "Could not remove it."), "error");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <p className="p-6 text-sm text-ink-muted dark:text-night-muted">Loading…</p>;
  }
  if (!org) {
    return (
      <p className="p-6 text-sm text-ink-muted dark:text-night-muted">
        Your account is not attached to an organisation.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <PageHeading
        title="Logo and banner"
        description="What appears on your public profile. Both are optional — without a logo, your card shows your initials, which is deliberate rather than a placeholder."
      />

      <div className="mt-8 space-y-8">
        {ASSETS.map((asset) => {
          const has =
            asset.key === "logo" ? Boolean(org.logo_mime ?? null) : Boolean(org.banner_mime ?? null);
          const src = `/api/v1/public/partners/${org.slug}/brand/${asset.key}?v=${version}`;
          return (
            <section
              key={asset.key}
              className="rounded-[5px] border border-surface-border p-5 dark:border-night-border"
            >
              <h2 className="text-sm font-semibold text-ink dark:text-gray-100">{asset.label}</h2>
              <p className="mt-1 text-xs text-ink-muted dark:text-night-muted">{asset.hint}</p>

              {has && (
                <div className="mt-4">
                  {/* Deliberately a plain <img>: this is a runtime-variable
                      byte stream from our own API, not a build-time asset, so
                      next/image has nothing to optimise and would need the route
                      allowlisted for no gain. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`${org.name} ${asset.label.toLowerCase()}`}
                    className={
                      asset.key === "logo"
                        ? "h-12 w-auto rounded bg-surface-wash p-1 dark:bg-night-body"
                        : "h-32 w-full rounded object-cover"
                    }
                  />
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  ref={(el) => {
                    inputs.current[asset.key] = el;
                  }}
                  type="file"
                  accept={asset.accept}
                  aria-label={`Upload ${asset.label.toLowerCase()}`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onUpload(asset.key, file);
                  }}
                  className="text-sm text-ink-label file:mr-3 file:rounded-[5px] file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white dark:text-night-muted"
                />
                {has && (
                  <Button
                    size="sm"
                    variant="danger"
                    loading={busy === asset.key}
                    onClick={() => onClear(asset.key)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
