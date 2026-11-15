import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import homeMarkdown from "../../content/home.md?raw";
import { renderMarkdown } from "./markdown";

// public-server-fn: serves the committed homepage content; runs at build time.
export const getHomePage = createServerFn({ method: "GET" }).handler(() =>
  // Rendering here validates the content, so a broken page fails the build instead of shipping.
  Effect.runPromise(
    Effect.map(renderMarkdown(homeMarkdown), ({ title }) => ({ title, markdown: homeMarkdown })),
  ),
);
