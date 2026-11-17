import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { getHomePage } from "#/content/home";
import { Markdown } from "#/content/Markdown";
import { renderMarkdown } from "#/content/pipeline";
import { noJavaScript } from "#/noJavaScript";

export const Route = createFileRoute("/")({
  loader: () => getHomePage(),
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.title ?? "Home" }] }),
  headers: noJavaScript,
  component: Home,
});

function Home() {
  const { markdown } = Route.useLoaderData();
  return (
    <main>
      <Markdown tree={Effect.runSync(renderMarkdown(markdown)).tree} />
    </main>
  );
}
