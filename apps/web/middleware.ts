import { type NextRequest, NextResponse } from "next/server";
import { decideRoute, NOT_FOUND_PATH } from "./src/lib/resolve-host";
import { getTenantConfig, SITE_HEADER } from "./src/lib/tenant-context";

/**
 * Host → site key, with no DB or IO (Edge). The site layout does the actual lookup. The rewrite
 * target `/sites/{key}/…` is internal: requests for it directly are answered with a 404.
 */
export function middleware(request: NextRequest) {
  const decision = decideRoute(
    request.headers.get("host"),
    request.nextUrl.pathname,
    getTenantConfig(),
  );

  // Never forward a client-supplied site header.
  const headers = new Headers(request.headers);
  headers.delete(SITE_HEADER);

  if (decision.kind === "pass") return NextResponse.next({ request: { headers } });
  if (decision.kind === "block") {
    return NextResponse.rewrite(new URL(NOT_FOUND_PATH, request.url), { request: { headers } });
  }

  headers.set(SITE_HEADER, decision.key);
  const url = request.nextUrl.clone();
  url.pathname = decision.path;
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  // Everything except API routes, Next internals and root-level static/metadata files. The
  // metadata image routes (icon, social preview) are prefix matches: Next may append a hash.
  matcher: ["/((?!api/|_next/|favicon.ico|icon.svg|opengraph-image|robots.txt|sitemap.xml).*)"],
};
