import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import Providers from "@/components/common/Providers";
import BrandingProvider from "@/components/common/BrandingProvider";
import TitleSync from "@/components/common/TitleSync";
import "./globals.css";
import { getBranding, themeStyleRule } from "@/lib/branding";
import { APP_NAME, APP_TAGLINE } from "@/lib/utils/constants";

// Viho's body font, adopted 2026-08-05. Loaded through `next/font` exactly as
// Inter was — never a Google Fonts <link>, which would cost us the self-hosting
// and reintroduce layout shift. Montserrat is a variable font here, so the whole
// 100–900 range costs one file.
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });

// Static, so the 16 routes stay prerendered (DYNAMIC_BRANDING_PLAN § 3.2). `icons` is
// a CONSTANT string pointing at a handler whose *bytes* vary — that is what makes the
// favicon runtime-configurable without making metadata dynamic.
//
// `app/favicon.ico` (the file convention, baked at build) moved to `public/`, where it
// still answers the bare path as the fallback. See `app/brand/favicon/route.ts` for why
// the handler cannot simply live at `/favicon.ico`.
export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
  icons: { icon: "/brand/favicon" },
};

// Injected before React hydration — eliminates dark-mode flash on page load.
//
// Must agree with `lib/hooks/useTheme.ts` on all three stored values, including
// the explicit 'system'. Treating an unrecognised value as "follow the OS" is what
// makes the pre-3-way stored values keep working rather than forcing light mode.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var dark=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark)document.documentElement.classList.add('dark');}catch(e){}})();`;

// `async` so the branding can be resolved server-side, once, for every route.
//
// This does NOT make routes dynamic: `getBranding` fetches with `next.revalidate`,
// which is compatible with static generation. Verified against the build output —
// the static/dynamic split is unchanged at 15/3. Using `cache: "no-store"` here, or
// reading cookies, would flip all 15. See DYNAMIC_BRANDING_PLAN § 3.2.
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const branding = await getBranding();
  const themeRule = themeStyleRule(branding);

  return (
    <html lang="en" className={`${montserrat.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Brand theme, server-resolved. Rendered in <head> so it applies before
            first paint — no flash of the default colour. Overrides the complete
            default theme in globals.css; null when the default is in force. */}
        {themeRule && <style dangerouslySetInnerHTML={{ __html: themeRule }} />}
      </head>
      {/* `text-sm` is Viho's 14px body baseline. Our components already set
          text-sm explicitly almost everywhere, so this mainly catches unstyled
          text that was inheriting Tailwind's 16px default. */}
      <body className="min-h-full flex flex-col font-sans text-sm bg-white dark:bg-night-body text-gray-900 dark:text-gray-100 transition-colors duration-200">
        <BrandingProvider branding={branding}>
          <TitleSync />
          <Providers>{children}</Providers>
        </BrandingProvider>
      </body>
    </html>
  );
}
