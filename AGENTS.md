# messi: the owner's personal website

This site represents its owner. **The owner makes every product decision; agents implement them.**
Read [docs/decisions/](docs/decisions/) before changing anything. Those decisions are binding.

## Decision boundary (read first)

| Agents decide alone                                                                                                                                           | Only the owner decides                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implementation that follows existing decisions and lint rules: structure, naming, refactors, tests, bug fixes, patch/minor dependency updates, new lint rules | Content and copy, visual design, layout, UX and behaviour, new pages or routes, new markdown components, new dependencies, architecture, hosting, cost, auth, storage, analytics, anything public-facing |

- When unsure, it is the owner's call. Use the `propose-decision` skill: lay out options, recommend one, and do not implement it until the owner chooses.
- Never edit `apps/*/content/`. That is the owner's own words, changed only through `/edit` or by the owner.
- Never invent a visual design. Design is explicitly pending (decision 0006).

<!-- intent-skills:start -->

# TanStack Intent - before editing files, run the matching guidance command.

tanstackIntent:

- id: "@tanstack/react-router#compositions/router-query"
  run: "pnpm exec intent load @tanstack/react-router#compositions/router-query"
  for: "Integrating TanStack Router with TanStack Query: queryClient in router context, static queries and fire-and-forget queries in loaders, useSuspenseQuery in components, defaultPreloadStaleTime: 0, setupRouterSsrQueryIntegration for SSR dehydration/hydration and streaming, per-request QueryClient isolation."
- id: "@tanstack/react-router#react-router"
  run: "pnpm exec intent load @tanstack/react-router#react-router"
  for: "React bindings for TanStack Router: RouterProvider, useRouter, useRouterState, useMatch, useMatches, useLocation, useSearch, useParams, useNavigate, useLoaderData, useLoaderDeps, useRouteContext, useBlocker, useCanGoBack, Link, Navigate, Outlet, CatchBoundary, ErrorComponent. React-specific patterns for hooks, providers, SSR hydration, and createLink with forwardRef."
- id: "@tanstack/react-start#react-start"
  run: "pnpm exec intent load @tanstack/react-start#react-start"
  for: "React bindings for TanStack Start: createStart, StartClient, StartServer, React-specific imports, re-exports from @tanstack/react-router, full project setup with React, useServerFn hook."
- id: "@tanstack/react-start#react-start/server-components"
  run: "pnpm exec intent load @tanstack/react-start#react-start/server-components"
  for: "Implement, review, debug, and refactor TanStack Start React Server Components in React 19 apps. Use when tasks mention @tanstack/react-start/rsc, renderServerComponent, createCompositeComponent, CompositeComponent, renderToReadableStream, createFromReadableStream, createFromFetch, Composite Components, React Flight streams, loader or query owned RSC caching, router.invalidate, structuralSharing: false, selective SSR, stale names like renderRsc or .validator, or migration from Next App Router RSC patterns. Do not use for generic SSR or non-TanStack RSC frameworks except brief comparison."
- id: "@tanstack/router-core#router-core"
  run: "pnpm exec intent load @tanstack/router-core#router-core"
  for: "Framework-agnostic core concepts for TanStack Router: route trees, createRouter, createRoute, createRootRoute, createRootRouteWithContext, addChildren, Register type declaration, route matching, route sorting, file naming conventions. Entry point for all router skills."
- id: "@tanstack/router-core#router-core/auth-and-guards"
  run: "pnpm exec intent load @tanstack/router-core#router-core/auth-and-guards"
  for: "Route protection with beforeLoad, redirect()/throw redirect(), isRedirect helper, authenticated layout routes (_authenticated), non-redirect auth (inline login), RBAC with roles and permissions, auth provider integration (Auth0, Clerk, Supabase), router context for auth state."
- id: "@tanstack/router-core#router-core/code-splitting"
  run: "pnpm exec intent load @tanstack/router-core#router-core/code-splitting"
  for: "Automatic code splitting (autoCodeSplitting), .lazy.tsx convention, createLazyFileRoute, createLazyRoute, lazyRouteComponent, getRouteApi for typed hooks in split files, codeSplitGroupings per-route override, splitBehavior programmatic config, critical vs non-critical properties."
- id: "@tanstack/router-core#router-core/data-loading"
  run: "pnpm exec intent load @tanstack/router-core#router-core/data-loading"
  for: "Route loader option, loaderDeps for cache keys, staleTime/gcTime/ defaultPreloadStaleTime SWR caching, pendingComponent/pendingMs/ pendingMinMs, errorComponent/onError/onCatch, beforeLoad, router context and createRootRouteWithContext DI pattern, router.invalidate, Await component, deferred data loading with unawaited promises."
