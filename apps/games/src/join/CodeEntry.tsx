import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { ROOM_CODE_LENGTH, ROOM_CODE_PATTERN } from "#/buzzer/room";
import { Button } from "#/ui/Button";
import { Logo } from "#/ui/Logo";

/** Typing in the code from the big screen. Scanning its QR code skips this page. */
export function CodeEntry() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const complete = ROOM_CODE_PATTERN.test(code);

  const join = (event: FormEvent) => {
    event.preventDefault();
    if (complete) void navigate({ to: "/join/$code", params: { code } });
  };

  return (
    <div className="stage flex min-h-dvh flex-col">
      <header className="px-5 py-5">
        <Link to="/" className="rounded-full">
          <Logo className="text-xl" />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-24">
        <form onSubmit={join} className="animate-rise">
          <h1 className="semi-condensed text-5xl font-extrabold leading-none tracking-tight sm:text-6xl">
            Join a game
          </h1>
          <label htmlFor="code" className="mt-4 block text-lg text-ink-300">
            Type the four letters on the big screen.
          </label>
          <input
            id="code"
            value={code}
            onChange={(event) =>
              setCode(
                event.target.value
                  .toUpperCase()
                  .replaceAll(/[^A-Z]/g, "")
                  .slice(0, ROOM_CODE_LENGTH),
              )
            }
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="ABCD"
            aria-invalid={code.length === ROOM_CODE_LENGTH && !complete}
            className="field mt-6 h-24 text-center text-6xl font-extrabold tracking-[0.3em] text-brass-300 uppercase caret-brass-400 placeholder:text-ink-700"
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="mt-5 w-full"
            disabled={!complete}
          >
            Join
          </Button>
        </form>
      </main>
    </div>
  );
}
