"use client";

import { usePathname } from "next/navigation";

/**
 * Decorative artwork for the auth split-screen's left panel.
 *
 * ⚠️ **Original work, not Viho's.** The theme's own illustrations are licensed
 * assets and `documentation/design/assets/screenshots/README.md` forbids putting
 * the theme's images in this repo — which is public. Tracing them from
 * `login.png` / `register.png` would produce a derivative of a paid asset, so
 * these are hand-authored in the same *style* (flat vector, brand palette,
 * floating "sticker" composition). Style is not the licensed part; the artwork is.
 *
 * Deliberately geometric — device mockups, cards, notes, plants — rather than
 * character illustration. Hand-coded human figures read as amateurish, and the
 * figure is also the most distinctive part of Viho's art. If you later license or
 * commission a real illustration, drop it in place of `<AuthArt />` and the layout
 * needs no change.
 *
 * Both variants share one viewBox so the panel never reflows between routes, and
 * every surface carries a `dark:` counterpart per `UI_PATTERNS.md` § Dark Mode.
 */

/** Faint background line-art — leaf sprigs and wave arcs, in both screenshots. */
function Backdrop() {
  return (
    <g className="stroke-surface-border dark:stroke-night-border" fill="none" strokeWidth={1.2}>
      {/* wave arcs, top right */}
      {[0, 7, 14, 21, 28].map((d) => (
        <path key={`w${d}`} d={`M ${430 + d} 4 Q ${492 + d} 54 ${452 + d} 118`} />
      ))}
      {/* wave arcs, bottom left */}
      {[0, 7, 14, 21].map((d) => (
        <path key={`v${d}`} d={`M ${18 - d} 452 Q ${62 - d} 396 ${26 - d} 336`} />
      ))}
      {/* leaf sprig, top left */}
      <g transform="translate(26 26) rotate(28)">
        <path d="M0 0 L96 22" />
        {[10, 27, 44, 61, 78].map((x, i) => (
          <g key={`la${x}`}>
            <ellipse cx={x} cy={x * 0.23 - 11} rx="11" ry="5.5" transform={`rotate(${-32 + i * 3} ${x} ${x * 0.23 - 11})`} />
            <ellipse cx={x + 4} cy={x * 0.23 + 12} rx="11" ry="5.5" transform={`rotate(${32 - i * 3} ${x + 4} ${x * 0.23 + 12})`} />
          </g>
        ))}
      </g>
      {/* leaf sprig, bottom right */}
      <g transform="translate(486 430) rotate(206)">
        <path d="M0 0 L82 18" />
        {[12, 30, 48, 66].map((x, i) => (
          <g key={`lb${x}`}>
            <ellipse cx={x} cy={x * 0.22 - 10} rx="10" ry="5" transform={`rotate(${-30 + i * 4} ${x} ${x * 0.22 - 10})`} />
            <ellipse cx={x + 4} cy={x * 0.22 + 11} rx="10" ry="5" transform={`rotate(${30 - i * 4} ${x + 4} ${x * 0.22 + 11})`} />
          </g>
        ))}
      </g>
    </g>
  );
}

/** Ground shadow the stickers sit on. */
function Ground() {
  return <ellipse cx="260" cy="418" rx="150" ry="15" className="fill-brand/[.07]" />;
}

