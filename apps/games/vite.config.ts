import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

/** Build, dev and test config for Tubas games. Lint and format settings live in the root config. */
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
          cloudflare({ viteEnvironment: { name: "ssr" } }),
          tailwindcss(),
          tanstackStart(),
          viteReact(),
        ],
  ),
});

export default config;
