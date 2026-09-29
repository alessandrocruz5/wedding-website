/** Joins truthy class names. Deliberately tiny — the primitives are disposable. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
