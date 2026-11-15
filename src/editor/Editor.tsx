import { useServerFn } from "@tanstack/react-start";
import { Effect, Result } from "effect";
import { useDeferredValue, useMemo, useState } from "react";
import { Markdown } from "#/content/Markdown";
import { renderMarkdown } from "#/content/markdown";
import { type SaveHomeResult, saveHome } from "./functions";

type SaveState =
  | { readonly _tag: "Idle" }
  | { readonly _tag: "Saving" }
  | { readonly _tag: "Failed" }
  | SaveHomeResult;

const statusText = (state: SaveState) => {
  switch (state._tag) {
    case "Idle":
      return "";
    case "Saving":
      return "Saving…";
    case "Saved":
      return "Saved. The homepage rebuilds and goes live in about 1–2 minutes.";
    case "Conflict":
      return "The page changed since you opened the editor (maybe edited on GitHub). Copy your text, reload, and re-apply it.";
    case "Invalid":
      return "Not saved: the content has errors.";
    case "Failed":
      return "Not saved: something went wrong. Try again.";
  }
};

export function Editor({
  initial,
}: {
  readonly initial: { readonly markdown: string; readonly revision: string };
}) {
  const [markdown, setMarkdown] = useState(initial.markdown);
  const [saved, setSaved] = useState(initial);
  const [state, setState] = useState<SaveState>({ _tag: "Idle" });
  const save = useServerFn(saveHome);

  const deferredMarkdown = useDeferredValue(markdown);
  const preview = useMemo(
    () => Effect.runSync(Effect.result(renderMarkdown(deferredMarkdown))),
    [deferredMarkdown],
  );

  const onSave = async () => {
    setState({ _tag: "Saving" });
    try {
      const result = await save({ data: { markdown, revision: saved.revision } });
      if (result._tag === "Saved") setSaved({ markdown, revision: result.revision });
      setState(result);
    } catch {
      setState({ _tag: "Failed" });
    }
  };

  const canSave =
    markdown !== saved.markdown && state._tag !== "Saving" && Result.isSuccess(preview);

  return (
    <main className="grid gap-4 p-4 md:grid-cols-2">
      <textarea
        aria-label="Markdown"
        className="min-h-[80vh] w-full font-mono"
        value={markdown}
        onChange={(event) => setMarkdown(event.target.value)}
      />
      <section aria-label="Preview">
        {Result.isSuccess(preview) ? (
          <Markdown tree={preview.success.tree} />
        ) : (
          <ul>
            {preview.failure.issues.map((issue) => (
              <li key={`${issue.line ?? ""}:${issue.message}`}>
                {issue.line === undefined ? "" : `Line ${issue.line}: `}
                {issue.message}
              </li>
            ))}
          </ul>
        )}
      </section>
      <div>
        <button type="button" disabled={!canSave} onClick={onSave}>
          Save
        </button>{" "}
        <span role="status">{statusText(state)}</span>
        {state._tag === "Saved" && state.commitUrl !== undefined ? (
          <>
            {" "}
            <a href={state.commitUrl}>View commit</a>
          </>
        ) : null}
      </div>
    </main>
  );
}
