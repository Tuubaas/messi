import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { NO_JAVASCRIPT_HEADER } from "./noJavaScript";

/**
 * Removes every script and script preload from the page, so the browser downloads
 * no JavaScript. TanStack Start has no per-route switch for this yet.
 */
const stripJavaScript = (response: Response) => {
  const headers = new Headers(response.headers);
  headers.delete(NO_JAVASCRIPT_HEADER);
  return new HTMLRewriter()
    .on("script", { element: (element) => void element.remove() })
    .on('link[rel="modulepreload"]', { element: (element) => void element.remove() })
    .transform(
      new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      }),
    );
};

export default createServerEntry({
  async fetch(request, options) {
    const response = await handler.fetch(request, options);
    return response.headers.has(NO_JAVASCRIPT_HEADER) ? stripJavaScript(response) : response;
  },
});
