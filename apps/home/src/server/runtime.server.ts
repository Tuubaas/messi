import { env } from "cloudflare:workers";
import { Effect, Layer, ManagedRuntime, Redacted, Schema } from "effect";
import homeMarkdown from "../../content/home.md?raw";
import { ContentStore } from "./ContentStore";
import { EditorAuth } from "@messi/access";

/** Worker settings, set as Cloudflare secrets (see docs/setup.md). */
const WorkerSettings = Schema.Struct({
  CF_ACCESS_TEAM_DOMAIN: Schema.NonEmptyString,
  CF_ACCESS_AUD: Schema.NonEmptyString,
  EDITOR_EMAIL: Schema.NonEmptyString,
  GITHUB_REPOSITORY: Schema.NonEmptyString,
  GITHUB_BRANCH: Schema.NonEmptyString,
  GITHUB_TOKEN: Schema.NonEmptyString,
});

const production = Layer.unwrap(
  Effect.gen(function* () {
    const settings = yield* Schema.decodeUnknownEffect(WorkerSettings)(env);
    return Layer.mergeAll(
      EditorAuth.cloudflareAccess({
        teamDomain: settings.CF_ACCESS_TEAM_DOMAIN,
        audience: settings.CF_ACCESS_AUD,
        editorEmail: settings.EDITOR_EMAIL,
      }),
      ContentStore.gitHub({
        repository: settings.GITHUB_REPOSITORY,
        branch: settings.GITHUB_BRANCH,
        token: Redacted.make(settings.GITHUB_TOKEN),
      }),
    );
  }),
);

// `vp dev` has no Access in front of it, and edits stay in memory instead of committing.
const development = Layer.mergeAll(EditorAuth.development, ContentStore.memory(homeMarkdown));

const runtime = ManagedRuntime.make(import.meta.env.DEV ? development : production);

export type ServerServices = EditorAuth | ContentStore;

export const runServer = <A, E>(effect: Effect.Effect<A, E, ServerServices>): Promise<A> =>
  runtime.runPromise(effect);
