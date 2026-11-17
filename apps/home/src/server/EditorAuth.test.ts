import { Effect, Exit, Layer, Redacted, Schema } from "effect";
import { SecureRandom, Signature } from "effect/crypto";
import { Jwk, Jwks, Jwt } from "effect/jose";
import { describe, expect, it } from "vite-plus/test";
import { EditorAuth } from "./EditorAuth";

const config = {
  teamDomain: "team.cloudflareaccess.com",
  audience: "app-aud",
  editorEmail: "owner@example.com",
};

const Claims = Schema.Struct({
  email: Schema.String,
  iss: Schema.String,
  aud: Schema.Array(Schema.String),
  exp: Schema.Number,
});

const crypto = Signature.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto));

/** Signs Access-like tokens and builds an EditorAuth that trusts the signing key. */
const setup = Effect.gen(function* () {
  const pair = yield* Jwk.generateKeyPair({ algorithm: "RS256", kid: "access-1" });
  const privateKey = yield* Jwk.importPrivate(pair.privateKey, "RS256");
  const auth = yield* EditorAuth.makeCloudflareAccess(config).pipe(
    Effect.provide(Jwks.layerLocal({ keys: [pair.publicKey] })),
  );
  const token = (overrides: Partial<typeof Claims.Type> = {}) =>
    Jwt.sign(
      Claims,
      {
        email: config.editorEmail,
        iss: `https://${config.teamDomain}`,
        aud: [config.audience],
        exp: Math.floor(Date.now() / 1000) + 600,
        ...overrides,
      },
      privateKey,
      { kid: "access-1" },
    ).pipe(Effect.map(Redacted.value));
  return { auth, token };
});

const authenticate = (headers: Record<string, string>) =>
  Effect.gen(function* () {
    const { auth } = yield* setup;
    return yield* auth.authenticate(new Request("https://site.test/edit", { headers }));
  });

const run = <A, E>(effect: Effect.Effect<A, E, Signature.Signature>) =>
  Effect.runPromiseExit(Effect.provide(effect, crypto));

describe("EditorAuth.cloudflareAccess", () => {
  it("accepts the editor's Access token from the header", async () => {
    const exit = await run(
      Effect.gen(function* () {
        const { auth, token } = yield* setup;
        const request = new Request("https://site.test/edit", {
          headers: { "cf-access-jwt-assertion": yield* token() },
        });
        return yield* auth.authenticate(request);
      }),
    );
    expect(Exit.isSuccess(exit) && exit.value.email).toBe(config.editorEmail);
  });

  it("accepts the Access cookie when the header is absent", async () => {
    const exit = await run(
      Effect.gen(function* () {
        const { auth, token } = yield* setup;
        const request = new Request("https://site.test/_serverFn/x", {
          headers: {
            cookie: `other=1; CF_Authorization=${yield* token({ email: "OWNER@example.com" })}`,
          },
        });
        return yield* auth.authenticate(request);
      }),
    );
    expect(Exit.isSuccess(exit)).toBe(true);
  });

  it.each([
    ["a different signed-in person", { email: "someone@example.com" }],
    ["another Access application", { aud: ["other-aud"] }],
    ["another team", { iss: "https://evil.cloudflareaccess.com" }],
    ["an expired token", { exp: Math.floor(Date.now() / 1000) - 60 }],
  ])("rejects %s", async (_, overrides) => {
    const exit = await run(
      Effect.gen(function* () {
        const { auth, token } = yield* setup;
        const request = new Request("https://site.test/edit", {
          headers: { "cf-access-jwt-assertion": yield* token(overrides) },
        });
        return yield* auth.authenticate(request);
      }),
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("rejects requests without a token or with garbage", async () => {
    expect(Exit.isFailure(await run(authenticate({})))).toBe(true);
    expect(Exit.isFailure(await run(authenticate({ "cf-access-jwt-assertion": "a.b.c" })))).toBe(
      true,
    );
  });
});
