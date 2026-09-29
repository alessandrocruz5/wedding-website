import { notFound } from "next/navigation";

/** Unmatched paths within a site 404 inside the site's layout (themed), not the platform's. */
export default function UnknownSitePage() {
  notFound();
}
