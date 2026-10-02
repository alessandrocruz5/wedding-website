"use client";

import { useState } from "react";
import { Badge } from "../core/badge";
import { Button } from "../core/button";
import { Checkbox } from "../forms/checkbox";
import { ChoiceGroup, type ChoiceOption } from "../forms/choice-group";
import { SelectField } from "../forms/select-field";
import { Stepper } from "../forms/stepper";
import { TextField } from "../forms/text-field";
import { StepArc } from "./step-arc";

export interface RsvpLookupResult {
  invitationId: string;
  guests: { id: string; name: string }[];
}

export interface RsvpGuestReply {
  guestId: string;
  attending: boolean;
  meal: string | null;
  /** ids from `extraEvents` */
  events: string[];
}

export interface RsvpSubmission {
  invitationId: string;
  guests: RsvpGuestReply[];
  shuttle: string | null;
  shuttleSeats: number;
  dietary: string | null;
  song: string | null;
  note: string | null;
  email: string;
}

export interface RsvpEvent {
  id: string;
  label: string;
  description?: string;
}

export type RsvpOption = ChoiceOption;

export interface RsvpFormProps {
  deadline?: string;
  weddingDate?: string;
  extraEvents?: RsvpEvent[];
  meals?: RsvpOption[];
  shuttleOptions?: RsvpOption[];
  /**
   * Find the party for a typed name; resolve null (or no guests) when not found. Throw an error
   * with a `userMessage` string to show it. Unlike the design kit there is no demo fallback:
   * without both handlers the form renders closed and collects nothing.
   */
  onLookup?: (name: string) => Promise<RsvpLookupResult | null>;
  /** Persist the reply. Throw to show an error; resolve to show the thank-you screen. */
  onSubmit?: (payload: RsvpSubmission) => Promise<void> | void;
  /** Shown while the form is closed. */
  closedMessage?: string;
}

interface PartyGuest {
  id: string;
  name: string;
  attending: "" | "yes" | "no";
  meal: string;
  events: string[];
}

const STEPS = ["Find your invitation", "Will you join us?", "The details", "A note for us"];

const DEFAULT_EVENTS: RsvpEvent[] = [
  { id: "welcome", label: "Welcome drinks", description: "Friday, 7pm · The Orchard Barn" },
  { id: "brunch", label: "Farewell brunch", description: "Sunday, 10am · Main House lawn" },
];
const DEFAULT_MEALS: RsvpOption[] = [
  { value: "short-rib", label: "Braised short rib", description: "Parsnip purée, charred carrots" },
  { value: "halibut", label: "Roasted halibut", description: "Fennel, brown butter, capers" },
  {
    value: "risotto",
    label: "Wild mushroom risotto",
    description: "Vegetarian · can be made vegan",
  },
];
const DEFAULT_SHUTTLES: RsvpOption[] = [
  { value: "arlo", label: "Hotel Arlo · 3:30pm pickup" },
  { value: "square", label: "Town square · 3:45pm pickup" },
  { value: "drive", label: "I’ll drive myself" },
];

const shellClass =
  "mx-auto box-border w-full max-w-form rounded-form border border-border bg-surface px-[clamp(20px,6vw,52px)] pb-9 font-body text-foreground shadow-md";
const introClass =
  "m-0 text-center font-body text-[16px] leading-[1.6] font-light text-pretty text-ink-soft";
const footerClass =
  "mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-[22px]";

function userMessage(err: unknown, fallback: string): string {
  const message = (err as { userMessage?: unknown } | null)?.userMessage;
  return typeof message === "string" ? message : fallback;
}