function LoginArt() {
  return (
    <>
      <Backdrop />
      <Ground />

      {/* picture-frame stickers, left */}
      <g className="fill-white dark:fill-night-body stroke-surface-border dark:stroke-night-border" strokeWidth={1.5}>
        <rect x="34" y="150" width="74" height="74" rx="3" />
        <rect x="52" y="248" width="58" height="58" rx="3" />
      </g>
      <path d="M52 214 l22 -26 14 16 12 -12 v32 z" className="fill-brand/20" />
      <path d="M66 298 l16 -20 12 14 10 -10 v22 z" className="fill-accent/30" />

      {/* phone */}
      <g>
        <rect x="176" y="70" width="168" height="316" rx="26" className="fill-ink dark:fill-black" />
        <rect x="186" y="80" width="148" height="296" rx="19" className="fill-white dark:fill-night-body" />
        <rect x="238" y="88" width="44" height="6" rx="3" className="fill-ink/40 dark:fill-white/20" />

        {/* screen: avatar, title, fields, button */}
        <circle cx="260" cy="146" r="30" className="fill-brand" />
        <circle cx="260" cy="137" r="10" className="fill-white" />
        <path d="M243 163 a17 17 0 0 1 34 0 z" className="fill-white" />
        <rect x="228" y="190" width="64" height="9" rx="4.5" className="fill-ink dark:fill-white" />
        <rect x="206" y="220" width="108" height="16" rx="4" className="fill-brand/15" />
        <rect x="206" y="246" width="108" height="16" rx="4" className="fill-brand/15" />
        <rect x="222" y="278" width="76" height="26" rx="5" className="fill-brand" />
        <rect x="240" y="288" width="40" height="6" rx="3" className="fill-white/90" />
        <circle cx="248" cy="330" r="4" className="fill-brand/30" />
        <circle cx="262" cy="330" r="5" className="fill-brand" />
        <circle cx="276" cy="330" r="4" className="fill-brand/30" />
      </g>

      {/* padlock, overlapping the phone */}
      <g transform="translate(104 168)">
        <path d="M22 44 v-14 a26 26 0 0 1 52 0 v14" fill="none" className="stroke-accent-light" strokeWidth={13} strokeLinecap="round" />
        <rect x="0" y="42" width="96" height="76" rx="9" className="fill-brand" />
        <circle cx="48" cy="74" r="11" className="fill-white" />
        <path d="M44 80 h8 l3 22 h-14 z" className="fill-white" />
      </g>

      {/* plant, right */}
      <g transform="translate(368 288)">
        <path d="M28 44 c-26 -12 -34 -40 -26 -60 20 4 34 26 30 58 z" className="fill-brand" />
        <path d="M34 44 c22 -16 26 -42 16 -58 -18 8 -28 30 -22 56 z" className="fill-brand/70" />
        <path d="M4 46 h56 l-9 52 a6 6 0 0 1 -6 5 h-26 a6 6 0 0 1 -6 -5 z" className="fill-accent" />
        <rect x="0" y="38" width="64" height="12" rx="4" className="fill-accent-dark" />
      </g>

      {/* small dots */}
      <circle cx="150" cy="120" r="5" className="fill-accent/60" />
      <circle cx="392" cy="150" r="7" className="fill-brand/30" />
      <circle cx="128" cy="352" r="4" className="fill-brand/40" />
    </>
  );
}

