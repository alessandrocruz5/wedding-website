import { ArcDivider, ArchFrame, Badge, buttonClasses, Card, Names, SectionHeading } from "@ww/ui";
import Link from "next/link";
import { HeroCarousel } from "@/components/hero-carousel";
import { SiteShell, sitePath } from "@/components/site-chrome";
import { details, heroSlides, story, weekendEvents } from "@/content/placeholder";
import { requireSite, type SitePageProps } from "@/lib/site";

const eyebrow = "text-eyebrow font-medium tracking-eyebrow text-primary uppercase";

export default async function SiteHome({ params }: SitePageProps) {
  const { site, base } = await requireSite(params);
  return (
    <SiteShell
      names={site.name}
      base={base}
      current="home"
      dateLine={details.dateLine}
      footerOnCalm
    >
      <HeroCarousel slides={heroSlides}>
        <div className="mx-auto box-border flex max-w-content flex-col items-center gap-[22px] px-6 pt-20 pb-24 text-center text-inverse-foreground">
          <span className="text-eyebrow font-medium tracking-eyebrow uppercase">
            Together with their families
          </span>
          {/* Ampersand lightened toward linen: plain clay-light dips under 3:1 on the brightest photo. */}
          <h1 className="m-0 font-normal [&_em]:text-[color-mix(in_srgb,var(--color-clay-light)_60%,var(--color-inverse-foreground))]">
            <Names names={site.name} className="text-display-xl" />
          </h1>
          <span className="text-body-lg font-light">{details.dateLine}</span>
          <div className="mt-1.5 flex flex-wrap justify-center gap-3">
            <Link href={sitePath(base, "rsvp")} className={buttonClasses({ size: "lg" })}>
              RSVP by {details.replyBy}
            </Link>
            <Link
              href={sitePath(base, "schedule")}
              className={buttonClasses({ size: "lg", variant: "inverse" })}
            >
              The weekend
            </Link>
          </div>
        </div>
      </HeroCarousel>

      <ArcDivider variant="scallop" color="var(--color-calm)" className="relative -mt-3.5" />
      <section className="bg-calm py-24">
        <div className="mx-auto box-border grid max-w-content grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-center gap-14 px-6">
          <ArchFrame
            shape="arch"
            aspect={0.8}
            inset
            tone="sand"
            label="How we met"
            className="max-w-[380px] justify-self-center"
          />
          <div className="flex flex-col gap-[22px]">
            <SectionHeading
              align="left"
              size="md"
              eyebrow="Our story"
              title={
                <>
                  It started with a <em>borrowed umbrella.</em>
                </>
              }
            />
            <p className="m-0 max-w-[520px] text-body-lg leading-[1.65] font-light text-ink-soft">
              {story}
            </p>
            <div>
              <Link
                href={sitePath(base, "schedule")}
                className={buttonClasses({ variant: "ghost" })}
              >
                See the weekend →
              </Link>
            </div>
          </div>
        </div>
      </section>
      <ArcDivider variant="scallop" color="var(--color-calm)" className="rotate-180" />

      <section className="mx-auto box-border flex max-w-content flex-col gap-14 px-6 py-28">
        <SectionHeading
          eyebrow={details.weekendRange}
          title={
            <>
              Three days, <em>one long table</em>
            </>
          }
          subtitle="Join us for as much of the weekend as you can. Everything happens at Hollis Farm unless noted."
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-[22px]">
          {weekendEvents.map((e) => (
            <Card
              key={e.name}
              variant="arch"
              padding={28}
              className="flex flex-col items-center gap-2.5"
            >
              <span className={eyebrow}>{e.day}</span>
              <span className="font-heading text-[32px] leading-[1.1]">{e.name}</span>
              <span className="text-[15px] text-ink-soft">{e.time}</span>
              <Badge tone="ochre" className="mt-1.5">
                {e.attire}
              </Badge>
            </Card>
          ))}
        </div>
      </section>

      <ArcDivider variant="scallop" color="var(--color-calm)" />
      <section className="bg-calm px-6 py-20">
        <div className="mx-auto flex max-w-content flex-col items-center gap-[22px] text-center">
          <SectionHeading
            size="md"
            eyebrow={`Kindly reply by ${details.replyBy}`}
            title="Will you join us?"
          />
          <Link href={sitePath(base, "rsvp")} className={buttonClasses({ size: "lg" })}>
            RSVP now
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