/** The custom multi-step RSVP: find the invitation, reply per guest, details, then a note. */
export function RsvpForm({
  deadline = "August 1",
  weddingDate = "Saturday, October 16",
  extraEvents = DEFAULT_EVENTS,
  meals = DEFAULT_MEALS,
  shuttleOptions = DEFAULT_SHUTTLES,
  onLookup,
  onSubmit,
  closedMessage = "Replies aren’t open yet. We’ll let you know as soon as they are.",
}: RsvpFormProps) {
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [party, setParty] = useState<PartyGuest[]>([]);
  const [shuttle, setShuttle] = useState("");
  const [seats, setSeats] = useState(1);
  const [dietary, setDietary] = useState("");
  const [song, setSong] = useState("");
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!onLookup || !onSubmit) {
    return (
      <div className={`${shellClass} pt-12`}>
        <StepArc steps={STEPS} current={0} />
        <div className="mt-7 flex flex-col gap-[26px]">
          <p className={introClass}>
            We’ve saved a seat for you. Enter your name as it appears on your invitation and we’ll
            find your party.
          </p>
          <TextField label="Full name" placeholder="e.g. Jordan Ellis" disabled />
          <p
            role="status"
            className="m-0 rounded-card bg-calm px-5 py-3 text-center text-small text-pretty text-calm-foreground"
          >
            {closedMessage}
          </p>
        </div>
        <div className={footerClass}>
          <span className="text-small text-muted-foreground">Kindly reply by {deadline}</span>
          <Button disabled>Find invitation</Button>
        </div>
      </div>
    );
  }

  const attending = party.filter((g) => g.attending === "yes");
  const updateGuest = (id: string, patch: Partial<PartyGuest>) =>
    setParty((p) => p.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const first = party[0]?.name.split(" ")[0] ?? "";

  const validate = () => {
    const e: Record<string, string> = {};
    if (step === 0 && query.trim().length < 2)
      e.query = "Please enter the name on your invitation.";
    if (step === 1)
      party.forEach((g, i) => {
        if (!g.attending) e[`att${i}`] = "Please choose one.";
      });
    if (step === 2) {
      attending.forEach((g) => {
        if (!g.meal) e[`meal${g.id}`] = "Please choose a dinner.";
      });
      if (!shuttle) e.shuttle = "Let us know how you’re getting to the farm.";
    }
    if (step === 3 && !/^\S+@\S+\.\S+$/.test(email)) e.email = "We’ll send your confirmation here.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = async () => {
    if (busy || !validate()) return;
    if (step === 0) {
      setBusy(true);
      try {
        const found = await onLookup(query.trim());
        if (!found?.guests.length) {
          setErrors({
            query: "We couldn’t find that name. Try it exactly as it appears on your invitation.",
          });
          return;
        }
        setInvitationId(found.invitationId);
        setParty(found.guests.map((g) => ({ ...g, attending: "", meal: "", events: [] })));
        setStep(1);
      } catch (err) {
        setErrors({
          query: userMessage(err, "Something went wrong on our end. Please try again."),
        });
      } finally {
        setBusy(false);
      }
      return;
    }
    if (step === 1 && attending.length === 0) {
      setStep(3);
      return;
    }
    if (step === 3) {
      const going = attending.length > 0;
      const payload: RsvpSubmission = {
        invitationId: invitationId ?? "",
        guests: party.map((g) => ({
          guestId: g.id,
          attending: g.attending === "yes",
          meal: g.attending === "yes" ? g.meal || null : null,
          events: g.attending === "yes" ? g.events : [],
        })),
        shuttle: going ? shuttle || null : null,
        shuttleSeats: going && shuttle && shuttle !== "drive" ? seats : 0,
        dietary: dietary.trim() || null,
        song: song.trim() || null,
        note: note.trim() || null,
        email: email.trim(),
      };
      setBusy(true);
      try {
        await onSubmit(payload);
        setDone(true);
      } catch (err) {
        setErrors({
          email: userMessage(err, "We couldn’t send your RSVP. Please try again in a moment."),
        });
      } finally {
        setBusy(false);
      }
      return;
    }
    setStep(step + 1);
  };

  const back = () => {
    setErrors({});
    setStep(step === 3 && attending.length === 0 ? 1 : Math.max(0, step - 1));
  };

  if (done) {
    const yes = attending.length > 0;
    const mealLabel = (v: string) => meals.find((m) => m.value === v)?.label;
    return (
      <div className={`${shellClass} flex flex-col items-center gap-6 pt-14 text-center`}>
        <div
          className={`box-border grid h-[208px] w-[168px] place-items-center rounded-arch pt-6 ${yes ? "bg-accent" : "bg-primary"}`}
        >
          <span className="font-heading text-[36px] leading-none text-primary-foreground italic">
            Thank you
          </span>
        </div>
        <h3 className="m-0 font-heading text-[36px] leading-[1.1] font-normal text-balance">
          {yes ? `We can’t wait to celebrate with you, ${first}.` : `We’ll miss you, ${first}.`}
        </h3>
        <div className="flex w-full flex-col gap-2.5">
          {party.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between gap-3 rounded-full bg-muted px-5 py-3.5 text-left"
            >
              <span className="text-[16px]">
                {g.name}
                {g.attending === "yes" && g.meal ? (
                  <span className="text-muted-foreground"> · {mealLabel(g.meal)}</span>
                ) : null}
              </span>
              <Badge tone={g.attending === "yes" ? "sage" : "clay"}>
                {g.attending === "yes" ? "Attending" : "Declined"}
              </Badge>
            </div>
          ))}
        </div>
        <p className={`${introClass} text-[15px]`}>
          A confirmation email is on its way to {email}. You can change your reply until {deadline}.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setDone(false);
            setStep(0);
          }}
        >
          Edit response
        </Button>
      </div>
    );
  }

  return (
    <div className={`${shellClass} pt-12`}>
      <StepArc steps={STEPS} current={step} />
      <div className="mt-7 flex flex-col gap-[26px]">
        {step === 0 ? (
          <>
            <p className={introClass}>
              We’ve saved a seat for you. Enter your name as it appears on your invitation and we’ll
              find your party.
            </p>
            <TextField
              label="Full name"
              placeholder="e.g. Jordan Ellis"
              value={query}
              required
              error={errors.query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void next();
              }}
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="flex justify-center">
              <Badge tone="sage">Party of {party.length}</Badge>
            </div>
            {party.map((g, i) => (
              <div key={g.id} className="flex flex-col gap-3.5">
                <span className="font-heading text-[28px] leading-[1.1] font-medium text-foreground">
                  {g.name}
                </span>
                <ChoiceGroup
                  variant="arch"
                  columns={2}
                  value={g.attending}
                  error={errors[`att${i}`]}
                  onChange={(v) => updateGuest(g.id, { attending: v as PartyGuest["attending"] })}
                  options={[
                    { value: "yes", label: "Joyfully accepts", description: weddingDate },
                    {
                      value: "no",
                      label: "Regretfully declines",
                      description: "Celebrating from afar",
                    },
                  ]}
                />
                {g.attending === "yes" ? (
                  <div className="flex flex-col gap-3 rounded-card bg-muted px-[22px] py-[18px]">
                    <span className="text-eyebrow font-medium tracking-label text-ink-soft uppercase">
                      Also joining us for
                    </span>
                    {extraEvents.map((ev) => (
                      <Checkbox
                        key={ev.id}
                        label={ev.label}
                        description={ev.description}
                        checked={g.events.includes(ev.id)}
                        onChange={(c) =>
                          updateGuest(g.id, {
                            events: c ? [...g.events, ev.id] : g.events.filter((x) => x !== ev.id),
                          })
                        }
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </>
        ) : null}

        {step === 2 ? (
          <>
            {attending.map((g) => (
              <ChoiceGroup
                key={g.id}
                variant="card"
                columns={1}
                label={`Dinner for ${g.name}`}
                required
                value={g.meal}
                error={errors[`meal${g.id}`]}
                options={meals}
                onChange={(v) => updateGuest(g.id, { meal: v })}
              />
            ))}
            <TextField
              label="Allergies or dietary needs"
              hint="Optional — our caterer will reach out if needed."
              value={dietary}
              onChange={(e) => setDietary(e.target.value)}
            />
            <SelectField
              label="Wedding-day shuttle"
              required
              placeholder="Choose a pickup"
              options={shuttleOptions}
              value={shuttle}
              error={errors.shuttle}
              onChange={(v) => {
                setShuttle(v);
                setSeats(attending.length);
              }}
            />
            {shuttle && shuttle !== "drive" ? (
              <Stepper
                label="Seats needed"
                hint="Shuttles return at 11pm and midnight."
                value={seats}
                min={1}
                max={attending.length}
                onChange={setSeats}
              />
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            {attending.length > 0 ? (
              <TextField
                label="A song that gets you dancing"
                placeholder="Artist — song"
                value={song}
                onChange={(e) => setSong(e.target.value)}
              />
            ) : null}
            <TextField
              multiline
              rows={4}
              label="A note for the couple"
              hint="Optional"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <TextField
              type="email"
              label="Email for your confirmation"
              required
              placeholder="you@example.com"
              value={email}
              error={errors.email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </>
        ) : null}
      </div>

      <div className={footerClass}>
        {step > 0 ? (
          <Button variant="ghost" onClick={back}>
            ← Back
          </Button>
        ) : (
          <span className="text-small text-muted-foreground">Kindly reply by {deadline}</span>
        )}
        <Button onClick={() => void next()} disabled={busy}>
          {busy
            ? step === 0
              ? "Searching…"
              : "Sending…"
            : step === 0
              ? "Find invitation"
              : step === 3
                ? "Send RSVP"
                : "Continue"}
        </Button>
      </div>
    </div>
  );
}
