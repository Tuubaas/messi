import { Effect, Exit, Layer, Redacted } from "effect";
import { Base64 } from "effect/encoding";
import { HttpClient, type HttpClientRequest, HttpClientResponse } from "effect/http";
import { describe, expect, it } from "vite-plus/test";
import { ContentStore } from "./ContentStore";

const config = { repository: "owner/site", branch: "main", token: Redacted.make("secret") };

interface Recorded {
  readonly method: string;
  readonly url: string;
  readonly authorization: string | undefined;
  readonly body: unknown;
}

/** A GitHub stand-in that answers every request with `respond` and records what was sent. */
const fakeGitHub = (respond: (request: HttpClientRequest.HttpClientRequest) => Response) => {
  const recorded: Array<Recorded> = [];
  const client = HttpClient.make((request, url) => {
    const body =
      request.body._tag === "Uint8Array"
        ? JSON.parse(new TextDecoder().decode(request.body.body))
        : undefined;
    recorded.push({
      method: request.method,
      url: url.toString(),
      authorization: request.headers.authorization,
      body,
    });
    return Effect.succeed(HttpClientResponse.fromWeb(request, respond(request)));
  });
  const layer = Layer.effect(ContentStore, ContentStore.makeGitHub(config)).pipe(
    Layer.provide(Layer.succeed(HttpClient.HttpClient, client)),
  );
  return { recorded, layer };
};

const json = (status: number, body: unknown) => Response.json(body, { status });

describe("ContentStore.gitHub", () => {
  it("reads the file from the configured branch", async () => {
    const github = fakeGitHub(() =>
      json(200, {
        sha: "abc",
        content: `${Base64.encode("# Hi ✨").slice(0, 4)}\n${Base64.encode("# Hi ✨").slice(4)}`,
      }),
    );
    const file = await Effect.runPromise(
      ContentStore.use((store) => store.read).pipe(Effect.provide(github.layer)),
    );
    expect(file).toMatchObject({ markdown: "# Hi ✨", revision: "abc" });
    expect(github.recorded[0]).toMatchObject({
      method: "GET",
      url: "https://api.github.com/repos/owner/site/contents/content/home.md?ref=main",
      authorization: "Bearer secret",
    });
  });

  it("commits with the revision it started from", async () => {
    const github = fakeGitHub(() =>
      json(200, {
        content: { sha: "def" },
        commit: { html_url: "https://github.com/owner/site/commit/1" },
      }),
    );
    const saved = await Effect.runPromise(
      ContentStore.use((store) => store.write({ markdown: "new", revision: "abc" })).pipe(
        Effect.provide(github.layer),
      ),
    );
    expect(saved).toMatchObject({
      revision: "def",
      commitUrl: "https://github.com/owner/site/commit/1",
    });
    expect(github.recorded[0]).toMatchObject({
      method: "PUT",
      body: { content: Base64.encode("new"), sha: "abc", branch: "main" },
    });
  });

  it("reports a conflict when the file changed meanwhile", async () => {
    const github = fakeGitHub(() => json(409, { message: "sha mismatch" }));
    const exit = await Effect.runPromiseExit(
      ContentStore.use((store) => store.write({ markdown: "new", revision: "old" })).pipe(
        Effect.provide(github.layer),
      ),
    );
    expect(Exit.isFailure(exit) && JSON.stringify(exit.cause)).toContain("ContentConflict");
  });
});

describe("ContentStore.memory", () => {
  it("rejects a write based on a stale revision", async () => {
    const program = Effect.gen(function* () {
      const store = yield* ContentStore;
      const first = yield* store.read;
      yield* store.write({ markdown: "a", revision: first.revision });
      return yield* Effect.exit(store.write({ markdown: "b", revision: first.revision }));
    });
    const exit = await Effect.runPromise(
      program.pipe(Effect.provide(ContentStore.memory("start"))),
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });
});
