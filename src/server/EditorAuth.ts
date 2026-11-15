import { Context, Effect, Layer, Option, Schema } from "effect";
import { SecureRandom, Signature } from "effect/crypto";
import { Cookies, FetchHttpClient } from "effect/http";
import { Jwks, Jwt } from "effect/jose";

export class Editor extends Schema.Class<Editor>("messi/server/Editor")({
  email: Schema.String,
}) {}

export class NotEditor extends Schema.TaggedError<NotEditor>()("NotEditor", {
  reason: Schema.String,
}) {}

export interface AccessConfig {
  /** Cloudflare Zero Trust team domain, e.g. `yourteam.cloudflareaccess.com`. */
  readonly teamDomain: string;
  /** Application Audience (AUD) tag of the Access application protecting the editor. */
  readonly audience: string;
  /** The only identity allowed to edit, checked on top of the Access policy. */
  readonly editorEmail: string;
}

const AccessClaims = Schema.Struct({ email: Schema.String });

/** Access forwards its JWT as a header on protected paths, and as a cookie set at login. */
const accessToken = (request: Request) =>
  Option.fromNullishOr(
    request.headers.get("cf-access-jwt-assertion") ??
      Cookies.parseHeader(request.headers.get("cookie") ?? "")["CF_Authorization"],
  );

/** Decides who may use the editor. Every editor server function must go through it. */
export class EditorAuth extends Context.Service<
  EditorAuth,
  {
    authenticate(request: Request): Effect.Effect<Editor, NotEditor>;
  }
>()("messi/server/EditorAuth") {
  /** Local development only: there is no Access in front of `vp dev`. */
  static readonly development = Layer.succeed(
    EditorAuth,
    EditorAuth.of({ authenticate: () => Effect.succeed(new Editor({ email: "dev@localhost" })) }),
  );

  /** Verifies a Cloudflare Access JWT using a key set already in context. */
  static readonly makeCloudflareAccess = Effect.fnUntraced(function* (config: AccessConfig) {
    const services = yield* Effect.context<Jwks.Jwks | Signature.Signature>();
    const authenticate = Effect.fn("EditorAuth.authenticate")(function* (request: Request) {
      const token = yield* Effect.fromOption(
        accessToken(request),
        () => new NotEditor({ reason: "No Cloudflare Access token." }),
      );
      const verified = yield* Jwt.verifyWithKeySet(AccessClaims, token, {
        algorithms: ["RS256"],
        issuer: `https://${config.teamDomain}`,
        audience: config.audience,
        requiredClaims: ["exp"],
      }).pipe(
        Effect.provideContext(services),
        Effect.mapError(
          (error) => new NotEditor({ reason: `Invalid Access token: ${error.message}` }),
        ),
      );
      if (verified.claims.email.toLowerCase() !== config.editorEmail.toLowerCase()) {
        return yield* new NotEditor({ reason: "Signed in, but not as the editor." });
      }
      return new Editor({ email: verified.claims.email });
    });
    return EditorAuth.of({ authenticate });
  });

  static readonly cloudflareAccess = (config: AccessConfig) =>
    Layer.effect(EditorAuth, EditorAuth.makeCloudflareAccess(config)).pipe(
      Layer.provide(Jwks.layerRemote({ url: `https://${config.teamDomain}/cdn-cgi/access/certs` })),
      Layer.provide(Signature.layerWebCrypto),
      Layer.provide(SecureRandom.layerWebCrypto),
      // The key set must come from the configured URL itself, never a redirect.
      Layer.provide(FetchHttpClient.layer),
      Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { redirect: "manual" })),
    );
}