- id: "@tanstack/router-core#router-core/navigation"
  run: "pnpm exec intent load @tanstack/router-core#router-core/navigation"
  for: "Link component, useNavigate, Navigate component, router.navigate, ToOptions/NavigateOptions/LinkOptions, from/to relative navigation, activeOptions/activeProps, preloading (intent/viewport/render), preloadDelay, navigation blocking (useBlocker, Block), createLink, linkOptions helper, scroll restoration, MatchRoute."
- id: "@tanstack/router-core#router-core/not-found-and-errors"
  run: "pnpm exec intent load @tanstack/router-core#router-core/not-found-and-errors"
  for: "notFound() function, notFoundComponent, defaultNotFoundComponent, notFoundMode (fuzzy/root), errorComponent, CatchBoundary, CatchNotFound, isNotFound, NotFoundRoute (deprecated), route masking (mask option, createRouteMask, unmaskOnReload)."
- id: "@tanstack/router-core#router-core/path-params"
  run: "pnpm exec intent load @tanstack/router-core#router-core/path-params"
  for: "Dynamic path segments ($paramName), splat routes ($ / _splat), optional params ({-$paramName}), prefix/suffix patterns ({$param}.ext), useParams, params.parse/stringify, pathParamsAllowedCharacters, i18n locale patterns."
- id: "@tanstack/router-core#router-core/search-params"
  run: "pnpm exec intent load @tanstack/router-core#router-core/search-params"
  for: "validateSearch, search param validation with Zod/Valibot/ArkType adapters, fallback(), search middlewares (retainSearchParams, stripSearchParams), custom serialization (parseSearch, stringifySearch), search param inheritance, loaderDeps for cache keys, reading and writing search params."
- id: "@tanstack/router-core#router-core/ssr"
  run: "pnpm exec intent load @tanstack/router-core#router-core/ssr"
  for: "Non-streaming and streaming SSR, RouterClient/RouterServer, renderRouterToString/renderRouterToStream, createRequestHandler, defaultRenderHandler/defaultStreamHandler, HeadContent/Scripts components, head route option (meta/links/styles/scripts), ScriptOnce, automatic loader dehydration/hydration, memory history on server, data serialization, document head management."
- id: "@tanstack/router-core#router-core/type-safety"
  run: "pnpm exec intent load @tanstack/router-core#router-core/type-safety"
  for: "Full type inference philosophy (never cast, never annotate inferred values), Register module declaration, from narrowing on hooks and Link, strict:false for shared components, getRouteApi for code-split typed access, addChildren with object syntax for TS perf, LinkProps and ValidateLinkOptions type utilities, as const satisfies pattern."
- id: "@tanstack/router-plugin#router-plugin"
  run: "pnpm exec intent load @tanstack/router-plugin#router-plugin"
  for: "TanStack Router bundler plugin for route generation and automatic code splitting. Supports Vite, Webpack, Rspack, and esbuild. Configures autoCodeSplitting, routesDirectory, target framework, and code split groupings."
- id: "@tanstack/start-client-core#start-core"
  run: "pnpm exec intent load @tanstack/start-client-core#start-core"
  for: "Core overview for TanStack Start: tanstackStart() Vite plugin, getRouter() factory, root route document shell (HeadContent, Scripts, Outlet), client/server entry points, routeTree.gen.ts, tsconfig configuration. Entry point for all Start skills."
- id: "@tanstack/start-client-core#start-core/auth-server-primitives"
  run: "pnpm exec intent load @tanstack/start-client-core#start-core/auth-server-primitives"
  for: "Server-side authentication primitives for TanStack Start: session cookies (HttpOnly, Secure, SameSite, __Host- prefix), session read/issue/destroy via createServerFn and middleware, OAuth authorization-code flow with state and PKCE, password-reset enumeration defense, CSRF for non-GET RPCs, rate limiting auth endpoints, session rotation on privilege change. Pairs with router-core/auth-and-guards for the routing side."
- id: "@tanstack/start-client-core#start-core/deployment"
  run: "pnpm exec intent load @tanstack/start-client-core#start-core/deployment"
  for: "Deploy to Cloudflare Workers, Netlify, Vercel, Node.js/Docker, Bun, Railway. Selective SSR (ssr option per route), SPA mode, static prerendering, ISR with Cache-Control headers, SEO and head management."
- id: "@tanstack/start-client-core#start-core/execution-model"
  run: "pnpm exec intent load @tanstack/start-client-core#start-core/execution-model"
  for: "Isomorphic-by-default principle, environment boundary functions (createServerFn, createServerOnlyFn, createClientOnlyFn, createIsomorphicFn), ClientOnly component, useHydrated hook, import protection, dead code elimination, environment variable safety (VITE_ prefix, process.env)."
- id: "@tanstack/start-client-core#start-core/middleware"
  run: "pnpm exec intent load @tanstack/start-client-core#start-core/middleware"
  for: "createMiddleware, request middleware (.server only), server function middleware (.client + .server), context passing via next({ context }), sendContext for client-server transfer, global middleware via createStart in src/start.ts, middleware factories, method order enforcement, fetch override precedence."