function RegisterArt() {
  return (
    <>
      <Backdrop />
      <Ground />

      {/* browser-window card, centre */}
      <g>
        <rect x="150" y="118" width="230" height="164" rx="8" className="fill-white dark:fill-night-body stroke-surface-border dark:stroke-night-border" strokeWidth={1.5} />
        <path d="M150 126 a8 8 0 0 1 8 -8 h214 a8 8 0 0 1 8 8 v16 H150 z" className="fill-brand/15" />
        <circle cx="166" cy="134" r="4" className="fill-brand" />
        <circle cx="180" cy="134" r="4" className="fill-accent" />
        <circle cx="194" cy="134" r="4" className="fill-brand/40" />
        <rect x="168" y="164" width="86" height="60" rx="4" className="fill-brand/10" />
        <path d="M176 214 l18 -22 13 15 11 -12 v19 z" className="fill-brand" />
        <circle cx="212" cy="180" r="7" className="fill-accent" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x="268" y={166 + i * 16} width={i === 3 ? 56 : 92} height="8" rx="4" className="fill-brand/20" />
        ))}
        <rect x="168" y="240" width="140" height="8" rx="4" className="fill-brand/20" />
        <rect x="168" y="256" width="96" height="8" rx="4" className="fill-brand/20" />
      </g>

      {/* image-card stickers, top */}
      <g className="fill-white dark:fill-night-body stroke-surface-border dark:stroke-night-border" strokeWidth={1.5}>
        <rect x="96" y="52" width="76" height="62" rx="5" transform="rotate(-11 134 83)" />
        <rect x="384" y="60" width="70" height="58" rx="5" transform="rotate(9 419 89)" />
      </g>
      <path d="M112 100 l18 -22 13 15 10 -11 v20 z" className="fill-brand/70" transform="rotate(-11 134 83)" />
      <path d="M398 106 l16 -20 12 14 9 -10 v18 z" className="fill-accent/70" transform="rotate(9 419 89)" />

      {/* lightbulb in a thought circle, left */}
      <g transform="translate(40 132)">
        <circle cx="46" cy="46" r="44" fill="none" className="stroke-surface-border dark:stroke-night-border" strokeWidth={1.5} />
        <path d="M46 20 a19 19 0 0 1 11 34 v7 h-22 v-7 a19 19 0 0 1 11 -34 z" className="fill-brand" />
        <rect x="37" y="64" width="18" height="6" rx="3" className="fill-accent" />
        <rect x="39" y="73" width="14" height="5" rx="2.5" className="fill-accent-dark" />
        <circle cx="12" cy="102" r="7" fill="none" className="stroke-surface-border dark:stroke-night-border" strokeWidth={1.5} />
      </g>

      {/* sticky note, right */}
      <g transform="rotate(8 428 232)">
        <rect x="396" y="196" width="66" height="66" rx="4" className="fill-accent/25" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x="408" y={214 + i * 14} width={i === 2 ? 24 : 42} height="6" rx="3" className="fill-accent-dark/60" />
        ))}
      </g>

      {/* phone with a checklist, bottom left */}
      <g transform="translate(74 262) rotate(-8)">
        <rect x="0" y="0" width="82" height="140" rx="13" className="fill-ink dark:fill-black" />
        <rect x="6" y="6" width="70" height="128" rx="9" className="fill-white dark:fill-night-body" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x="15" y={24 + i * 24} width="12" height="12" rx="3" className={i < 2 ? "fill-brand" : "fill-brand/20"} />
            <rect x="34" y={28 + i * 24} width="30" height="5" rx="2.5" className="fill-brand/25" />
          </g>
        ))}
      </g>

      {/* grid-paper note, bottom right */}
      <g transform="translate(360 296) rotate(-6)">
        <rect x="0" y="0" width="88" height="76" rx="4" className="fill-white dark:fill-night-body stroke-surface-border dark:stroke-night-border" strokeWidth={1.5} />
        <g className="stroke-brand/15" strokeWidth={1}>
          {[1, 2, 3].map((i) => <path key={`h${i}`} d={`M0 ${i * 19} H88`} />)}
          {[1, 2, 3, 4].map((i) => <path key={`v${i}`} d={`M${i * 17.6} 0 V76`} />)}
        </g>
        <path d="M14 52 l16 -18 12 13 10 -10 14 15 v10 h-52 z" className="fill-brand/50" />
      </g>

      {/* small dots */}
      <circle cx="196" cy="330" r="5" className="fill-accent/60" />
      <circle cx="470" cy="176" r="6" className="fill-brand/30" />
      <circle cx="30" cy="60" r="4" className="fill-brand/40" />
    </>
  );
}

export default function AuthArt() {
  const pathname = usePathname();
  const isRegister = pathname?.startsWith("/sign-up") ?? false;

  return (
    <svg
      viewBox="0 0 520 460"
      role="presentation"
      aria-hidden="true"
      className="h-auto w-full max-w-[560px]"
    >
      {isRegister ? <RegisterArt /> : <LoginArt />}
    </svg>
  );
}
