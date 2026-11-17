import { EditorAuth } from "@messi/access";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest, setResponseHeader, setResponseStatus } from "@tanstack/react-start/server";
import { Effect, Result } from "effect";
import { runServer } from "./runtime.server";

/**
 * Guard for every server function of this app: nothing in it is public. Cloudflare
 * Access sits in front of the whole site; this checks its token again, and the email.
 */
export const requireEditor = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const result = await runServer(
    Effect.result(EditorAuth.use((auth) => auth.authenticate(getRequest()))),
  );
  if (Result.isFailure(result)) {
    setResponseStatus(403);
    throw new Error(result.failure.reason);
  }
  // Everything behind this guard is private: no browser or proxy may keep a copy.
  setResponseHeader("Cache-Control", "no-store");
  return next({ context: { editor: result.success } });
});
