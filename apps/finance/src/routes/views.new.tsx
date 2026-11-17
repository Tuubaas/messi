import { createFileRoute } from "@tanstack/react-router";
import { NEW_VIEW, ViewEditor } from "#/views/ViewEditor";

export const Route = createFileRoute("/views/new")({
  component: () => <ViewEditor initial={NEW_VIEW} />,
});
