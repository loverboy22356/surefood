import type { Metadata } from "next";
import "./globals.css";
import "./browse.css";
import "./vendor/vendor.css";
import { AutoLocalize } from "./components/auto-localize";
import { LocaleProvider } from "./components/locale-provider";

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
    <html lang="en">
      <body>
        <LocaleProvider>
          {children}
          <AutoLocalize />
        </LocaleProvider>
      </body>
    </html>
  );
}
