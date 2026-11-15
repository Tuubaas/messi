import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

/** Pages rendered to static HTML at build time. Everything else is rendered by the Worker. */
const prerenderedPages = ["/"];

const config = defineConfig({
  fmt: {
    ignorePatterns: ["src/routeTree.gen.ts", "worker-configuration.d.ts"],
  },
  lint: {
    ignorePatterns: ["src/routeTree.gen.ts", "worker-configuration.d.ts"],
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react", "import", "node", "vitest"],
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      { name: "messi", specifier: "./lint/messi.ts" },
    ],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "messi/server-fn-guard": ["error", { guards: ["requireEditor"] }],
      "messi/server-fn-post-validator": "error",
      "node/no-process-env": "error",
      "typescript/no-explicit-any": "error",
    },
    overrides: [
      // Build tooling runs in Node, not the Worker, so process.env is fine there.
      {
        files: ["vite.config.ts", "lint/**", "scripts/**"],
        rules: { "node/no-process-env": "off" },
      },
    ],
    options: { typeAware: true, typeCheck: true },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "lint/**/*.test.ts"],
  },
  resolve: { tsconfigPaths: true },
  plugins: lazyPlugins(() =>
    // Unit tests run in plain Node; the Worker and Start plugins are only for dev and build.
    process.env.VITEST
      ? [viteReact()]
      : [
          devtools(),
          cloudflare({ viteEnvironment: { name: "ssr" } }),
          tailwindcss(),
          tanstackStart({
            pages: prerenderedPages.map((path) => ({ path })),
            prerender: {
              enabled: true,
              autoStaticPathsDiscovery: false,
              crawlLinks: false,
              failOnError: true,
            },
          }),
          viteReact(),
        ],
  ),
});

export default config;
