import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AdminHeader } from "#/admin/AdminHeader";
import { BoardList } from "#/admin/BoardList";
import { listBoards } from "#/boards/functions";

const admin = getRouteApi("/admin");

export const Route = createFileRoute("/admin/")({
  loader: () => listBoards(),
  // Coming back from the editor must show what was just saved, not the list as it was before.
  gcTime: 0,
  component: Boards,
});

function Boards() {
  const { email } = admin.useLoaderData();
  return (
    <>
      <AdminHeader email={email} />
      <BoardList boards={Route.useLoaderData()} />
    </>
  );
}
