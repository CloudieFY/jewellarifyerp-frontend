import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 mins cache for instant navigation
      gcTime: 1000 * 60 * 10, // Keep in memory for fast tab switching
      refetchOnWindowFocus: false, // Prevents layout flashes when switching browser windows
      retry: 1, // Single retry on network blips for fast feedback
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);