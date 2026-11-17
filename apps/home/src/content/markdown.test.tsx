import { Effect, Exit } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { Markdown } from "./Markdown";
import { ContentInvalid, renderMarkdown } from "./pipeline";

const render = (markdown: string) => Effect.runSync(renderMarkdown(markdown));
const html = (markdown: string) => renderToStaticMarkup(<Markdown tree={render(markdown).tree} />);
const issues = (markdown: string) => {
  const exit = Effect.runSyncExit(renderMarkdown(markdown));
  if (Exit.isSuccess(exit)) throw new Error("expected invalid content");
  const error = exit.cause.reasons[0];
  if (error?._tag !== "Fail" || !(error.error instanceof ContentInvalid))
    throw new Error("unexpected failure");
  return error.error.issues.map((issue) => issue.message);
};

describe("renderMarkdown", () => {
  it("renders GitHub-flavored markdown", () => {
    expect(html("# Hi\n\n~~old~~ *new*")).toBe("<h1>Hi</h1>\n<p><del>old</del> <em>new</em></p>");
  });

  it("uses the first h1 as title", () => {
    expect(render("intro\n\n# Name\n\n# Other").title).toBe("Name");
    expect(render("## Only h2").title).toBeUndefined();
  });

  it("drops raw HTML", () => {
    expect(html("<script>alert(1)</script>\n\nok")).toBe("<p>ok</p>");
  });

  it("restores unknown text directives as prose", () => {
    expect(html("ratio 16:9 and note:this")).toBe("<p>ratio 16:9 and note:this</p>");
  });

  it("rejects unknown block components", () => {
    expect(issues('::nope{a="b"}')).toEqual(['Unknown component "nope".']);
  });

  it("rejects a component written with the wrong directive kind", () => {
    expect(issues(':::links{github="x"}\n:::')).toEqual([
      'Component "links" must be written as a leaf directive.',
    ]);
  });
});

describe("links component", () => {
  it("renders links in the author's order", () => {
    expect(html('::links{email="me@example.com" github="octocat"}')).toBe(
      '<ul class="flex list-none flex-wrap gap-x-4 p-0">' +
        '<li><a href="mailto:me@example.com" rel="me">Email</a></li>' +
        '<li><a href="https://github.com/octocat" rel="me">GitHub</a></li></ul>',
    );
  });

  it("rejects unknown attributes, bad values, and empty rows", () => {
    expect(issues('::links{githb="octocat"}')[0]).toContain("githb");
    expect(issues('::links{website="http://insecure.example"}')[0]).toContain("https:// URL");
    expect(issues("::links")[0]).toContain("at least one link");
  });
});
