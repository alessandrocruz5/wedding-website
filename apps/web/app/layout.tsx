import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import type { ReactNode } from "react";
import { platformOrigin } from "../src/lib/resolve-host";
import { getTenantConfig } from "../src/lib/tenant-context";
import "./globals.css";

// Self-hosted at build time: guest pages make no requests to Google. @ww/ui's default
// font tokens read these variables.
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});
const body = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});

const description =
  "A whitelabel wedding-site platform: shared-schema multi-tenancy, Postgres row-level security and token-based theming. Three live demo sites.";

export const metadata: Metadata = {
  metadataBase: new URL(platformOrigin(getTenantConfig().rootDomain)),
  title: "Wedding",
  description,
  openGraph: { title: "Wedding", description, type: "website", siteName: "Wedding" },
  twitter: { card: "summary_large_image", title: "Wedding", description },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
