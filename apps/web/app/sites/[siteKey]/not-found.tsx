/** Known site, unknown page: rendered inside the site's theme. */
export default function SiteNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-3xl">Page not found</h1>
      <p className="text-muted-foreground">This page doesn&rsquo;t exist on this wedding site.</p>
    </main>
  );
}
