import { Result, Schema } from "effect";
import type { ReactNode } from "react";

/** hast tag name prefix that marks an element as a registered directive component. */
export const DIRECTIVE_TAG_PREFIX = "directive-";

/** Where a directive may appear: `:text[...]`, `::leaf{...}`, or `:::container`. */
export type DirectiveKind = "text" | "leaf" | "container";

/** Raw directive attributes as written in markdown, in the author's order. */
export type DirectiveAttributes = Readonly<Record<string, string>>;

export interface DirectiveDefinition<A> {
  readonly kind: DirectiveKind;
  /** Decodes the raw string attributes into the component's typed attributes. */
  readonly attributes: Schema.Codec<A, DirectiveAttributes>;
  readonly Component: (props: {
    readonly attributes: A;
    readonly raw: DirectiveAttributes;
    readonly children?: ReactNode;
  }) => ReactNode;
}

/** A registered directive with its attribute type erased, so the registry can hold many. */
export interface Directive {
  readonly kind: DirectiveKind;
  readonly validate: (raw: DirectiveAttributes) => Result.Result<void, string>;
  readonly render: (raw: DirectiveAttributes, children: ReactNode) => ReactNode;
}

const parseOptions = { onExcessProperty: "error", errors: "all" } as const;

export function defineDirective<A>(definition: DirectiveDefinition<A>): Directive {
  const decode = Schema.decodeUnknownResult(definition.attributes, parseOptions);
  const { Component } = definition;
  return {
    kind: definition.kind,
    validate: (raw) =>
      Result.match(decode(raw), {
        onSuccess: () => Result.succeed(undefined),
        onFailure: (error) => Result.fail(error.message),
      }),
    render: (raw, children) => (
      <Component attributes={Result.getOrThrow(decode(raw))} raw={raw}>
        {children}
      </Component>
    ),
  };
}
