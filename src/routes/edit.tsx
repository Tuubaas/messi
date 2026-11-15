import { createFileRoute } from "@tanstack/react-router";
import { Editor } from "#/editor/Editor";
import { loadHomeSource } from "#/editor/functions";

export const Route = createFileRoute("/edit")({
  loader: () => loadHomeSource(),
  head: () => ({ meta: [{ title: "Edit" }, { name: "robots", content: "noindex" }] }),
  component: EditPage,
});

function EditPage() {
  return <Editor initial={Route.useLoaderData()} />;
}
