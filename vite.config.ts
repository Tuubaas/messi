import { defineConfig } from "vite-plus";

const generated = ["**/routeTree.gen.ts", "**/worker-configuration.d.ts"];

/**
 * Workspace root: lint, format, test and task settings for every package.
 * Build and dev config lives in each app's own vite.config.ts.
 */
const config = defineConfig({
  fmt: {
    ignorePatterns: generated,
  },
  lint: {
    ignorePatterns: generated,
    plugins: ["eslint", "typescript", "unicorn", "oxc", "react", "import", "node", "vitest"],
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      { name: "messi", specifier: "./tools/lint/messi.ts" },
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
        files: ["**/vite.config.ts", "tools/**"],
        rules: { "node/no-process-env": "off" },
      },
    ],
    options: { typeAware: true, typeCheck: true },
  },
  // `vp test` at the root runs every package's tests with that package's own config.
  test: {
    projects: ["apps/*", "tools/*"],
  },
  run: {
    cache: true,
  },
});

export default config;
