import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import { renderMarkdown } from "#/content/markdown";
import { ContentStore } from "#/server/ContentStore";
import { requireEditor } from "#/server/requireEditor";
import { runServer } from "#/server/runtime.server";

export const loadHomeSource = createServerFn({ method: "GET" })
  .middleware([requireEditor])
  .handler(() =>
    runServer(
      ContentStore.use((store) => store.read).pipe(
        Effect.map(({ markdown, revision }) => ({ markdown, revision })),
      ),
    ),
  );

const SaveHomeInput = Schema.Struct({
  markdown: Schema.String.check(Schema.isMaxLength(200_000)),
  revision: Schema.String,
});

export type SaveHomeResult =
  | { readonly _tag: "Saved"; readonly revision: string; readonly commitUrl: string | undefined }
  | { readonly _tag: "Conflict" }
  | {
      readonly _tag: "Invalid";
      readonly issues: ReadonlyArray<{ readonly message: string; readonly line?: number }>;
    };

/** Validates the content exactly like the build will, then commits it. */
export const saveHome = createServerFn({ method: "POST" })
  .middleware([requireEditor])
  .validator(Schema.toStandardSchemaV1(SaveHomeInput))
  .handler(({ data }) =>
    runServer(
      renderMarkdown(data.markdown).pipe(
        Effect.andThen(ContentStore.use((store) => store.write(data))),
        Effect.map((saved): SaveHomeResult => ({
          _tag: "Saved",
          revision: saved.revision,
          commitUrl: saved.commitUrl,
        })),
        Effect.catchTags({
          ContentInvalid: (error) =>
            Effect.succeed<SaveHomeResult>({
              _tag: "Invalid",
              issues: error.issues.map(({ message, line }) =>
                line === undefined ? { message } : { message, line },
              ),
            }),
          ContentConflict: () => Effect.succeed<SaveHomeResult>({ _tag: "Conflict" }),
        }),
      ),
    ),
  );