- id: "@tanstack/start-client-core#start-core/server-functions"
  run: "pnpm exec intent load @tanstack/start-client-core#start-core/server-functions"
  for: "createServerFn (GET/POST), validator (Zod or function), useServerFn hook, server context utilities (getRequest, getRequestHeader, setResponseHeader, setResponseStatus), error handling (throw errors, redirect, notFound), streaming, FormData handling, file organization (.functions.ts, .server.ts)."
- id: "@tanstack/start-client-core#start-core/server-routes"
  run: "pnpm exec intent load @tanstack/start-client-core#start-core/server-routes"
  for: "Server-side API endpoints using the server property on createFileRoute, HTTP method handlers (GET, POST, PUT, DELETE), createHandlers for per-handler middleware, handler context (request, params, context), request body parsing, response helpers, file naming for API routes."
- id: "@tanstack/start-server-core#start-server-core"
  run: "pnpm exec intent load @tanstack/start-server-core#start-server-core"
  for: "Server-side runtime for TanStack Start: createStartHandler, request/response utilities (getRequest, setResponseHeader, setCookie, getCookie, appendResponseHeader), three-phase request handling, AsyncLocalStorage context."

<!-- intent-skills:end -->

## Map

A pnpm workspace (decision 0009): apps in `apps/`, shared libraries in `packages/`, repo tooling in `tools/`. The root `vite.config.ts` owns lint, format, test and task settings for every package; each app's own `vite.config.ts` only builds that app.

| Path                        | What                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `apps/home/`                | The homepage app (`@messi/home`), a Cloudflare Worker.                                                            |
| `apps/home/content/home.md` | Homepage source. Owner only.                                                                                      |
| `apps/home/src/routes/`     | TanStack file routes. `/` is prerendered and ships no JavaScript; `/edit` is the editor.                          |
| `apps/home/src/content/`    | Markdown pipeline (`markdown.ts`), renderer (`Markdown.tsx`), component registry (`directives/`). Isomorphic.     |
| `apps/home/src/editor/`     | Editor UI and its server functions.                                                                               |
| `apps/home/src/server/`     | Effect services: `EditorAuth` (Cloudflare Access JWT), `ContentStore` (GitHub contents API), `runtime.server.ts`. |
| `apps/home/src/server.ts`   | Worker entry. Strips all JavaScript from pages whose route uses `headers: noJavaScript`.                          |
| `tools/lint/`               | Project oxlint rules (`messi.ts`) and their tests (`@messi/lint`).                                                |
| `docs/decisions/`           | Owner decisions (binding). `proposed/` holds open questions for the owner.                                        |
| `docs/patterns.md`          | Every codified right/wrong pattern and what enforces it.                                                          |
| `docs/setup.md`             | One-time Cloudflare, Access and GitHub setup.                                                                     |

## How saving works

`/edit` (behind Cloudflare Access) → `saveHome` validates with the same pipeline the build uses → commits `apps/home/content/home.md` through the GitHub API → the push to `main` runs `.github/workflows/deploy.yml` → prerender → Cloudflare. About 1–2 minutes.

## Engineering rules

- Use TanStack features before writing your own. Load the matching Intent skill above before touching TanStack code.
- Server logic is Effect: services and layers, `Schema` at every boundary, tagged errors. Idioms: `node_modules/effect/AGENTS.md`.
- Every `createServerFn` uses the `requireEditor` middleware or carries a `// public-server-fn: <reason>` comment (lint-enforced).
- The homepage ships zero JavaScript. Keep client-only code off it.
- Patterns: when you or a reviewer find a right or wrong way to do something, codify it with the `codify-pattern` skill. Lint rule if it can be checked mechanically, otherwise a review checklist entry.

## Workflow

- From the repo root: `vp install`, then `vp check` (format, lint, types), `vp test` (every package), `vp run -r build` (prerenders; fails on invalid content). `vp run ready` runs all three.
- One app: `vp -C apps/home <command>`, or `vp run @messi/home#<script>`. `vp run dev` starts the homepage.
- Run the `review` skill on your diff before handing off.
- Work on branches and open PRs. Never push to `main`: it is the owner's content channel and deploys on every push.
- CI fails PRs that touch `apps/*/content/` unless the owner labels them `content-approved`.

## Repo skills (`.agents/skills/`, also at `.claude/skills/`)

- `review`: review a diff against decisions, patterns and the decision boundary.
- `codify-pattern`: turn a found pattern into a lint rule or review check, and refine the review skill.
- `propose-decision`: escalate a product decision to the owner with options.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Running Scripts

Run TypeScript and JavaScript files with `vpx <file>`, for example `vpx ./scripts/seed.ts --dry-run`. It handles enums, decorators, JSX, and tsconfig `paths`, so do not add `tsx` or `ts-node` to run scripts. `vpx --watch <file>` reruns the file when a file it uses changes, in place of `tsx watch`. `vp node <file>` runs plain Node.js.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
