# RSVP demo script

For the portfolio video. All guests are **fake**; the demo accepts only example email addresses.

## Before you record

1. Reseed so no earlier reply is showing (use the target DB's `MIGRATE_DATABASE_URL`):
   `ALLOW_DEMO_SEED=1 pnpm --filter @ww/db seed:rsvp`
   It deletes and recreates the 8 demo parties; their replies go with them. Run it before every
   take, and at least weekly on prod.
2. Open `/rsvp` on the preview/prod deploy (the default site is `ana-and-ben`).

## Click path

1. Type **Maya Santos** and press **Find my invitation**. Names are exact match (case-insensitive).
   Others to try: **Jun Tanaka** (his party includes a plus-one, "Guest of Jun Tanaka").
2. For each guest choose **Joyfully accepts** or **Regretfully declines**.
   For accepting guests pick a meal and any extra events.
3. Continue through the steps; add dietary notes, a song or a note if you like.
4. Enter the email **you@example.com**. Real addresses are rejected on purpose.
5. Submit. The **thank-you screen** appears.

## Check the result

The reply is one row in `rsvp_responses` for that invitation:

```sql
select invitation_id, email, updated_at from rsvp_responses;
```

Resubmitting the same party updates that row instead of adding another.

## Reset

Re-run the seed command above: the row is gone and the party can reply again.

## If it doesn't work

- "We couldn't find your invitation": the name isn't an exact match, or `0002_rsvp` / the seed
  hasn't been applied to that environment's DB.
- "This demo only accepts example addresses": use `you@example.com`.
