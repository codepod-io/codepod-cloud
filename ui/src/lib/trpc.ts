import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../api/src/routers";
import type { ContainerRouter } from "../../../container/src/routers";
import type { CopilotRouter } from "../../../copilot/src/routers";
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

export const copilotContext = createContext<QueryClient | undefined>(undefined);
export const copilotTrpc = createTRPCReact<CopilotRouter>({
  context: createContext(null),
  reactQueryContext: copilotContext,
});
