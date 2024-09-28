import React, { useState, useContext, useEffect, createContext } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";

import {
  runtimeContext,
  runtimeTrpc,
  copilotContext,
  copilotTrpc,
  trpc,
  yjsTrpc,
  yjsContext,
} from "@/lib/trpc";

function RuntimeTrpcProvider({ children }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  });
  const trpcClient = runtimeTrpc.createClient({
    links: [
      httpBatchLink({
        url: "/runtime",
      }),
    ],
  });
  return (
    <runtimeTrpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient} context={runtimeContext}>
        {children}
      </QueryClientProvider>
    </runtimeTrpc.Provider>
  );
}

function CopilotTrpcProvider({ children }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  });
  const trpcClient = copilotTrpc.createClient({
    links: [
      httpBatchLink({
        url: "/copilot",
      }),
    ],
  });
  return (
    <copilotTrpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient} context={copilotContext}>
        {children}
      </QueryClientProvider>
    </copilotTrpc.Provider>
  );
}

function YjsTrpcProvider({ children }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  });
  const trpcClient = yjsTrpc.createClient({
    links: [
      httpBatchLink({
        url: "/yjs",
      }),
    ],
  });
  return (
    <yjsTrpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient} context={yjsContext}>
        {children}
      </QueryClientProvider>
    </yjsTrpc.Provider>
  );
}

export function TrpcProvider({ children }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Do not refetch queries when window is re-focused.
        // https://github.com/TanStack/query/issues/273
        refetchOnWindowFocus: false,
      },
    },
  });
  const trpcClient = trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api",
      }),
    ],
  });

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RuntimeTrpcProvider>
          <CopilotTrpcProvider>
            <YjsTrpcProvider>{children}</YjsTrpcProvider>
          </CopilotTrpcProvider>
        </RuntimeTrpcProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
