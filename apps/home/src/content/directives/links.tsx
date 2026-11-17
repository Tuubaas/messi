import { Schema } from "effect";
import { defineDirective } from "./directive";

const pattern = (regExp: RegExp, expected: string) =>
  Schema.String.check(Schema.isPattern(regExp, { expected }));

const links = {
  github: {
    label: "GitHub",
    value: pattern(/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i, "a GitHub username"),
    href: (user: string) => `https://github.com/${user}`,
  },
  email: {
    label: "Email",
    value: pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "an email address"),
    href: (address: string) => `mailto:${address}`,
  },
  linkedin: {
    label: "LinkedIn",
    value: pattern(/^[\w-]{3,100}$/, "a LinkedIn profile handle"),
    href: (handle: string) => `https://www.linkedin.com/in/${handle}`,
  },
  x: {
    label: "X",
    value: pattern(/^\w{1,15}$/, "an X handle without @"),
    href: (handle: string) => `https://x.com/${handle}`,
  },
  bluesky: {
    label: "Bluesky",
    value: pattern(/^[a-z\d][a-z\d.-]*\.[a-z]{2,}$/i, "a Bluesky handle like name.bsky.social"),
    href: (handle: string) => `https://bsky.app/profile/${handle}`,
  },
  website: {
    label: "Website",
    value: pattern(/^https:\/\/\S+$/, "an https:// URL"),
    href: (url: string) => url,
  },
} as const;

type LinkKind = keyof typeof links;

const isLinkKind = (key: string): key is LinkKind => Object.hasOwn(links, key);

const LinksAttributes = Schema.Struct({
  github: Schema.optionalKey(links.github.value),
  email: Schema.optionalKey(links.email.value),
  linkedin: Schema.optionalKey(links.linkedin.value),
  x: Schema.optionalKey(links.x.value),
  bluesky: Schema.optionalKey(links.bluesky.value),
  website: Schema.optionalKey(links.website.value),
}).check(Schema.isMinProperties(1, { expected: "at least one link" }));

/**
 * `::links{github="you" email="you@example.com"}` renders a row of profile links,
 * in the order the attributes are written.
 */
export const linksDirective = defineDirective({
  kind: "leaf",
  attributes: LinksAttributes,
  Component: ({ attributes, raw }) => (
    <ul className="flex list-none flex-wrap gap-x-4 p-0">
      {Object.keys(raw)
        .filter(isLinkKind)
        .flatMap((kind) => {
          const value = attributes[kind];
          return value === undefined
            ? []
            : [
                <li key={kind}>
                  <a href={links[kind].href(value)} rel="me">
                    {links[kind].label}
                  </a>
                </li>,
              ];
        })}
    </ul>
  ),
});
