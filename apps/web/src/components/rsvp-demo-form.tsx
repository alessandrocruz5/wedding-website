"use client";

import { RsvpForm, type RsvpFormProps, type RsvpSubmission } from "@ww/ui";
import { lookupInvitation, submitRsvp } from "@/lib/rsvp/actions";

/**
 * Wires the RSVP server actions into the form. The actions return errors as values (Next
 * redacts thrown messages in production); the form shows an error only when `onSubmit` throws
 * a `userMessage`, so `{ ok: false }` is turned back into a throw here.
 */
async function onSubmit(payload: RsvpSubmission) {
  const result = await submitRsvp(payload);
  if (!result.ok) throw { userMessage: result.error };
}

export function RsvpDemoForm(props: Omit<RsvpFormProps, "onLookup" | "onSubmit">) {
  return <RsvpForm {...props} onLookup={lookupInvitation} onSubmit={onSubmit} />;
}
