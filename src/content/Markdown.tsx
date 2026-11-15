import type { Element, Root } from "hast";
import { type Components, toJsxRuntime } from "hast-util-to-jsx-runtime";
import type { ReactNode } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { directives } from "./directives";
import { DIRECTIVE_TAG_PREFIX } from "./directives/directive";

const stringProperties = (node: Element) =>
  Object.fromEntries(
    Object.entries(node.properties).flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value]] : [],
    ),
  );

// Directive elements carry a custom tag name, which Components' intrinsic keys don't model.
const components = Object.fromEntries(
  Object.entries(directives).map(([name, directive]) => [
    `${DIRECTIVE_TAG_PREFIX}${name}`,
    ({ node, children }: { node?: Element; children?: ReactNode }) =>
      node === undefined ? null : directive.render(stringProperties(node), children),
  ]),
) as Partial<Components>;

/** Renders a tree produced by `renderMarkdown`. */
export function Markdown({ tree }: { readonly tree: Root }) {
  return toJsxRuntime(tree, { Fragment, jsx, jsxs, passNode: true, components });
}
