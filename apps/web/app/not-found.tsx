/** Unknown site, unroutable host, or a direct hit on the internal sites route. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-3xl">Page not found</h1>
      <p className="text-muted-foreground">There is no wedding site at this address.</p>
    </main>
  );
}
