import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

/** Build, dev and test config for the finance app. Lint and format settings live in the root config. */
const config = defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: { tsconfigPaths: true },
  // Known up front, so `vp dev` doesn't find them one page at a time and reload mid-visit.
  optimizeDeps: {
    include: ["@tanstack/react-query", "@tanstack/react-table", "papaparse", "recharts"],
  },
  plugins: lazyPlugins(() =>
    // Unit tests run in plain Node; the Worker and Start plugins are only for dev and build.
    process.env.VITEST
      ? [viteReact()]
      : [
          cloudflare({ viteEnvironment: { name: "ssr" } }),
          tailwindcss(),
          tanstackStart(),
          viteReact(),
        ],
  ),
});

export default config;
