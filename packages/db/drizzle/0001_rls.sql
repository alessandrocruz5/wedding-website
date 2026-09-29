-- Tenant isolation. The app connects as a login role that is a member of `ww_app`
-- (non-owner, NOBYPASSRLS). Tenant context is the transaction-local GUC `app.site_id`,
-- set only by withSite(). No context => every policy compares against NULL => 0 rows.
-- Migrations and the seed run as the database owner, which bypasses RLS.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'ww_app') THEN
    CREATE ROLE ww_app NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint
-- Enforce attributes even if ww_app pre-existed (roles are cluster-wide, shared by branches).
ALTER ROLE ww_app NOLOGIN NOBYPASSRLS NOCREATEROLE NOCREATEDB;--> statement-breakpoint

-- '' (not NULL) is what a txn-local GUC reverts to after commit on a pooled connection.
CREATE FUNCTION public.ww_current_site_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.site_id', true), '')::uuid $$;
--> statement-breakpoint

-- Host/slug -> site lookups happen before any tenant context exists. These run as the
-- owner (SECURITY DEFINER) and expose only id + slug. Pinned search_path.
CREATE FUNCTION public.ww_resolve_site_by_host(p_hostname text)
  RETURNS TABLE (id uuid, slug text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
  AS $$
    SELECT s.id, s.slug
    FROM public.site_domains d
    JOIN public.sites s ON s.id = d.site_id
    WHERE d.hostname = lower(p_hostname)
  $$;
--> statement-breakpoint
CREATE FUNCTION public.ww_resolve_site_by_slug(p_slug text)
  RETURNS TABLE (id uuid, slug text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
  AS $$ SELECT s.id, s.slug FROM public.sites s WHERE s.slug = lower(p_slug) $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.ww_resolve_site_by_host(text) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.ww_resolve_site_by_slug(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.ww_resolve_site_by_host(text) TO ww_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.ww_resolve_site_by_slug(text) TO ww_app;--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO ww_app;--> statement-breakpoint
GRANT SELECT, UPDATE ON public.sites TO ww_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_theme TO ww_app;--> statement-breakpoint
-- Routing, membership and identity writes belong to the admin/auth layer (Sprint 4), which
-- adds its own grants. The FOR ALL policies below already constrain them once granted.
GRANT SELECT ON public.site_domains, public.site_members, public.users TO ww_app;--> statement-breakpoint

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.sites FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.site_domains ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.site_domains FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.site_theme ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.site_theme FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.site_members ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.site_members FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY sites_select ON public.sites FOR SELECT TO ww_app
  USING (id = (SELECT public.ww_current_site_id()));--> statement-breakpoint
CREATE POLICY sites_update ON public.sites FOR UPDATE TO ww_app
  USING (id = (SELECT public.ww_current_site_id()))
  WITH CHECK (id = (SELECT public.ww_current_site_id()));--> statement-breakpoint

CREATE POLICY site_domains_tenant ON public.site_domains FOR ALL TO ww_app
  USING (site_id = (SELECT public.ww_current_site_id()))
  WITH CHECK (site_id = (SELECT public.ww_current_site_id()));--> statement-breakpoint
CREATE POLICY site_theme_tenant ON public.site_theme FOR ALL TO ww_app
  USING (site_id = (SELECT public.ww_current_site_id()))
  WITH CHECK (site_id = (SELECT public.ww_current_site_id()));--> statement-breakpoint
CREATE POLICY site_members_tenant ON public.site_members FOR ALL TO ww_app
  USING (site_id = (SELECT public.ww_current_site_id()))
  WITH CHECK (site_id = (SELECT public.ww_current_site_id()));--> statement-breakpoint

CREATE POLICY users_via_membership ON public.users FOR SELECT TO ww_app
  USING (EXISTS (
    SELECT 1 FROM public.site_members m
    WHERE m.user_id = users.id AND m.site_id = (SELECT public.ww_current_site_id())
  ));
