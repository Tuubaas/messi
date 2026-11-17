import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

/** Pages rendered to static HTML at build time. Everything else is rendered by the Worker. */
const prerenderedPages = ["/"];

/** Build, dev and test config for the homepage app. Lint and format settings live in the root config. */
const config = defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
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
