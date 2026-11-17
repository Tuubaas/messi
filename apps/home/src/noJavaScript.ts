/** Response header marking a page to be served without any JavaScript (see src/server.ts). */
export const NO_JAVASCRIPT_HEADER = "x-messi-no-javascript";

/**
 * Route `headers` option for pages that ship as plain HTML and CSS only.
 * The homepage uses this to stay as light as possible (docs/decisions/0005).
 */
export const noJavaScript = () => ({ [NO_JAVASCRIPT_HEADER]: "1" });
