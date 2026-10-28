import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "SureFood | Fresh, good food",
  description: "Discover fresh groceries and everyday favourites at SureFood.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
