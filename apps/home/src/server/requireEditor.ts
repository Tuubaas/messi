import { createMiddleware } from "@tanstack/react-start";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";
import { Effect, Result } from "effect";
import { EditorAuth } from "./EditorAuth";
import { runServer } from "./runtime.server";

/** Guard for every editor server function: only the configured editor gets through. */
export const requireEditor = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const result = await runServer(
    Effect.result(EditorAuth.use((auth) => auth.authenticate(getRequest()))),
  );
  if (Result.isFailure(result)) {
    setResponseStatus(403);
    throw new Error(result.failure.reason);
  }
  return next({ context: { editor: result.success } });
});
