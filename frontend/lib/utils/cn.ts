import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Join class names, resolving Tailwind conflicts.
 *
 * Asked for twice in `UI_PATTERNS.md` (§ Known Issues and § Pending): class
 * strings here are template literals, and a conditional class inside one turns
 * into `${cond ? "a" : ""}` with the empty string leaving a double space — or,
 * worse, into a nested ternary nobody can read.
 *
 * ## It gained `tailwind-merge` on 2026-08-10, and that is not cosmetic
 *
 * It began as a three-line `filter(Boolean).join(" ")` with an explicit note that
 * it was *not* `tailwind-merge` and did no conflict resolution. Adopting the
 * reference's `components/ui/*` changed the requirement: every shadcn component
 * ends with `cn(variantClasses, className)` and **relies on the later class
 * winning**. With plain joining, `<Button className="px-2">` emits both `px-7`
 * and `px-2`, and which one applies depends on their order in the generated
 * stylesheet — not on the caller's intent. That is a real bug, and it is silent.
 *
 * `twMerge` makes the last conflicting utility win, which is what every call site
 * already assumes. `clsx` comes with it and handles the array/object forms those
 * components pass.
 *
 * Both were already installed as transitive requirements of the copied
 * components, so this costs no new dependency.
 */
export function cn(...parts: ClassValue[]): string {
  return twMerge(clsx(parts));
}
