import { ThemeProvider } from "@ww/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getSite } from "@/lib/site";

interface Props {
  children: ReactNode;
  params: Promise<{ siteKey: string }>;
}

// ISR: each site key renders on first request and is cached; nothing is prebuilt.
export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await getSite((await params).siteKey);
  return site ? { title: { default: site.name, template: `%s · ${site.name}` } } : {};
}

export default async function SiteLayout({ children, params }: Props) {
  const site = await getSite((await params).siteKey);
  if (!site) notFound();
  return (
    // Light only: the Arc & Hearth design has no dark mode (WW-3).
    <ThemeProvider preset={site.theme.preset} tokens={site.theme.tokens} mode="light">
      <div className="min-h-dvh">{children}</div>
    </ThemeProvider>
  );
}
