import type { Directive } from "./directive";
import { linksDirective } from "./links";

/**
 * Every component that markdown content may use, keyed by directive name.
 * Adding a component here is a product decision (see docs/decisions/0004).
 */
export const directives: Readonly<Record<string, Directive>> = {
  links: linksDirective,
};

export const getDirective = (name: string): Directive | undefined =>
  Object.hasOwn(directives, name) ? directives[name] : undefined;
