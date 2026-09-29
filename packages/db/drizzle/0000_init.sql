CREATE TYPE "public"."site_member_role" AS ENUM('owner', 'editor');--> statement-breakpoint
CREATE TABLE "site_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"hostname" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_domains_hostname_unique" UNIQUE("hostname"),
	CONSTRAINT "site_domains_hostname_lowercase" CHECK ("site_domains"."hostname" = lower("site_domains"."hostname"))
);
--> statement-breakpoint
CREATE TABLE "site_members" (
	"site_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "site_member_role" DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_members_site_id_user_id_pk" PRIMARY KEY("site_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_slug_unique" UNIQUE("slug"),
	CONSTRAINT "sites_slug_format" CHECK ("sites"."slug" ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$')
);
--> statement-breakpoint
CREATE TABLE "site_theme" (
	"site_id" uuid PRIMARY KEY NOT NULL,
	"preset" text DEFAULT 'default' NOT NULL,
	"tokens" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email"))
);
--> statement-breakpoint
ALTER TABLE "site_domains" ADD CONSTRAINT "site_domains_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_members" ADD CONSTRAINT "site_members_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_members" ADD CONSTRAINT "site_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_theme" ADD CONSTRAINT "site_theme_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_domains_site_id_idx" ON "site_domains" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "site_domains_one_primary_per_site" ON "site_domains" USING btree ("site_id") WHERE "site_domains"."is_primary";--> statement-breakpoint
CREATE INDEX "site_members_user_id_idx" ON "site_members" USING btree ("user_id");