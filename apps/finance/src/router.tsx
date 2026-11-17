import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { notifyError } from "./ui/notices";
import { NotFoundPage, PagePending, RouteError } from "./ui/RouteStates";

export function getRouter() {
  // One per router: on the server that is one per request, so nothing leaks between them.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
    // Every failed change tells the person, whichever screen made it.
    mutationCache: new MutationCache({ onError: notifyError }),
  });

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    // TanStack Query decides what is fresh, not the router's own preload cache.
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFoundPage,
    defaultErrorComponent: RouteError,
    defaultPendingComponent: PagePending,
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
