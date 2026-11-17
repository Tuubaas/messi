import { Effect, Result, Schema } from "effect";
import type { Root as HastRoot } from "hast";
import type { Nodes as MdastNodes, Root as MdastRoot } from "mdast";
import type { ContainerDirective, LeafDirective, TextDirective } from "mdast-util-directive";
import { toHast } from "mdast-util-to-hast";
import { toString } from "mdast-util-to-string";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";
import {
  DIRECTIVE_TAG_PREFIX,
  type DirectiveAttributes,
  type DirectiveKind,
} from "./directives/directive";
import { getDirective } from "./directives";

export class ContentIssue extends Schema.Class<ContentIssue>("messi/content/ContentIssue")({
  message: Schema.String,
  line: Schema.optionalKey(Schema.Number),
}) {}

export class ContentInvalid extends Schema.TaggedError<ContentInvalid>()("ContentInvalid", {
  issues: Schema.Array(ContentIssue),
}) {}

export interface RenderedContent {
  /** Text of the first `# heading`, used as the page title. */
  readonly title: string | undefined;
  readonly tree: HastRoot;
}

type DirectiveNode = ContainerDirective | LeafDirective | TextDirective;

const directiveKinds: Record<DirectiveNode["type"], DirectiveKind> = {
  textDirective: "text",
  leafDirective: "leaf",
  containerDirective: "container",
};

const isDirectiveNode = (node: MdastNodes): node is DirectiveNode =>
  Object.hasOwn(directiveKinds, node.type);

const syntax = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

const normalizeAttributes = (attributes: DirectiveNode["attributes"]): DirectiveAttributes =>
  Object.fromEntries(Object.entries(attributes ?? {}).map(([key, value]) => [key, value ?? ""]));

/**
 * Validates every directive against the registry and marks valid ones for rendering.
 * Unknown text directives (`word:thing`) are restored as plain text, since they are
 * usually prose rather than intent; unknown block directives are errors.
 */
const resolveDirectives = (tree: MdastRoot): Array<ContentIssue> => {
  const issues: Array<ContentIssue> = [];
  visit(tree, (node, index, parent) => {
    if (!isDirectiveNode(node)) return;
    const line = node.position?.start.line;
    const issue = (message: string) =>
      issues.push(new ContentIssue(line === undefined ? { message } : { message, line }));
    const directive = getDirective(node.name);
    const kind = directiveKinds[node.type];

    if (directive === undefined) {
      if (kind === "text" && parent !== undefined && index !== undefined) {
        parent.children.splice(
          index,
          1,
          { type: "text", value: `:${node.name}` },
          ...node.children,
        );
        return [SKIP, index];
      }
      issue(`Unknown component "${node.name}".`);
      return;
    }
    if (directive.kind !== kind) {
      issue(`Component "${node.name}" must be written as a ${directive.kind} directive.`);
      return;
    }
    const attributes = normalizeAttributes(node.attributes);
    const validation = directive.validate(attributes);
    if (Result.isFailure(validation)) {
      issue(`Component "${node.name}": ${validation.failure}`);
      return;
    }
    node.data = { hName: `${DIRECTIVE_TAG_PREFIX}${node.name}`, hProperties: attributes };
  });
  return issues;
};

const findTitle = (tree: MdastRoot): string | undefined => {
  const heading = tree.children.find((node) => node.type === "heading" && node.depth === 1);
  return heading === undefined ? undefined : toString(heading);
};

/** Parses markdown into a renderable hast tree. Raw HTML is dropped; use components instead. */
export const renderMarkdown = Effect.fnUntraced(function* (
  markdown: string,
): Effect.fn.Return<RenderedContent, ContentInvalid> {
  const tree = syntax.parse(markdown);
  const issues = resolveDirectives(tree);
  if (issues.length > 0) return yield* new ContentInvalid({ issues });
  const hast = toHast(tree);
  if (hast.type !== "root") return yield* Effect.die("toHast of a root must return a root");
  return { title: findTitle(tree), tree: hast };
});
