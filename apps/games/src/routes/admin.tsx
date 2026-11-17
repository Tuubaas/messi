import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { getEditor } from "#/boards/functions";
import { buttonClass } from "#/ui/Button";
import { Notice } from "#/ui/RouteStates";

/**
 * Everything under /admin. In production Cloudflare Access asks for a sign-in before the
 * page is even reached; the server functions check the same identity again on every call.
 */
export const Route = createFileRoute("/admin")({
  loader: () => getEditor(),
  head: () => ({
    meta: [{ title: "Admin · Tubas games" }, { name: "robots", content: "noindex" }],
  }),
  component: Admin,
  errorComponent: () => (
    <Notice
      title="The admin is locked"
      actions={
        <Link to="/" className={buttonClass({ variant: "primary" })}>
          Back to the boards
        </Link>
      }
    >
      Only the owner can make and edit boards. If that's you, sign in through Cloudflare Access and
      reload.
    </Notice>
  ),
});

function Admin() {
  return (
    <div className="stage min-h-dvh">
      <Outlet />
    </div>
  );
}
