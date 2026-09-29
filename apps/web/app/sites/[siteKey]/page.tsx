import { Button, Card } from "@ww/ui";
import { notFound } from "next/navigation";
import { getSite } from "@/lib/site";

/** Placeholder shell until Sprint 2's content model; exists to prove per-site theming. */
export default async function SiteHome({ params }: { params: Promise<{ siteKey: string }> }) {
  const site = await getSite((await params).siteKey);
  if (!site) notFound();
  return (
    <main>
      <header className="bg-primary px-6 py-20 text-center text-primary-foreground">
        <p className="mb-3 inline-block rounded-md bg-accent px-3 py-1 text-sm text-accent-foreground">
          We&rsquo;re getting married
        </p>
        <h1 className="text-5xl">{site.name}</h1>
      </header>
      <section className="mx-auto grid max-w-3xl gap-6 px-6 py-12 sm:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-2xl">The day</h2>
          <p className="text-muted-foreground">Details are on their way.</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-2xl">RSVP</h2>
          <p className="mb-4 text-muted-foreground">Opens soon.</p>
          <Button disabled>RSVP</Button>
        </Card>
      </section>
    </main>
  );
}
