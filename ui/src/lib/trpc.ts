import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/../../api/src/main/routers";
import type { RuntimeRouter } from "@/../../api/src/runtime/routers";
import type { CopilotRouter } from "@/../../api/src/copilot/routers";
import type { YjsRouter } from "@/../../api/src/yjs/routers";
import { createContext } from "react";
import { QueryClient } from "@tanstack/react-query";

export const trpc = createTRPCReact<AppRouter>();

// Use multiple trpc clients in the same app. Ref: https://github.com/trpc/trpc/pull/3049
export const runtimeContext = createContext<QueryClient | undefined>(undefined);
export const runtimeTrpc = createTRPCReact<RuntimeRouter>({
  context: createContext(null),
  reactQueryContext: runtimeContext,
});

export const copilotContext = createContext<QueryClient | undefined>(undefined);
export const copilotTrpc = createTRPCReact<CopilotRouter>({
  context: createContext(null),
  reactQueryContext: copilotContext,
});

// yjs trpc
export const yjsContext = createContext<QueryClient | undefined>(undefined);
export const yjsTrpc = createTRPCReact<YjsRouter>({
  context: createContext(null),
  reactQueryContext: yjsContext,
});
