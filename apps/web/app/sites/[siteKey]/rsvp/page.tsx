import { SectionHeading } from "@ww/ui";
import type { Metadata } from "next";
import { RsvpDemoForm } from "@/components/rsvp-demo-form";
import { SiteShell } from "@/components/site-chrome";
import { details, rsvpEvents, rsvpHint, rsvpMeals } from "@/content/placeholder";
import { requireSite, type SitePageProps } from "@/lib/site";

export const metadata: Metadata = { title: "RSVP" };

/** Demo RSVP: lookup and submit hit the DB-backed server actions, against seeded fake guests. */
export default async function RsvpPage({ params }: SitePageProps) {
  const { site, base } = await requireSite(params);
  return (
    <SiteShell names={site.name} base={base} current="rsvp" dateLine={details.dateLine}>
      <section className="bg-background px-5 pt-[88px] pb-[120px]">
        <div className="flex flex-col gap-12">
          <SectionHeading
            as="h1"
            eyebrow="RSVP"
            title={
              <>
                We’d love to <em>see you there</em>
              </>
            }
            subtitle={`Kindly reply by ${details.replyBy}. It takes about two minutes.`}
          />
          <p className="text-center text-sm text-muted-foreground">Demo: {rsvpHint}</p>
          <RsvpDemoForm
            deadline={details.replyBy}
            weddingDate={details.weddingDate}
            meals={rsvpMeals}
            extraEvents={rsvpEvents}
          />
        </div>
      </section>
    </SiteShell>
  );
}
