import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Providers from "@/components/common/Providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

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
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
