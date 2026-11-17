import { createFileRoute, Link } from "@tanstack/react-router";
import { getPlayableBoard } from "#/boards/functions";
import { PlayPage } from "#/play/PlayPage";
import { buttonClass } from "#/ui/Button";
import { Notice, PagePending } from "#/ui/RouteStates";

export const Route = createFileRoute("/play/$boardId")({
  // The game lives in this browser's storage, so only the browser can draw it. The board
  // itself still arrives with the page.
  ssr: "data-only",
  loader: ({ params }) => getPlayableBoard({ data: { id: params.boardId } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title:
          loaderData === undefined || loaderData.title.trim() === ""
            ? "Tubas games"
            : `${loaderData.title} · Tubas games`,
      },
    ],
  }),
  pendingComponent: PagePending,
  notFoundComponent: () => (
    <Notice
      title="No such board"
      actions={
        <Link to="/" className={buttonClass({ variant: "primary" })}>
          All boards
        </Link>
      }
    >
      It may have been taken down, or it isn't published yet.
    </Notice>
  ),
  component: Play,
});

function Play() {
  const board = Route.useLoaderData();
  // A different board is a different game: start from its own saved state.
  return <PlayPage key={board.id} board={board} />;
}
