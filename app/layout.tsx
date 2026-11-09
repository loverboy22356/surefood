import type { Metadata } from "next";
import { Figtree, Fraunces } from "next/font/google";
import "./globals.css";
import "./browse.css";
import "./motion.css";
import "./vendor/vendor.css";
import "./theme-dark.css";
import "./theme.css";
import { AutoLocalize } from "./components/auto-localize";
import { LocaleProvider } from "./components/locale-provider";
import { ReferralCapture } from "./components/referral-capture";
import { ThemeProvider } from "./components/theme-provider";
import { themeInitScript } from "./components/theme-script";

// Downloaded once at build time and served from this origin, so text never waits
// on a round trip to Google before it can render.
const figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  weight: "variable",
  variable: "--font-body",
  fallback: ["Segoe UI", "system-ui", "sans-serif"],
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  weight: "variable",
  axes: ["opsz"],
  variable: "--font-brand",
  fallback: ["Iowan Old Style", "Georgia", "serif"],
});

export const metadata: Metadata = {
  title: "Sure Foodz | Fresh, good food",
  description: "Discover fresh groceries and everyday favourites at Sure Foodz — pay later, order for events, and buy from verified local sellers.",
  applicationName: "Sure Foodz",
  openGraph: {
    title: "Sure Foodz",
    description: "Fresh food from verified local sellers across Nigeria.",
    siteName: "Sure Foodz",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${figtree.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <LocaleProvider>
            {children}
            <AutoLocalize />
            <ReferralCapture />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
