import { createFileRoute, Link } from "@tanstack/react-router";
import { ROOM_CODE_PATTERN } from "#/buzzer/room";
import { PlayerPage } from "#/join/PlayerPage";
import { buttonClass } from "#/ui/Button";
import { Notice, PagePending } from "#/ui/RouteStates";

export const Route = createFileRoute("/join/$code")({
  // A buzzer is a live connection from this phone; there is nothing for the server to draw.
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `Game ${params.code.toUpperCase()} · Tubas games` },
      { name: "robots", content: "noindex" },
    ],
  }),
  pendingComponent: PagePending,
  component: Join,
});

function Join() {
  const code = Route.useParams().code.toUpperCase();
  if (!ROOM_CODE_PATTERN.test(code)) {
    return (
      <Notice
        title="That's not a game code"
        actions={
          <Link to="/join" className={buttonClass({ variant: "primary" })}>
            Enter a code
          </Link>
        }
      >
        A code is the four letters shown on the host's screen.
      </Notice>
    );
  }
  // A different code is a different room: start over rather than carry state across.
  return <PlayerPage key={code} code={code} />;
}
