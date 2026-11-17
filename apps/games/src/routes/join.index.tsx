import { createFileRoute } from "@tanstack/react-router";
import { CodeEntry } from "#/join/CodeEntry";

export const Route = createFileRoute("/join/")({
  head: () => ({ meta: [{ title: "Join a game · Tubas games" }] }),
  component: CodeEntry,
});
