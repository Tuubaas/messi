import { env } from "cloudflare:workers";
import { EditorAuth } from "@messi/access";
import { Effect, Layer, ManagedRuntime, Schema } from "effect";
import { sampleBoard } from "#/game/sample";
import { BoardStore } from "./BoardStore";

/** Worker settings for the admin, set as Cloudflare secrets (see docs/setup.md). */
const AccessSettings = Schema.Struct({
  CF_ACCESS_TEAM_DOMAIN: Schema.NonEmptyString,
  CF_ACCESS_AUD: Schema.NonEmptyString,
  EDITOR_EMAIL: Schema.NonEmptyString,
});

/**
 * Without its settings the admin locks instead of failing the whole Worker, so published
 * boards stay playable before (or without) Cloudflare Access being set up.
 */
const productionAuth = Layer.unwrap(
  Schema.decodeUnknownEffect(AccessSettings)(env).pipe(
    Effect.map((settings) =>
      EditorAuth.cloudflareAccess({
        teamDomain: settings.CF_ACCESS_TEAM_DOMAIN,
        audience: settings.CF_ACCESS_AUD,
        editorEmail: settings.EDITOR_EMAIL,
      }),
    ),
    Effect.catch(() =>
      Effect.succeed(EditorAuth.locked("The admin is locked: Cloudflare Access is not set up.")),
    ),
  ),
);

const boards = BoardStore.sql(env.DB);

/** `vp dev` starts with something to play. */
const seedSample = Layer.effectDiscard(
  Effect.gen(function* () {
    const store = yield* BoardStore;
    if ((yield* store.list).length === 0) {
      yield* store.create({ content: sampleBoard, published: true });
    }
  }),
);

// `vp dev` has no Access in front of it; boards go to a local database in .wrangler/.
const development = Layer.mergeAll(
  EditorAuth.development,
  seedSample.pipe(Layer.provideMerge(boards)),
);

const production = Layer.mergeAll(productionAuth, boards);

// A layer that cannot be built is a broken deployment, not something a request can handle.
const runtime = ManagedRuntime.make(
  import.meta.env.DEV ? Layer.orDie(development) : Layer.orDie(production),
);

export type ServerServices = EditorAuth | BoardStore;

export const runServer = <A, E>(effect: Effect.Effect<A, E, ServerServices>): Promise<A> =>
  runtime.runPromise(effect);
