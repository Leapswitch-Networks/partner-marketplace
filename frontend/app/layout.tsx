import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import Providers from "@/components/common/Providers";
import "./globals.css";

// Viho's body font, adopted 2026-08-05. Loaded through `next/font` exactly as
// Inter was — never a Google Fonts <link>, which would cost us the self-hosting
// and reintroduce layout shift. Montserrat is a variable font here, so the whole
// 100–900 range costs one file.
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });

export const metadata: Metadata = {
  title: "Partner Marketplace",
  description: "Partner marketplace platform",
};

// Injected before React hydration — eliminates dark-mode flash on page load.
//
// Must agree with `lib/hooks/useTheme.ts` on all three stored values, including
// the explicit 'system'. Treating an unrecognised value as "follow the OS" is what
// makes the pre-3-way stored values keep working rather than forcing light mode.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var dark=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${montserrat.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* `text-sm` is Viho's 14px body baseline. Our components already set
          text-sm explicitly almost everywhere, so this mainly catches unstyled
          text that was inheriting Tailwind's 16px default. */}
      <body className="min-h-full flex flex-col font-sans text-sm bg-white dark:bg-night-body text-gray-900 dark:text-gray-100 transition-colors duration-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
