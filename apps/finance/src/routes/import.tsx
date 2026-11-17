import { createFileRoute } from "@tanstack/react-router";
import { ImportPage } from "#/import/ImportPage";

export const Route = createFileRoute("/import")({ component: ImportPage });
