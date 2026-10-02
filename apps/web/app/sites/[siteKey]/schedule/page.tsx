import { ArcDivider, Badge, Card, SectionHeading } from "@ww/ui";
import type { Metadata } from "next";
import { SiteShell } from "@/components/site-chrome";
import { details, scheduleDays } from "@/content/placeholder";
import { requireSite, type SitePageProps } from "@/lib/site";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage({ params }: SitePageProps) {
  const { site, base } = await requireSite(params);
  return (
    <SiteShell names={site.name} base={base} current="schedule" dateLine={details.dateLine}>
      <section className="mx-auto box-border flex max-w-[880px] flex-col gap-16 px-6 pt-[88px] pb-[120px]">
        <SectionHeading
          as="h1"
          eyebrow="Schedule"
          title={
            <>
              The weekend, <em>hour by hour</em>
            </>
          }
          subtitle="All times Eastern. We’ll text any changes to guests who RSVP with a phone number."
        />
        {scheduleDays.map((d) => (
          <div key={d.day} className="flex flex-col gap-[22px]">
            <div className="flex flex-col items-center gap-3.5">
              <h2 className="m-0 font-heading text-h2 font-normal italic">{d.day}</h2>
              <ArcDivider variant="rule" width={220} />
            </div>
            {d.items.map((it) => (
              <div
                key={it.name}
                className="grid grid-cols-[minmax(84px,120px)_minmax(0,1fr)] items-start gap-[clamp(12px,3vw,28px)]"
              >
                <div className="pt-[22px] text-right">
                  <span className="font-heading text-[34px] leading-none">{it.time}</span>
                  <span className="ml-1 text-[13px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                    {it.ampm}
                  </span>
                </div>
                <Card padding={24} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <span className="font-heading text-h3">{it.name}</span>
                    <span className="text-small font-medium text-primary">{it.place}</span>
                  </div>
                  <p className="m-0 text-[16px] leading-[1.6] text-ink-soft">{it.note}</p>
                  {it.badges.length > 0 ? (
                    <div className="mt-1 flex gap-2">
                      {it.badges.map(([tone, label]) => (
                        <Badge key={label} tone={tone}>
                          {label}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </Card>
              </div>
            ))}
          </div>
        ))}
      </section>
    </SiteShell>
  );
}
