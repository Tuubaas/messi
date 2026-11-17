import { createFileRoute, Link } from "@tanstack/react-router";
import { BoardEditor } from "#/admin/BoardEditor";
import { getBoard } from "#/boards/functions";
import { buttonClass } from "#/ui/Button";
import { Notice } from "#/ui/RouteStates";

export const Route = createFileRoute("/admin/$boardId")({
  loader: ({ params }) => getBoard({ data: { id: params.boardId } }),
  // The editor works on its own copy and saves by revision, so it must always start from
  // what the server has now, never from a remembered load.
  gcTime: 0,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData === undefined || loaderData.title.trim() === "" ? "Untitled board" : loaderData.title} · Admin`,
      },
    ],
  }),
  notFoundComponent: () => (
    <Notice
      title="No such board"
      actions={
        <Link to="/admin" className={buttonClass({ variant: "primary" })}>
          All boards
        </Link>
      }
    >
      It may have been deleted.
    </Notice>
  ),
  component: EditBoard,
});

function EditBoard() {
  const board = Route.useLoaderData();
  // A newer revision from the server (after "Load the latest version") restarts the editor.
  return <BoardEditor key={`${board.id}:${board.revision}`} board={board} />;
}
