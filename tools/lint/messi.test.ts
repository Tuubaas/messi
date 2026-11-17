import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import plugin from "./messi";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester();
const rules = plugin.rules;
if (rules === undefined) throw new Error("plugin has no rules");

tester.run("server-fn-guard", rules["server-fn-guard"], {
  valid: [
    {
      code: "export const f = createServerFn().middleware([requireEditor]).handler(() => 1);",
      options: [{ guards: ["requireEditor"] }],
    },
    {
      code: "// public-server-fn: renders the public homepage\nexport const f = createServerFn().handler(() => 1);",
      options: [{ guards: ["requireEditor"] }],
    },
    "const other = createSomethingElse().handler(() => 1);",
  ],
  invalid: [
    {
      code: "export const f = createServerFn().handler(() => 1);",
      options: [{ guards: ["requireEditor"] }],
      errors: [{ messageId: "unguarded" }],
    },
    {
      code: "export const f = createServerFn().middleware([logger]).handler(() => 1);",
      options: [{ guards: ["requireEditor"] }],
      errors: [{ messageId: "unguarded" }],
    },
    {
      code: "// public-server-fn:\nexport const f = createServerFn().handler(() => 1);",
      options: [{ guards: ["requireEditor"] }],
      errors: [{ messageId: "unguarded" }],
    },
  ],
});

tester.run("server-fn-post-validator", rules["server-fn-post-validator"], {
  valid: [
    'createServerFn({ method: "POST" }).validator(schema).handler(() => 1);',
    "createServerFn().handler(() => 1);",
  ],
  invalid: [
    {
      code: 'createServerFn({ method: "POST" }).middleware([requireEditor]).handler(() => 1);',
      errors: [{ messageId: "missing" }],
    },
  ],
});
