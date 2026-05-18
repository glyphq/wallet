import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "@/router";
import { useDeepLink } from "@/hooks/use-deep-link";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: true,
    },
  },
});

function GlobalListeners() {
  useDeepLink();
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobalListeners />
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
