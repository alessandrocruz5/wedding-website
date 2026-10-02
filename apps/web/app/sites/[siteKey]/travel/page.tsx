import { Accordion, ArchFrame, Badge, buttonClasses, Card, SectionHeading } from "@ww/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell, sitePath } from "@/components/site-chrome";
import { details, faqs, hotels, travelModes } from "@/content/placeholder";
import { requireSite, type SitePageProps } from "@/lib/site";

export const metadata: Metadata = { title: "Travel & FAQ" };

export default async function TravelPage({ params }: SitePageProps) {
  const { site, base } = await requireSite(params);
  return (
    <SiteShell names={site.name} base={base} current="travel" dateLine={details.dateLine}>
      <div className="mx-auto box-border flex max-w-content flex-col gap-[72px] px-6 pt-[88px] pb-[120px]">
        <SectionHeading
          as="h1"
          eyebrow="Travel & stay"
          title={
            <>
              Getting to <em>Hollis Farm</em>
            </>
          }
          subtitle="The farm is about two hours north of the city. We’ve held rooms at two nearby spots — book by September 1."
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6">
          {hotels.map((h) => (
            <Card key={h.name} padding={20} className="flex flex-col gap-4">
              <ArchFrame shape="rounded" aspect={1.7} tone={h.tone} label="Hotel photo" />
              <div className="flex flex-col items-start gap-2.5 px-2 pb-2">
                <span className="font-heading text-h3">{h.name}</span>
                <span className="text-[15px] text-ink-soft">{h.meta}</span>
                <Badge tone="dark">{h.badge}</Badge>
                {h.bookingUrl ? (
                  <a
                    href={h.bookingUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                    className={buttonClasses({ variant: "ghost", className: "pl-0" })}
                  >
                    Book a room →
                  </a>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
        <Card
          variant="sunken"
          padding={36}
          className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-7"
        >
          {travelModes.map(([title, text]) => (
            <div key={title} className="flex flex-col gap-2">
              <span className="text-eyebrow font-medium tracking-eyebrow text-primary uppercase">
                {title}
              </span>
              <span className="text-[16px] leading-[1.6] text-ink-soft">{text}</span>
            </div>
          ))}
        </Card>
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8">
          <SectionHeading size="md" eyebrow="Good to know" title="Questions & answers" />
          <Accordion name="faq" items={faqs} />
          <div className="text-center">
            <Link href={sitePath(base, "rsvp")} className={buttonClasses()}>
              Ready? RSVP
            </Link>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
