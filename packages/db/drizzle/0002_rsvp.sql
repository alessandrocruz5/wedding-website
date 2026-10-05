CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"invitation_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guests_full_name_length" CHECK (char_length("guests"."full_name") between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_site_id_id_unique" UNIQUE("site_id","id"),
	CONSTRAINT "invitations_label_length" CHECK (char_length("invitations"."label") between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "rsvp_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"invitation_id" uuid NOT NULL,
	"guests" jsonb NOT NULL,
	"shuttle" text,
	"shuttle_seats" integer DEFAULT 0 NOT NULL,
	"dietary" text,
	"song" text,
	"note" text,
	"email" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rsvp_responses_invitation_id_unique" UNIQUE("invitation_id"),
	CONSTRAINT "rsvp_responses_guests_shape" CHECK (case when jsonb_typeof("rsvp_responses"."guests") = 'array'
        then jsonb_array_length("rsvp_responses"."guests") between 1 and 20 and pg_column_size("rsvp_responses"."guests") <= 16384
        else false end),
	CONSTRAINT "rsvp_responses_shuttle_seats_range" CHECK ("rsvp_responses"."shuttle_seats" between 0 and 20),
	CONSTRAINT "rsvp_responses_email_length" CHECK (char_length("rsvp_responses"."email") between 3 and 254),
	CONSTRAINT "rsvp_responses_email_reserved_domain" CHECK (lower("rsvp_responses"."email") ~ '^[^@[:space:]]+@([a-z0-9-]+[.])*(example[.](com|net|org)|[a-z0-9-]+[.](test|example|invalid))$'),
	CONSTRAINT "rsvp_responses_text_length" CHECK (coalesce(char_length("rsvp_responses"."shuttle"), 0) <= 100
        and coalesce(char_length("rsvp_responses"."dietary"), 0) <= 1000
        and coalesce(char_length("rsvp_responses"."song"), 0) <= 200
        and coalesce(char_length("rsvp_responses"."note"), 0) <= 2000)
);
--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_invitation_same_site_fk" FOREIGN KEY ("site_id","invitation_id") REFERENCES "public"."invitations"("site_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvp_responses" ADD CONSTRAINT "rsvp_responses_invitation_same_site_fk" FOREIGN KEY ("site_id","invitation_id") REFERENCES "public"."invitations"("site_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guests_invitation_id_idx" ON "guests" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "guests_site_id_name_idx" ON "guests" USING btree ("site_id",lower("full_name"));--> statement-breakpoint

-- RSVP tenancy (hand-written: drizzle-kit does not see grants or policies). Same model as
-- 0001_rls: ww_app is non-owner, context is the txn-local app.site_id set by withSite().
-- Guest names, emails and free text are PII; ww_app reads parties but never reads replies back.
GRANT SELECT ON public.invitations, public.guests TO ww_app;--> statement-breakpoint
GRANT INSERT ON public.rsvp_responses TO ww_app;--> statement-breakpoint
-- Payload columns only: a reply cannot be moved to another party/site, re-keyed or backdated.
GRANT UPDATE (guests, shuttle, shuttle_seats, dietary, song, note, email, updated_at)
  ON public.rsvp_responses TO ww_app;--> statement-breakpoint
-- INSERT ... ON CONFLICT (invitation_id) DO UPDATE and UPDATE ... WHERE invitation_id = ...
-- must read the conflict/filter column. Nothing else is readable (no RETURNING *, no excluded.*).
GRANT SELECT (invitation_id) ON public.rsvp_responses TO ww_app;--> statement-breakpoint

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.invitations FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.guests FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.rsvp_responses ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.rsvp_responses FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY invitations_select ON public.invitations FOR SELECT TO ww_app
  USING (site_id = (SELECT public.ww_current_site_id()));--> statement-breakpoint
CREATE POLICY guests_select ON public.guests FOR SELECT TO ww_app
  USING (site_id = (SELECT public.ww_current_site_id()));--> statement-breakpoint

-- The SELECT policy scopes the upsert's conflicting-row check and UPDATE's WHERE (and limits
-- which invitation_ids the column grant can list) to the current site.
CREATE POLICY rsvp_responses_select ON public.rsvp_responses FOR SELECT TO ww_app
  USING (site_id = (SELECT public.ww_current_site_id()));--> statement-breakpoint
CREATE POLICY rsvp_responses_insert ON public.rsvp_responses FOR INSERT TO ww_app
  WITH CHECK (site_id = (SELECT public.ww_current_site_id()));--> statement-breakpoint
CREATE POLICY rsvp_responses_update ON public.rsvp_responses FOR UPDATE TO ww_app
  USING (site_id = (SELECT public.ww_current_site_id()))
  WITH CHECK (site_id = (SELECT public.ww_current_site_id()));
