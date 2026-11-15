/**
 * Project lint rules. Each rule encodes a pattern we decided is right or wrong;
 * see docs/patterns.md for the reasoning and the decision each rule comes from.
 */
import { Schema } from "effect";
import { definePlugin, defineRule } from "vite-plus/lint/plugins";
import type { ESTree } from "vite-plus/lint/plugins";

type Node = ESTree.Node;

interface ChainCall {
  readonly method: string;
  readonly call: ESTree.CallExpression;
}

/** For `createServerFn(...).a(...).b(...)`, returns the calls `a` and `b` in order. */
const chainedCalls = (root: ESTree.CallExpression): Array<ChainCall> => {
  const calls: Array<ChainCall> = [];
  let current: Node = root;
  for (;;) {
    const member: Node | null = current.parent;
    if (member?.type !== "MemberExpression" || member.object !== current) return calls;
    const call: Node | null = member.parent;
    if (call?.type !== "CallExpression" || call.callee !== member) return calls;
    if (member.property.type === "Identifier") calls.push({ method: member.property.name, call });
    current = call;
  }
};

const isCreateServerFn = (node: ESTree.CallExpression) =>
  node.callee.type === "Identifier" && node.callee.name === "createServerFn";

/** The top-level statement containing `node`, including a wrapping `export`. */
const topLevelStatement = (node: Node): Node => {
  let current = node;
  while (current.parent !== null && current.parent.type !== "Program") current = current.parent;
  return current;
};

const decodeGuardOptions = Schema.decodeUnknownSync(
  Schema.Struct({ guards: Schema.optionalKey(Schema.Array(Schema.String)) }),
);

const serverFnGuard = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Server functions are public HTTP endpoints: each must use an auth guard middleware or be explicitly marked public.",
    },
    schema: [
      {
        type: "object",
        properties: { guards: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    messages: {
      unguarded:
        "Server function has no auth guard. Add `.middleware([{{guards}}])`, or mark it public with a `// public-server-fn: <reason>` comment above it.",
    },
  },
  create(context) {
    const { guards = [] } = decodeGuardOptions(context.options[0] ?? {});
    return {
      CallExpression(node) {
        if (!isCreateServerFn(node)) return;
        const guarded = chainedCalls(node).some(
          ({ method, call }) =>
            method === "middleware" &&
            call.arguments[0]?.type === "ArrayExpression" &&
            call.arguments[0].elements.some(
              (element) => element?.type === "Identifier" && guards.includes(element.name),
            ),
        );
        if (guarded) return;
        const markedPublic = context.sourceCode
          .getCommentsBefore(topLevelStatement(node))
          .some((comment) => /^\s*public-server-fn:\s*\S/.test(comment.value));
        if (markedPublic) return;
        context.report({ node, messageId: "unguarded", data: { guards: guards.join(", ") } });
      },
    };
  },
});

const isPostMethod = (node: ESTree.CallExpression) => {
  const options = node.arguments[0];
  return (
    options?.type === "ObjectExpression" &&
    options.properties.some(
      (property) =>
        property.type === "Property" &&
        property.key.type === "Identifier" &&
        property.key.name === "method" &&
        property.value.type === "Literal" &&
        property.value.value === "POST",
    )
  );
};

const serverFnPostValidator = defineRule({
  meta: {
    type: "problem",
    docs: { description: "POST server functions must validate their input with a schema." },
    messages: {
      missing:
        "POST server function has no `.validator(...)`. Validate input with `Schema.toStandardSchemaV1(...)`.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isCreateServerFn(node) || !isPostMethod(node)) return;
        if (chainedCalls(node).some(({ method }) => method === "validator")) return;
        context.report({ node, messageId: "missing" });
      },
    };
  },
});

export default definePlugin({
  meta: { name: "messi" },
  rules: {
    "server-fn-guard": serverFnGuard,
    "server-fn-post-validator": serverFnPostValidator,
  },
});
