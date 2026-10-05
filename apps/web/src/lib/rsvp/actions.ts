"use server";

import { getPoolDb, guests, rsvpResponses, withSite } from "@ww/db";
import type { RsvpLookupResult } from "@ww/ui";
import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getSite } from "../site";
import { SITE_HEADER } from "../tenant-context";
import { lookupNameSchema, rsvpSubmissionSchema } from "./schema";

/**
 * Errors come back as values: Next redacts thrown messages in production. The form's
 * `onSubmit` throws to show an error, so the page adapts `{ ok: false }` into a throw.
 */
export type SubmitRsvpResult = { ok: true } | { ok: false; error: string };

const MESSAGES = {
  invalid: "Some of your answers couldn’t be saved. Please check them and try again.",
  email: "This demo only accepts example addresses, like you@example.com.",
  unknownInvitation: "We couldn’t find your invitation. Please look it up again.",
  failed: "We couldn’t send your RSVP. Please try again in a moment.",
} as const;

/**
 * The site this request is for, from the header middleware sets (it strips any client copy).
 * Never from the payload: a reply can only land on the site whose page posted it.
 */
async function currentSiteId(): Promise<string | null> {
  const key = (await headers()).get(SITE_HEADER);
  if (!key) return null;
  return (await getSite(key))?.id ?? null;
}

/** Postgres SQLSTATE of a failed query (Drizzle wraps the driver error in `cause`). */
function pgCode(error: unknown): string | undefined {
  const e = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = e?.code ?? e?.cause?.code;
  return typeof code === "string" ? code : undefined;
}

// Driver errors quote the query params (names, emails): log the SQLSTATE only, never the error.
function logFailure(action: "lookup" | "submit", error: unknown) {
  console.error(`[rsvp] ${action} failed`, { code: pgCode(error) ?? "unknown" });
}

/**
 * Exact (case-insensitive) name match within the current site. Returns the matched party, or
 * null when the name is unknown or ambiguous (in more than one party): no list, no hints.
 */
export async function lookupInvitation(name: unknown): Promise<RsvpLookupResult | null> {
  const parsed = lookupNameSchema.safeParse(name);
  if (!parsed.success) return null;
  const siteId = await currentSiteId();
  if (!siteId) return null;

  try {
    return await withSite(getPoolDb(), siteId, async (tx) => {
      const matches = await tx
        .selectDistinct({ invitationId: guests.invitationId })
        .from(guests)
        .where(
          and(eq(guests.siteId, siteId), sql`lower(${guests.fullName}) = lower(${parsed.data})`),
        )
        .limit(2);
      if (matches.length !== 1) return null;
      const invitationId = matches[0]!.invitationId;
      const party = await tx
        .select({ id: guests.id, name: guests.fullName })
        .from(guests)
        .where(and(eq(guests.siteId, siteId), eq(guests.invitationId, invitationId)))
        .orderBy(guests.sortOrder, guests.id);
      return { invitationId, guests: party };
    });
  } catch (error) {
    logFailure("lookup", error);
    // A fresh error, cause dropped on purpose: the original carries the typed name.
    // eslint-disable-next-line preserve-caught-error
    throw new Error("RSVP lookup failed");
  }
}

/**
 * Saves the party's reply. One row per invitation: resubmitting replaces the answers in place
 * (same row, `updated_at` bumped), so repeating a submit is harmless.
 */
export async function submitRsvp(payload: unknown): Promise<SubmitRsvpResult> {
  const parsed = rsvpSubmissionSchema.safeParse(payload);
  if (!parsed.success) {
    const emailIssue = parsed.error.issues.some((i) => i.path[0] === "email");
    return { ok: false, error: emailIssue ? MESSAGES.email : MESSAGES.invalid };
  }
  const reply = parsed.data;
  const siteId = await currentSiteId();
  if (!siteId) return { ok: false, error: MESSAGES.failed };

  try {
    return await withSite(getPoolDb(), siteId, async (tx): Promise<SubmitRsvpResult> => {
      const party = await tx
        .select({ id: guests.id })
        .from(guests)
        .where(and(eq(guests.siteId, siteId), eq(guests.invitationId, reply.invitationId)));
      if (party.length === 0) return { ok: false, error: MESSAGES.unknownInvitation };
      // The reply must cover exactly this party (the DB only checks the jsonb's size and shape).
      const ids = new Set(party.map((g) => g.id));
      if (reply.guests.length !== ids.size || !reply.guests.every((g) => ids.has(g.guestId))) {
        return { ok: false, error: MESSAGES.invalid };
      }

      const answers = {
        guests: reply.guests,
        shuttle: reply.shuttle,
        shuttleSeats: reply.shuttleSeats,
        dietary: reply.dietary,
        song: reply.song,
        note: reply.note,
        email: reply.email,
      };
      // No RETURNING and no `excluded.*`: ww_app can read back only `invitation_id`.
      await tx
        .insert(rsvpResponses)
        .values({ siteId, invitationId: reply.invitationId, ...answers })
        .onConflictDoUpdate({
          target: rsvpResponses.invitationId,
          set: { ...answers, updatedAt: sql`now()` },
        });
      return { ok: true };
    });
  } catch (error) {
    const code = pgCode(error);
    // 23514: a CHECK the schema should have caught. 23503: the party was removed (reseed) meanwhile.
    if (code === "23514") return { ok: false, error: MESSAGES.invalid };
    if (code === "23503") return { ok: false, error: MESSAGES.unknownInvitation };
    logFailure("submit", error);
    return { ok: false, error: MESSAGES.failed };
  }
}
