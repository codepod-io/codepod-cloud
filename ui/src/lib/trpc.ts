import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../api/src/routers";
import type { ContainerRouter } from "../../../container/src/routers";
import { createContext } from "react";
import { QueryClient } from "@tanstack/react-query";

export const trpc = createTRPCReact<AppRouter>();

// Use multiple trpc clients in the same app. Ref: https://github.com/trpc/trpc/pull/3049
export const containerContext = createContext<QueryClient | undefined>(
  undefined
);
export const containerTrpc = createTRPCReact<ContainerRouter>({
  context: createContext(null),
  reactQueryContext: containerContext,
});
