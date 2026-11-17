import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => ({
  // Reject cross-site writes. Plain page loads stay open so links into the site keep working.
  requestMiddleware: [
    createCsrfMiddleware({
      filter: ({ request }) => request.method !== "GET" && request.method !== "HEAD",
    }),
  ],
}));
