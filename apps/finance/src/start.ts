import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => ({
  // The Worker only sends the page shell; every page draws in the browser from data it
  // fetches through server functions. Rendering tables and charts of a year of
  // transactions on the server would not fit the 10 ms of CPU a request gets on the
  // Workers free plan (docs/decisions/0012-finance.md).
  defaultSsr: false,
  // Reject cross-site writes. Plain page loads stay open so links into the site keep working.
  requestMiddleware: [
    createCsrfMiddleware({
      filter: ({ request }) => request.method !== "GET" && request.method !== "HEAD",
    }),
  ],
}));
