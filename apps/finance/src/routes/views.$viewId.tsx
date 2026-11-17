import { createFileRoute, notFound } from "@tanstack/react-router";
import { workspaceQuery } from "#/api/queries";
import { ViewEditor } from "#/views/ViewEditor";

export const Route = createFileRoute("/views/$viewId")({
  loader: async ({ context, params }) => {
    const { views } = await context.queryClient.ensureQueryData(workspaceQuery);
    const view = views.find((candidate) => String(candidate.id) === params.viewId);
    if (view === undefined) throw notFound();
    return view;
  },
  component: EditView,
});

function EditView() {
  const view = Route.useLoaderData();
  // Keyed by id: "save as copy" lands on the copy with a fresh form.
  return <ViewEditor key={view.id} viewId={view.id} initial={view} />;
}
