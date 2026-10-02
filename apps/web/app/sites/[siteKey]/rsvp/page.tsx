import { RsvpForm, SectionHeading } from "@ww/ui";
import type { Metadata } from "next";
import { SiteShell } from "@/components/site-chrome";
import { details } from "@/content/placeholder";
import { requireSite, type SitePageProps } from "@/lib/site";

export const metadata: Metadata = { title: "RSVP" };

/**
 * The form renders closed: no lookup/submit handlers until Sprint 3 adds invitations, guest
 * storage under RLS and the PII controls. Nothing is collected or sent from this page.
 */
export default async function RsvpPage({ params }: SitePageProps) {
  const { site, base } = await requireSite(params);
  return (
    <SiteShell names={site.name} base={base} current="rsvp" dateLine={details.dateLine}>
      <section className="bg-muted px-5 pt-[88px] pb-[120px]">
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
          <RsvpForm deadline={details.replyBy} weddingDate={details.weddingDate} />
        </div>
      </section>
    </SiteShell>
  );
}
