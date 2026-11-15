import { Context, Effect, flow, Layer, type Redacted, Ref, Result, Schema } from "effect";
import { Base64 } from "effect/encoding";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

/** Repository path of the homepage source. Git is the source of truth for content. */
export const HOME_CONTENT_PATH = "content/home.md";

export class ContentFile extends Schema.Class<ContentFile>("messi/server/ContentFile")({
  markdown: Schema.String,
  /** Opaque version of the file; saving requires the version the edit started from. */
  revision: Schema.String,
}) {}

export class SavedContent extends Schema.Class<SavedContent>("messi/server/SavedContent")({
  revision: Schema.String,
  commitUrl: Schema.optionalKey(Schema.String),
}) {}

/** The file changed since the editor loaded it, e.g. edited on GitHub meanwhile. */
export class ContentConflict extends Schema.TaggedError<ContentConflict>()("ContentConflict", {}) {}

export class ContentStoreError extends Schema.TaggedError<ContentStoreError>()(
  "ContentStoreError",
  {
    cause: Schema.Defect(),
  },
) {}

export class ContentStore extends Context.Service<
  ContentStore,
  {
    readonly read: Effect.Effect<ContentFile, ContentStoreError>;
    write(input: {
      readonly markdown: string;
      readonly revision: string;
    }): Effect.Effect<SavedContent, ContentConflict | ContentStoreError>;
  }
>()("messi/server/ContentStore") {
  /** In-memory store for local development and tests. */
  static readonly memory = (initialMarkdown: string) =>
    Layer.effect(
      ContentStore,
      Effect.gen(function* () {
        const state = yield* Ref.make(
          new ContentFile({ markdown: initialMarkdown, revision: "0" }),
        );
        return ContentStore.of({
          read: Ref.get(state),
          write: ({ markdown, revision }) =>
            Ref.modify(
              state,
              (current): readonly [Result.Result<SavedContent, ContentConflict>, ContentFile] => {
                if (current.revision !== revision)
                  return [Result.fail(new ContentConflict()), current];
                const next = new ContentFile({
                  markdown,
                  revision: String(Number(current.revision) + 1),
                });
                return [Result.succeed(new SavedContent({ revision: next.revision })), next];
              },
            ).pipe(Effect.flatMap(Effect.fromResult)),
        });
      }),
    );

  static readonly makeGitHub = Effect.fnUntraced(function* (config: GitHubConfig) {
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest(
        flow(
          HttpClientRequest.prependUrl(
            `https://api.github.com/repos/${config.repository}/contents/`,
          ),
          HttpClientRequest.bearerToken(config.token),
          HttpClientRequest.setHeaders({
            accept: "application/vnd.github+json",
            "x-github-api-version": "2022-11-28",
            "user-agent": "messi-editor",
          }),
        ),
      ),
    );

    const read = client.get(HOME_CONTENT_PATH, { urlParams: { ref: config.branch } }).pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(GitHubFile)),
      Effect.flatMap((file) =>
        Effect.fromResult(Base64.decodeString(file.content.replaceAll("\n", ""))).pipe(
          Effect.map((markdown) => new ContentFile({ markdown, revision: file.sha })),
        ),
      ),
      Effect.mapError((cause) => new ContentStoreError({ cause })),
      Effect.withSpan("ContentStore.read"),
    );

    const write = Effect.fn("ContentStore.write")(function* (input: {
      readonly markdown: string;
      readonly revision: string;
    }) {
      const response = yield* HttpClientRequest.put(HOME_CONTENT_PATH).pipe(
        HttpClientRequest.bodyJsonUnsafe({
          message: "content: update home page",
          content: Base64.encode(input.markdown),
          sha: input.revision,
          branch: config.branch,
        }),
        client.execute,
        Effect.mapError((cause) => new ContentStoreError({ cause })),
      );
      if (response.status === 409) return yield* new ContentConflict();
      const saved = yield* HttpClientResponse.filterStatusOk(response).pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(GitHubWrite)),
        Effect.mapError((cause) => new ContentStoreError({ cause })),
      );
      return new SavedContent({ revision: saved.content.sha, commitUrl: saved.commit.html_url });
    });

    return ContentStore.of({ read, write });
  });

  /** Reads and commits the file through the GitHub contents API. */
  static readonly gitHub = (config: GitHubConfig) =>
    Layer.effect(ContentStore, ContentStore.makeGitHub(config)).pipe(
      Layer.provide(FetchHttpClient.layer),
    );
}

export interface GitHubConfig {
  /** `owner/name` of the repository holding the content. */
  readonly repository: string;
  readonly branch: string;
  /** Fine-grained token with Contents read & write on that repository only. */
  readonly token: Redacted.Redacted<string>;
}

const GitHubFile = Schema.Struct({ sha: Schema.String, content: Schema.String });

const GitHubWrite = Schema.Struct({
  content: Schema.Struct({ sha: Schema.String }),
  commit: Schema.Struct({ html_url: Schema.String }),
});
