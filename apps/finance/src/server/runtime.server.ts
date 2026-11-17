import { env } from "cloudflare:workers";
import { D1Client } from "@effect/sql-d1";
import { EditorAuth } from "@messi/access";
import { Effect, Layer, ManagedRuntime, Schema } from "effect";
import { Ledger } from "./Ledger";

/** Worker settings, set as Cloudflare secrets (see docs/setup.md). */
const AccessSettings = Schema.Struct({
  CF_ACCESS_TEAM_DOMAIN: Schema.NonEmptyString,
  CF_ACCESS_AUD: Schema.NonEmptyString,
  EDITOR_EMAIL: Schema.NonEmptyString,
});

/**
 * Fails closed: without its Access settings the app lets nobody in, rather than
 * everybody. There is nothing public here to keep running.
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
      Effect.succeed(EditorAuth.locked("Locked: Cloudflare Access is not set up for this app.")),
    ),
  ),
);

// Cloudflare D1 in production; under `vp dev` the same binding is a local file in .wrangler/.
const ledger = Ledger.layer.pipe(Layer.provide(D1Client.layer({ db: env.DB })));

// `vp dev` has no Access in front of it.
const auth = import.meta.env.DEV ? EditorAuth.development : productionAuth;

// A layer that cannot be built is a broken deployment, not something a request can handle.
const runtime = ManagedRuntime.make(Layer.orDie(Layer.mergeAll(auth, ledger)));

export type ServerServices = EditorAuth | Ledger;

export const runServer = <A, E>(effect: Effect.Effect<A, E, ServerServices>): Promise<A> =>
  runtime.runPromise(effect);
